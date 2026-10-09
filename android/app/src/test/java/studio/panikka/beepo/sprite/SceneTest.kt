package studio.panikka.beepo.sprite

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SceneTest {
    private val sprites = Sprites.parse(File("../../extension/data/sprites.json").readText())
    private val beepo = sprites.compose("happy")
    private val pet = sprites.pet("pet-cat", 0)!!

    @Test
    fun everySceneIs32By24WithKnownColors() {
        val scenes = sprites.items.values.filter { it.slot == "scene" }
        assertTrue(scenes.isNotEmpty())
        for (s in scenes) {
            assertEquals(s.id, 24, s.scene.size)
            assertTrue(s.id, s.scene.all { it.length == 32 })
            // Not Beepo's body colors, so color items can't repaint the scene.
            val keys = s.scene.flatMap { it.toList() }.toSet()
            assertTrue(s.id, 'b' !in keys && 'd' !in keys)
            assertTrue(s.id, keys.all { it in sprites.palette || it in s.colors })
        }
    }

    @Test
    fun beepoStandsOnRow20AndThePetFacesHim() {
        val f = sprites.scene("scene-meadow", beepo, pet)!!
        // His feet row "....kk....kk....", 4 from the left, on scene row 20.
        assertEquals("kkkk", "${f.grid[20][8]}${f.grid[20][9]}${f.grid[20][14]}${f.grid[20][15]}")
        // The cat's ears ("o...o.....") flipped, so it faces him: at x 21 + 9 and 21 + 5, row 13.
        assertEquals('o', f.grid[13][30])
        assertEquals('o', f.grid[13][26])
        assertEquals(sprites.items.getValue("scene-meadow").scene[13][21], f.grid[13][21])
        assertEquals(beepo.palette + sprites.items.getValue("scene-meadow").colors, f.palette)
    }

    @Test
    fun aloneHeStandsInTheMiddle() {
        val f = sprites.scene("scene-night", beepo, null)!!
        assertEquals("kkkk", "${f.grid[20][12]}${f.grid[20][13]}${f.grid[20][18]}${f.grid[20][19]}")
    }

    @Test
    fun notASceneIsNull() {
        assertNull(sprites.scene("hat-cap", beepo, pet))
        assertNull(sprites.scene(null, beepo, pet))
    }
}
