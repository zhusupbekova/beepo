package studio.panikka.beepo.core

import studio.panikka.beepo.sprite.Evolve
import kotlinx.serialization.Serializable

// What background.js does around core.js, for Android: day rollover (history, stars, streak /
// evolve / badge news) and today's usage. Pure, so it's unit-tested; Store owns the files.

/** Queued Beepo news, shown once. Holds ids (badge / evolve), so it renders in the current language. */
@Serializable
data class News(val key: String, val vars: Map<String, String> = emptyMap())

data class State(
    val rules: List<Rule> = emptyList(),
    val settings: Settings = Settings(),
    val wallet: Wallet = Wallet(),
    val day: Day? = null,
    val history: List<HistoryEntry> = emptyList(),
    val pending: List<News> = emptyList(),
)

/** How many missed days are rebuilt from the system usage log (it only keeps about a week). */
const val BACKFILL_DAYS = 7
const val PENDING_MAX = 5

private fun Wallet.award(n: Int) = copy(stars = stars + n, earned = earned + n)

/** Awards every badge now earned (a badge's stars can unlock "first star", hence the loop). */
fun checkBadges(st: State, today: String, s: Streaks = streaks(st.history, today)): State {
    var wallet = st.wallet
    val news = st.pending.toMutableList()
    while (true) {
        val fresh = newBadges(BadgeContext(wallet, st.history, today, s.limitStreak, s.goalStreak))
        if (fresh.isEmpty()) break
        for (b in fresh) {
            wallet = wallet.copy(badges = wallet.badges + b.id).award(BADGE_REWARD)
            news += News("badge", mapOf("id" to b.id))
        }
    }
    return st.copy(wallet = wallet, pending = news)
}

/**
 * Moves `st` to `today`. The stored day and any days after it that the phone was used (per
 * `usageFor`: seconds per package, or null without usage access) are finalized in order, each
 * awarding a star per kept limit plus streak / evolve / badge news. Days without use stay gaps,
 * like days the browser wasn't opened.
 */
fun rollover(st: State, today: String, evolveDefs: List<Evolve>, usageFor: (String) -> Map<String, Long>?): State {
    val prev = st.day
    if (prev == null) return st.copy(day = newDay(today))
    if (prev.date >= today) return st

    var cur = st
    val keys = generateSequence(prev.date) { addDays(it, 1) }.takeWhile { it < today }.toList()
    for (key in keys.takeLast(BACKFILL_DAYS)) {
        val secs = usageFor(key)
        if (key != prev.date && secs.isNullOrEmpty()) continue
        // The stored day keeps its counters if the log has nothing (no access, or it expired).
        val base = if (key == prev.date) prev else newDay(key)
        cur = finishDay(cur, if (!secs.isNullOrEmpty()) dayUsage(base, secs, cur.rules) else base, addDays(key, 1), evolveDefs)
    }
    return cur.copy(day = newDay(today), pending = cur.pending.takeLast(PENDING_MAX))
}

private fun finishDay(st: State, day: Day, next: String, evolveDefs: List<Evolve>): State {
    val before = evolution(evolveDefs, streaks(st.history, day.date))
    val entry = finalizeDay(day, st.rules)
    val history = (st.history.filter { it.date != entry.date } + entry).sortedBy { it.date }.takeLast(HISTORY_DAYS)
    var wallet = st.wallet
    val news = st.pending.toMutableList()

    val kept = entry.results.orEmpty().values.count { it.mode == Mode.LIMIT && it.ok }
    if (kept > 0) {
        wallet = wallet.award(kept)
        news += News("kept", mapOf("n" to "$kept"))
    }
    val s = streaks(history, next)
    val best = maxOf(s.limitStreak, s.goalStreak)
    if (best >= 2) news += News("streak", mapOf("n" to "$best"))

    val after = evolution(evolveDefs, s)
    for (e in evolveDefs) {
        val was = if (e.grow > 0) before.grow > 0 else e.id in before.evolve
        val now = if (e.grow > 0) after.grow > 0 else e.id in after.evolve
        if (now && !was) news += News("evolve", mapOf("id" to e.id))
    }
    return checkBadges(st.copy(history = history, wallet = wallet, pending = news), next, s)
}

/**
 * Today's usage from the system log (seconds per package). Goals reached award their star once,
 * like the extension's goal100 milestone; the other milestones are nudges, which need the overlay.
 */
fun applyUsage(st: State, appSecs: Map<String, Long>): State {
    val day = dayUsage(st.day ?: return st, appSecs, st.rules)
    val notified = day.notified.toMutableMap()
    var cur = st.copy(day = day)
    for (rule in st.rules.filter { it.mode == Mode.GOAL }) {
        val keys = notified[rule.id].orEmpty().toMutableList()
        val event = milestone(rule.mode, day.usage[rule.id] ?: 0, baseLimitSecs(rule, day.date), notified = keys)
        notified[rule.id] = keys
        if (event == "goal100") {
            cur = cur.copy(wallet = cur.wallet.award(1).let { it.copy(goalsMet = it.goalsMet + 1) })
            cur = checkBadges(cur, day.date)
        }
    }
    return cur.copy(day = cur.day!!.copy(notified = notified))
}
