package studio.panikka.beepo.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import studio.panikka.beepo.I18n
import studio.panikka.beepo.MainActivity
import studio.panikka.beepo.R
import studio.panikka.beepo.core.Mode
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.baseLimitSecs
import studio.panikka.beepo.data.Plus
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.sprite.Frame
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.sprite.pet
import studio.panikka.beepo.sprite.scene
import studio.panikka.beepo.ui.Theme
import studio.panikka.beepo.ui.beepoLook
import studio.panikka.beepo.ui.today
import kotlin.concurrent.thread

/** Bitmap pixels per sprite pixel (the launcher scales it to fit, so keep it sharp). */
private const val SCALE = 8
/** Height (dp) taken by the padding and the header line, and by one rule row. */
private const val HEADER_DP = 48
private const val ROW_DP = 36

private class Row(val box: Int, val name: Int, val time: Int, val bar: Int)

/** The rule rows in the layout (r1..r5); as many show as fit. */
private val ROWS = listOf(
    Row(R.id.r1, R.id.r1name, R.id.r1time, R.id.r1bar),
    Row(R.id.r2, R.id.r2name, R.id.r2time, R.id.r2bar),
    Row(R.id.r3, R.id.r3name, R.id.r3time, R.id.r3bar),
    Row(R.id.r4, R.id.r4name, R.id.r4time, R.id.r4bar),
    Row(R.id.r5, R.id.r5name, R.id.r5time, R.id.r5bar),
)

/**
 * Home-screen widget (Plus): Beepo as he is now (in his scene, with his pet, if one is on), stars
 * and streak, and today's time on as many rules as fit. Without Plus he invites you to unlock it.
 * Updated by [Store] whenever its data changes, on resize, and every 30 minutes by the system
 * (which also refreshes today's usage). Light or dark like the app.
 */
class BeepoWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val pending = goAsync()
        thread {
            try {
                // Store.refresh() reads the usage log and saves, which updates the widget.
                Store.get(context).also { Plus.init(context, it) }.refresh()
                update(context)
            } finally {
                pending.finish()
            }
        }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        update(context)
    }

    companion object {
        private var i18n: I18n? = null
        private var i18nPref: String? = null

        fun update(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, BeepoWidget::class.java))
            if (ids.isEmpty()) return
            val store = Store.get(context)
            for (id in ids) {
                // Portrait height, the taller of the two the launcher reports.
                val height = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110)
                val rows = ((height - HEADER_DP) / ROW_DP).coerceIn(1, ROWS.size)
                manager.updateAppWidget(id, views(context, store, store.state.value, store.plus.value, rows))
            }
        }

        private fun views(context: Context, store: Store, st: State, plus: Boolean, rows: Int): RemoteViews {
            val t = i18n?.takeIf { i18nPref == st.settings.lang } ?: I18n.load(context.assets, st.settings.lang).also {
                i18n = it
                i18nPref = st.settings.lang
            }
            val phoneDark = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
            val dark = Theme.isDark(st.settings, plus, phoneDark)
            // "Follow the phone": the layout's night-qualified resources do it, so it switches with
            // the phone without an update. Otherwise light or dark is set here.
            val fixed = !(plus && st.settings.theme == "system")
            val ink = if (dark) 0xFFE8E4FF.toInt() else 0xFF1B1B2F.toInt()
            val muted = (ink and 0x00FFFFFF) or 0x99000000.toInt()
            fun RemoteViews.color(id: Int, color: Int) {
                if (fixed) setTextColor(id, color)
            }

            val look = st.beepoLook(store.sprites)
            val today = st.today()
            val lines = st.rules.filter { !it.hidden }.map { rule ->
                val used = st.day?.takeIf { it.date == today }?.usage?.get(rule.id) ?: 0
                val limit = baseLimitSecs(rule, today) + (st.day?.bonus?.get(rule.id) ?: 0)
                Triple(rule, used, limit)
            }
            val over = lines.any { (rule, used, limit) -> rule.mode == Mode.LIMIT && used >= limit }
            val mood = when {
                !plus -> "happy"
                over -> "worried"
                lines.isNotEmpty() && lines.all { (rule, used, limit) -> rule.mode == Mode.GOAL && used >= limit } -> "proud"
                else -> look.mood
            }
            val frame = store.sprites.compose(mood, look = look.look)
            val scene = if (plus) store.sprites.scene(st.wallet.equipped.scene, frame, store.sprites.pet(look.look.equipped["pet"], 0)) else null
            val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)

            return RemoteViews(context.packageName, R.layout.widget).apply {
                if (fixed) setInt(android.R.id.background, "setBackgroundResource", if (dark) R.drawable.widget_bg_dark else R.drawable.widget_bg)
                setOnClickPendingIntent(android.R.id.background, open)
                if (scene != null) setImageViewBitmap(R.id.scene, scene.bitmap()) else setImageViewBitmap(R.id.beepo, frame.bitmap())
                setViewVisibility(R.id.scene, if (scene != null) View.VISIBLE else View.GONE)
                setViewVisibility(R.id.beepo, if (scene != null) View.GONE else View.VISIBLE)

                val streak = maxOf(look.streaks.limitStreak, look.streaks.goalStreak)
                setTextViewText(R.id.header, "⭐ ${st.wallet.stars}" + if (streak >= 2) "  🔥 $streak" else "")
                color(R.id.header, ink)
                setViewVisibility(R.id.header, if (plus) View.VISIBLE else View.GONE)

                // Without Plus: the invite. With Plus and no rules: what to do.
                val note = when {
                    !plus -> if (Plus.available) "✨ " + t.android("widgetPlus") else ""
                    lines.isEmpty() -> t.t("noRules")
                    else -> null
                }
                setTextViewText(R.id.note, note.orEmpty())
                color(R.id.note, ink)
                setViewVisibility(R.id.note, if (note != null) View.VISIBLE else View.GONE)

                val shown = if (plus) lines.take(rows) else emptyList()
                for ((i, row) in ROWS.withIndex()) {
                    val line = shown.getOrNull(i)
                    setViewVisibility(row.box, if (line != null) View.VISIBLE else View.GONE)
                    if (line == null) continue
                    val (rule, used, limit) = line
                    val isOver = rule.mode == Mode.LIMIT && used >= limit
                    val mark = if (isOver) " ⛔" else if (rule.mode == Mode.GOAL && used >= limit) " ✓" else ""
                    setTextViewText(row.name, rule.name)
                    setTextViewText(row.time, "${t.duration(used)}/${t.duration(limit)}$mark")
                    color(row.name, ink)
                    color(row.time, muted)
                    // Over: the whole bar red (secondary progress), else blue up to the time used.
                    val pct = if (limit > 0) (used * 100 / limit).toInt().coerceIn(0, 100) else 100
                    setProgressBar(row.bar, 100, if (isOver) 0 else pct, false)
                    setInt(row.bar, "setSecondaryProgress", if (isOver) 100 else 0)
                }
            }
        }

        private fun Frame.bitmap(): Bitmap {
            val px = IntArray(width * SCALE * height * SCALE)
            for ((y, row) in grid.withIndex()) for ((x, c) in row.withIndex()) {
                val argb = palette[c] ?: continue
                for (dy in 0 until SCALE) px.fill(argb, (y * SCALE + dy) * width * SCALE + x * SCALE, (y * SCALE + dy) * width * SCALE + (x + 1) * SCALE)
            }
            return Bitmap.createBitmap(px, width * SCALE, height * SCALE, Bitmap.Config.ARGB_8888)
        }
    }
}
