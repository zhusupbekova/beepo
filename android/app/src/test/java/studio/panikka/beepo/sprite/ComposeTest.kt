package studio.panikka.beepo.sprite

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

/** Checks the Kotlin port against tests/fixtures/sprite-cases.json (made by `npm run fixtures`). */
class ComposeTest {
    private val repo = File("../..")
    private val sprites = Sprites.parse(File(repo, "extension/data/sprites.json").readText())
    private val fixtures = JSONObject(File(repo, "tests/fixtures/sprite-cases.json").readText())

    @Test
    fun matchesExtensionRenderer() {
        val cases = fixtures.getJSONArray("cases")
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val opts = c.getJSONObject("opts")
            val look = opts.optJSONObject("look")
            val frame = sprites.compose(
                mood = opts.optString("mood", "neutral"),
                pose = opts.optString("pose").ifEmpty { null },
                look = Look(
                    equipped = look?.optJSONObject("equipped")?.let { e -> e.keys().asSequence().associateWith { e.getString(it) } }.orEmpty(),
                    evolve = look?.optJSONArray("evolve")?.strings().orEmpty(),
                    scruffy = look?.optBoolean("scruffy") ?: false,
                ),
            )
            val name = c.getString("name")
            assertEquals(name, c.getJSONArray("grid").strings(), frame.rows())
            val palette = c.getJSONObject("palette")
            assertEquals(name, palette.keys().asSequence().associate { it[0] to Sprites.parseColor(palette.getString(it)) }, frame.palette)
        }
    }

    @Test
    fun petFramesLoop() {
        val pets = fixtures.getJSONArray("pets")
        for (i in 0 until pets.length()) {
            val p = pets.getJSONObject(i)
            val frame = sprites.pet(p.getString("id"), p.getInt("frame"))!!
            assertEquals(p.getJSONArray("grid").strings(), frame.rows())
        }
        val cat = sprites.items.getValue("pet-cat").frames
        assertEquals(cat[0], sprites.pet("pet-cat", cat.size)!!.rows())
        assertNull(sprites.pet("hat-cap", 0))
        assertNull(sprites.pet(null, 0))
    }

    @Test
    fun customItemsAreFound() {
        val custom = Sprites.item("custom-1", JSONObject("""{"slot":"hat","rows":{"0":"k_.............."}}"""))
        val frame = sprites.compose(look = Look(equipped = mapOf("hat" to "custom-1")), custom = listOf(custom))
        assertEquals('k', frame.grid[0][0])
        assertEquals(EMPTY, frame.grid[0][1])
    }

    private fun JSONArray.strings() = (0 until length()).map { getString(it) }
}
