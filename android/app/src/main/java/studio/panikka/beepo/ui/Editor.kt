package studio.panikka.beepo.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.CustomItem
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.sprite.Look
import studio.panikka.beepo.sprite.compose

private const val KEEP = '.'
private const val ERASE = '_'
private val EDIT_SLOTS = listOf("hat" to "edSlotHat", "accessory" to "edSlotAccessory", "antenna" to "edSlotAntenna")

/**
 * Sprite editor (Plus; like the extension's editor page): paint an overlay on top of Beepo, save
 * it to the shop. `editing` is a creation to change, or null for a new one.
 */
@Composable
fun EditorScreen(store: Store, i18n: I18n, editing: CustomItem?, onClose: () -> Unit) {
    val sprites = store.sprites
    val w = sprites.width
    val h = sprites.height
    fun grid(rows: Map<Int, String>) = List(h) { y -> (rows[y] ?: "").padEnd(w, KEEP).take(w).toCharArray() }

    val id = editing?.id.orEmpty()
    var name by remember { mutableStateOf(editing?.name.orEmpty()) }
    var slot by remember { mutableStateOf(editing?.slot ?: "hat") }
    var cells by remember { mutableStateOf(grid(editing?.rows.orEmpty().mapKeys { it.key.toInt() })) }
    var brush by remember { mutableStateOf('k') }
    var msg by remember { mutableStateOf<String?>(null) }

    val rows = cells.withIndex().filter { (_, r) -> r.any { it != KEEP } }.associate { (y, r) -> y to String(r) }
    val item = CustomItem(id, slot, name.trim().ifEmpty { i18n.t("edDefaultName") }, rows.mapKeys { "${it.key}" })
    val under = sprites.compose("happy")

    fun paint(at: Offset, cellPx: Float) {
        val x = (at.x / cellPx).toInt()
        val y = (at.y / cellPx).toInt()
        if (x !in 0 until w || y !in 0 until h || cells[y][x] == brush) return
        cells = cells.mapIndexed { i, r -> if (i == y) r.copyOf().also { it[x] = brush } else r }
        msg = null
    }

    FullScreenDialog(onClose) {
        Column(
            Modifier.fillMaxSize().background(Paper).safeDrawingPadding().verticalScroll(rememberScrollState()).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(i18n.t("edTitle"), Modifier.weight(1f), style = PixelText.copy(fontWeight = FontWeight.Bold))
                Text("×", Modifier.clickable(onClick = onClose).padding(horizontal = 8.dp), style = PixelText.copy(fontWeight = FontWeight.Bold))
            }
            Text(i18n.android("edHint"), style = PixelText.copy(color = Muted))

            // The canvas: Beepo faded underneath, the overlay on top, a light grid.
            Canvas(
                Modifier
                    .fillMaxWidth(0.8f)
                    .align(Alignment.CenterHorizontally)
                    .aspectRatio(w / h.toFloat())
                    .border(2.dp, Ink)
                    .background(Card)
                    .pointerInput(Unit) {
                        detectTapGestures { paint(it, size.width / w.toFloat()) }
                    }
                    .pointerInput(Unit) {
                        detectDragGestures(onDragStart = { paint(it, size.width / w.toFloat()) }) { change, _ ->
                            paint(change.position, size.width / w.toFloat())
                        }
                    },
            ) {
                val c = size.width / w
                for ((y, r) in under.grid.withIndex()) for ((x, k) in r.withIndex()) {
                    val argb = under.palette[k] ?: continue
                    drawRect(Color(argb), Offset(x * c, y * c), Size(c, c), alpha = 0.35f)
                }
                for ((y, r) in cells.withIndex()) for ((x, k) in r.withIndex()) {
                    val at = Offset(x * c, y * c)
                    when (k) {
                        KEEP -> {}
                        ERASE -> drawLine(Red, at + Offset(c * 0.2f, c * 0.2f), at + Offset(c * 0.8f, c * 0.8f), strokeWidth = 2.dp.toPx())
                        else -> sprites.palette[k]?.let { drawRect(Color(it), at, Size(c, c)) }
                    }
                }
                val line = Ink.copy(alpha = 0.08f)
                for (x in 0..w) drawLine(line, Offset(x * c, 0f), Offset(x * c, size.height))
                for (y in 0..h) drawLine(line, Offset(0f, y * c), Offset(size.width, y * c))
            }

            // Brushes: the palette, ⌫ (erase Beepo's own pixel) and · (leave the pixel as it is).
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val keys = sprites.palette.keys.filter { it != 'a' } + ERASE + KEEP
                for (k in keys) {
                    val color = sprites.palette[k]
                    Box(
                        Modifier
                            .size(32.dp)
                            .border(if (k == brush) 4.dp else 2.dp, if (k == brush) Gold else Ink)
                            .background(color?.let { Color(it) } ?: Card)
                            .clickable { brush = k },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (color == null) Text(if (k == ERASE) "⌫" else "·", style = PixelText.copy(fontWeight = FontWeight.Bold))
                    }
                }
            }

            Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(i18n.t("edName"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                PixelField(name, { name = it }, Modifier.fillMaxWidth(), placeholder = i18n.t("edNamePh"))
                Text(i18n.t("edSlot"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for ((s, key) in EDIT_SLOTS) PixelChip(i18n.t(key), slot == s) { slot = s }
                }
                // Start from a shop item of this slot (or blank).
                Text(i18n.t("edStart"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PixelChip(i18n.t("edBlank"), false) { cells = grid(emptyMap()) }
                    for (it in sprites.items.values.filter { it.slot == slot && it.rows.isNotEmpty() }) {
                        PixelChip(i18n.get("items", it.id), false) { cells = grid(it.rows) }
                    }
                }
            }

            Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(i18n.t("edPreview"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                val look = Look(mapOf(slot to "__preview"), custom = listOf(item.copy(id = "__preview").toItem()))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    for (mood in listOf("happy", "angry", "sleepy")) PixelCanvas(sprites.compose(mood, look = look), 4.dp)
                }
            }

            msg?.let { Text(it, Modifier.fillMaxWidth(), style = PixelText.copy(fontWeight = FontWeight.Bold), textAlign = TextAlign.Center) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (id.isNotEmpty()) PixelButton(i18n.t("delete"), fill = Card) {
                    store.deleteCustom(id)
                    onClose()
                }
                PixelButton(i18n.t("edClear"), fill = Card) {
                    cells = grid(emptyMap())
                    msg = null
                }
                Spacer(Modifier.weight(1f))
                PixelButton(i18n.t("edSave"), fill = Gold) {
                    if (rows.isEmpty()) msg = i18n.t("edDrawFirst")
                    else {
                        store.saveCustom(item)
                        onClose()
                    }
                }
            }
        }
    }
}
