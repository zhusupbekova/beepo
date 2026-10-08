package studio.panikka.beepo.core

import studio.panikka.beepo.sprite.Evolve
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

// Port of extension/lib/core.js, checked against tests/fixtures/core-cases.json (`npm run fixtures`).
// Pure logic only: no Android APIs, so it runs in plain JVM tests.
// Not ported: URL matching (Android matches app packages instead) and the v0.1 migrations.

/** App languages (data/i18n/<key>.json), by native name. */
val LANGUAGES = linkedMapOf(
    "en" to "English",
    "es" to "Español",
    "fr" to "Français",
    "de" to "Deutsch",
    "it" to "Italiano",
    "pt_BR" to "Português (Brasil)",
    "ru" to "Русский",
    "uk" to "Українська",
    "tr" to "Türkçe",
    "ar" to "العربية",
    "hi" to "हिन्दी",
    "id" to "Bahasa Indonesia",
    "ja" to "日本語",
    "ko" to "한국어",
    "zh_CN" to "简体中文",
    "zh_TW" to "繁體中文（台灣）",
    "yue" to "粵語（香港）",
)

/** Picks the app language from the setting, falling back to the system UI language. */
fun resolveLang(pref: String?, uiLang: String = "en"): String {
    if (pref != null && pref != "auto" && pref in LANGUAGES) return pref
    val parts = uiLang.replaceFirst('_', '-').split('-')
    val b = parts[0].lowercase()
    val r = parts.getOrElse(1) { "" }.uppercase()
    if (b == "yue" || (b == "zh" && (r == "HK" || r == "MO"))) return "yue"
    if (b == "zh") return if (r == "TW" || uiLang.contains("hant", ignoreCase = true)) "zh_TW" else "zh_CN"
    if (b == "pt") return "pt_BR"
    return if (b in LANGUAGES) b else "en"
}

const val SNOOZE_SECS = 5 * 60
const val UNLOCK_SECS = 5 * 60
const val UNLOCK_COST = 1
const val BADGE_REWARD = 3
const val HISTORY_DAYS = 60

// ---------- dates ----------

private fun local(now: Long, zone: ZoneId): ZonedDateTime = Instant.ofEpochMilli(now).atZone(zone)

/** Local date key (YYYY-MM-DD) for `now`, where the day starts at `resetHour`. */
fun dateKey(now: Long, resetHour: Int = 0, zone: ZoneId = ZoneId.systemDefault()): String =
    local(now - resetHour * 3_600_000L, zone).toLocalDate().toString()

fun addDays(key: String, n: Int): String = LocalDate.parse(key).plusDays(n.toLong()).toString()

fun isWeekend(key: String) = LocalDate.parse(key).dayOfWeek.let { it == DayOfWeek.SATURDAY || it == DayOfWeek.SUNDAY }

/** When the day `key` starts (epoch ms): `resetHour` o'clock local time on that date. */
fun dayStart(key: String, resetHour: Int = 0, zone: ZoneId = ZoneId.systemDefault()): Long =
    LocalDate.parse(key).atTime(resetHour, 0).atZone(zone).toInstant().toEpochMilli()

/** Whether `key` (YYYY-MM-DD) is in `season` ["MM-DD", "MM-DD"], both ends included; may wrap the new year. */
fun inSeason(season: List<String>, key: String): Boolean {
    val (from, to) = season
    val md = key.substring(5)
    return if (from <= to) md in from..to else md >= from || md <= to
}

/** `seen` plus the seasonal items (`seasons`: id → season) in season on `key`. Once seen, always in the shop. */
fun revealSeasonal(seasons: Map<String, List<String>>, key: String, seen: List<String> = emptyList()): List<String> {
    val add = seasons.keys.filter { it !in seen && inSeason(seasons.getValue(it), key) }
    return if (add.isEmpty()) seen else seen + add
}

// ---------- matching ----------

/** The rule tracking this app package, if any. */
fun matchApp(rules: List<Rule>, pkg: String): Rule? = rules.firstOrNull { pkg in it.apps }

/**
 * Android counts nothing itself: the system already logs app time, so today's [Day] counters are
 * rebuilt from seconds per package. Each package counts towards the first rule that lists it.
 */
fun dayUsage(day: Day, appSecs: Map<String, Long>, rules: List<Rule>): Day {
    val usage = mutableMapOf<String, Long>()
    for ((pkg, secs) in appSecs) {
        val rule = matchApp(rules, pkg) ?: continue
        usage[rule.id] = (usage[rule.id] ?: 0) + secs
    }
    return day.copy(usage = usage, domains = appSecs)
}

// ---------- limits ----------

fun baseLimitSecs(rule: Rule, key: String): Long =
    (if (rule.weekendMinutes != null && isWeekend(key)) rule.weekendMinutes else rule.minutes) * 60L

private fun toMin(hhmm: String) = hhmm.split(":").let { (h, m) -> h.toInt() * 60 + m.toInt() }

/** Is `now` inside the rule's focus hours (when its apps are off-limits)? Handles overnight ranges. */
fun inFocus(focus: Focus?, now: Long, zone: ZoneId = ZoneId.systemDefault()): Boolean {
    if (focus == null || focus.start.isEmpty() || focus.end.isEmpty()) return false
    val d = local(now, zone)
    if (focus.weekdaysOnly && (d.dayOfWeek == DayOfWeek.SATURDAY || d.dayOfWeek == DayOfWeek.SUNDAY)) return false
    val t = d.hour * 60 + d.minute
    val s = toMin(focus.start)
    val e = toMin(focus.end)
    return if (s <= e) t in s until e else t >= s || t < e
}

/**
 * Which milestone fires for this tick (at most one). Returns the event key or null
 * and adds the dedupe keys to `notified`.
 */
fun milestone(mode: Mode, used: Long, base: Long, bonus: Long = 0, notified: MutableList<String>, nagMinutes: Int = 5): String? {
    fun fire(key: String, event: String = key): String? {
        if (key in notified) return null
        notified += key
        return event
    }
    var event: String? = null
    val steps = if (mode == Mode.GOAL) listOf(0.5 to "goal50", 1.0 to "goal100")
    else listOf(0.5 to "limit50", 0.8 to "limit80", 1.0 to "limit100")
    for ((at, key) in steps) {
        if (used >= base * at) event = fire(key) ?: event
    }
    if (event != null || mode != Mode.LIMIT) return event

    val limit = base + bonus
    if (bonus > 0 && used >= limit) fire("snoozeOver$bonus", "snoozeOver")?.let { return it }
    val overBy = used - limit
    val nag = nagMinutes * 60L
    if (nag > 0 && overBy >= nag) return fire("over${overBy / nag}", "over")
    return null
}

fun blockState(rule: Rule, used: Long, base: Long, bonus: Long = 0, now: Long, unlockUntil: Long = 0, zone: ZoneId = ZoneId.systemDefault()) = when {
    now < unlockUntil -> BlockState.OK
    inFocus(rule.focus, now, zone) -> BlockState.BLOCKED_FOCUS
    rule.block && rule.mode == Mode.LIMIT && used >= base + bonus -> BlockState.BLOCKED_LIMIT
    else -> BlockState.OK
}

fun isNight(now: Long, zone: ZoneId = ZoneId.systemDefault()) = local(now, zone).hour < 5

// ---------- days, streaks, badges ----------

fun newDay(key: String) = Day(key)

/** Compact history entry for a finished day. Limit results ignore snooze bonus time. */
fun finalizeDay(day: Day, rules: List<Rule>): HistoryEntry {
    val results = rules.associate { r ->
        val used = day.usage[r.id] ?: 0
        val limit = baseLimitSecs(r, day.date)
        r.id to RuleResult(r.mode, limit, used, if (r.mode == Mode.GOAL) used >= limit else used <= limit)
    }
    val domains = day.domains.entries.sortedByDescending { it.value }.take(30).associate { it.key to it.value }
    return HistoryEntry(day.date, day.usage, domains, day.snoozes.values.sum(), day.night, results)
}

/**
 * Streaks over completed days (yesterday backwards). Missing days (phone not used) count as
 * limits kept but goals missed. Days with no limit rules neither extend nor break the limit streak.
 */
fun streaks(history: List<HistoryEntry>, todayKey: String): Streaks {
    val byDate = history.associateBy { it.date }
    val first = history.minOfOrNull { it.date }?.let { minOf(it, todayKey) } ?: todayKey
    var limitStreak = 0
    var goalStreak = 0
    var missStreak = 0
    var limitDone = false
    var goalDone = false
    var missDone = false
    var k = addDays(todayKey, -1)
    while (k >= first && !(limitDone && goalDone && missDone)) {
        val h = byDate[k]
        val res = h?.results?.values.orEmpty()
        val limits = res.filter { it.mode == Mode.LIMIT }
        val goals = res.filter { it.mode == Mode.GOAL }
        val kept = limits.all { it.ok }

        if (!limitDone && (h == null || limits.isNotEmpty())) if (kept) limitStreak++ else limitDone = true
        if (!goalDone) if (h != null && goals.isNotEmpty() && goals.all { it.ok }) goalStreak++ else goalDone = true
        if (!missDone) if (h != null && limits.isNotEmpty() && !kept) missStreak++ else missDone = true
        k = addDays(k, -1)
    }
    return Streaks(limitStreak, goalStreak, missStreak)
}

private fun lastNConsecutive(history: List<HistoryEntry>, n: Int, todayKey: String): List<HistoryEntry>? {
    val byDate = history.associateBy { it.date }
    return (1..n).map { byDate[addDays(todayKey, -it)] ?: return null }
}

class BadgeContext(
    val wallet: Wallet,
    val history: List<HistoryEntry>,
    val today: String,
    val limitStreak: Int,
    val goalStreak: Int,
)

/** Names and descriptions live in data/i18n under `badges`. */
class Badge(val id: String, val test: (BadgeContext) -> Boolean)

val BADGES = listOf(
    Badge("first_star") { it.wallet.earned >= 1 },
    Badge("streak3") { it.limitStreak >= 3 },
    Badge("week_clean") { it.limitStreak >= 7 },
    Badge("month_clean") { it.limitStreak >= 30 },
    Badge("goal_crusher") { it.wallet.goalsMet >= 10 },
    Badge("on_a_roll") { it.goalStreak >= 7 },
    Badge("night_owl_reformed") { c -> lastNConsecutive(c.history, 7, c.today)?.all { it.night == 0L } == true },
    Badge("unsnoozable") { c -> lastNConsecutive(c.history, 7, c.today)?.all { it.snoozes == 0 } == true },
    Badge("fashionista") { it.wallet.owned.size >= 4 },
)

fun newBadges(ctx: BadgeContext) = BADGES.filter { it.id !in ctx.wallet.badges && it.test(ctx) }

// ---------- evolution ----------

fun evolution(defs: List<Evolve>, s: Streaks): EvolveState {
    val best = maxOf(s.limitStreak, s.goalStreak)
    val active = defs.filter { best >= it.minStreak }
    return EvolveState(
        evolve = active.filter { it.rows != null }.map { it.id },
        grow = active.sumOf { it.grow },
        scruffy = s.missStreak >= 2,
    )
}

// ---------- insights ----------

/** Untracked apps with lots of time on 3 of the last 4 days (plus today). */
fun suggestions(
    history: List<HistoryEntry>,
    day: Day,
    isTracked: (String) -> Boolean,
    dismissed: List<String> = emptyList(),
    minMinutes: Int = 45,
): List<Suggestion> {
    val recent = history.takeLast(4).map { it.domains } + listOf(day.domains)
    val days = linkedMapOf<String, Int>()
    val secs = mutableMapOf<String, Long>()
    for (domains in recent) {
        for ((domain, s) in domains) {
            if (s < minMinutes * 60L) continue
            days[domain] = (days[domain] ?: 0) + 1
            secs[domain] = (secs[domain] ?: 0) + s
        }
    }
    return days.filter { (d, n) -> n >= 3 && d !in dismissed && !isTracked(d) }
        .map { (d, n) -> Suggestion(d, n, Math.round(secs.getValue(d).toDouble() / n / 60).toInt()) }
        .sortedByDescending { it.avgMinutes }
        .take(3)
}

/** Last 7 days (incl. today) vs the 7 before that. */
fun weeklyReport(history: List<HistoryEntry>, day: Day, rules: List<Rule>, todayKey: String): WeeklyReport {
    val byDate = history.associateBy { it.date } + (day.date to HistoryEntry(day.date, day.usage, results = null))
    fun usageOn(k: String) = byDate[k]?.usage.orEmpty()

    val days = (6 downTo 0).map {
        val k = addDays(todayKey, -it)
        val usage = usageOn(k)
        ReportDay(k, usage.values.sum(), usage)
    }

    fun sumRule(id: String, from: Int, to: Int) = (from..to).sumOf { usageOn(addDays(todayKey, -it))[id] ?: 0L }
    val perRule = rules.map { RuleWeek(it.id, it.name, it.mode, sumRule(it.id, 0, 6), sumRule(it.id, 7, 13)) }

    var bestDay: BestDay? = null
    for (i in 1..6) {
        val h = byDate[addDays(todayKey, -i)] ?: continue
        val res = h.results?.values ?: continue
        val score = res.count { it.ok }
        val limitTime = res.filter { it.mode == Mode.LIMIT }.sumOf { it.used }
        val b = bestDay
        if (b == null || score > b.score || (score == b.score && limitTime < b.limitTime)) {
            bestDay = BestDay(h.date, score, res.size, limitTime)
        }
    }

    val savedSecs = rules.filter { it.mode == Mode.LIMIT }.sumOf { sumRule(it.id, 7, 13) - sumRule(it.id, 0, 6) }
    return WeeklyReport(days, perRule, bestDay, savedSecs)
}

// ---------- misc ----------

private val TEMPLATE_VAR = Regex("""\{(\w+)\}""")

fun fillTemplate(text: String, vars: Map<String, Any?> = emptyMap()): String =
    TEMPLATE_VAR.replace(text) { m -> vars[m.groupValues[1]]?.toString() ?: m.value }

fun newId(): String = (1..8).map { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
