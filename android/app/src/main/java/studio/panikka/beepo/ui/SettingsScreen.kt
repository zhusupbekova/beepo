package studio.panikka.beepo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import studio.panikka.beepo.BuildConfig
import studio.panikka.beepo.I18n
import studio.panikka.beepo.PRIVACY_URL
import studio.panikka.beepo.openUrl
import studio.panikka.beepo.core.LANGUAGES
import studio.panikka.beepo.core.Settings

/** The options page's settings that matter without the overlay: language and when the day starts. */
@Composable
fun SettingsScreen(settings: Settings, i18n: I18n, onChange: (Settings) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(Paper).safeDrawingPadding().verticalScroll(rememberScrollState()).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(i18n.t("optTitle"), style = PixelText.copy(fontWeight = FontWeight.Bold))

            Section(i18n.t("language")) {
                PixelChip(i18n.android("langAuto"), settings.lang == "auto") { onChange(settings.copy(lang = "auto")) }
                for ((code, name) in LANGUAGES) PixelChip(name, settings.lang == code) { onChange(settings.copy(lang = code)) }
            }

            Section(i18n.t("newDay"), i18n.t("newDayHint")) {
                for (h in 0 until 12) {
                    PixelChip("%02d:00".format(java.util.Locale.ROOT, h), settings.resetHour == h) { onChange(settings.copy(resetHour = h)) }
                }
            }

            Text(
                i18n.android("privacyPolicy"),
                Modifier.clickable { openUrl(context, PRIVACY_URL) }.padding(vertical = 4.dp),
                style = PixelText.copy(textDecoration = TextDecoration.Underline),
            )

            PixelButton(i18n.t("close"), onClick = onClose)

            // Debug builds only, so not translated.
            if (BuildConfig.DEBUG) {
                PixelButton("Dev: show intro again", fill = Card) {
                    onChange(settings.copy(onboarded = false))
                    onClose()
                }
            }
        }
    }
}

@Composable
private fun Section(title: String, hint: String? = null, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = PixelText.copy(fontWeight = FontWeight.Bold))
        hint?.let { Text(it, style = PixelText.copy(color = Muted)) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}
