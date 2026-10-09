package studio.panikka.beepo.overlay

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.panikka.beepo.sprite.Frame
import studio.panikka.beepo.ui.Ink
import studio.panikka.beepo.ui.Muted
import studio.panikka.beepo.ui.PixelButton
import studio.panikka.beepo.ui.PixelCanvas
import studio.panikka.beepo.ui.PixelText
import studio.panikka.beepo.ui.Red
import studio.panikka.beepo.ui.pixelBox
import kotlin.math.floor
import kotlin.random.Random

class Action(val label: String, val run: () -> Unit)

class Bubble(val text: String, val meta: String, val actions: List<Action> = emptyList())

/** One frame of the on-screen Beepo, built by the service. */
class BuddyView(
    val beepo: Frame,
    val cell: Int,
    val pet: Frame?,
    val petLeft: Boolean,
    /** "STOP" while over a limit (he holds up a sign), else null. */
    val stop: String?,
    /** A little hop (dp up), for good news. */
    val hop: Int = 0,
)

/**
 * Pet + Beepo (+ STOP sign) standing on the bottom edge. The bubble is a window of its own: a
 * window that changes size catches up a frame late, which made him jump when it opened and closed.
 */
@Composable
fun StageUi(v: BuddyView, onBeepoTap: () -> Unit, onBeepoHold: () -> Unit, onSize: (IntSize) -> Unit) {
    // Headroom for the hop, so it isn't cut off at the window's top.
    Row(Modifier.onSizeChanged(onSize).padding(top = (v.cell * 3).dp), verticalAlignment = Alignment.Bottom) {
        // Beepo's last row is empty and hangs past the screen edge; the rest stands on the edge.
        val ground = Modifier.padding(bottom = v.cell.dp)
        // Pets face left; on his left they turn around, to face him (and their way when following).
        if (v.pet != null && v.petLeft) PixelCanvas(v.pet, maxOf(2, v.cell - 1).dp, ground, flip = true)
        PixelCanvas(
            v.beepo,
            v.cell.dp,
            Modifier
                .offset(y = (-v.hop).dp)
                .pointerInput(Unit) { detectTapGestures(onTap = { onBeepoTap() }, onLongPress = { onBeepoHold() }) },
        )
        if (v.stop != null) StopSign(v.stop, v.cell, ground)
        if (v.pet != null && !v.petLeft) PixelCanvas(v.pet, maxOf(2, v.cell - 1).dp, ground)
    }
}

/** What Beepo says, above him: text, buttons (snooze), and the numbers. */
@Composable
fun BubbleUi(b: Bubble, rtl: Boolean, closeLabel: String, onClose: () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Column(
            Modifier.widthIn(max = 260.dp).padding(horizontal = 4.dp).pixelBox().padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Text(b.text, Modifier.weight(1f, fill = false), style = PixelText)
                Text(
                    "×",
                    Modifier.clickable(onClickLabel = closeLabel, onClick = onClose).padding(start = 8.dp),
                    style = PixelText.copy(fontWeight = FontWeight.Bold),
                )
            }
            for (a in b.actions) PixelButton(a.label, onClick = a.run)
            if (b.meta.isNotEmpty()) Text(b.meta, style = PixelText.copy(color = Muted, fontSize = 11.sp))
        }
    }
}

@Composable
private fun StopSign(label: String, cell: Int, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        SignBoard(label, cell)
        Box(Modifier.background(Ink).padding(horizontal = 1.dp, vertical = (cell * 3).dp))
    }
}

/** Beepo up in the camera hole: hanging upside down with his head out, or dropped on a thread. */
class CameraView(
    val beepo: Frame,
    /** Pixels per sprite pixel. */
    val cellPx: Int,
    /** Upside down, head out of the hole (else upright, on a thread). */
    val peek: Boolean,
    /** Window size and where Beepo's top-left sits in it (the hole is at the top edge). */
    val width: Int,
    val height: Int,
    val beepoY: Int,
    /** Thread length from the hole to the top of his head (0 when peeking). */
    val thread: Int,
    val threadX: Int,
    val stop: String?,
    val stopCell: Int,
    /** Over the limit while hidden: only the STOP sign hangs out of the hole, on a pole this long. */
    val signPole: Int = -1,
)

@Composable
fun CameraUi(v: CameraView, onTap: () -> Unit) {
    val d = LocalDensity.current
    if (v.signPole >= 0 && v.stop != null) {
        Column(
            Modifier.pointerInput(Unit) { detectTapGestures(onTap = { onTap() }) },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            with(d) { Box(Modifier.size(maxOf(2, v.cellPx / 2).toDp(), v.signPole.toDp()).background(Ink)) }
            SignBoard(v.stop, v.stopCell)
        }
        return
    }
    with(d) {
        Box(
            Modifier
                .size(v.width.toDp(), v.height.toDp())
                .clipToBounds()
                .pointerInput(Unit) { detectTapGestures(onTap = { onTap() }) },
        ) {
            if (v.thread > 0) {
                Box(Modifier.offset(v.threadX.toDp(), 0.dp).size(maxOf(2, v.cellPx / 2).toDp(), v.thread.toDp()).background(Ink))
            }
            Row(Modifier.offset(0.dp, v.beepoY.toDp()), verticalAlignment = Alignment.Bottom) {
                PixelCanvas(v.beepo, v.cellPx.toDp(), flipY = v.peek)
                if (v.stop != null) StopSign(v.stop, v.stopCell)
            }
        }
    }
}

/** Beepo mid-jump (fixed-size window; he shrinks inside it, so the window never resizes). */
@Composable
fun FlightUi(beepo: Frame, cell: Int, scale: Float) {
    Box(Modifier.size((beepo.width * cell).dp, (beepo.height * cell).dp), contentAlignment = Alignment.Center) {
        PixelCanvas(beepo, cell.dp, Modifier.graphicsLayer { scaleX = scale; scaleY = scale })
    }
}

@Composable
private fun SignBoard(label: String, cell: Int) {
    Box(Modifier.border(2.dp, Ink).background(Red).padding(horizontal = 4.dp, vertical = 2.dp)) {
        Text(label, style = PixelText.copy(color = Color.White, fontWeight = FontWeight.Bold, fontSize = (cell * 2.5f).sp))
    }
}

/** One bit of confetti: where it flies (dp from the burst), its spin and how long it takes. */
class Piece(val color: Color, val dx: Float, val up: Float, val fall: Float, val spin: Float, val ms: Int)

fun confettiPieces(random: Random = Random.Default) = List(28) {
    Piece(
        // Party colors, bright in dark mode too.
        color = Color(listOf(0xFFFFD84A, 0xFFFF5C7A, 0xFF8AFFC1, 0xFF7AD1FF, 0xFF9B7BFF).random(random)),
        dx = random.nextInt(-160, 160).toFloat(),
        up = random.nextInt(80, 220).toFloat(),
        fall = random.nextInt(20, 120).toFloat(),
        spin = random.nextInt(90, 360).toFloat(),
        ms = random.nextInt(1100, 1700),
    )
}

/**
 * Confetti bursting from [origin] (dp in the window), like the page's: up and out, then down and
 * fading, in 12 steps.
 */
@Composable
fun ConfettiUi(pieces: List<Piece>, origin: Offset) {
    var ms by remember { mutableLongStateOf(0L) }
    LaunchedEffect(Unit) {
        val start = withFrameMillis { it }
        while (true) withFrameMillis { ms = it - start }
    }
    Canvas(Modifier.fillMaxSize()) {
        val size = 6.dp.toPx()
        for (p in pieces) {
            val t = floor(minOf(1f, ms / p.ms.toFloat()) * 12) / 12
            if (t >= 1f) continue
            val (x, y) = if (t < 0.4f) {
                val k = t / 0.4f
                p.dx * 0.6f * k to -p.up * k
            } else {
                val k = (t - 0.4f) / 0.6f
                p.dx * (0.6f + 0.4f * k) to -p.up + (p.fall + p.up) * k
            }
            val spin = if (t < 0.4f) 0f else p.spin * (t - 0.4f) / 0.6f
            val alpha = if (t < 0.4f) 1f else 1 - (t - 0.4f) / 0.6f
            val at = Offset((origin.x + x).dp.toPx(), (origin.y + y).dp.toPx())
            rotate(spin, at) { drawRect(p.color, at - Offset(size / 2, size / 2), Size(size, size), alpha) }
        }
    }
}
