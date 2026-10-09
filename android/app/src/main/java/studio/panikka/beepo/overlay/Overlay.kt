package studio.panikka.beepo.overlay

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import studio.panikka.beepo.core.State
import studio.panikka.beepo.usage.UsageAccess

/** "Display over other apps" and the service that uses it. */
object Overlay {
    fun allowed(context: Context) = Settings.canDrawOverlays(context)

    fun openSettings(context: Context) {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(Intent(intent).setData(Uri.parse("package:${context.packageName}")))
        } catch (_: ActivityNotFoundException) {
            context.startActivity(intent)
        }
    }

    /** Beepo has something to watch, may show himself and can see which app is open. */
    fun shouldRun(context: Context, st: State) =
        st.settings.overlay && st.rules.isNotEmpty() && allowed(context) && UsageAccess.granted(context)

    /** Starts or stops [BeepoService] to match. Call from the foreground (or boot). */
    fun sync(context: Context, st: State) {
        val intent = Intent(context, BeepoService::class.java)
        if (shouldRun(context, st)) {
            runCatching { context.startForegroundService(intent) }
        } else {
            context.stopService(intent)
        }
    }
}
