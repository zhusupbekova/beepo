package studio.panikka.beepo.ui

import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.Streaks
import studio.panikka.beepo.core.dateKey
import studio.panikka.beepo.core.evolution
import studio.panikka.beepo.core.streaks
import studio.panikka.beepo.sprite.Look
import studio.panikka.beepo.sprite.Sprites

/** Beepo as he is today: what he wears plus what his streaks did to him (like background.js lookFor). */
class BeepoLook(val look: Look, val grow: Int, val streaks: Streaks) {
    val mood get() = if (streaks.missStreak >= 2) "sad" else "happy"

    /** Same look wearing `itemId` instead (shop preview). Hats cover the antenna. */
    fun wearing(slot: String, itemId: String): Look {
        val eq = look.equipped + (slot to itemId)
        return Look(if (slot == "antenna") eq - "hat" else eq, look.evolve, look.scruffy)
    }
}

fun State.today(now: Long = System.currentTimeMillis()) = day?.date ?: dateKey(now, settings.resetHour)

fun State.beepoLook(sprites: Sprites): BeepoLook {
    val s = streaks(history, today())
    val evo = evolution(sprites.evolve, s)
    return BeepoLook(Look(wallet.equipped.toMap(), evo.evolve, evo.scruffy), evo.grow, s)
}
