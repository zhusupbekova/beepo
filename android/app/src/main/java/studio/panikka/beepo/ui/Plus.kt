package studio.panikka.beepo.ui

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.revenuecat.purchases.Package
import kotlinx.coroutines.launch
import studio.panikka.beepo.I18n
import studio.panikka.beepo.data.Plus
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.sprite.Look
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.sprite.pet

/** Beepo Plus: what it brings, buy (price from RevenueCat), restore. */
@Composable
fun PlusDialog(store: Store, i18n: I18n, onClose: () -> Unit) {
    val activity = LocalActivity.current
    val scope = rememberCoroutineScope()
    val active by store.plus.collectAsStateWithLifecycle()
    var offer by remember { mutableStateOf<Package?>(null) }
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        offer = Plus.offer()
        loading = false
    }

    val sprites = store.sprites
    val pets = sprites.items.values.filter { it.plus && it.slot == "pet" }
    // Wearing this season's hat (or the latest one seen).
    val seen = store.state.collectAsStateWithLifecycle().value.wallet.seen
    val hat = seen.lastOrNull { sprites.items[it]?.let { i -> i.plus && i.slot == "hat" } == true }

    Dialog(onClose) {
        Column(
            Modifier.fillMaxWidth().pixelBox(Paper).padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("✨ " + i18n.android("plusTitle"), style = PixelText.copy(fontWeight = FontWeight.Bold))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                PixelCanvas(sprites.compose("proud", look = Look(hat?.let { mapOf("hat" to it) }.orEmpty())), 4.dp)
                for (p in pets) sprites.pet(p.id, 0)?.let { PixelCanvas(it, 4.dp) }
            }
            Text(i18n.android("plusBody"), style = PixelText, textAlign = TextAlign.Center)

            when {
                active -> Text(i18n.android("plusActive"), style = PixelText.copy(fontWeight = FontWeight.Bold), textAlign = TextAlign.Center)
                loading -> Text("…", style = PixelText)
                offer == null -> Text(i18n.android("plusOffline"), style = PixelText.copy(color = Muted), textAlign = TextAlign.Center)
                else -> PixelButton(i18n.android("plusBuy", "price" to offer!!.product.price.formatted), Modifier.fillMaxWidth(), fill = Gold, enabled = !busy && activity != null) {
                    val pkg = offer ?: return@PixelButton
                    busy = true
                    note = null
                    scope.launch {
                        note = when (Plus.buy(activity!!, pkg, store)) {
                            Plus.Result.Done, Plus.Result.Cancelled -> null
                            Plus.Result.Failed -> i18n.android("plusFailed")
                        }
                        busy = false
                    }
                }
            }
            note?.let { Text(it, style = PixelText.copy(color = Muted), textAlign = TextAlign.Center) }

            if (!active) {
                PixelButton(i18n.android("plusRestore"), Modifier.fillMaxWidth(), fill = Card, enabled = !busy) {
                    busy = true
                    note = null
                    scope.launch {
                        if (!Plus.restore(store)) note = i18n.android("plusNothing")
                        busy = false
                    }
                }
            }
            PixelButton(i18n.t("close"), Modifier.fillMaxWidth(), fill = Card, onClick = onClose)
        }
    }
}
