package studio.panikka.beepo

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/** Same page the store listings link to (docs/STORE.md); keep in sync with docs/PRIVACY.md. */
const val PRIVACY_URL = "https://panikka.studio/apps/privacy-policy"

fun openUrl(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        // No browser: nothing to open it with.
    }
}
