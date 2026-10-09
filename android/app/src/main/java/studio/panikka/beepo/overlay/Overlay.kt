package studio.panikka.beepo.overlay

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
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

    /** Android 13+ needs a runtime grant before the ongoing "Beepo is on screen" notification shows. */
    fun needsNotifications(context: Context) =
        Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

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

/**
 * `ask { ... }` asks for notifications if needed (when turning Beepo on screen on), then runs the
 * block whatever the answer: the service works without them, only its notification stays hidden.
 */
@Composable
fun rememberNotificationAsk(): (() -> Unit) -> Unit {
    val context = LocalContext.current
    var then by remember { mutableStateOf<(() -> Unit)?>(null) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        then?.invoke()
        then = null
    }
    return { next ->
        if (Overlay.needsNotifications(context)) {
            then = next
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            next()
        }
    }
}
