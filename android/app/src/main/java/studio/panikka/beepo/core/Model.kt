package studio.panikka.beepo.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Same JSON shapes as the extension's storage (see lib/core.js), so data can move between them.
// Missing fields fall back to the defaults here, which is what normalizeDay / DEFAULT_* spreads do in JS.

@Serializable
enum class Mode {
    @SerialName("limit") LIMIT,
    @SerialName("goal") GOAL,
}

/** "HH:MM" range when the rule's apps are off-limits; may wrap past midnight. */
@Serializable
data class Focus(val start: String = "", val end: String = "", val weekdaysOnly: Boolean = false)

@Serializable
data class Rule(
    val id: String,
    val name: String,
    /** Web patterns (host or host/path), used by the extension. */
    val patterns: List<String> = emptyList(),
    /** Android package names. */
    val apps: List<String> = emptyList(),
    val mode: Mode = Mode.LIMIT,
    val minutes: Int = 30,
    val weekendMinutes: Int? = null,
    val block: Boolean = false,
    val hidden: Boolean = false,
    val focus: Focus? = null,
)

@Serializable
data class Settings(
    val side: String = "right",
    val scale: Int = 4,
    val quiet: Boolean = false,
    val sound: Boolean = false,
    val wander: Boolean = true,
    val nagMinutes: Int = 5,
    /** The day rolls over at 4am, not midnight. */
    val resetHour: Int = 4,
    val everywhere: Boolean = false,
    val idleSeconds: Int = 60,
    /** Suggestions the user said no to. */
    val dismissed: List<String> = emptyList(),
    val lang: String = "auto",
    /** Android only: the intro has been shown. */
    val onboarded: Boolean = false,
)

@Serializable
data class Equipped(
    val color: String? = "color-blue",
    val hat: String? = null,
    val antenna: String? = null,
    val accessory: String? = null,
    val pet: String? = null,
) {
    fun toMap() = listOf("color" to color, "hat" to hat, "antenna" to antenna, "accessory" to accessory, "pet" to pet)
        .mapNotNull { (slot, id) -> id?.let { slot to it } }
        .toMap()
}

@Serializable
data class Wallet(
    /** Spendable. */
    val stars: Int = 0,
    /** Lifetime. */
    val earned: Int = 0,
    val goalsMet: Int = 0,
    val owned: List<String> = listOf("color-blue"),
    val equipped: Equipped = Equipped(),
    val badges: List<String> = emptyList(),
)

/**
 * Today's counters, keyed by rule id (seconds). `domains` is time per host in the extension
 * and per app package on Android. `notified` holds milestone keys already fired.
 */
@Serializable
data class Day(
    val date: String,
    val usage: Map<String, Long> = emptyMap(),
    val domains: Map<String, Long> = emptyMap(),
    val bonus: Map<String, Long> = emptyMap(),
    val snoozes: Map<String, Int> = emptyMap(),
    val notified: Map<String, List<String>> = emptyMap(),
    val unlockUntil: Map<String, Long> = emptyMap(),
    val night: Long = 0,
)

@Serializable
data class RuleResult(val mode: Mode, val limit: Long, val used: Long, val ok: Boolean)

/** A finished day in `history`. `results` is null only for today's in-progress entry in reports. */
@Serializable
data class HistoryEntry(
    val date: String,
    val usage: Map<String, Long> = emptyMap(),
    val domains: Map<String, Long> = emptyMap(),
    val snoozes: Int = 0,
    val night: Long = 0,
    val results: Map<String, RuleResult>? = null,
)

@Serializable
data class Streaks(val limitStreak: Int, val goalStreak: Int, val missStreak: Int)

@Serializable
data class EvolveState(val evolve: List<String>, val grow: Int, val scruffy: Boolean)

@Serializable
data class Suggestion(val domain: String, val days: Int, val avgMinutes: Int)

@Serializable
data class ReportDay(val date: String, val total: Long, val byRule: Map<String, Long>)

@Serializable
data class RuleWeek(val id: String, val name: String, val mode: Mode, val thisWeek: Long, val lastWeek: Long)

@Serializable
data class BestDay(val date: String, val score: Int, val of: Int, val limitTime: Long)

@Serializable
data class WeeklyReport(val days: List<ReportDay>, val perRule: List<RuleWeek>, val bestDay: BestDay?, val savedSecs: Long)

enum class BlockState { OK, BLOCKED_LIMIT, BLOCKED_FOCUS }
