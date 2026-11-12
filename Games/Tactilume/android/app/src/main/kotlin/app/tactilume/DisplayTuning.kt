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

/** Which of a screen's refresh rates suits a frame-rate cap. Plain Kotlin, unit-tested. */
internal object RefreshChoice {
    // how far a rate may be from a whole multiple of the cap (59.94 Hz panels count as 60)
    private const val TOLERANCE_HZ = 1f

    /**
     * The index in [rates] to ask for: with [capFps] 0 (none) the highest rate; with a cap the
     * lowest rate that is a whole multiple of it (60 Hz for a 30 or 60 cap on a 60/90/120 Hz
     * panel, 120 Hz where 60 is not offered), else the highest. Null when [rates] is empty.
     */
    fun pick(rates: List<Float>, capFps: Int): Int? {
        if (rates.isEmpty()) return null
        val highest = rates.indices.maxByOrNull { rates[it] }
        if (capFps <= 0) return highest
        val even = rates.indices.filter { i ->
            val k = Math.round(rates[i] / capFps)
            k >= 1 && kotlin.math.abs(rates[i] - k * capFps) <= TOLERANCE_HZ
        }
        return even.minByOrNull { rates[it] } ?: highest
    }
}

/** Making the most of the screen: every pixel, the right refresh rate, and no bars in the way. */
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
     * Asks for the refresh rate that suits the page's frame-rate cap ([capFps], 0 for none) at
     * the current resolution: with no cap the fastest (90, 120 or 144 Hz where the panel has
     * it), because flowing light is where a high refresh rate shows most; with a cap the
     * slowest one the cap divides evenly, so frames are paced evenly and the panel saves power.
     */
    fun preferRefreshRate(activity: Activity, capFps: Int) {
        val display = currentDisplay(activity) ?: return
        val current = display.mode
        val modes = display.supportedModes
            .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
        val best = RefreshChoice.pick(modes.map { it.refreshRate }, capFps)?.let { modes[it] } ?: return
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
