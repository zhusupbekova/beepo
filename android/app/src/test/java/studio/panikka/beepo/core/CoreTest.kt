package studio.panikka.beepo.core

import studio.panikka.beepo.sprite.Evolve
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Runs the Kotlin port over tests/fixtures/core-cases.json (inputs + outputs recorded from lib/core.js
 * by `npm run fixtures`) and expects the same JSON back.
 */
class CoreTest {
    private val repo = File("../..")
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }
    private val cases = json.parseToJsonElement(File(repo, "tests/fixtures/core-cases.json").readText()).jsonObject
    private val zone = ZoneId.systemDefault()

    private fun each(fn: String, body: (JsonObject) -> Any?) {
        val list = cases[fn]?.jsonArray.orEmpty()
        assertTrue("no cases for $fn", list.isNotEmpty())
        list.forEachIndexed { i, c ->
            val args = c.jsonObject.getValue("args").jsonObject
            val actual = when (val v = body(args)) {
                is JsonElement -> v
                null -> JsonNull
                is String -> JsonPrimitive(v)
                is Boolean -> JsonPrimitive(v)
                is Number -> JsonPrimitive(v)
                else -> error("encode $fn output with out()")
            }
            assertEquals("$fn #$i $args", c.jsonObject.getValue("out"), actual)
        }
    }

    private inline fun <reified T> out(v: T) = json.encodeToJsonElement(v)
    private inline fun <reified T> JsonObject.arg(key: String): T = json.decodeFromJsonElement(getValue(key))
    private fun JsonObject.str(key: String) = getValue(key).jsonPrimitive.content
    private fun JsonObject.int(key: String) = getValue(key).jsonPrimitive.int
    private fun JsonObject.long(key: String) = getValue(key).jsonPrimitive.content.toLong()
    private fun JsonObject.time(key: String) = LocalDateTime.parse(str(key)).atZone(zone).toInstant().toEpochMilli()

    @Test fun dateKey() = each("dateKey") { dateKey(it.time("now"), it.int("resetHour"), zone) }

    @Test fun addDays() = each("addDays") { addDays(it.str("key"), it.int("n")) }

    @Test fun isWeekend() = each("isWeekend") { isWeekend(it.str("key")) }

    @Test fun baseLimitSecs() = each("baseLimitSecs") { baseLimitSecs(it.arg("rule"), it.str("key")) }

    @Test fun inFocus() = each("inFocus") { inFocus(it.arg("focus"), it.time("now"), zone) }

    @Test fun isNight() = each("isNight") { isNight(it.time("now"), zone) }

    @Test fun milestone() = each("milestone") { a ->
        val notified = mutableListOf<String>()
        val mode = a.arg<Mode>("mode")
        val events = a.getValue("ticks").jsonArray.map { t ->
            val tick = t.jsonObject
            milestone(mode, tick.long("used"), a.long("base"), tick.long("bonus"), notified, a.int("nagMinutes"))
        }
        out(mapOf("events" to out(events), "notified" to out(notified)))
    }

    @Test fun blockState() = each("blockState") { a ->
        val now = a.time("now")
        val unlockIn = a.long("unlockIn")
        val state = blockState(a.arg("rule"), a.long("used"), a.long("base"), a.long("bonus"), now, if (unlockIn != 0L) now + unlockIn else 0, zone)
        state.name.lowercase().replace('_', '-')
    }

    @Test fun finalizeDay() = each("finalizeDay") { out(finalizeDay(it.arg("day"), it.arg("rules"))) }

    @Test fun streaks() = each("streaks") { out(streaks(it.arg("history"), it.str("today"))) }

    @Test fun newBadges() = each("newBadges") { a ->
        val ctx = BadgeContext(a.arg("wallet"), a.arg("history"), a.str("today"), a.int("limitStreak"), a.int("goalStreak"))
        out(newBadges(ctx).map { it.id })
    }

    @Test fun evolution() = each("evolution") { a ->
        val defs = a.getValue("defs").jsonArray.map { d ->
            val o = d.jsonObject
            val rows = o["rows"]?.jsonObject?.mapKeys { it.key.toInt() }?.mapValues { it.value.jsonPrimitive.content }
            Evolve(o.str("id"), o.int("minStreak"), o["grow"]?.jsonPrimitive?.int ?: 0, rows)
        }
        out(evolution(defs, Streaks(a.int("limitStreak"), a.int("goalStreak"), a.int("missStreak"))))
    }

    // Fixture rules use bare hosts, so "tracked" is an exact pattern match here.
    @Test fun suggestions() = each("suggestions") { a ->
        val rules = a.arg<List<Rule>>("rules")
        val day = a.getValue("day").jsonObject.let { Day("", domains = json.decodeFromJsonElement(it.getValue("domains"))) }
        out(suggestions(a.arg("history"), day, { d -> rules.any { d in it.patterns } }, a.arg("dismissed")))
    }

    @Test fun weeklyReport() = each("weeklyReport") { out(weeklyReport(it.arg("history"), it.arg("day"), it.arg("rules"), it.str("today"))) }

    @Test fun fillTemplate() = each("fillTemplate") { a ->
        fillTemplate(a.str("text"), a.getValue("vars").jsonObject.mapValues { it.value.jsonPrimitive.content })
    }

    @Test fun normalizeDay() = each("normalizeDay") { out(it.arg<Day>("day")) }

    @Test fun resolveLang() = each("resolveLang") { a ->
        resolveLang(a["pref"]?.let { if (it is JsonNull) null else it.jsonPrimitive.content }, a.str("uiLang"))
    }

    @Test
    fun languagesMatchI18nFiles() {
        val files = File(repo, "extension/data/i18n").list()!!.map { it.removeSuffix(".json") }.toSet()
        assertEquals(files, LANGUAGES.keys)
    }

    @Test
    fun matchApp() {
        val ig = Rule("r1", "Instagram", apps = listOf("com.instagram.android", "com.instagram.barcelona"))
        val yt = Rule("r2", "YouTube", patterns = listOf("youtube.com"), apps = listOf("com.google.android.youtube"))
        assertEquals("r1", matchApp(listOf(ig, yt), "com.instagram.barcelona")?.id)
        assertEquals("r2", matchApp(listOf(ig, yt), "com.google.android.youtube")?.id)
        assertNull(matchApp(listOf(ig, yt), "youtube.com"))
        assertNull(matchApp(listOf(ig, yt), "com.instagram"))
    }

    @Test
    fun dayUsageSumsAppsPerRule() {
        val social = Rule("s", "Social", apps = listOf("ig", "tt"))
        val yt = Rule("y", "YouTube", apps = listOf("yt"))
        val day = dayUsage(Day("2026-10-05", notified = mapOf("s" to listOf("limit50"))), mapOf("ig" to 600L, "tt" to 300L, "maps" to 60L), listOf(social, yt))
        assertEquals(mapOf("s" to 900L), day.usage)
        assertEquals(mapOf("ig" to 600L, "tt" to 300L, "maps" to 60L), day.domains)
        assertEquals(listOf("limit50"), day.notified["s"])
    }

    @Test
    fun dayStartIsResetHourOnThatDate() {
        val start = dayStart("2026-10-05", 4, zone)
        assertEquals(LocalDateTime.parse("2026-10-05T04:00").atZone(zone).toInstant().toEpochMilli(), start)
        assertEquals("2026-10-05", dateKey(start, 4, zone))
        assertEquals("2026-10-04", dateKey(start - 1, 4, zone))
    }

    @Test
    fun storedShapesRoundTrip() {
        // A stored extension wallet/rule (with fields Android doesn't know) still loads, missing fields get defaults.
        val w = json.decodeFromString<Wallet>("""{"stars":3,"equipped":{"hat":"hat-cap"},"future":1}""")
        assertEquals(Wallet(stars = 3, equipped = Equipped(hat = "hat-cap")), w)
        val r = json.decodeFromString<Rule>("""{"id":"a","name":"x","patterns":["x.com"],"mode":"goal","minutes":10,"weekendMinutes":null}""")
        assertEquals(Mode.GOAL, r.mode)
        assertEquals(emptyList<String>(), r.apps)
    }
}
