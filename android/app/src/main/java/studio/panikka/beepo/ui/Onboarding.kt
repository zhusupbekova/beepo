package studio.panikka.beepo.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import studio.panikka.beepo.I18n
import studio.panikka.beepo.PRIVACY_URL
import studio.panikka.beepo.core.Rule
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.matchApp
import studio.panikka.beepo.core.newId
import studio.panikka.beepo.data.AppInfo
import studio.panikka.beepo.openUrl
import studio.panikka.beepo.sprite.Sprites
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.usage.UsageAccess

private const val STEPS = 4
private const val WEEK_MS = 7 * 24 * 3_600_000L
private const val PICK_MAX = 8
private const val PRESELECT = 3

/**
 * First-run intro: hello, how it works, usage access (with the privacy promise, before sending
 * anyone to system settings), then a few of the week's most used apps to limit right away.
 * `onDone` gets the rules to add (none if skipped).
 */
@Composable
fun Onboarding(state: State, sprites: Sprites, apps: Map<String, AppInfo>, granted: Boolean, i18n: I18n, onDone: (List<Rule>) -> Unit) {
    val context = LocalContext.current
    var step by rememberSaveable { mutableIntStateOf(0) }
    var minutes by rememberSaveable { mutableIntStateOf(30) }
    var picked by rememberSaveable { mutableStateOf<List<String>?>(null) }
    BackHandler(enabled = step > 0) { step-- }

    // The week's most used apps, once usage access is on.
    val top by produceState(emptyList<Pair<AppInfo, Long>>(), granted, apps) {
        if (!granted || apps.isEmpty()) return@produceState
        val now = System.currentTimeMillis()
        value = withContext(Dispatchers.IO) { UsageAccess.foreground(context, now - WEEK_MS, now) }
            .filter { (pkg, ms) -> pkg in apps && ms >= 60_000 && matchApp(state.rules, pkg) == null }
            .entries.sortedByDescending { it.value }
            .take(PICK_MAX)
            .map { apps.getValue(it.key) to it.value / 1000 }
    }
    val selected = picked ?: top.take(PRESELECT).map { it.first.pkg }

    var tick by rememberSaveable { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(300)
            tick++
        }
    }
    val (mood, pose) = when (step) {
        0 -> "happy" to if (tick % 4 < 2) "wave" else null
        1 -> "proud" to null
        2 -> (if (granted) "party" else if (tick % 12 == 0) "blink" else "neutral") to null
        else -> "happy" to null
    }

    Column(Modifier.fillMaxSize().background(Paper).safeDrawingPadding().padding(16.dp)) {
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically),
        ) {
            PixelCanvas(sprites.compose(mood, pose, state.beepoLook(sprites).look), 8.dp)
            when (step) {
                0 -> {
                    Title(i18n.android("obHello"))
                    Body(i18n.android("obIntro"))
                }
                1 -> {
                    Title(i18n.android("obHowTitle"))
                    Column(Modifier.fillMaxWidth().pixelBox().padding(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        for ((icon, key) in listOf("⏳" to "obLimits", "🎯" to "obGoals", "⭐" to "obStars", "🔥" to "obStreaks")) {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(icon, style = PixelText.copy(fontSize = 18.sp))
                                Text(i18n.android(key), style = PixelText)
                            }
                        }
                    }
                }
                2 -> {
                    Title(i18n.android("usageTitle"))
                    Body(i18n.android("usageBody"))
                    Column(Modifier.fillMaxWidth().pixelBox(Gold).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("🔒 " + i18n.android("obOffline"), style = PixelText)
                        Text(
                            i18n.android("privacyPolicy"),
                            Modifier.clickable { openUrl(context, PRIVACY_URL) },
                            style = PixelText.copy(fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline),
                        )
                    }
                    if (granted) Text(i18n.android("obGranted"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                    else Body(i18n.android("usageFind"), muted = true)
                }
                else -> {
                    Title(i18n.android("obPickTitle"))
                    if (top.isEmpty()) Body(i18n.android("obNoApps"), muted = true)
                    else {
                        Body(i18n.android("obPickHint"), muted = true)
                        Column(Modifier.fillMaxWidth().pixelBox()) {
                            for ((app, secs) in top) {
                                val on = app.pkg in selected
                                Row(
                                    Modifier.fillMaxWidth()
                                        .clickable { picked = if (on) selected - app.pkg else selected + app.pkg }
                                        .padding(horizontal = 8.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Box(Modifier.size(16.dp).border(2.dp, Ink).background(if (on) Ink else Card))
                                    AppIcon(app, 28)
                                    Text(app.label, Modifier.weight(1f), style = PixelText, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(i18n.duration(secs), style = PixelText.copy(color = Muted))
                                }
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(i18n.android("obMinutes"), style = PixelText.copy(color = Muted))
                            for (m in listOf(15, 30, 60)) PixelChip(i18n.t("m", "m" to m), minutes == m) { minutes = m }
                        }
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.Center) {
            Text((0 until STEPS).joinToString(" ") { if (it == step) "●" else "○" }, style = PixelText.copy(color = Muted))
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (step > 0) PixelButton(i18n.android("back"), fill = Card) { step-- }
            Spacer(Modifier.weight(1f))
            when {
                step < 2 -> PixelButton(i18n.android("next")) { step++ }
                step == 2 && !granted -> {
                    PixelButton(i18n.android("notNow"), fill = Card) { onDone(emptyList()) }
                    PixelButton(i18n.android("usageGrant")) { UsageAccess.openSettings(context) }
                }
                step == 2 -> PixelButton(i18n.android("next")) { step++ }
                else -> PixelButton(i18n.android("start")) {
                    onDone(top.filter { it.first.pkg in selected }.map { (app) -> Rule(newId(), app.label, apps = listOf(app.pkg), minutes = minutes) })
                }
            }
        }
    }
}

@Composable
private fun Title(text: String) =
    Text(text, style = PixelText.copy(fontWeight = FontWeight.Bold, fontSize = 20.sp), textAlign = TextAlign.Center)

@Composable
private fun Body(text: String, muted: Boolean = false) =
    Text(text, Modifier.fillMaxWidth(), style = PixelText.copy(color = if (muted) Muted else Ink), textAlign = TextAlign.Center)
