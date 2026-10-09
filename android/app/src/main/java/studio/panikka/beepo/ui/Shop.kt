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
import studio.panikka.beepo.core.CustomItem
import studio.panikka.beepo.core.State
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import studio.panikka.beepo.data.Plus
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.sprite.pet
import studio.panikka.beepo.sprite.scene

private val SLOTS = listOf("color", "hat", "antenna", "accessory", "pet", "scene")

/** Shop tab: spend stars on cosmetics (like the popup's). Tap an item to try it on in the preview. */
@Composable
fun ShopScreen(state: State, store: Store, i18n: I18n) {
    val sprites = store.sprites
    val look = state.beepoLook(sprites)
    val w = state.wallet
    val plus by store.plus.collectAsStateWithLifecycle()
    var preview by remember { mutableStateOf<String?>(null) }
    var plusOpen by remember { mutableStateOf(false) }
    /** The editor: a creation to change, or a blank one (id ""). */
    var editing by remember { mutableStateOf<CustomItem?>(null) }
    val previewItem = preview?.let { sprites.items[it] }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Preview: Beepo (and pet) as he'd look with the tapped item.
        val previewLook = previewItem?.let { look.wearing(it.slot, it.id) } ?: look.look
        val mood = if (previewItem != null) "proud" else "happy"
        // A scene shows as on the widget: Beepo and his pet standing in it.
        val scene = previewItem?.takeIf { it.slot == "scene" }?.let {
            sprites.scene(it.id, sprites.compose(mood, look = previewLook), sprites.pet(previewLook.equipped["pet"], 0))
        }
        Row(
            Modifier.fillMaxWidth().pixelBox().padding(8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.Bottom,
        ) {
            if (scene != null) PixelCanvas(scene, 5.dp)
            else {
                sprites.pet(previewLook.equipped["pet"], 0)?.let { PixelCanvas(it, 4.dp, flip = true) }
                PixelCanvas(sprites.compose(mood, look = previewLook), (5 + look.grow).dp)
            }
        }

        // Your own hats and things (Plus).
        if (Plus.available) {
            PixelButton(i18n.android("edMake") + if (plus) "" else " ✨", Modifier.fillMaxWidth(), fill = Gold) {
                if (plus) editing = CustomItem("", "hat", "", emptyMap()) else plusOpen = true
            }
        }

        for (slot in SLOTS) {
            val items = sprites.items.values.filter { it.slot == slot && (it.season == null || it.id in w.seen) }
            val mine = state.custom.filter { it.slot == slot }
            if (items.isEmpty() && mine.isEmpty()) continue
            // Scenes only show on the widget, which is Plus.
            if (slot == "scene" && !Plus.available) continue
            Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (slot == "scene") {
                    Text(i18n.android("scenes"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                    Text(i18n.android("sceneHint"), style = PixelText.copy(color = Muted))
                } else Text(i18n.t("slot_$slot"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (c in mine) {
                        val on = w.equipped.toMap()[slot] == c.id
                        Column(
                            Modifier.width(96.dp)
                                .pixelBox(if (on) Gold else Card, shadow = false)
                                .clickable { if (plus) editing = c else plusOpen = true }
                                .padding(4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Box(Modifier.height(44.dp), contentAlignment = Alignment.BottomCenter) {
                                PixelCanvas(sprites.compose("happy", look = look.wearing(slot, c.id)), 2.dp)
                            }
                            Text("${c.name} ✏", style = PixelText.copy(fontSize = PixelText.fontSize * 0.85f), textAlign = TextAlign.Center, minLines = 2, maxLines = 2)
                            when {
                                on -> PixelButton(i18n.t("takeOff"), fill = Card) { store.equip(slot, null) }
                                plus -> PixelButton(i18n.t("wear")) { store.equip(slot, c.id) }
                                else -> PixelButton("✨ Plus", fill = Gold, enabled = Plus.available) { plusOpen = true }
                            }
                        }
                    }
                    for (item in items) {
                        val owned = item.id in w.owned || (plus && item.plus)
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
                                val frame = when (slot) {
                                    "pet" -> sprites.pet(item.id, 0)
                                    "scene" -> sprites.scene(item.id, sprites.compose("happy", look = look.look), sprites.pet(look.look.equipped["pet"], 0))
                                    else -> sprites.compose("happy", look = look.wearing(slot, item.id))
                                }
                                frame?.let { PixelCanvas(it, if (slot == "pet") 4.dp else if (slot == "scene") 1.8.dp else 2.dp) }
                            }
                            Text(i18n.get("items", item.id), style = PixelText.copy(fontSize = PixelText.fontSize * 0.85f), textAlign = TextAlign.Center, minLines = 2, maxLines = 2)
                            when {
                                on && slot == "color" -> PixelButton(i18n.t("wearing"), enabled = false) {}
                                on -> PixelButton(if (slot == "scene") i18n.android("sceneOff") else i18n.t("takeOff"), fill = Card) { store.equip(slot, null) }
                                owned -> PixelButton(if (slot == "scene") i18n.android("sceneUse") else i18n.t("wear")) { store.equip(slot, item.id) }
                                item.plus -> PixelButton("✨ Plus", fill = Gold, enabled = Plus.available) {
                                    preview = item.id
                                    plusOpen = true
                                }
                                else -> PixelButton("⭐ ${item.price}", enabled = w.stars >= item.price) { store.buy(item.id) }
                            }
                        }
                    }
                }
            }
        }
    }
    if (plusOpen) PlusDialog(store, i18n) { plusOpen = false }
    editing?.let { EditorScreen(store, i18n, it.takeIf { c -> c.id.isNotEmpty() }) { editing = null } }
}
