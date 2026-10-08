package studio.panikka.beepo.core

import studio.panikka.beepo.sprite.Sprites
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class RolloverTest {
    private val evolve = Sprites.parse(File("../../extension/data/sprites.json").readText()).evolve
    private val yt = Rule("yt", "YouTube", apps = listOf("yt"), minutes = 30)
    private val duo = Rule("duo", "Duolingo", apps = listOf("duo"), mode = Mode.GOAL, minutes = 10)
    private val min = 60L

    private fun state(day: Day?, vararg rules: Rule = arrayOf(yt)) = State(rules = rules.toList(), day = day)
    private fun keys(st: State) = st.pending.map { it.key }

    @Test
    fun firstRunStartsToday() {
        val st = rollover(state(null), "2026-10-05", evolve) { error("nothing to finalize") }
        assertEquals(Day("2026-10-05"), st.day)
        assertTrue(st.history.isEmpty())
    }

    @Test
    fun sameDayIsUntouched() {
        val st = state(Day("2026-10-05"))
        assertSame(st, rollover(st, "2026-10-05", evolve) { error("nothing to finalize") })
    }

    @Test
    fun keptLimitEarnsAStarPlusFirstStarBadge() {
        val st = rollover(state(Day("2026-10-04")), "2026-10-05", evolve) { mapOf("yt" to 20 * min) }
        assertEquals(Day("2026-10-05"), st.day)
        assertEquals(listOf("2026-10-04"), st.history.map { it.date })
        assertEquals(20 * min, st.history[0].usage["yt"])
        assertEquals(true, st.history[0].results!!["yt"]!!.ok)
        // 1 for the limit + 3 for the "first star" badge it unlocks.
        assertEquals(1 + BADGE_REWARD, st.wallet.stars)
        assertEquals(st.wallet.stars, st.wallet.earned)
        assertEquals(listOf("first_star"), st.wallet.badges)
        assertEquals(listOf(News("kept", mapOf("n" to "1")), News("badge", mapOf("id" to "first_star"))), st.pending)
    }

    @Test
    fun overLimitEarnsNothing() {
        val st = rollover(state(Day("2026-10-04")), "2026-10-05", evolve) { mapOf("yt" to 31 * min) }
        assertEquals(false, st.history[0].results!!["yt"]!!.ok)
        assertEquals(0, st.wallet.stars)
        assertTrue(st.pending.isEmpty())
    }

    @Test
    fun withoutLogDataTheStoredDayIsUsed() {
        val stored = state(Day("2026-10-04", usage = mapOf("yt" to 40 * min)))
        assertEquals(false, rollover(stored, "2026-10-05", evolve) { null }.history[0].results!!["yt"]!!.ok)
        assertEquals(false, rollover(stored, "2026-10-05", evolve) { emptyMap() }.history[0].results!!["yt"]!!.ok)
    }

    @Test
    fun missedDaysAreRebuiltFromTheLogAndUnusedDaysStayGaps() {
        val log = mapOf(
            "2026-10-01" to mapOf("yt" to 5 * min),
            "2026-10-02" to emptyMap(), // phone not used
            "2026-10-03" to mapOf("yt" to 10 * min),
            "2026-10-04" to mapOf("other" to 10 * min),
        )
        val st = rollover(state(Day("2026-10-01")), "2026-10-05", evolve) { log[it] }
        assertEquals(listOf("2026-10-01", "2026-10-03", "2026-10-04"), st.history.map { it.date })
        assertEquals(4, streaks(st.history, "2026-10-05").limitStreak) // the gap counts as kept
        assertTrue("streak news", News("streak", mapOf("n" to "4")) in st.pending || st.pending.size == PENDING_MAX)
        assertEquals(3 + BADGE_REWARD * 2, st.wallet.stars) // 3 kept + first_star + streak3
        assertTrue("streak3" in st.wallet.badges)
        assertTrue(st.pending.size <= PENDING_MAX)
    }

    @Test
    fun backfillIsCappedAtAWeek() {
        val st = rollover(state(Day("2026-09-01")), "2026-10-05", evolve) { mapOf("yt" to min) }
        assertEquals(BACKFILL_DAYS, st.history.size)
        assertEquals("2026-10-04", st.history.last().date)
    }

    @Test
    fun streakUnlocksEvolution() {
        // 2 kept days before, plus the day being finished: the streak reaches 3.
        val history = (3..4).map { HistoryEntry("2026-10-0$it", results = mapOf("yt" to RuleResult(Mode.LIMIT, 1800, 0, true))) }
        val st = rollover(state(Day("2026-10-05")).copy(history = history), "2026-10-06", evolve) { mapOf("yt" to min) }
        // Cheeks (3 days) is new, collar (14) isn't yet.
        assertTrue(News("evolve", mapOf("id" to "cheeks")) in st.pending)
        assertTrue(keys(st).count { it == "evolve" } == 1)
    }

    @Test
    fun goalReachedAwardsOnce() {
        var st = state(Day("2026-10-05"), yt, duo)
        st = applyUsage(st, mapOf("duo" to 5 * min, "yt" to 3 * min))
        assertEquals(0, st.wallet.stars)
        assertEquals(mapOf("yt" to 3 * min, "duo" to 5 * min), st.day!!.usage)
        st = applyUsage(st, mapOf("duo" to 10 * min))
        assertEquals(1 + BADGE_REWARD, st.wallet.stars) // goal star + first_star
        assertEquals(1, st.wallet.goalsMet)
        st = applyUsage(st, mapOf("duo" to 20 * min))
        assertEquals(1 + BADGE_REWARD, st.wallet.stars)
        assertEquals(listOf("goal50", "goal100"), st.day!!.notified["duo"])
        assertNull(st.day!!.notified["yt"])
    }
}
