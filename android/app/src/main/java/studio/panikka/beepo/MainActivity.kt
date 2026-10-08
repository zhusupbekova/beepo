package studio.panikka.beepo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import studio.panikka.beepo.data.AppInfo
import studio.panikka.beepo.data.Apps
import studio.panikka.beepo.data.Plus
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.ui.BadgesScreen
import studio.panikka.beepo.ui.Header
import studio.panikka.beepo.ui.Onboarding
import studio.panikka.beepo.ui.Paper
import studio.panikka.beepo.ui.PixelChip
import studio.panikka.beepo.ui.PlusDialog
import studio.panikka.beepo.ui.ReportScreen
import studio.panikka.beepo.ui.SettingsScreen
import studio.panikka.beepo.ui.ShopScreen
import studio.panikka.beepo.ui.TodayScreen
import studio.panikka.beepo.usage.UsageAccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val store = Store.get(this)
        Plus.init(this, store)
        setContent { App(store) }
    }
}

private const val REFRESH_MS = 30_000L
private val TABS = listOf("today", "report", "shop", "badges")

/** The popup, as an app: header, tabs, settings. */
@Composable
private fun App(store: Store) {
    val context = LocalContext.current
    val state by store.state.collectAsStateWithLifecycle()
    val plus by store.plus.collectAsStateWithLifecycle()
    val i18n = remember(state.settings.lang) { I18n.load(context.assets, state.settings.lang) }
    var tab by rememberSaveable { mutableStateOf("today") }
    var settingsOpen by rememberSaveable { mutableStateOf(false) }
    var plusOpen by rememberSaveable { mutableStateOf(false) }
    var granted by remember { mutableStateOf(UsageAccess.granted(context)) }
    var apps by remember { mutableStateOf(emptyMap<String, AppInfo>()) }

    LaunchedEffect(Unit) { apps = withContext(Dispatchers.IO) { Apps.launchable(context) } }

    // While open: roll the day over and re-read usage now and then. Checking on every resume
    // also notices usage access granted in system settings.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                granted = UsageAccess.granted(context)
                withContext(Dispatchers.IO) { store.refresh() }
                delay(REFRESH_MS)
            }
        }
    }
    // A different reset hour can mean a different day.
    LaunchedEffect(state.settings.resetHour) { withContext(Dispatchers.IO) { store.refresh() } }

    val dir = if (i18n.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides dir) {
        if (!state.settings.onboarded) {
            Onboarding(state, store.sprites, apps, granted, i18n, store::finishOnboarding)
            return@CompositionLocalProvider
        }
        Column(Modifier.fillMaxSize().background(Paper).safeDrawingPadding()) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Header(state, store.sprites, i18n, onSettings = { settingsOpen = true }, onNewsSeen = store::clearNews)
                when (tab) {
                    "today" -> TodayScreen(state, store, apps, granted, i18n)
                    "report" -> ReportScreen(state, i18n)
                    "shop" -> ShopScreen(state, store, i18n)
                    "badges" -> BadgesScreen(state, store.sprites, i18n)
                }
            }
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (name in TABS) PixelChip(i18n.t("tab_$name"), tab == name) { tab = name }
            }
        }
        if (settingsOpen) SettingsScreen(state.settings, i18n, store::setSettings, onPlus = { plusOpen = true }, plus, store::setPlus) { settingsOpen = false }
        if (plusOpen) PlusDialog(store, i18n) { plusOpen = false }
    }
}
