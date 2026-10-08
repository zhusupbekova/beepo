package studio.panikka.beepo.sprite

import org.json.JSONArray
import org.json.JSONObject

/** Overlay rows: row index → 16 chars ('.' keep, '_' clear, else palette key). */
typealias Rows = Map<Int, String>

class Item(
    val id: String,
    val slot: String,
    val price: Int,
    val colors: Map<Char, Int>,
    val rows: Rows,
    val frames: List<List<String>>,
    /** Comes with Beepo Plus (Android) instead of being bought with stars. */
    val plus: Boolean = false,
    /** ["MM-DD", "MM-DD"]: only in the shop from its first season on. */
    val season: List<String>? = null,
)

/** `rows` is null for steps that only change size (grow). */
class Evolve(val id: String, val minStreak: Int, val grow: Int, val rows: Rows?)

/** data/sprites.json, shared with the extension. */
class Sprites(
    val width: Int,
    val height: Int,
    val palette: Map<Char, Int>,
    val body: List<String>,
    val faceRow: Int,
    val faceCol: Int,
    val faces: Map<String, List<String>>,
    val poses: Map<String, Rows>,
    val evolve: List<Evolve>,
    val scruffy: Rows,
    val items: Map<String, Item>,
) {
    val seasons: Map<String, List<String>> get() = items.values.mapNotNull { i -> i.season?.let { i.id to it } }.toMap()

    companion object {
        fun parse(json: String): Sprites {
            val o = JSONObject(json)
            val items = o.getJSONObject("items")
            return Sprites(
                width = o.getInt("width"),
                height = o.getInt("height"),
                palette = colors(o.getJSONObject("palette")),
                body = strings(o.getJSONArray("body")),
                faceRow = o.getInt("faceRow"),
                faceCol = o.getInt("faceCol"),
                faces = o.getJSONObject("faces").let { f -> f.keys().asSequence().associateWith { strings(f.getJSONArray(it)) } },
                poses = o.getJSONObject("poses").let { p -> p.keys().asSequence().associateWith { rows(p.getJSONObject(it)) } },
                evolve = o.getJSONArray("evolve").objects().map {
                    Evolve(it.getString("id"), it.optInt("minStreak"), it.optInt("grow"), it.optJSONObject("rows")?.let(::rows))
                },
                scruffy = rows(o.getJSONObject("scruffy").optJSONObject("rows")),
                items = items.keys().asSequence().associateWith { item(it, items.getJSONObject(it)) },
            )
        }

        /** Shop items and custom editor items share this shape. */
        fun item(id: String, o: JSONObject) = Item(
            id = id,
            slot = o.getString("slot"),
            price = o.optInt("price"),
            colors = o.optJSONObject("colors")?.let(::colors).orEmpty(),
            rows = rows(o.optJSONObject("rows")),
            frames = o.optJSONArray("frames")?.let { f -> (0 until f.length()).map { strings(f.getJSONArray(it)) } }.orEmpty(),
            plus = o.optBoolean("plus"),
            season = o.optJSONArray("season")?.let(::strings),
        )

        private fun strings(a: JSONArray) = (0 until a.length()).map { a.getString(it) }

        private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }

        private fun rows(o: JSONObject?): Rows =
            o?.keys()?.asSequence()?.associate { it.toInt() to o.getString(it) }.orEmpty()

        private fun colors(o: JSONObject) = o.keys().asSequence().associate { it[0] to parseColor(o.getString(it)) }

        /** "#rrggbb" → opaque ARGB. */
        fun parseColor(hex: String) = (0xFF000000 or hex.removePrefix("#").toLong(16)).toInt()
    }
}
