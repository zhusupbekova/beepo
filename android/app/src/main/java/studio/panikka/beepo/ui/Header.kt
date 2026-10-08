package studio.panikka.beepo.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.News
import studio.panikka.beepo.core.State
import studio.panikka.beepo.sprite.Sprites
import studio.panikka.beepo.sprite.compose

/** Beepo, stars and streaks on top (like the popup header), then his queued news. */
@Composable
fun Header(state: State, sprites: Sprites, i18n: I18n, onSettings: () -> Unit, onNewsSeen: () -> Unit) {
    val look = state.beepoLook(sprites)
    val s = look.streaks
    // Pick the lines once per batch of news, not on every recomposition.
    val news = remember(state.pending, i18n) { state.pending.mapNotNull { newsLine(it, i18n) } }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PixelCanvas(sprites.compose(news.firstOrNull()?.second ?: look.mood, look = look.look), 2.dp)
            Column(Modifier.weight(1f)) {
                Text("⭐ ${state.wallet.stars}", style = PixelText.copy(fontWeight = FontWeight.Bold, fontSize = 16.sp))
                Text(
                    if (s.missStreak >= 2) i18n.t("streakRough", "n" to s.missStreak)
                    else i18n.t("streakLine", "limit" to s.limitStreak, "goal" to s.goalStreak),
                    style = PixelText.copy(color = Muted),
                )
            }
            Text(
                "⚙️",
                Modifier.semantics { contentDescription = i18n.t("settings") }.clickable(onClick = onSettings).padding(8.dp),
                style = PixelText.copy(fontSize = 22.sp),
            )
        }
        if (news.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().pixelBox(Gold).clickable(onClick = onNewsSeen).padding(8.dp), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for ((text) in news) Text(text, style = PixelText)
                }
                Text("×", Modifier.semantics { contentDescription = i18n.t("close") }.padding(horizontal = 4.dp), style = PixelText.copy(fontWeight = FontWeight.Bold))
            }
        }
    }
}

/** Text + mood for one piece of news; badge / evolve ids become names in the current language. */
private fun newsLine(n: News, i18n: I18n): Pair<String, String>? {
    val vars = n.vars.toMutableMap<String, Any?>()
    n.vars["id"]?.let { vars["name"] = if (n.key == "badge") i18n.badgeName(it) else i18n.get("evolve", it) }
    return i18n.line(n.key, vars)
}
