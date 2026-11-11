package app.tactilume

import android.app.Activity
import android.graphics.Rect
import android.os.Build
import android.view.Display
import android.view.View
import android.view.Window
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/** Making the most of the screen: every pixel, the fastest refresh, and no bars in the way. */
internal object DisplayTuning {
    // Android honours at most 200 dp of back-gesture exclusion per side edge
    private const val EXCLUDED_EDGE_HEIGHT_DP = 200
    // wider than any back-gesture sensitivity setting; only the part inside the gesture zone counts
    private const val EXCLUDED_EDGE_WIDTH_DP = 48

    /** Lets the page draw under camera cutouts: short edges only before Android 11, every edge after. */
    fun drawIntoCutouts(window: Window) {
        val mode = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ->
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            else -> return
        }
        val attrs = window.attributes
        if (attrs.layoutInDisplayCutoutMode != mode) {
            attrs.layoutInDisplayCutoutMode = mode
            window.attributes = attrs
        }
    }

    /** Hides the status and navigation bars; a swipe from an edge shows them for a moment. */
    fun hideSystemBars(window: Window) {
        WindowCompat.getInsetsController(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    /**
     * Asks for the display's fastest refresh rate at the current resolution (90, 120 or 144 Hz
     * where the panel has it), because flowing light is where a high refresh rate shows most.
     */
    fun preferHighestRefreshRate(activity: Activity) {
        val display = currentDisplay(activity) ?: return
        val current = display.mode
        val best = display.supportedModes
            .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
            .maxByOrNull { it.refreshRate } ?: return
        val window = activity.window
        val attrs = window.attributes
        if (attrs.preferredDisplayModeId == best.modeId && attrs.preferredRefreshRate == best.refreshRate) return
        attrs.preferredDisplayModeId = best.modeId
        // older or customised builds that ignore the mode id still honour the rate
        attrs.preferredRefreshRate = best.refreshRate
        window.attributes = attrs
    }

    private fun currentDisplay(activity: Activity): Display? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.display
        } else {
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay
        }
    } catch (e: UnsupportedOperationException) {
        null
    }

    /**
     * Keeps the lower part of both side edges for play instead of the system Back gesture.
     * Thumbs sweep in from the sides near the bottom when holding a phone, so that is where
     * an accidental Back would hurt most. The upper part still works for Back.
     */
    fun keepEdgesForPlay(view: View) {
        view.addOnLayoutChangeListener { v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
            if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) excludeEdges(v)
        }
        excludeEdges(view)
    }

    private fun excludeEdges(view: View) {
        val w = view.width
        val h = view.height
        if (w == 0 || h == 0) return
        val density = view.resources.displayMetrics.density
        val edgeHeight = minOf(h, (EXCLUDED_EDGE_HEIGHT_DP * density).toInt())
        val edgeWidth = minOf(w / 2, (EXCLUDED_EDGE_WIDTH_DP * density).toInt())
        ViewCompat.setSystemGestureExclusionRects(
            view,
            listOf(
                Rect(0, h - edgeHeight, edgeWidth, h),
                Rect(w - edgeWidth, h - edgeHeight, w, h),
            ),
        )
    }
}
