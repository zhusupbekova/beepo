package studio.panikka.beepo.usage

/** The few UsageEvents types that matter for foreground time. */
enum class EventType { RESUMED, PAUSED, SCREEN_OFF, SHUTDOWN }

class UsageEvent(val time: Long, val pkg: String, val activity: String?, val type: EventType)

/**
 * Milliseconds each package spent in the foreground between `start` and `end`, from system usage
 * events (oldest first, queried from well before `start` so apps opened earlier are seen).
 *
 * A package is in the foreground while any of its activities is resumed. Screen off and shutdown
 * end everything. A pause without a resume in the log counts nothing, like Android's own totals:
 * after a reboot or restore the log can't say how long the app was really open.
 */
fun foregroundTime(events: List<UsageEvent>, start: Long, end: Long): Map<String, Long> {
    val resumed = mutableMapOf<String, MutableSet<String?>>()
    val since = mutableMapOf<String, Long>()
    val total = linkedMapOf<String, Long>()

    fun close(pkg: String, at: Long) {
        val opened = since.remove(pkg) ?: return
        val ms = minOf(at, end) - maxOf(opened, start)
        if (ms > 0) total[pkg] = (total[pkg] ?: 0) + ms
    }

    for (e in events) {
        if (e.time > end) break
        when (e.type) {
            EventType.RESUMED -> {
                resumed.getOrPut(e.pkg) { mutableSetOf() } += e.activity
                since.putIfAbsent(e.pkg, e.time)
            }
            EventType.PAUSED -> {
                val open = resumed[e.pkg]
                open?.remove(e.activity)
                if (open.isNullOrEmpty()) {
                    resumed.remove(e.pkg)
                    close(e.pkg, e.time)
                }
            }
            EventType.SCREEN_OFF, EventType.SHUTDOWN -> {
                resumed.clear()
                since.keys.toList().forEach { close(it, e.time) }
            }
        }
    }
    since.keys.toList().forEach { close(it, end) }
    return total
}

/**
 * Which app is in front right now, fed usage events as they come (oldest first): the most
 * recently resumed package that still has a resumed activity. When the one on top pauses
 * without anything new resuming (a home swipe that was taken back), the app underneath, which
 * never paused, is in front again. Screen off ends everything.
 */
class ForegroundTracker {
    /** Resumed activities per package, oldest resumed first. */
    private val resumed = linkedMapOf<String, MutableSet<String?>>()
    val top: String? get() = resumed.keys.lastOrNull()

    fun feed(e: UsageEvent) {
        when (e.type) {
            EventType.RESUMED -> {
                val open = resumed.remove(e.pkg) ?: mutableSetOf()
                open += e.activity
                resumed[e.pkg] = open
            }
            EventType.PAUSED -> {
                val open = resumed[e.pkg] ?: return
                open.remove(e.activity)
                if (open.isEmpty()) resumed.remove(e.pkg)
            }
            EventType.SCREEN_OFF, EventType.SHUTDOWN -> resumed.clear()
        }
    }
}
