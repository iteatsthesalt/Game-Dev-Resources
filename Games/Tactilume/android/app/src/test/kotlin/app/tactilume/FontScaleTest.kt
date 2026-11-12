package app.tactilume

import org.junit.Assert.assertEquals
import org.junit.Test

class FontScaleTest {
    @Test
    fun `Android's Font size reaches the page as it is`() {
        assertEquals(1.0, FontScale.forPage(1f), 0.0)
        assertEquals(1.3, FontScale.forPage(1.3f), 0.0)
        assertEquals(2.0, FontScale.forPage(2f), 0.0)
        assertEquals(0.85, FontScale.forPage(0.85f), 0.0)
    }

    @Test
    fun `a float's noise is rounded away`() {
        assertEquals(1.15, FontScale.forPage(1.1500001f), 0.0)
    }

    @Test
    fun `a scale the system cannot mean is read as 1`() {
        assertEquals(1.0, FontScale.forPage(Float.NaN), 0.0)
        assertEquals(1.0, FontScale.forPage(Float.POSITIVE_INFINITY), 0.0)
        assertEquals(1.0, FontScale.forPage(0f), 0.0)
        assertEquals(1.0, FontScale.forPage(-2f), 0.0)
    }

    @Test
    fun `extreme scales are held to a sane range`() {
        assertEquals(4.0, FontScale.forPage(9f), 0.0)
        assertEquals(0.5, FontScale.forPage(0.1f), 0.0)
    }
}
