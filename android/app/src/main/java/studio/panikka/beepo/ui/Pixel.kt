package studio.panikka.beepo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Same palette as ui/ui.css.
val Ink = Color(0xFF1B1B2F)
val Paper = Color(0xFFF4F1E8)
val Card = Color.White
val Blue = Color(0xFF7AD1FF)
val Gold = Color(0xFFFFD84A)

val PixelText = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Ink)

/** 3px ink border with a hard offset shadow. */
fun Modifier.pixelBox(fill: Color = Card, shadow: Boolean = true) = this
    .then(if (shadow) Modifier.background(Ink).padding(end = 2.dp, bottom = 2.dp) else Modifier)
    .border(2.dp, Ink)
    .background(fill)
    .padding(2.dp)

@Composable
fun PixelChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .offset(if (selected) 1.dp else 0.dp, if (selected) 1.dp else 0.dp)
            .pixelBox(if (selected) Gold else Card, shadow = !selected)
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(label, style = PixelText.copy(fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal))
    }
}

val Green = Color(0xFF8AFFC1)
val Red = Color(0xFFFF5C7A)
val Muted = Color(0x991B1B2F)

@Composable
fun PixelButton(label: String, modifier: Modifier = Modifier, fill: Color = Blue, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier
            .pixelBox(if (enabled) fill else Paper)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = PixelText.copy(fontWeight = FontWeight.Bold, color = if (enabled) Ink else Muted))
    }
}

/** Single-line text input with an ink border. */
@Composable
fun PixelField(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboard: KeyboardOptions = KeyboardOptions.Default,
) {
    BasicTextField(
        value,
        onChange,
        modifier.border(2.dp, Ink).background(Card).padding(horizontal = 6.dp, vertical = 6.dp),
        textStyle = PixelText,
        singleLine = true,
        keyboardOptions = keyboard,
        decorationBox = { inner ->
            Box {
                if (value.isEmpty()) Text(placeholder, style = PixelText.copy(color = Muted))
                inner()
            }
        },
    )
}

/** Progress bar: `ratio` of the way, capped at full. */
@Composable
fun PixelBar(ratio: Float, fill: Color, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(12.dp).border(2.dp, Ink).background(Color(0xFFEEEEEE)).padding(2.dp)) {
        Box(Modifier.fillMaxWidth(ratio.coerceIn(0f, 1f)).fillMaxHeight().background(fill))
    }
}
