package studio.panikka.beepo.sprite

/** Scene row Beepo and his pet stand on. */
private const val SCENE_FEET = 20
/** Beepo's feet are his second-last row (the last one is empty). */
private const val BEEPO_FEET_ROW = 2

/**
 * Android only: a scene (widget background) with Beepo standing in it and his pet beside him,
 * facing him. Without a pet he stands in the middle. Null if `id` isn't a scene.
 */
fun Sprites.scene(id: String?, beepo: Frame, pet: Frame?): Frame? {
    val item = findItem(id)?.takeIf { it.scene.isNotEmpty() } ?: return null
    val grid = item.scene.map { it.toCharArray() }
    val width = grid.first().size
    val x = if (pet == null) (width - beepo.width) / 2 else 4
    stamp(grid, beepo, x, SCENE_FEET - (beepo.height - BEEPO_FEET_ROW))
    if (pet != null) stamp(grid, pet, x + beepo.width + 1, SCENE_FEET - (pet.height - 1), flip = true)
    return Frame(grid, beepo.palette + item.colors)
}

private fun stamp(grid: List<CharArray>, frame: Frame, left: Int, top: Int, flip: Boolean = false) {
    for ((y, row) in frame.grid.withIndex()) {
        val line = grid.getOrNull(top + y) ?: continue
        for ((x, c) in row.withIndex()) {
            if (c == EMPTY) continue
            val at = left + if (flip) frame.width - 1 - x else x
            if (at in line.indices) line[at] = c
        }
    }
}
