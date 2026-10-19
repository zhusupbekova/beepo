package studio.panikka.beepo

import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Icon
import studio.panikka.beepo.sprite.Look
import studio.panikka.beepo.sprite.Sprites
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.widget.bitmap

/**
 * Long-press the launcher icon: Today, Report, Shop. Dynamic rather than static so the labels follow
 * Beepo's language setting and the icons show your Beepo. MainActivity opens the tab in [EXTRA_TAB].
 */
object Shortcuts {
    const val EXTRA_TAB = "tab"

    /** Adaptive icon size (108dp at 2x) and Beepo's pixel size inside its 66dp safe zone. */
    private const val ICON = 216
    private const val SCALE = 5

    private val TABS = listOf("today" to "happy", "report" to "proud", "shop" to "party")

    fun update(context: Context, sprites: Sprites, look: Look, i18n: I18n) {
        val manager = context.getSystemService(ShortcutManager::class.java) ?: return
        val shortcuts = TABS.map { (tab, mood) ->
            val label = i18n.t("tab_$tab")
            ShortcutInfo.Builder(context, tab)
                .setShortLabel(label)
                .setIcon(Icon.createWithAdaptiveBitmap(icon(sprites.compose(mood, look = look).bitmap(SCALE))))
                .setIntent(Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).putExtra(EXTRA_TAB, tab))
                .build()
        }
        manager.dynamicShortcuts = shortcuts
    }

    /** Beepo centered on paper. */
    private fun icon(beepo: Bitmap): Bitmap {
        val out = Bitmap.createBitmap(ICON, ICON, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        canvas.drawColor(0xFFF4F1E8.toInt())
        canvas.drawBitmap(beepo, (ICON - beepo.width) / 2f, (ICON - beepo.height) / 2f, null)
        return out
    }
}
