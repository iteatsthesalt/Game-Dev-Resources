package app.tactilume

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The page's Frame rate setting picks the screen's refresh rate (DisplayTuning.preferRefreshRate)
class RefreshChoiceTest {
    private fun rate(rates: List<Float>, cap: Int) = RefreshChoice.pick(rates, cap)?.let { rates[it] }

    @Test
    fun `with no cap the fastest rate is asked for`() {
        assertEquals(120f, rate(listOf(60f, 120f, 90f), 0))
        assertEquals(144f, rate(listOf(60f, 144f, 120f), 0))
    }

    @Test
    fun `a 60 or 30 cap asks for the slowest rate it divides evenly`() {
        val panel = listOf(60f, 90f, 120f)
        assertEquals(60f, rate(panel, 60))
        assertEquals(60f, rate(panel, 30))
        // where 60 is not offered, 120 still paces a 60 cap evenly (not 90: one vsync, then two)
        assertEquals(120f, rate(listOf(90f, 120f), 60))
        // a 144 Hz panel with 60 and 120 modes too
        assertEquals(60f, rate(listOf(144f, 120f, 60f), 60))
    }

    @Test
    fun `rates a little off a whole multiple still count`() {
        assertEquals(59.94f, rate(listOf(59.94f, 90f, 119.88f), 60))
    }

    @Test
    fun `with no even rate the fastest is kept`() {
        assertEquals(90f, rate(listOf(90f, 50f), 60))
    }

    @Test
    fun `no modes, no choice`() {
        assertNull(RefreshChoice.pick(emptyList(), 60))
    }
}
