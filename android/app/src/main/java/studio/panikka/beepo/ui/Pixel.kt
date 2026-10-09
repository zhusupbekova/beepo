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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import studio.panikka.beepo.core.Settings

/**
 * Light (same palette as ui/ui.css) or dark (Plus). Everything reads the colors below, which follow
 * [Theme.dark]; it's snapshot state, so screens and overlay windows redraw when it changes.
 */
object Theme {
    var dark by mutableStateOf(false)

    /** Dark only with Plus: always, or when the phone is dark ("system"). */
    fun isDark(settings: Settings, plus: Boolean, phoneDark: Boolean) =
        plus && (settings.theme == "dark" || (settings.theme == "system" && phoneDark))
}

private fun themed(light: Long, dark: Long) = Color(if (Theme.dark) dark else light)

/** Text and borders. */
val Ink get() = themed(0xFF1B1B2F, 0xFFE8E4FF)
val Paper get() = themed(0xFFF4F1E8, 0xFF1E1E36)
val Card get() = themed(0xFFFFFFFF, 0xFF2B2B4A)
/** Fills: bright in light, deeper in dark so light text stays readable on them. */
val Blue get() = themed(0xFF7AD1FF, 0xFF2F6E96)
val Gold get() = themed(0xFFFFD84A, 0xFF8A6D12)
val Green get() = themed(0xFF8AFFC1, 0xFF2E7D5A)
val Red get() = themed(0xFFFF5C7A, 0xFFA8344D)
val Muted get() = Ink.copy(alpha = 0.6f)
/** The empty part of a progress bar. */
val Track get() = themed(0xFFEEEEEE, 0xFF3A3A5C)

val PixelText get() = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Ink)

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
    Box(modifier.fillMaxWidth().height(12.dp).border(2.dp, Ink).background(Track).padding(2.dp)) {
        Box(Modifier.fillMaxWidth(ratio.coerceIn(0f, 1f)).fillMaxHeight().background(fill))
    }
}
