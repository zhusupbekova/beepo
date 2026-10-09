package studio.panikka.beepo.sprite

/** Port of extension/render/sprite.js. Keep the two in sync (tests/fixtures/sprite-cases.json). */

const val EMPTY = '.'

class Look(
    val equipped: Map<String, String> = emptyMap(),
    val evolve: List<String> = emptyList(),
    val scruffy: Boolean = false,
    /** Editor items the equipped ids may point to. */
    val custom: List<Item> = emptyList(),
)

/** A grid of palette keys ('.' = transparent) plus the palette to draw it with. */
class Frame(val grid: List<CharArray>, val palette: Map<Char, Int>) {
    val width get() = grid.firstOrNull()?.size ?: 0
    val height get() = grid.size
    fun rows() = grid.map { String(it) }
}

fun applyOverlay(grid: List<CharArray>, rows: Rows?) {
    for ((y, line) in rows.orEmpty()) {
        val row = grid.getOrNull(y) ?: continue
        for (x in 0 until minOf(line.length, row.size)) {
            val c = line[x]
            if (c == '.') continue
            row[x] = if (c == '_') EMPTY else c
        }
    }
}

fun Sprites.findItem(id: String?, custom: List<Item> = emptyList()): Item? =
    id?.let { items[it] ?: custom.find { c -> c.id == it } }

fun Sprites.compose(
    mood: String = "neutral",
    pose: String? = null,
    look: Look = Look(),
    custom: List<Item> = emptyList(),
): Frame {
    val grid = body.map { it.toCharArray() }
    val mine = custom + look.custom
    val palette = palette + findItem(look.equipped["color"], mine)?.colors.orEmpty()

    poses[pose]?.let { applyOverlay(grid, it) }

    val face = faces[mood] ?: faces.getValue("neutral")
    for ((fy, line) in face.withIndex()) {
        for ((fx, c) in line.withIndex()) grid[faceRow + fy][faceCol + fx] = c
    }

    for (id in look.evolve) applyOverlay(grid, evolve.find { it.id == id }?.rows)
    if (look.scruffy) applyOverlay(grid, scruffy)
    for (slot in listOf("antenna", "accessory", "hat")) applyOverlay(grid, findItem(look.equipped[slot], mine)?.rows)
    return Frame(grid, palette)
}

fun Sprites.pet(id: String?, frame: Int, custom: List<Item> = emptyList()): Frame? {
    val frames = findItem(id, custom)?.frames?.takeIf { it.isNotEmpty() } ?: return null
    return Frame(frames[frame % frames.size].map { it.toCharArray() }, palette)
}
