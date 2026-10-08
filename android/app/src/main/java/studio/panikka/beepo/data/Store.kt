package studio.panikka.beepo.data

import android.content.Context
import android.util.AtomicFile
import studio.panikka.beepo.core.Day
import studio.panikka.beepo.core.HISTORY_DAYS
import studio.panikka.beepo.core.HistoryEntry
import studio.panikka.beepo.core.News
import studio.panikka.beepo.core.Rule
import studio.panikka.beepo.core.Settings
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.Wallet
import studio.panikka.beepo.core.addDays
import studio.panikka.beepo.core.applyUsage
import studio.panikka.beepo.core.checkBadges
import studio.panikka.beepo.core.dateKey
import studio.panikka.beepo.core.dayStart
import studio.panikka.beepo.core.dayUsage
import studio.panikka.beepo.core.revealSeasonal
import studio.panikka.beepo.core.rollover
import studio.panikka.beepo.sprite.Sprites
import studio.panikka.beepo.usage.UsageAccess
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * The single owner of Beepo's data (what background.js is in the extension). JSON files in
 * filesDir, same shapes as the extension's storage: rules, settings, wallet, day, history, pending.
 * Every change goes through a synchronized method; screens read [state] and call these.
 */
class Store private constructor(private val context: Context) {
    val sprites: Sprites = Sprites.parse(context.assets.open("sprites.json").bufferedReader().use { it.readText() })

    private val dir = context.filesDir
    private val rulesFile = file("rules.json", ListSerializer(Rule.serializer()))
    private val settingsFile = file("settings.json", Settings.serializer())
    private val walletFile = file("wallet.json", Wallet.serializer())
    private val dayFile = file("day.json", Day.serializer())
    private val historyFile = file("history.json", ListSerializer(HistoryEntry.serializer()))
    private val pendingFile = file("pending.json", ListSerializer(News.serializer()))

    private val _state = MutableStateFlow(
        State(
            rules = rulesFile.read() ?: emptyList(),
            settings = settingsFile.read() ?: Settings(),
            wallet = walletFile.read() ?: Wallet(),
            day = dayFile.read(),
            history = historyFile.read() ?: emptyList(),
            pending = pendingFile.read() ?: emptyList(),
        ),
    )
    val state: StateFlow<State> = _state

    private val _plus = MutableStateFlow(false)

    /** Beepo Plus is active (set from RevenueCat by [Plus]). Plus items count as owned while it is. */
    val plus: StateFlow<Boolean> = _plus

    fun owns(itemId: String) = itemId in _state.value.wallet.owned || (_plus.value && sprites.items[itemId]?.plus == true)

    /** RevenueCat's answer; if Plus is gone (refund), Plus items come off. */
    @Synchronized
    fun setPlus(active: Boolean) {
        _plus.value = active
        if (active) return
        val e = _state.value.wallet.equipped
        e.toMap().forEach { (slot, id) -> if (sprites.items[id]?.plus == true && !owns(id)) equip(slot, null) }
    }

    /**
     * Rolls the day over if needed, then rebuilds today's usage from the system log. Call on
     * resume and periodically; it reads the log, so not on the main thread.
     */
    @Synchronized
    fun refresh(now: Long = System.currentTimeMillis()) {
        val st = _state.value
        val resetHour = st.settings.resetHour
        val today = dateKey(now, resetHour)
        val granted = UsageAccess.granted(context)
        fun secs(start: Long, end: Long) = UsageAccess.foreground(context, start, end).mapValues { it.value / 1000 }

        var next = rollover(st, today, sprites.evolve) { key ->
            if (granted) secs(dayStart(key, resetHour), dayStart(addDays(key, 1), resetHour)) else null
        }
        if (granted) next = applyUsage(next, secs(dayStart(today, resetHour), now))
        val seen = revealSeasonal(sprites.seasons, today, next.wallet.seen)
        if (seen !== next.wallet.seen) next = next.copy(wallet = next.wallet.copy(seen = seen))
        save(next)
    }

    /** Today's per-rule totals follow right away (per-app seconds are already known). */
    @Synchronized
    fun setRules(rules: List<Rule>) {
        val st = _state.value
        save(st.copy(rules = rules, day = st.day?.let { dayUsage(it, it.domains, rules) }))
    }

    @Synchronized
    fun setSettings(settings: Settings) = save(_state.value.copy(settings = settings))

    /** End of the intro: adds the picked rules and doesn't show it again. */
    @Synchronized
    fun finishOnboarding(rules: List<Rule>) {
        setRules(_state.value.rules + rules)
        setSettings(_state.value.settings.copy(onboarded = true))
    }

    /** News has been shown. */
    @Synchronized
    fun clearNews() = save(_state.value.copy(pending = emptyList()))

    /** Buys and wears a shop item. Stars are only spent, never taken. */
    @Synchronized
    fun buy(itemId: String): Boolean {
        val st = _state.value
        val item = sprites.items[itemId] ?: return false
        val w = st.wallet
        if (item.plus || itemId in w.owned || (item.season != null && itemId !in w.seen) || w.stars < item.price) return false
        val bought = st.copy(wallet = w.copy(stars = w.stars - item.price, owned = w.owned + itemId))
        save(checkBadges(bought, bought.day?.date ?: dateKey(System.currentTimeMillis(), st.settings.resetHour)))
        equip(item.slot, itemId)
        return true
    }

    /** Wears an owned item, or takes the slot off (`itemId` null; colors go back to blue). */
    @Synchronized
    fun equip(slot: String, itemId: String?) {
        val st = _state.value
        if (itemId != null && !owns(itemId)) return
        val e = st.wallet.equipped
        val equipped = when (slot) {
            "color" -> e.copy(color = itemId ?: "color-blue")
            "hat" -> e.copy(hat = itemId)
            "antenna" -> e.copy(antenna = itemId)
            "accessory" -> e.copy(accessory = itemId)
            "pet" -> e.copy(pet = itemId)
            else -> return
        }
        save(st.copy(wallet = st.wallet.copy(equipped = equipped)))
    }

    /** Writes only what changed. */
    private fun save(next: State) {
        val prev = _state.value
        if (next.rules != prev.rules) rulesFile.write(next.rules)
        if (next.settings != prev.settings) settingsFile.write(next.settings)
        if (next.wallet != prev.wallet) walletFile.write(next.wallet)
        if (next.day != prev.day) next.day?.let { dayFile.write(it) }
        if (next.history != prev.history) historyFile.write(next.history.takeLast(HISTORY_DAYS))
        if (next.pending != prev.pending) pendingFile.write(next.pending)
        _state.value = next
    }

    private fun <T> file(name: String, serializer: KSerializer<T>) = JsonFile(AtomicFile(File(dir, name)), serializer)

    private class JsonFile<T>(private val file: AtomicFile, private val serializer: KSerializer<T>) {
        fun read(): T? = runCatching { json.decodeFromString(serializer, file.readFully().decodeToString()) }.getOrNull()

        fun write(value: T) {
            val out = file.startWrite()
            try {
                out.write(json.encodeToString(serializer, value).toByteArray())
                file.finishWrite(out)
            } catch (e: Exception) {
                file.failWrite(out)
                throw e
            }
        }
    }

    companion object {
        val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }

        @Volatile private var instance: Store? = null

        fun get(context: Context) = instance ?: synchronized(this) {
            instance ?: Store(context.applicationContext).also { instance = it }
        }
    }
}
