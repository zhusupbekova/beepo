package studio.panikka.beepo

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/** Same page the store listings link to (docs/STORE.md); keep in sync with docs/PRIVACY.md. */
const val PRIVACY_URL = "https://panikka.studio/apps/privacy-policy"

/** Support address, same as the store listings (docs/STORE.md). */
const val SUPPORT_EMAIL = "beepo@panikka.studio"

/** Email to support with the subject filled in and version/device/language at the bottom. */
fun sendFeedback(context: Context, subject: String, lang: String) {
    val info = "Beepo ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · Android ${android.os.Build.VERSION.RELEASE} · ${android.os.Build.MODEL} · $lang"
    val uri = "mailto:$SUPPORT_EMAIL?subject=${Uri.encode(subject)}&body=${Uri.encode("\n\n\n—\n$info")}"
    try {
        context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        // No email app.
    }
}

fun openUrl(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        // No browser: nothing to open it with.
    }
}
