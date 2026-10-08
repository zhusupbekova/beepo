package studio.panikka.beepo.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.State
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.sprite.pet

private val SLOTS = listOf("color", "hat", "antenna", "accessory", "pet")

/** Shop tab: spend stars on cosmetics (like the popup's). Tap an item to try it on in the preview. */
@Composable
fun ShopScreen(state: State, store: Store, i18n: I18n) {
    val sprites = store.sprites
    val look = state.beepoLook(sprites)
    val w = state.wallet
    var preview by remember { mutableStateOf<String?>(null) }
    val previewItem = preview?.let { sprites.items[it] }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Preview: Beepo (and pet) as he'd look with the tapped item.
        val previewLook = previewItem?.let { look.wearing(it.slot, it.id) } ?: look.look
        Row(
            Modifier.fillMaxWidth().pixelBox().padding(8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.Bottom,
        ) {
            sprites.pet(previewLook.equipped["pet"], 0)?.let { PixelCanvas(it, 4.dp, flip = true) }
            PixelCanvas(sprites.compose(if (previewItem != null) "proud" else "happy", look = previewLook), (5 + look.grow).dp)
        }

        for (slot in SLOTS) {
            val items = sprites.items.values.filter { it.slot == slot }
            if (items.isEmpty()) continue
            Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(i18n.t("slot_$slot"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (item in items) {
                        val owned = item.id in w.owned
                        val on = w.equipped.toMap()[slot] == item.id
                        Column(
                            Modifier.width(96.dp)
                                .pixelBox(if (on || preview == item.id) Gold else Card, shadow = false)
                                .clickable { preview = item.id }
                                .padding(4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Box(Modifier.height(44.dp), contentAlignment = Alignment.BottomCenter) {
                                val frame = if (slot == "pet") sprites.pet(item.id, 0) else sprites.compose("happy", look = look.wearing(slot, item.id))
                                frame?.let { PixelCanvas(it, if (slot == "pet") 4.dp else 2.dp) }
                            }
                            Text(i18n.get("items", item.id), style = PixelText.copy(fontSize = PixelText.fontSize * 0.85f), textAlign = TextAlign.Center, minLines = 2, maxLines = 2)
                            when {
                                on && slot == "color" -> PixelButton(i18n.t("wearing"), enabled = false) {}
                                on -> PixelButton(i18n.t("takeOff"), fill = Card) { store.equip(slot, null) }
                                owned -> PixelButton(i18n.t("wear")) { store.equip(slot, item.id) }
                                else -> PixelButton("⭐ ${item.price}", enabled = w.stars >= item.price) { store.buy(item.id) }
                            }
                        }
                    }
                }
            }
        }
    }
}
