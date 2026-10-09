package studio.panikka.beepo.usage

import studio.panikka.beepo.usage.EventType.PAUSED
import studio.panikka.beepo.usage.EventType.RESUMED
import studio.panikka.beepo.usage.EventType.SCREEN_OFF
import studio.panikka.beepo.usage.EventType.SHUTDOWN
import org.junit.Assert.assertEquals
import org.junit.Test

class ForegroundTest {
    private val min = 60_000L
    private fun ev(minute: Int, pkg: String, type: EventType, activity: String = "Main") =
        UsageEvent(minute * min, pkg, activity, type)

    /** Window: count minutes 60..120. */
    private fun run(vararg events: UsageEvent, end: Long = 120 * min) =
        foregroundTime(events.toList(), start = 60 * min, end = end).mapValues { it.value / min }

    @Test
    fun countsResumedToPaused() {
        assertEquals(mapOf("ig" to 10L, "yt" to 5L), run(ev(70, "ig", RESUMED), ev(80, "ig", PAUSED), ev(90, "yt", RESUMED), ev(95, "yt", PAUSED)))
    }

    @Test
    fun clipsToWindow() {
        // Opened before the day started, and still open now.
        assertEquals(mapOf("ig" to 5L, "yt" to 10L), run(ev(30, "ig", RESUMED), ev(65, "ig", PAUSED), ev(110, "yt", RESUMED)))
        // Entirely before the window.
        assertEquals(emptyMap<String, Long>(), run(ev(10, "ig", RESUMED), ev(20, "ig", PAUSED)))
        // Events after `end` are ignored.
        assertEquals(mapOf("ig" to 10L), run(ev(70, "ig", RESUMED), ev(80, "ig", PAUSED), ev(130, "yt", RESUMED)))
    }

    @Test
    fun packageStaysForegroundAcrossItsOwnActivities() {
        // Second activity resumes before the first one pauses: one continuous session, not double-counted.
        val events = arrayOf(
            ev(70, "ig", RESUMED, "Feed"),
            ev(75, "ig", RESUMED, "Story"),
            ev(75, "ig", PAUSED, "Feed"),
            ev(85, "ig", PAUSED, "Story"),
        )
        assertEquals(mapOf("ig" to 15L), run(*events))
    }

    @Test
    fun screenOffAndShutdownEndEverything() {
        assertEquals(mapOf("ig" to 10L), run(ev(70, "ig", RESUMED), ev(80, "android", SCREEN_OFF), ev(90, "ig", PAUSED)))
        assertEquals(mapOf("ig" to 5L), run(ev(70, "ig", RESUMED), ev(75, "android", SHUTDOWN)))
    }

    @Test
    fun pauseWithoutResumeCountsNothing() {
        // e.g. after a reboot or emulator snapshot restore: Android's own totals ignore these too.
        assertEquals(emptyMap<String, Long>(), run(ev(80, "ig", PAUSED)))
        // And a second pause doesn't count again.
        assertEquals(mapOf("ig" to 10L), run(ev(70, "ig", RESUMED), ev(80, "ig", PAUSED), ev(85, "ig", PAUSED)))
    }

    @Test
    fun trackerFollowsTheAppInFront() {
        val t = ForegroundTracker()
        fun feed(vararg e: UsageEvent) = e.forEach(t::feed)
        feed(ev(1, "ig", RESUMED))
        assertEquals("ig", t.top)
        // Switching apps: the old one's pause can come after the new one's resume.
        feed(ev(2, "yt", RESUMED), ev(2, "ig", PAUSED))
        assertEquals("yt", t.top)
        // Moving between two activities of one app keeps it in front.
        feed(ev(3, "yt", RESUMED, "Player"), ev(3, "yt", PAUSED, "Main"))
        assertEquals("yt", t.top)
        feed(ev(4, "yt", PAUSED, "Player"))
        assertEquals(null, t.top)
        feed(ev(5, "ig", RESUMED), ev(6, "x", SCREEN_OFF))
        assertEquals(null, t.top)
    }

    @Test
    fun takenBackHomeSwipeLeavesTheAppInFront() {
        val t = ForegroundTracker()
        // The launcher shows for a moment, then goes; the app never paused.
        listOf(ev(1, "yt", RESUMED), ev(2, "launcher", RESUMED), ev(2, "launcher", PAUSED)).forEach(t::feed)
        assertEquals("yt", t.top)
    }
}
