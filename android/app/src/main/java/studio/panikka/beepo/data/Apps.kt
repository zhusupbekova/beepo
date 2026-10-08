package studio.panikka.beepo.data

import android.content.Context
import android.content.Intent
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap

class AppInfo(val pkg: String, val label: String, loadIcon: () -> ImageBitmap) {
    /** Decoded on first use: only the icons on screen are ever loaded. */
    val icon: ImageBitmap by lazy(loadIcon)
}

/** Apps with a launcher icon (what people think of as "apps"), minus Beepo itself. */
object Apps {
    private const val ICON_PX = 96

    @Suppress("DEPRECATION") // the flags overload needs API 33
    fun launchable(context: Context): Map<String, AppInfo> {
        val pm = context.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(launcher, 0)
            .map { it.activityInfo.applicationInfo }
            .distinctBy { it.packageName }
            .filter { it.packageName != context.packageName }
            .map { info -> AppInfo(info.packageName, pm.getApplicationLabel(info).toString()) { pm.getApplicationIcon(info).toBitmap(ICON_PX, ICON_PX).asImageBitmap() } }
            .sortedBy { it.label.lowercase() }
            .associateBy { it.pkg }
    }
}
