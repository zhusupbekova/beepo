package studio.panikka.beepo.overlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import studio.panikka.beepo.data.Store

/** Brings Beepo back on screen after a reboot or an app update. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        Overlay.sync(context, Store.get(context).state.value)
    }
}
