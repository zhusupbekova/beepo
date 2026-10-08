package studio.panikka.beepo.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.BADGES
import studio.panikka.beepo.core.State
import studio.panikka.beepo.sprite.Sprites

/** Badges tab: earned / locked badges and Beepo's evolution steps (like the popup's). */
@Composable
fun BadgesScreen(state: State, sprites: Sprites, i18n: I18n) {
    val s = state.beepoLook(sprites).streaks
    val best = maxOf(s.limitStreak, s.goalStreak)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (b in BADGES) {
            val earned = b.id in state.wallet.badges
            Column(Modifier.fillMaxWidth().pixelBox(if (earned) Card else Paper, shadow = earned).padding(8.dp)) {
                Text(
                    (if (earned) "🏅 " else "🔒 ") + i18n.badgeName(b.id),
                    style = PixelText.copy(fontWeight = FontWeight.Bold, color = if (earned) Ink else Muted),
                )
                Text(i18n.badgeDesc(b.id), style = PixelText.copy(color = Muted))
            }
        }
        Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(i18n.t("evoTitle"), style = PixelText.copy(fontWeight = FontWeight.Bold))
            Text(i18n.t("evoIntro", "n" to best), style = PixelText.copy(color = Muted))
            for (e in sprites.evolve) {
                Text(
                    (if (best >= e.minStreak) "✅ " else "⬜ ") + i18n.t("evoStep", "name" to i18n.get("evolve", e.id), "n" to e.minStreak),
                    style = PixelText,
                )
            }
            Text((if (s.missStreak >= 2) "😿 " else "⬜ ") + i18n.t("scruffy"), style = PixelText)
        }
    }
}
