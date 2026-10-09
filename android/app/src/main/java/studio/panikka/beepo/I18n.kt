package studio.panikka.beepo

import android.content.res.AssetManager
import studio.panikka.beepo.core.fillTemplate
import studio.panikka.beepo.core.resolveLang
import org.json.JSONObject
import java.util.Locale
import kotlin.random.Random

/** data/i18n/<lang>.json merged over English, section by section (like the extension's `assets.i18n`). */
class I18n(private val sections: Map<String, Map<String, Any>>, val lang: String) {
    val rtl get() = string("dir") == "rtl"

    fun string(key: String) = sections[""]?.get(key) as? String

    fun get(section: String, key: String) = sections[section]?.get(key) as? String ?: key

    /** A `ui` string (shared with the extension), with {var}s filled in. */
    fun t(key: String, vararg vars: Pair<String, Any?>) = fillTemplate(get("ui", key), vars.toMap())

    /** An Android-only string, with {var}s filled in. */
    fun android(key: String, vararg vars: Pair<String, Any?>) = fillTemplate(get("android", key), vars.toMap())

    /** Locale for dates (weekday names in the report). */
    val locale: Locale get() = Locale.forLanguageTag(string("locale") ?: "en")

    fun badgeName(id: String) = (sections["badges"]?.get(id) as? JSONObject)?.optString("name") ?: id

    fun badgeDesc(id: String) = (sections["badges"]?.get(id) as? JSONObject)?.optString("desc").orEmpty()

    /**
     * One of Beepo's lines for a message pool (`messages.<key>`), picked at random, plus the mood
     * to show with it. Null if the pool doesn't exist.
     */
    fun line(key: String, vars: Map<String, Any?> = emptyMap(), random: Random = Random.Default): Pair<String, String>? {
        val pool = sections["messages"]?.get(key) as? JSONObject ?: return null
        val lines = pool.optJSONArray("lines") ?: return null
        if (lines.length() == 0) return null
        return fillTemplate(lines.getString(random.nextInt(lines.length())), vars) to pool.optString("mood", "happy")
    }

    /** Beepo's line for queued news or a nudge; badge / evolve ids become names in this language. */
    fun news(key: String, vars: Map<String, String>): Pair<String, String>? {
        val all = vars.toMutableMap<String, Any?>()
        vars["id"]?.let { all["name"] = if (key == "badge") badgeName(it) else get("evolve", it) }
        return line(key, all)
    }

    /** "12 min", or seconds under a minute (so "0 min over" never happens), like the page bubble. */
    fun minutes(secs: Long): String {
        val s = maxOf(0L, secs)
        return if (s in 1..59) t("sec", "n" to s) else t("min", "n" to Math.round(s / 60.0))
    }

    /** "42m" or "1h 5m", like the popup. */
    fun duration(secs: Long): String {
        val m = Math.round(secs / 60.0)
        return if (m >= 60) t("hm", "h" to m / 60, "m" to m % 60) else t("m", "m" to m)
    }

    companion object {
        fun load(assets: AssetManager, pref: String = "auto", locale: Locale = Locale.getDefault()): I18n {
            val lang = resolveLang(pref, uiLang(locale))
            val read = { l: String -> JSONObject(assets.open("i18n/$l.json").bufferedReader().use { it.readText() }) }
            val en = sections(read("en"))
            val local = if (lang == "en") emptyMap() else sections(read(lang))
            val merged = (en.keys + local.keys).associateWith { en[it].orEmpty() + local[it].orEmpty() }.toMutableMap()
            // Pools whose lines talk about pages and tabs have app versions.
            merged["messages"] = merged["messages"].orEmpty() + merged["appMessages"].orEmpty()
            return I18n(merged, lang)
        }

        private fun uiLang(l: Locale) =
            if (l.script == "Hant" && l.country.isEmpty()) "${l.language}-Hant" else "${l.language}-${l.country}"

        /** Top-level strings go in section "", objects become their own sections. */
        private fun sections(o: JSONObject): Map<String, Map<String, Any>> {
            val top = mutableMapOf<String, Any>()
            val out = mutableMapOf<String, Map<String, Any>>("" to top)
            for (k in o.keys()) {
                val v = o.get(k)
                if (v is JSONObject) out[k] = v.keys().asSequence().associateWith { v.get(it) } else top[k] = v
            }
            return out
        }
    }
}
