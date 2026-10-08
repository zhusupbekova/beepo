package studio.panikka.beepo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import studio.panikka.beepo.I18n
import studio.panikka.beepo.core.Day
import studio.panikka.beepo.core.Mode
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.weeklyReport
import java.time.LocalDate
import java.time.format.TextStyle

/** Report tab: this week vs last, tracked time per day, per rule (like the popup's). */
@Composable
fun ReportScreen(state: State, i18n: I18n) {
    val today = state.today()
    val r = weeklyReport(state.history, state.day ?: Day(today), state.rules, today)
    val max = maxOf(60L, r.days.maxOf { it.total })
    val weekTotal = r.days.sumOf { it.total }
    fun dayName(key: String) = LocalDate.parse(key).dayOfWeek.getDisplayName(TextStyle.SHORT, i18n.locale)

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Stat(i18n.t("thisWeek"), i18n.duration(weekTotal), i18n.android("onTracked"), Modifier.weight(1f))
            Stat(i18n.t(if (r.savedSecs >= 0) "saved" else "extra"), i18n.duration(kotlin.math.abs(r.savedSecs)), i18n.t("vsLastWeek"), Modifier.weight(1f))
            val best = r.bestDay
            Stat(
                i18n.t("bestDay"),
                best?.let { dayName(it.date) } ?: "–",
                best?.let { i18n.t("rulesKept", "score" to it.score, "of" to it.of) } ?: i18n.t("notEnough"),
                Modifier.weight(1f),
            )
        }

        Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(i18n.t("perDay"), style = PixelText.copy(fontWeight = FontWeight.Bold))
            Row(
                Modifier.fillMaxWidth().height(120.dp).semantics { contentDescription = i18n.t("perDayAria") },
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                r.days.forEachIndexed { i, d ->
                    Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.Bottom, horizontalAlignment = Alignment.CenterHorizontally) {
                        if (d.total > 0) Text(i18n.duration(d.total), style = PixelText.copy(color = Muted, fontSize = PixelText.fontSize * 0.75f), maxLines = 1)
                        if (d.total > 0) {
                            Box(Modifier.fillMaxWidth().fillMaxHeight(0.8f * d.total / max).pixelBox(if (i == r.days.lastIndex) Gold else Blue, shadow = false))
                        }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                r.days.forEachIndexed { i, d ->
                    Text(
                        if (i == r.days.lastIndex) i18n.t("today") else dayName(d.date),
                        Modifier.weight(1f),
                        style = PixelText.copy(color = Muted, fontSize = PixelText.fontSize * 0.8f),
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Clip,
                    )
                }
            }
        }

        Column(Modifier.fillMaxWidth().pixelBox().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(i18n.t("perRule"), style = PixelText.copy(fontWeight = FontWeight.Bold))
            if (r.perRule.isEmpty()) Text(i18n.t("noRules"), style = PixelText.copy(color = Muted))
            else {
                TableRow(i18n.t("colRule"), i18n.t("colThisWk"), i18n.t("colLastWk"), "Δ", bold = true)
                for (rule in r.perRule) {
                    val delta = rule.thisWeek - rule.lastWeek
                    val good = if (rule.mode == Mode.LIMIT) delta <= 0 else delta >= 0
                    val sign = if (delta > 0) "+" else if (delta < 0) "−" else ""
                    val mark = if (delta == 0L) "" else if (good) " 👍" else " 👀"
                    TableRow(rule.name, i18n.duration(rule.thisWeek), i18n.duration(rule.lastWeek), "$sign${i18n.duration(kotlin.math.abs(delta))}$mark")
                }
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String, note: String, modifier: Modifier) {
    Column(modifier.pixelBox().padding(6.dp)) {
        Text(label, style = PixelText.copy(color = Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(value, style = PixelText.copy(fontWeight = FontWeight.Bold))
        Text(note, style = PixelText.copy(color = Muted, fontSize = PixelText.fontSize * 0.8f))
    }
}

@Composable
private fun TableRow(a: String, b: String, c: String, d: String, bold: Boolean = false) {
    val style = PixelText.copy(fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
    Row {
        Text(a, Modifier.weight(1.4f), style = style, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(b, Modifier.weight(1f), style = style, textAlign = TextAlign.End)
        Text(c, Modifier.weight(1f), style = style, textAlign = TextAlign.End)
        Text(d, Modifier.weight(1.2f), style = style, textAlign = TextAlign.End)
    }
}
