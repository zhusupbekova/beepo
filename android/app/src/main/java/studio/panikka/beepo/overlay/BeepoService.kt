package studio.panikka.beepo.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.Point
import android.graphics.PointF
import android.graphics.RectF
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.view.Gravity
import android.view.WindowInsets
import android.view.WindowManager
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.geometry.Offset
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import studio.panikka.beepo.I18n
import studio.panikka.beepo.MainActivity
import studio.panikka.beepo.R
import studio.panikka.beepo.core.BlockState
import studio.panikka.beepo.core.Mode
import studio.panikka.beepo.core.Nudge
import studio.panikka.beepo.core.Rule
import studio.panikka.beepo.core.State
import studio.panikka.beepo.core.baseLimitSecs
import studio.panikka.beepo.core.blockState
import studio.panikka.beepo.core.isNight
import studio.panikka.beepo.core.matchApp
import studio.panikka.beepo.data.Plus
import studio.panikka.beepo.data.Store
import studio.panikka.beepo.sprite.compose
import studio.panikka.beepo.sprite.pet
import studio.panikka.beepo.ui.BeepoLook
import studio.panikka.beepo.ui.Theme
import studio.panikka.beepo.ui.beepoLook
import studio.panikka.beepo.ui.today
import studio.panikka.beepo.usage.ForegroundTracker
import studio.panikka.beepo.usage.UsageAccess
import java.text.DateFormat
import java.util.Date
import kotlin.random.Random

private const val POLL_MS = 1_500L
private const val TICK_MS = 125L
/** The jump into the camera / the fall back: steps of FLY_MS. */
private const val FLY_STEPS = 12
private const val FLY_MS = 50L
/** How small he is when he reaches the hole. */
private const val HOLE_SCALE = 0.2f
/** Ticks to slide out of the camera on his thread. */
private const val DROP_STEPS = 6
/** Sprite rows above his body (antenna, head): what peeks out of the hole. */
private const val HEAD_ROWS = 14
/** Empty rows under the peeking head, so it's easy to tap below the status bar. */
private const val PEEK_PAD = 4
/** First row that can have pixels (hats); the thread ends there. */
private const val TOP_ROW = 0
private const val REFRESH_MS = 15_000L
/** At start, how far back to look for the app that is already open. */
private const val SEED_MS = 3 * 3_600_000L
private const val NOTIFICATION_ID = 1
private const val CHANNEL = "beepo"
/** The confetti window (dp) and where the burst starts in it: room to fly up and out, then fall. */
private const val CONFETTI_W = 360
private const val CONFETTI_H = 400
private const val CONFETTI_Y = 260
private const val CONFETTI_MS = 1_800L

// Same as content.js.
private val LOUD = setOf("limit100", "over", "snoozeOver", "goal100", "kept", "badge", "evolve", "snooze1", "snooze2", "snooze3", "unlock")
private val CELEBRATE = setOf("goal100", "kept", "badge", "evolve", "streak")
private val STICKY = setOf("limit100", "over", "snoozeOver")
private val BLINKABLE = setOf("happy", "neutral", "worried", "bored", "proud", "lookLeft", "lookRight")

/**
 * Beepo over other apps (what content.js is in the browser). Watches which app is in front; in a
 * tracked app he pops up when a milestone fires or news is waiting, and with Plus "stay out" he
 * stays, walks around and chats when poked. Rules set to block get the block screen. All data goes
 * through [Store]; this only shows it.
 */
class BeepoService : Service() {
    private val scope = MainScope()
    private lateinit var store: Store
    private lateinit var wm: WindowManager
    private lateinit var sounds: Sounds
    private var i18n: I18n? = null
    private var i18nPref: String? = null

    private val tracker = ForegroundTracker()
    private var lastEventAt = 0L
    private var refreshedAt = 0L
    private var ruleId: String? = null

    private class Said(val ruleId: String?, val key: String, val vars: Map<String, String> = emptyMap())

    private var buddy: OverlayWindow? = null
    private val buddyView = mutableStateOf<BuddyView?>(null)
    private val queue = ArrayDeque<Said>()
    private var nextEventAt = 0L
    private var bubble: Bubble? = null
    /** 0 = stays until closed. */
    private var bubbleUntil = 0L
    private var mood: String? = null
    private var moodUntil = 0L
    private var waveUntil = 0L
    private var hopUntil = 0L
    private var tick = 0

    private enum class Home { BOTTOM, CAMERA }
    /** Where he lives: the bottom edge, or (after a long press) the camera hole, until tapped. */
    private var home = Home.BOTTOM
    private var flight: Flight? = null
    /** 0 = peeking from the camera, DROP_STEPS = all the way out on his thread. */
    private var drop = 0
    private var cameraWin: OverlayWindow? = null
    private var cameraSign = false
    private val cameraView = mutableStateOf<CameraView?>(null)
    private var petWidth = 0

    private enum class Walk { IDLE, WALK, SIT }
    private var walk = Walk.IDLE
    private var walkTo = 0f
    private var nextWalkAt = 0L
    private var x = -1f
    private var stageWidth = 0
    private var stageHeight = 0
    private var lastPetLeft = false
    private var bubbleWin: OverlayWindow? = null
    private var shownBubble: Bubble? = null

    private var block: OverlayWindow? = null
    private val blockView = mutableStateOf<BlockView?>(null)
    private var blockRule: String? = null
    private var blockPkg: String? = null

    private var confettiWin: OverlayWindow? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        store = Store.get(this)
        wm = getSystemService(WindowManager::class.java)
        sounds = Sounds(this)
        Plus.init(this, store)
        startForeground()
        scope.launch { watch() }
        scope.launch { animate() }
        scope.launch { store.nudges.collect { onNudge(it) } }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY

    override fun onDestroy() {
        scope.cancel()
        closeBuddy()
        closeCamera()
        closeBlock()
        confettiWin?.close()
        sounds.release()
        super.onDestroy()
    }

    private fun i18n(): I18n {
        val lang = store.state.value.settings.lang
        i18n?.takeIf { i18nPref == lang }?.let { return it }
        i18nPref = lang
        return I18n.load(assets, lang).also { i18n = it }
    }

    private fun startForeground() {
        val t = i18n()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, t.android("notifChannel"), NotificationManager.IMPORTANCE_MIN))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_monochrome)
            .setContentTitle(t.android("notifText"))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(NOTIFICATION_ID, n)
    }

    private fun phoneDark() =
        resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

    // ---------- watching ----------

    private suspend fun watch() {
        val power = getSystemService(PowerManager::class.java)
        lastEventAt = System.currentTimeMillis() - SEED_MS
        while (scope.isActive) {
            if (!Overlay.shouldRun(this, store.state.value)) {
                stopSelf()
                return
            }
            if (!power.isInteractive) {
                closeBuddy()
                closeCamera()
                delay(POLL_MS * 4)
                continue
            }
            val now = System.currentTimeMillis()
            val events = withContext(Dispatchers.IO) { UsageAccess.events(this@BeepoService, lastEventAt + 1, now) }
            events.forEach(tracker::feed)
            events.lastOrNull()?.let { lastEventAt = it.time }

            val pkg = tracker.top?.takeIf { it != packageName }
            val rule = pkg?.let { matchApp(store.state.value.rules, it) }
            if (rule != null && (rule.id != ruleId || now - refreshedAt > REFRESH_MS)) {
                withContext(Dispatchers.IO) { store.refresh() }
                refreshedAt = now
            }
            onApp(rule?.id, pkg)
            delay(POLL_MS)
        }
    }

    private fun onApp(id: String?, pkg: String?) {
        val st = store.state.value
        val rule = st.rules.find { it.id == id }
        if (id != ruleId) {
            ruleId = id
            bubble = null
            queue.removeAll { it.ruleId != null && it.ruleId != id }
            if (rule != null && !rule.hidden) arrive(st)
        }
        if (rule != null && pkg != null && blockRule == null) {
            val n = numbers(st, rule)
            val bs = blockState(rule, n.used, n.base, n.bonus, System.currentTimeMillis(), st.day?.unlockUntil?.get(rule.id) ?: 0)
            if (bs != BlockState.OK) showBlock(st, rule, pkg, bs)
        }
    }

    /** Entering a tracked app: news first; with "stay out", a hello and how it's going. */
    private fun arrive(st: State) {
        for (n in st.pending) say(Said(null, n.key, n.vars))
        if (st.pending.isNotEmpty()) store.clearNews()
        x = -1f
        val rule = currentRule(st) ?: return
        if (stayingOut() && !st.settings.quiet && queue.isEmpty()) {
            val greet = greetKey()
            i18n().line(greet)?.let { (text, m) -> sayStatus(text to m) }
            waveUntil = System.currentTimeMillis() + 1600
        } else if (overLimit(st, rule) && queue.isEmpty()) {
            // Opening an app that's already over: that's worth popping up for (with snooze).
            sayStatus()
        }
    }

    private fun onNudge(n: Nudge) {
        if (n.ruleId == ruleId) say(Said(n.ruleId, n.key, n.vars))
    }

    private fun say(s: Said) {
        if (store.state.value.settings.quiet && s.key !in LOUD) return
        queue += s
    }

    private fun stayingOut() = store.state.value.settings.stayOut && store.plus.value

    // ---------- talking ----------

    private class Numbers(val used: Long, val base: Long, val bonus: Long) {
        val limit get() = base + bonus
    }

    private fun numbers(st: State, rule: Rule): Numbers {
        val day = st.day
        val base = baseLimitSecs(rule, st.today())
        return Numbers(day?.usage?.get(rule.id) ?: 0, base, day?.bonus?.get(rule.id) ?: 0)
    }

    private fun currentRule(st: State = store.state.value) = st.rules.find { it.id == ruleId }

    private fun overLimit(st: State, rule: Rule) = rule.mode == Mode.LIMIT && numbers(st, rule).let { it.used >= it.limit }

    private fun greetKey(): String {
        val h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return when {
            h < 5 -> "greetNight"
            h < 12 -> "greetMorning"
            h < 18 -> "greetAfternoon"
            else -> "greetEvening"
        }
    }

    private fun statusLine(st: State, rule: Rule): Pair<String, String>? {
        val t = i18n()
        val n = numbers(st, rule)
        val left = n.limit - n.used
        if (rule.mode == Mode.GOAL) return t.line(if (left > 0) "statusGoal" else "statusGoalDone", mapOf("left" to t.minutes(left)))
        if (left <= 0) return t.line("statusOver", mapOf("over" to t.minutes(-left), "name" to rule.name))
        if (isNight(System.currentTimeMillis()) && Random.nextBoolean()) {
            return t.line("statusNight", mapOf("time" to DateFormat.getTimeInstance(DateFormat.SHORT, t.locale).format(Date())))
        }
        return t.line("statusLimit", mapOf("left" to t.minutes(left), "name" to rule.name))
    }

    private fun meta(st: State, rule: Rule): String {
        val t = i18n()
        val n = numbers(st, rule)
        val look = st.beepoLook(store.sprites)
        val streak = maxOf(look.streaks.limitStreak, look.streaks.goalStreak)
        val unlockLeft = (st.day?.unlockUntil?.get(rule.id) ?: 0) - System.currentTimeMillis()
        return buildString {
            append("${t.minutes(n.used)} / ${t.minutes(n.limit)} ${t.t("mode_" + rule.mode.name.lowercase())} · ⭐ ${st.wallet.stars}")
            if (streak >= 2) append(" · 🔥 $streak")
            if (unlockLeft > 0) append(" · 🔓 ${t.t("m", "m" to (unlockLeft + 59_999) / 60_000)}")
        }
    }

    private fun snoozeActions(st: State, rule: Rule): List<Action> {
        if (!overLimit(st, rule)) return emptyList()
        val n = st.day?.snoozes?.get(rule.id) ?: 0
        val label = if (n > 0) i18n().t("snoozeBtnN", "n" to n + 1) else i18n().t("snoozeBtn")
        return listOf(Action(label) {
            val said = store.snooze(rule.id)
            bubble = null
            queue.addFirst(Said(rule.id, said.key, said.vars))
            nextEventAt = 0
        })
    }

    private fun show(text: String, m: String, actions: List<Action>, duration: Long) {
        val st = store.state.value
        val rule = currentRule(st) ?: return
        val now = System.currentTimeMillis()
        bubble = Bubble(text, meta(st, rule), actions)
        bubbleUntil = if (duration > 0) now + duration else 0
        mood = m
        moodUntil = now + minOf(if (duration > 0) duration else 8000, 8000)
        if (st.settings.sound) sounds.play(m)
    }

    private fun sayStatus(extra: Pair<String, String>? = null) {
        val st = store.state.value
        val rule = currentRule(st) ?: return
        val s = statusLine(st, rule) ?: return
        val actions = snoozeActions(st, rule)
        val (text, m) = if (extra != null) "${extra.first} ${s.first}" to extra.second else s
        show(text, m, actions, if (actions.isNotEmpty()) 15_000 else 6_000)
    }

    private fun nextEvent(now: Long) {
        if (queue.isEmpty() || now < nextEventAt) return
        val st = store.state.value
        val rule = currentRule(st) ?: return
        val e = queue.removeFirst()
        val t = i18n()
        val n = numbers(st, rule)
        val vars = mapOf("name" to rule.name, "left" to t.minutes(n.limit - n.used), "over" to t.minutes(n.used - n.limit)) + e.vars
        val (text, m) = t.news(e.key, vars) ?: return
        val sticky = e.key in STICKY
        show(text, m, if (sticky) snoozeActions(st, rule) else emptyList(), if (sticky) 0 else 8_000)
        if (e.key in CELEBRATE) {
            hopUntil = now + 1_000
            confetti(st)
        }
        nextEventAt = now + 6_000
    }

    // ---------- drawing ----------

    private suspend fun animate() {
        while (scope.isActive) {
            tick++
            val now = System.currentTimeMillis()
            Theme.dark = Theme.isDark(store.state.value.settings, store.plus.value, phoneDark())
            if (bubble != null && bubbleUntil in 1..<now) bubble = null
            if (blockRule == null) nextEvent(now)
            if (flight == null) render(now)
            delay(TICK_MS)
        }
    }

    /** Sprite frames (blinks, steps, pet) run at half the tick rate. */
    private val frame get() = tick / 2

    private fun render(now: Long) {
        val st = store.state.value
        val rule = currentRule(st)
        val visible = rule != null && !rule.hidden && blockRule == null &&
            (stayingOut() || bubble != null || queue.isNotEmpty() || (home == Home.CAMERA && drop > 0))
        if (!visible || rule == null) {
            closeBuddy()
            closeCamera()
            drop = 0
            return
        }
        if (home == Home.CAMERA) {
            closeStage()
            renderCamera(st, rule)
        } else {
            closeCamera()
            renderStage(st, rule, now)
        }
    }

    private fun mood(st: State, rule: Rule, look: BeepoLook, now: Long): String {
        var m = when {
            now < moodUntil && mood != null -> mood!!
            walk == Walk.WALK -> if (walkTo > x) "lookRight" else "lookLeft"
            else -> baseMood(st, rule, look)
        }
        if (m in BLINKABLE && frame % 16 == 0) m = "blink"
        return m
    }

    /** At home on the bottom edge: walking, sitting, STOP sign, pet; the bubble above him. */
    private fun renderStage(st: State, rule: Rule, now: Long) {
        val look = st.beepoLook(store.sprites)
        val cell = cell(st, look)
        val density = resources.displayMetrics.density
        val screen = screenSize().x
        val margin = 16 * density
        // Home corner on arrival; otherwise he stays where he is (where he landed, too).
        if (x < 0) x = if (st.settings.side == "left") margin else screen - margin - (16 * cell * density).toInt()
        if (walk != Walk.WALK && stageWidth > 0) x = x.coerceIn(margin, maxOf(margin, screen - margin - stageWidth))
        if (tick % 2 == 0) stepWalk(st, now, cell * density, screen, margin)

        val over = overLimit(st, rule)
        val m = mood(st, rule, look, now)
        val pose = when {
            over -> "wave"
            now < waveUntil -> if (frame % 4 < 2) "wave" else null
            walk == Walk.WALK -> if (frame % 2 == 1) "walk" else null
            walk == Walk.SIT -> "sit"
            else -> null
        }
        // Which half he's on (the pet stays on the inside), with a guess before the row is measured.
        val onRight = x + maxOf(stageWidth, (16 * cell * density).toInt()) / 2f > screen / 2f
        val petLeft = if (walk == Walk.WALK) walkTo > x else !onRight
        // Anchored to the nearer edge so the bubble grows inwards; but from the right only once his
        // width is known (the right edge's offset depends on it), else the first frame lands wrong.
        val right = onRight && stageWidth > 0
        val pet = store.sprites.pet(look.look.equipped["pet"], frame / 2)
        // The pet changing sides would push him over by its width; move the row instead, so he
        // stays put and the pet hops around him.
        petWidth = pet?.let { (it.width * maxOf(2, cell - 1) * density).toInt() } ?: 0
        if (pet != null && petLeft != lastPetLeft) x += if (petLeft) -petWidth else petWidth
        lastPetLeft = petLeft
        val t = i18n()
        buddyView.value = BuddyView(
            beepo = store.sprites.compose(m, pose, look.look),
            cell = cell,
            pet = pet,
            petLeft = petLeft,
            stop = if (over) t.t("stop") else null,
            hop = if (now < hopUntil && frame % 2 == 0) cell * 3 else 0,
        )
        val gravity = Gravity.BOTTOM or if (right) Gravity.RIGHT else Gravity.LEFT
        val px = maxOf(0, if (right) (screen - x - stageWidth).toInt() else x.toInt())
        // Feet on the bottom edge: the sprite's last row is empty, so it goes past the screen.
        val py = -(cell * density).toInt()
        val win = buddy ?: OverlayWindow(this, focusable = false, setup = { free(); at(gravity, px, py) }) {
            buddyView.value?.let { v ->
                StageUi(v, onBeepoTap = ::poke, onBeepoHold = ::hide, onSize = { stageWidth = it.width; stageHeight = it.height })
            }
        }.also { buddy = it }
        place(win, gravity, px, py)

        // The bubble sits above him, a window of its own (a new one per bubble, so none resizes).
        val b = bubble
        if (b != null && stageHeight > 0) {
            val by = py + stageHeight + (4 * density).toInt()
            showBubble(b, gravity, px, by)
        } else {
            showBubble(null, 0, 0, 0)
        }
    }

    /**
     * Hiding in the camera: upside down with his head out of the hole. When he has something to say
     * he drops on a thread (holding the STOP sign if over), with the bubble below, then climbs back.
     */
    private fun renderCamera(st: State, rule: Rule) {
        val look = st.beepoLook(store.sprites)
        val cam = camera()
        val density = resources.displayMetrics.density
        val t = i18n()
        val sprites = store.sprites
        val talking = bubble != null
        // Drop out (or climb back) a few steps at a time.
        drop = if (talking) minOf(DROP_STEPS, drop + 1) else maxOf(0, drop - 1)
        if (drop == 0 && !stayingOut() && !talking && queue.isEmpty()) {
            closeCamera()
            return
        }
        val m = mood(st, rule, look, System.currentTimeMillis())
        val over = overLimit(st, rule)
        val view = if (drop == 0 && over) {
            // Over the limit: the STOP sign hangs out of the hole instead of him, just below the
            // status bar (bobbing a little now and then).
            val cell = cell(st, look)
            val pole = maxOf(0, cam.statusBar - cam.cy) + ((if (frame % 24 < 2) 4 else 6) * density).toInt()
            CameraView(
                beepo = sprites.compose(m, look = look.look), cellPx = (cell * density).toInt(), peek = false,
                width = 0, height = 0, beepoY = 0, thread = 0, threadX = 0,
                stop = t.t("stop"), stopCell = cell, signPole = pole,
            )
        } else if (drop == 0) {
            // Head about as wide as the hole (at least 2dp a pixel), hanging out of its bottom edge.
            val c = maxOf((2 * density).toInt(), cam.r * 2 / 12)
            CameraView(
                beepo = sprites.compose(m, look = look.look),
                cellPx = c, peek = true,
                width = sprites.width * c, height = (HEAD_ROWS + PEEK_PAD) * c,
                beepoY = -(sprites.height - HEAD_ROWS) * c, thread = 0, threadX = 0, stop = null, stopCell = 0,
            )
        } else {
            val cell = cell(st, look)
            val c = (cell * density).toInt()
            val top = TOP_ROW * c
            val hang = maxOf(0, cam.statusBar - cam.cy) + (24 * density).toInt()
            val full = hang + sprites.height * c
            // He slides out of the hole: from fully inside (above the window) to hanging.
            val y = -full + (full * drop / DROP_STEPS) + hang - top
            val stopW = if (over) (cell * 12 * density).toInt() else 0
            CameraView(
                beepo = sprites.compose(m, if (over) "wave" else null, look.look),
                cellPx = c, peek = false,
                width = sprites.width * c + stopW, height = hang + (sprites.height - TOP_ROW) * c,
                beepoY = y, thread = maxOf(0, y + top), threadX = sprites.width * c / 2 - c / 4,
                stop = if (over) t.t("stop") else null, stopCell = cell,
            )
        }
        // The sign is centered under the hole whatever its width; a new window when it comes or
        // goes, so no frame has the old content in the new place.
        val sign = view.signPole >= 0
        if (sign != cameraSign) closeCamera()
        cameraSign = sign
        cameraView.value = view
        val gravity = Gravity.TOP or if (sign) Gravity.CENTER_HORIZONTAL else Gravity.LEFT
        val px = if (sign) cam.cx - screenSize().x / 2 else cam.cx - sprites.width * view.cellPx / 2
        // Peeking: from one row inside the hole's bottom edge (now and then he bobs back up a
        // row). The sign and the thread: from the hole's middle.
        val py = if (view.peek) cam.cy + cam.r - view.cellPx * (if (frame % 24 < 2) 2 else 1) else cam.cy
        val win = cameraWin ?: OverlayWindow(this, focusable = false, setup = { free(); at(gravity, px, py) }) {
            cameraView.value?.let { CameraUi(it, onTap = ::comeDown) }
        }.also { cameraWin = it }
        place(win, gravity, px, py)

        // Bubble under him once he's all the way down.
        val b = bubble
        if (b != null && drop == DROP_STEPS) {
            val screen = screenSize().x
            showBubble(b, Gravity.TOP or Gravity.CENTER_HORIZONTAL, (cam.cx - screen / 2).coerceIn(-screen / 4, screen / 4), py + view.height + (4 * density).toInt())
        } else {
            showBubble(null, 0, 0, 0)
        }
    }

    private fun showBubble(b: Bubble?, gravity: Int, x: Int, y: Int) {
        if (b !== shownBubble) {
            bubbleWin?.close()
            bubbleWin = null
            shownBubble = b
        }
        if (b == null) return
        val t = i18n()
        val win = bubbleWin ?: OverlayWindow(this, focusable = false, setup = { free(); at(gravity, x, y) }) {
            BubbleUi(b, t.rtl, t.t("close")) { bubble = null }
        }.also { bubbleWin = it }
        place(win, gravity, x, y)
    }

    private fun cell(st: State, look: BeepoLook) = minOf(8, st.settings.scale + look.grow)

    /** A burst from Beepo: from his chest at the bottom, or under the hole when he's in the camera. */
    private fun confetti(st: State) {
        val density = resources.displayMetrics.density
        val (ox, oy) = if (home == Home.CAMERA) {
            val cam = camera()
            cam.cx to maxOf(cam.cy, cam.statusBar) + (48 * density).toInt()
        } else {
            val look = st.beepoLook(store.sprites)
            val c = cell(st, look) * density
            val w = store.sprites.width * c
            val h = store.sprites.height * c
            val size = screenSize()
            val left = if (x >= 0) x + (if (lastPetLeft) petWidth else 0) else if (st.settings.side == "left") 16 * density else size.x - 16 * density - w
            (left + w / 2).toInt() to (size.y + c - h + h / 3).toInt()
        }
        val pieces = confettiPieces()
        confettiWin?.close()
        val win = OverlayWindow(this, focusable = false, setup = {
            free()
            flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
            // Touches only pass through a not-touchable overlay this see-through (Android 12+).
            alpha = 0.8f
            width = (CONFETTI_W * density).toInt()
            height = (CONFETTI_H * density).toInt()
            at(Gravity.TOP or Gravity.LEFT, ox - (CONFETTI_W / 2 * density).toInt(), oy - (CONFETTI_Y * density).toInt())
        }) {
            ConfettiUi(pieces, Offset(CONFETTI_W / 2f, CONFETTI_Y.toFloat()))
        }
        confettiWin = win
        scope.launch {
            delay(CONFETTI_MS)
            win.close()
            if (confettiWin === win) confettiWin = null
        }
    }

    // ---------- jumping into the camera and back ----------

    private class Flight(val up: Boolean)

    /** Long press: he crouches, jumps up the screen, shrinking, and pops into the camera. */
    private fun hide() {
        if (flight != null || home == Home.CAMERA) return
        scope.launch { fly(up = true) }
    }

    /** Tapping him in the camera: he drops out and falls back down to the bottom, growing. */
    private fun comeDown() {
        if (flight != null || home == Home.BOTTOM) return
        bubble = null
        scope.launch { fly(up = false) }
    }

    private suspend fun fly(up: Boolean) {
        flight = Flight(up)
        val st = store.state.value
        val look = st.beepoLook(store.sprites)
        val cell = cell(st, look)
        val density = resources.displayMetrics.density
        val size = screenSize()
        val w = (store.sprites.width * cell * density).toInt()
        val h = (store.sprites.height * cell * density).toInt()
        // Beepo's spot at the bottom (his own column in the stage row) and the hole's center.
        val margin = 16 * density
        if (x < 0) x = if (st.settings.side == "left") margin else size.x - margin - w
        val bx = x + if (lastPetLeft) petWidth else 0
        val bottom = PointF(bx + w / 2f, size.y - h / 2f + cell * density)
        val cam = camera()
        val hole = PointF(cam.cx.toFloat(), cam.cy.toFloat())
        val from = if (up) bottom else hole
        val to = if (up) hole else bottom
        val m = if (up) "happy" else "proud"
        val view = mutableStateOf(store.sprites.compose(m, "sit", look.look) to (if (up) 1f else HOLE_SCALE))

        closeBuddy()
        closeCamera()
        val win = OverlayWindow(this, focusable = false, setup = {
            free()
            flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
            at(Gravity.TOP or Gravity.LEFT, (from.x - w / 2).toInt(), (from.y - h / 2).toInt())
        }) {
            val (frame, scale) = view.value
            FlightUi(frame, cell, scale)
        }
        // Crouch first (going up) / land at the end (coming down): a couple of frames sitting.
        if (up) delay(FLY_MS * 3)
        for (i in 1..FLY_STEPS) {
            val p = i / FLY_STEPS.toFloat()
            // Up: fast off the ground, slowing near the top. Down: the reverse, a fall.
            val e = if (up) 1 - (1 - p) * (1 - p) else p * p
            val cx = from.x + (to.x - from.x) * p
            val cy = from.y + (to.y - from.y) * e
            val scale = if (up) 1f + (HOLE_SCALE - 1f) * p else HOLE_SCALE + (1f - HOLE_SCALE) * p
            view.value = store.sprites.compose(m, if (i % 2 == 0) "wave" else null, look.look) to scale
            win.params.at(Gravity.TOP or Gravity.LEFT, (cx - w / 2).toInt(), (cy - h / 2).toInt())
            win.update()
            delay(FLY_MS)
        }
        if (!up) {
            view.value = store.sprites.compose(m, "sit", look.look) to 1f
            delay(FLY_MS * 3)
        }
        home = if (up) Home.CAMERA else Home.BOTTOM
        drop = 0
        flight = null
        // Where he arrives is drawn before the jump goes, so no frame is empty.
        render(System.currentTimeMillis())
        delay(FLY_MS * 2)
        win.close()
    }

    // ---------- screen geometry ----------

    /** The camera hole (center, radius) and the status bar height, in screen pixels. */
    private class Camera(val cx: Int, val cy: Int, val r: Int, val statusBar: Int)

    private fun camera(): Camera {
        val width = screenSize().x
        if (Build.VERSION.SDK_INT < 30) return Camera(width / 2, 0, 0, statusBarFallback())
        val insets = wm.currentWindowMetrics.windowInsets
        val bar = insets.getInsets(WindowInsets.Type.statusBars()).top
        val cut = insets.displayCutout
        val top = cut?.boundingRectTop
        if (cut == null || top == null || top.isEmpty) return Camera(width / 2, 0, 0, bar)
        if (Build.VERSION.SDK_INT >= 31) {
            cut.cutoutPath?.let { path ->
                val b = RectF()
                path.computeBounds(b, true)
                if (!b.isEmpty && b.top < bar) return Camera(b.centerX().toInt(), b.centerY().toInt(), (minOf(b.width(), b.height()) / 2).toInt(), bar)
            }
        }
        val r = minOf(top.width(), top.height()) / 2
        return Camera(top.centerX(), top.top + r, r, bar)
    }

    private fun statusBarFallback(): Int {
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (id > 0) resources.getDimensionPixelSize(id) else (24 * resources.displayMetrics.density).toInt()
    }

    private fun screenSize(): Point =
        if (Build.VERSION.SDK_INT >= 30) wm.currentWindowMetrics.bounds.let { Point(it.width(), it.height()) }
        else Point().also {
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealSize(it)
        }

    /** Screen coordinates: may cover the bars and the camera, and go past the edges. */
    private fun WindowManager.LayoutParams.free() {
        flags = flags or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        if (Build.VERSION.SDK_INT >= 30) {
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            // Otherwise the system keeps it clear of the status and navigation bars.
            fitInsetsTypes = 0
        } else if (Build.VERSION.SDK_INT >= 28) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }

    private fun place(win: OverlayWindow, gravity: Int, x: Int, y: Int) {
        val p = win.params
        if (p.gravity == gravity && p.x == x && p.y == y) return
        p.at(gravity, x, y)
        win.update()
    }

    private fun WindowManager.LayoutParams.at(gravity: Int, x: Int, y: Int) {
        this.gravity = gravity
        this.x = x
        this.y = y
    }

    private fun baseMood(st: State, rule: Rule, look: BeepoLook): String {
        val n = numbers(st, rule)
        val ratio = n.used.toFloat() / maxOf(1L, n.base)
        return when {
            rule.mode == Mode.GOAL -> if (ratio >= 1) "proud" else "happy"
            n.used >= n.limit -> "angry"
            ratio >= 0.8 -> "worried"
            isNight(System.currentTimeMillis()) -> "sleepy"
            look.look.scruffy -> "sad"
            else -> "happy"
        }
    }

    /** With "stay out" he wanders along the bottom now and then (like the page's wander). */
    private fun stepWalk(st: State, now: Long, cellPx: Float, screen: Int, margin: Float) {
        if (!stayingOut() || !st.settings.wander || bubble != null) {
            if (walk == Walk.WALK) walk = Walk.IDLE
            return
        }
        when (walk) {
            Walk.WALK -> {
                val step = cellPx * 2
                if (kotlin.math.abs(walkTo - x) <= step) {
                    x = walkTo
                    walk = Walk.IDLE
                    nextWalkAt = now + Random.nextLong(8_000, 20_000)
                } else {
                    x += if (walkTo > x) step else -step
                }
            }
            else -> if (now >= nextWalkAt) {
                val roll = Random.nextFloat()
                val maxX = screen - margin - stageWidth
                when {
                    roll < 0.6f && maxX > margin -> {
                        walk = Walk.WALK
                        walkTo = Random.nextFloat() * (maxX - margin) + margin
                    }
                    roll < 0.8f -> {
                        walk = Walk.SIT
                        nextWalkAt = now + Random.nextLong(5_000, 15_000)
                    }
                    else -> {
                        walk = Walk.IDLE
                        nextWalkAt = now + Random.nextLong(8_000, 20_000)
                    }
                }
            }
        }
    }

    private fun poke() {
        if (bubble != null) {
            bubble = null
            return
        }
        sayStatus(if (Random.nextFloat() < 0.25f) i18n().line("poke") else null)
    }

    /** Everything on screen except the camera peek and the block screen. */
    private fun closeBuddy() {
        closeStage()
        showBubble(null, 0, 0, 0)
    }

    private fun closeStage() {
        buddy?.close()
        buddy = null
        stageWidth = 0
        stageHeight = 0
    }

    private fun closeCamera() {
        cameraWin?.close()
        cameraWin = null
    }

    // ---------- block screen ----------

    private fun showBlock(st: State, rule: Rule, pkg: String, bs: BlockState) {
        blockRule = rule.id
        blockPkg = pkg
        bubble = null
        closeBuddy()
        closeCamera()
        goHome()
        val t = i18n()
        val n = numbers(st, rule)
        val focus = bs == BlockState.BLOCKED_FOCUS
        val (title, m) = t.line(if (focus) "focus" else "blocked", mapOf("name" to rule.name, "until" to (rule.focus?.end ?: "")))
            ?: (rule.name to "angry")
        val stars = st.wallet.stars
        blockView.value = BlockView(
            beepo = store.sprites.compose(m, look = st.beepoLook(store.sprites).look),
            title = title,
            info = if (focus) t.t("blockFocus", "start" to rule.focus?.start, "end" to rule.focus?.end, "stars" to stars)
            else t.t("blockUsed", "used" to t.minutes(n.used), "base" to t.minutes(n.base), "stars" to stars),
            unlock = t.t("unlock"),
            noStars = if (stars < 1) t.t("noStars") else null,
            close = t.android("closeApp"),
            rtl = t.rtl,
        )
        block = OverlayWindow(this, focusable = true, onBack = ::closeBlock) {
            blockView.value?.let { BlockUi(it, onUnlock = ::unlockBlocked, onClose = ::closeBlock) }
        }
    }

    private fun unlockBlocked() {
        val id = blockRule ?: return
        val pkg = blockPkg
        if (!store.unlock(id)) return
        closeBlock()
        queue.addFirst(Said(id, "unlock"))
        nextEventAt = 0
        pkg?.let { packageManager.getLaunchIntentForPackage(it) }?.let {
            runCatching { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }

    private fun closeBlock() {
        block?.close()
        block = null
        blockRule = null
        blockPkg = null
    }

    /** Leaves the blocked app, so its time stops counting while the block screen is up. */
    private fun goHome() {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { startActivity(home) }
    }
}
