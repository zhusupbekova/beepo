package studio.panikka.beepo.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.layout.size
import studio.panikka.beepo.sprite.Frame
import kotlin.math.floor

/** Draws a sprite frame as hard-edged squares, `cell` per pixel. */
@Composable
fun PixelCanvas(frame: Frame, cell: Dp, modifier: Modifier = Modifier, flip: Boolean = false) {
    Canvas(modifier.size(cell * frame.width, cell * frame.height)) {
        val s = floor(size.width / frame.width)
        for ((y, row) in frame.grid.withIndex()) {
            for ((x, c) in row.withIndex()) {
                val argb = frame.palette[c] ?: continue
                val col = if (flip) frame.width - 1 - x else x
                drawRect(Color(argb), Offset(col * s, y * s), Size(s, s))
            }
        }
    }
}
