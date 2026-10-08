package studio.panikka.beepo.usage

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Process
import android.provider.Settings

/** Usage access is a special permission the user turns on in system settings. */
object UsageAccess {
    /** How far back to look for apps that were already open when the window starts. */
    private const val LOOKBACK_MS = 12 * 3_600_000L

    fun granted(context: Context): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java)
        val mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /** Opens Beepo's entry in Usage access settings (or the whole list where that isn't supported). */
    fun openSettings(context: Context) {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(Intent(intent).setData(Uri.fromParts("package", context.packageName, null)))
        } catch (_: ActivityNotFoundException) {
            context.startActivity(intent)
        }
    }

    /** Foreground milliseconds per package between `start` and `end`. */
    fun foreground(context: Context, start: Long, end: Long): Map<String, Long> {
        val from = start - LOOKBACK_MS
        val usm = context.getSystemService(UsageStatsManager::class.java)
        val events = mutableListOf<UsageEvent>()
        val raw = usm.queryEvents(from, end)
        val e = UsageEvents.Event()
        while (raw.getNextEvent(e)) {
            val type = when (e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> EventType.RESUMED
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> EventType.PAUSED
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> EventType.SCREEN_OFF
                UsageEvents.Event.DEVICE_SHUTDOWN -> EventType.SHUTDOWN
                else -> null
            } ?: continue
            events += UsageEvent(e.timeStamp, e.packageName, e.className, type)
        }
        return foregroundTime(events, start, end)
    }
}
