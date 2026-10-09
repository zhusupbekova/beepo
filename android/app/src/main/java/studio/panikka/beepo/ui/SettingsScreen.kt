package studio.panikka.beepo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
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
import studio.panikka.beepo.data.Plus
import studio.panikka.beepo.overlay.Overlay

/** The options page, for the phone: language, when the day starts, Beepo on screen. */
@Composable
fun SettingsScreen(
    settings: Settings,
    i18n: I18n,
    onChange: (Settings) -> Unit,
    onPlus: () -> Unit,
    plus: Boolean,
    overlayOk: Boolean,
    onSetPlus: (Boolean) -> Unit,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Paper).safeDrawingPadding()) {
            // Title and Close stay at the top while the settings scroll.
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(i18n.t("optTitle"), Modifier.weight(1f), style = PixelText.copy(fontWeight = FontWeight.Bold))
                PixelButton(i18n.t("close"), onClick = onClose)
            }
            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (Plus.available) {
                    PixelButton("✨ " + i18n.android(if (plus) "plusTitle" else "plusGet"), Modifier.fillMaxWidth(), fill = Gold, onClick = onPlus)
                }

                Section(i18n.t("language")) {
                    PixelChip(i18n.android("langAuto"), settings.lang == "auto") { onChange(settings.copy(lang = "auto")) }
                    for ((code, name) in LANGUAGES) PixelChip(name, settings.lang == code) { onChange(settings.copy(lang = code)) }
                }

                // Dark mode is Plus; without it the other choices open the paywall.
                if (Plus.available) {
                    Section("✨ " + i18n.android("theme")) {
                        for ((value, key) in listOf("light" to "themeLight", "dark" to "themeDark", "system" to "themeSystem")) {
                            val on = if (plus) settings.theme == value else value == "light"
                            PixelChip(i18n.android(key), on) {
                                if (plus || value == "light") onChange(settings.copy(theme = value)) else onPlus()
                            }
                        }
                    }
                }

                Section(i18n.t("newDay"), i18n.t("newDayHint")) {
                    for (h in 0 until 12) {
                        PixelChip("%02d:00".format(java.util.Locale.ROOT, h), settings.resetHour == h) { onChange(settings.copy(resetHour = h)) }
                    }
                }

                Section(i18n.android("overlaySection"), i18n.android("overlayBody")) {
                    PixelChip(i18n.android("overlayOn"), settings.overlay) { onChange(settings.copy(overlay = !settings.overlay)) }
                    if (settings.overlay && !overlayOk) PixelButton(i18n.android("usageGrant"), fill = Gold) { Overlay.openSettings(context) }
                    PixelChip(i18n.t("quiet"), settings.quiet) { onChange(settings.copy(quiet = !settings.quiet)) }
                    PixelChip(i18n.t("sounds"), settings.sound) { onChange(settings.copy(sound = !settings.sound)) }
                }
                if (settings.overlay) {
                    if (Plus.available) {
                        Section("✨ " + i18n.android("stayOut"), i18n.android("stayOutHint")) {
                            PixelChip(i18n.android("stayOut"), plus && settings.stayOut) {
                                if (plus) onChange(settings.copy(stayOut = !settings.stayOut)) else onPlus()
                            }
                        }
                    }
                    Section(i18n.t("homeCorner")) {
                        PixelChip(i18n.t("bottomLeft"), settings.side == "left") { onChange(settings.copy(side = "left")) }
                        PixelChip(i18n.t("bottomRight"), settings.side != "left") { onChange(settings.copy(side = "right")) }
                    }
                    Section(i18n.t("size")) {
                        for ((label, scale) in listOf("small" to 3, "medium" to 4, "large" to 5)) {
                            PixelChip(i18n.t(label), settings.scale == scale) { onChange(settings.copy(scale = scale)) }
                        }
                    }
                    Section(i18n.t("nagEvery"), i18n.t("nagHint")) {
                        for (m in listOf(0, 5, 10, 15, 30)) PixelChip("$m", settings.nagMinutes == m) { onChange(settings.copy(nagMinutes = m)) }
                    }
                }

                Text(
                    i18n.android("privacyPolicy"),
                    Modifier.clickable { openUrl(context, PRIVACY_URL) }.padding(vertical = 4.dp),
                    style = PixelText.copy(textDecoration = TextDecoration.Underline),
                )

                // Debug builds only, so not translated.
                if (BuildConfig.DEBUG) {
                    PixelButton("Dev: show intro again", fill = Card) {
                        onChange(settings.copy(onboarded = false))
                        onClose()
                    }
                    // Local only: RevenueCat's next update (purchase, restore, relaunch) sets it back.
                    PixelButton("Dev: Plus ${if (plus) "on → off" else "off → on"}", fill = Card) { onSetPlus(!plus) }
                    PixelButton("Dev: show paywall", fill = Card, onClick = onPlus)
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
