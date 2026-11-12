package app.tactilume

import org.junit.Assert.assertEquals
import org.junit.Test

// The page's vibrations: the touch tick follows the system's Touch feedback switch (Haptics)
class HapticsTest {
    @Test
    fun `the tick on every touch is the system's touch feedback`() {
        // main.js asks for 6 ms on every touch
        assertEquals(Haptics.Play.Tick, Haptics.choose(6))
        assertEquals(Haptics.Play.Tick, Haptics.choose(1))
        assertEquals(Haptics.Play.Tick, Haptics.choose(Haptics.TICK_MAX_MS))
    }

    @Test
    fun `a longer buzz keeps its length`() {
        // ui.js asks for 12 ms when hidden controls come back
        assertEquals(Haptics.Play.Buzz(12), Haptics.choose(12))
        assertEquals(Haptics.Play.Buzz(60), Haptics.choose(60))
    }
}
