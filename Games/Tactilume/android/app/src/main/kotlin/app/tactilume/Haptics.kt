package app.tactilume

/**
 * How a vibration the page asks for is played. Plain Kotlin, unit-tested.
 *
 * The tick on every touch (6 ms) is the system's own touch feedback (View.performHapticFeedback),
 * which follows the system's Touch feedback switch on every Android version and plays the
 * device's tuned tick. A plain Vibrator call does not on Android 8, and on 9 to 12 it ignores the
 * old "Vibrate on tap" switch. Anything longer, such as the buzz when hidden controls come back,
 * is a deliberate confirmation and stays a one-shot vibration of the asked length.
 */
internal object Haptics {
    /** The longest vibration still played as the system's touch tick. */
    const val TICK_MAX_MS = 8L

    sealed interface Play {
        /** View.performHapticFeedback with the system's touch constant. */
        data object Tick : Play

        /** A one-shot vibration of [ms]. */
        data class Buzz(val ms: Long) : Play
    }

    fun choose(ms: Long): Play = if (ms <= TICK_MAX_MS) Play.Tick else Play.Buzz(ms)
}
