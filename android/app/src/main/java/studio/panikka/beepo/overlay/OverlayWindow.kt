package studio.panikka.beepo.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner

/**
 * A Compose window drawn over other apps (TYPE_APPLICATION_OVERLAY). A service has no activity,
 * so the window brings its own lifecycle. `focusable` windows get the back key (`onBack`) and
 * cover the screen; the others only take touches on their own content.
 */
class OverlayWindow(
    context: Context,
    focusable: Boolean,
    private val onBack: () -> Unit = {},
    /** Where it first shows up (gravity, x, y), so it doesn't flash elsewhere first. */
    setup: WindowManager.LayoutParams.() -> Unit = {},
    content: @Composable () -> Unit,
) : LifecycleOwner, SavedStateRegistryOwner {
    private val wm = context.getSystemService(WindowManager::class.java)
    private val registry = LifecycleRegistry(this)
    private val saved = SavedStateRegistryController.create(this)
    override val lifecycle: Lifecycle get() = registry
    override val savedStateRegistry get() = saved.savedStateRegistry

    val params = WindowManager.LayoutParams(
        if (focusable) WindowManager.LayoutParams.MATCH_PARENT else WindowManager.LayoutParams.WRAP_CONTENT,
        if (focusable) WindowManager.LayoutParams.MATCH_PARENT else WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        if (focusable) WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        else WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT,
    ).apply {
        // Full-screen ones go behind the status and navigation bars too; their content pads itself.
        if (focusable) {
            fitInsetsTypes = 0
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        }
        setup()
    }

    private val root = object : FrameLayout(context) {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            if (event.keyCode == KeyEvent.KEYCODE_BACK) {
                if (event.action == KeyEvent.ACTION_UP) onBack()
                return true
            }
            return super.dispatchKeyEvent(event)
        }
    }

    init {
        saved.performRestore(null)
        registry.currentState = Lifecycle.State.RESUMED
        root.setViewTreeLifecycleOwner(this)
        root.setViewTreeSavedStateRegistryOwner(this)
        root.addView(ComposeView(context).apply { setContent(content) })
        wm.addView(root, params)
    }

    /** Applies changes made to [params] (position). */
    fun update() = runCatching { wm.updateViewLayout(root, params) }

    fun close() {
        registry.currentState = Lifecycle.State.DESTROYED
        runCatching { wm.removeView(root) }
    }
}
