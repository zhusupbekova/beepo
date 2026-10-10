package studio.panikka.beepo.overlay

import android.view.WindowInsets
import android.view.WindowInsetsController
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.panikka.beepo.sprite.Frame
import studio.panikka.beepo.ui.Card
import studio.panikka.beepo.ui.Gold
import studio.panikka.beepo.ui.Muted
import studio.panikka.beepo.ui.Paper
import studio.panikka.beepo.ui.PixelButton
import studio.panikka.beepo.ui.PixelCanvas
import studio.panikka.beepo.ui.PixelText

class BlockView(
    val beepo: Frame,
    val title: String,
    val info: String,
    val unlock: String,
    /** Why unlocking is off (no stars), else null. */
    val noStars: String?,
    val close: String,
    val rtl: Boolean,
)

/** Full screen, like the extension's block page: Beepo guarding the door, unlock for a star, or leave. */
@Composable
fun BlockUi(v: BlockView, onUnlock: () -> Unit, onClose: () -> Unit) {
    // It covers the whole screen, and an overlay can't color the bar icons (they follow the app
    // behind it), so the bars hide while it's up; a swipe brings them back for a moment.
    val view = LocalView.current
    SideEffect {
        view.windowInsetsController?.run {
            systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsets.Type.systemBars())
        }
    }
    CompositionLocalProvider(LocalLayoutDirection provides if (v.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Column(
            Modifier
                .fillMaxSize()
                .background(Paper)
                // Swallow touches so nothing behind gets them.
                .clickable(remember { MutableInteractionSource() }, indication = null) {}
                .safeDrawingPadding()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PixelCanvas(v.beepo, 8.dp)
            Text(v.title, style = PixelText.copy(fontWeight = FontWeight.Bold, fontSize = 20.sp), textAlign = TextAlign.Center)
            Text(v.info, style = PixelText.copy(color = Muted), textAlign = TextAlign.Center)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PixelButton(v.unlock, fill = Gold, enabled = v.noStars == null, onClick = onUnlock)
                PixelButton(v.close, fill = Card, onClick = onClose)
            }
            v.noStars?.let { Text(it, style = PixelText.copy(color = Muted), textAlign = TextAlign.Center) }
        }
    }
}
