package studio.panikka.beepo

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/** Same page the store listings link to (docs/STORE.md); keep in sync with docs/PRIVACY.md. */
const val PRIVACY_URL = "https://panikka.studio/apps/privacy-policy"

/** Store listings. The Play link carries a UTM source so the Console can tell shares apart. */
const val PLAY_SHARE_URL = "https://play.google.com/store/apps/details?id=studio.panikka.beepo&referrer=utm_source%3Dshare%26utm_medium%3Dapp"
const val CHROME_URL = "https://chromewebstore.google.com/detail/akiejmhndfgcfbgjebcfkbaoeffkhdpj"
const val EDGE_URL = "https://microsoftedge.microsoft.com/addons/detail/pnnhepbnimbeneejgachdemhcpbelhgn"
const val FIREFOX_URL = "https://addons.mozilla.org/firefox/addon/beepo-screen-time-buddy/"

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

/** The system share sheet with plain text. */
fun shareText(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
