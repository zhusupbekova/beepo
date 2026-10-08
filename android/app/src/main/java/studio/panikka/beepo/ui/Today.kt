package studio.panikka.beepo.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.Day
import studio.panikka.beepo.core.Mode
import studio.panikka.beepo.core.Rule
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.baseLimitSecs
import studio.panikka.beepo.core.matchApp
import studio.panikka.beepo.core.newId
import studio.panikka.beepo.data.AppInfo
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.usage.UsageAccess

private const val PHONE_TODAY_MAX = 12

/**
 * Today tab: tracked rules with progress, then today's untracked apps with quick limits (like the
 * popup). Usage comes from [Store.refresh], which MainActivity runs while the app is open.
 */
@Composable
fun TodayScreen(state: State, store: Store, apps: Map<String, AppInfo>, granted: Boolean, i18n: I18n) {
    val context = LocalContext.current
    val rules = state.rules
    val key = state.today()
    val day = state.day ?: Day(key)
    val appSecs = day.domains
    var editing by remember { mutableStateOf<Rule?>(null) }

    fun addRule(app: AppInfo, minutes: Int) {
        store.setRules(rules + Rule(newId(), app.label, apps = listOf(app.pkg), minutes = minutes))
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!granted) UsageAccessCard(i18n) { UsageAccess.openSettings(context) }

        // The empty hint points at "Today on your phone", which needs usage access.
        if (rules.isNotEmpty() || granted) {
            Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (rules.isEmpty()) Text(i18n.android("noRules"), style = PixelText.copy(color = Muted))
                for (rule in rules) {
                    RuleRow(rule, day.usage[rule.id] ?: 0, baseLimitSecs(rule, key), rule.apps.mapNotNull { apps[it] }, i18n) { editing = rule }
                }
            }
        }

        if (granted) {
            val untracked = appSecs.entries
                .filter { (pkg, secs) -> secs >= 60 && pkg in apps && matchApp(rules, pkg) == null }
                .sortedByDescending { it.value }
                .take(PHONE_TODAY_MAX)
            Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(i18n.android("phoneToday"), style = PixelText.copy(fontWeight = FontWeight.Bold))
                if (untracked.isEmpty()) Text(i18n.android("noUsage"), style = PixelText.copy(color = Muted))
                for ((pkg, secs) in untracked) {
                    val app = apps.getValue(pkg)
                    QuickAddRow(app, secs, i18n) { addRule(app, it) }
                }
            }
        }

        Text(
            i18n.t("customRule"),
            style = PixelText.copy(color = Muted),
            modifier = Modifier.clickable { editing = Rule(newId(), "") }.padding(4.dp),
        )
    }

    editing?.let { rule ->
        RuleEditor(
            rule = rule,
            isNew = rules.none { it.id == rule.id },
            apps = apps,
            // An app counts towards one rule only, so apps used by other rules aren't offered.
            taken = rules.filter { it.id != rule.id }.flatMap { it.apps }.toSet(),
            appSecs = appSecs,
            i18n = i18n,
            onSave = { saved ->
                store.setRules(if (rules.any { it.id == saved.id }) rules.map { if (it.id == saved.id) saved else it } else rules + saved)
                editing = null
            },
            onDelete = {
                store.setRules(rules.filter { it.id != rule.id })
                editing = null
            },
            onDismiss = { editing = null },
        )
    }
}

@Composable
private fun UsageAccessCard(i18n: I18n, onGrant: () -> Unit) {
    Column(Modifier.fillMaxWidth().pixelBox(Gold).padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(i18n.android("usageTitle"), style = PixelText.copy(fontWeight = FontWeight.Bold))
        Text(i18n.android("usageBody"), style = PixelText)
        Text(i18n.android("usageFind"), style = PixelText.copy(color = Muted))
        PixelButton(i18n.android("usageGrant"), fill = Card, onClick = onGrant)
    }
}

@Composable
private fun RuleRow(rule: Rule, used: Long, base: Long, apps: List<AppInfo>, i18n: I18n, onEdit: () -> Unit) {
    val ratio = used.toFloat() / maxOf(1L, base)
    val fill = when {
        rule.mode == Mode.GOAL -> Green
        ratio > 1 -> Red
        else -> Blue
    }
    Column(Modifier.fillMaxWidth().clickable(onClick = onEdit), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (app in apps.take(3)) AppIcon(app, 20)
            Text(rule.name, Modifier.weight(1f), style = PixelText.copy(fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(i18n.t("mode_" + rule.mode.name.lowercase()), Modifier.pixelBox(shadow = false).padding(horizontal = 4.dp), style = PixelText.copy(color = Muted))
            Text("${i18n.duration(used)}/${i18n.duration(base)}", style = PixelText)
        }
        PixelBar(ratio, fill)
    }
}

@Composable
private fun QuickAddRow(app: AppInfo, secs: Long, i18n: I18n, onAdd: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        AppIcon(app, 28)
        Column(Modifier.weight(1f)) {
            Text(app.label, style = PixelText.copy(fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(i18n.duration(secs), style = PixelText.copy(color = Muted))
        }
        Text(i18n.t("quickLimit"), style = PixelText.copy(color = Muted))
        for (m in listOf(15, 30, 60)) PixelButton("$m") { onAdd(m) }
    }
}

@Composable
fun AppIcon(app: AppInfo, sizeDp: Int) {
    Image(app.icon, app.label, Modifier.size(sizeDp.dp))
}
