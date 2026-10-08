package studio.panikka.beepo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.Mode
import studio.panikka.beepo.core.Rule
import studio.panikka.beepo.data.AppInfo

/** Full-screen rule editor, same fields as the popup's (block / hide / focus come with the overlay). */
@Composable
fun RuleEditor(
    rule: Rule,
    isNew: Boolean,
    apps: Map<String, AppInfo>,
    taken: Set<String>,
    appSecs: Map<String, Long>,
    i18n: I18n,
    onSave: (Rule) -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(rule.name) }
    var selected by remember { mutableStateOf(rule.apps.toSet()) }
    var mode by remember { mutableStateOf(rule.mode) }
    var minutes by remember { mutableStateOf(rule.minutes.toString()) }
    var weekend by remember { mutableStateOf(rule.weekendMinutes?.toString().orEmpty()) }
    var search by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    // Picked apps first, then today's most used.
    val shown = apps.values
        .filter { it.pkg !in taken && (search.isBlank() || it.label.contains(search.trim(), ignoreCase = true)) }
        .sortedWith(compareBy<AppInfo>({ it.pkg !in rule.apps }, { -(appSecs[it.pkg] ?: 0) }, { it.label.lowercase() }))
    val numbers = KeyboardOptions(keyboardType = KeyboardType.Number)

    Dialog(onDismiss, DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(Paper).safeDrawingPadding().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(i18n.t(if (isNew) "newRule" else "editRule"), style = PixelText.copy(fontWeight = FontWeight.Bold))

            Field(i18n.t("fieldName")) {
                PixelField(name, { name = it }, Modifier.fillMaxWidth(), placeholder = i18n.t("namePlaceholder"))
            }
            Field(i18n.t("fieldType")) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PixelChip(i18n.t("typeLimit"), mode == Mode.LIMIT) { mode = Mode.LIMIT }
                    PixelChip(i18n.t("typeGoal"), mode == Mode.GOAL) { mode = Mode.GOAL }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Field(i18n.t("fieldMinutes"), Modifier.weight(1f)) {
                    PixelField(minutes, { minutes = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), keyboard = numbers)
                }
                Field(i18n.t("fieldWeekend"), Modifier.weight(1f)) {
                    PixelField(weekend, { weekend = it.filter(Char::isDigit) }, Modifier.fillMaxWidth(), i18n.t("weekendPlaceholder"), numbers)
                }
            }

            Field(i18n.android("fieldApps")) {
                PixelField(search, { search = it }, Modifier.fillMaxWidth(), placeholder = i18n.android("searchApps"))
            }
            if (error) Text(i18n.android("errApps"), style = PixelText.copy(color = Red, fontWeight = FontWeight.Bold))
            LazyColumn(Modifier.weight(1f).fillMaxWidth().pixelBox(shadow = false)) {
                items(shown, key = { it.pkg }) { app ->
                    val on = app.pkg in selected
                    Row(
                        Modifier.fillMaxWidth()
                            .clickable {
                                selected = if (on) selected - app.pkg else selected + app.pkg
                                error = false
                            }
                            .padding(horizontal = 6.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(Modifier.size(16.dp).border(2.dp, Ink).background(if (on) Ink else Card))
                        AppIcon(app, 24)
                        Text(app.label, Modifier.weight(1f), style = PixelText, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        appSecs[app.pkg]?.takeIf { it >= 60 }?.let { Text(i18n.duration(it), style = PixelText.copy(color = Muted)) }
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PixelButton(i18n.t("save")) {
                    if (selected.isEmpty()) {
                        error = true
                        return@PixelButton
                    }
                    val picked = apps.keys.filter { it in selected } + selected.filter { it !in apps }
                    onSave(
                        rule.copy(
                            name = name.trim().ifEmpty { apps[picked.first()]?.label ?: picked.first() },
                            apps = picked,
                            mode = mode,
                            minutes = minutes.toIntOrNull() ?: rule.minutes,
                            weekendMinutes = weekend.toIntOrNull(),
                        ),
                    )
                }
                PixelButton(i18n.t("cancel"), fill = Card, onClick = onDismiss)
                Spacer(Modifier.weight(1f))
                if (!isNew) PixelButton(i18n.t("delete"), fill = Red, onClick = onDelete)
            }
        }
    }
}

@Composable
private fun Field(label: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = PixelText.copy(color = Muted))
        content()
    }
}
