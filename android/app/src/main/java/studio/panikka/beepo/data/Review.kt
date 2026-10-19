package studio.panikka.beepo.data

import android.app.Activity
import com.google.android.play.core.review.ReviewManagerFactory
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.addDays
import studio.panikka.beepo.core.dateKey

/**
 * Play's in-app review sheet, asked for at a happy moment (good news was just read) once a week of
 * history is in, and at most every 60 days. No "do you like Beepo?" gate: Play decides whether the
 * sheet actually shows. Like the extension's rating card, but without a button.
 */
object Review {
    private const val MIN_DAYS = 7
    private const val EVERY_DAYS = 60

    /** News worth smiling about (all of it, today: kept limits, streaks, badges, evolving). */
    private val HAPPY = setOf("kept", "streak", "badge", "evolve")

    fun happy(st: State) = st.pending.any { it.key in HAPPY }

    fun due(st: State, today: String) =
        st.history.size >= MIN_DAYS && st.settings.reviewAskedOn.let { it == null || addDays(it, EVERY_DAYS) <= today }

    fun maybeAsk(activity: Activity, store: Store) {
        val st = store.state.value
        val today = dateKey(System.currentTimeMillis(), st.settings.resetHour)
        if (!due(st, today)) return
        val manager = ReviewManagerFactory.create(activity)
        manager.requestReviewFlow().addOnCompleteListener { task ->
            if (!task.isSuccessful || activity.isFinishing) return@addOnCompleteListener
            store.setSettings(store.state.value.settings.copy(reviewAskedOn = today))
            manager.launchReviewFlow(activity, task.result)
        }
    }
}
