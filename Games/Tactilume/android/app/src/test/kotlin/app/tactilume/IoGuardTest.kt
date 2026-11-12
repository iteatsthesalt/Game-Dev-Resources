package app.tactilume

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

// The bridge's file thread: a task that throws must not reach the thread's uncaught-exception
// handler, which on Android ends the app (and loses the photo or clip being saved)
class IoGuardTest {
    @Test
    fun `a RuntimeException in a file task is handed over, not thrown at the thread`() {
        val uncaught = AtomicReference<Throwable?>(null)
        val handled = AtomicReference<RuntimeException?>(null)
        val io = Executors.newSingleThreadExecutor { r ->
            Thread(r, "test-files").apply { setUncaughtExceptionHandler { _, e -> uncaught.set(e) } }
        }
        val after = CountDownLatch(1)
        io.execute(IoGuard.guarded({ throw IllegalStateException("Volume external_primary not found") }) { handled.set(it) })
        // the same thread keeps working afterwards
        io.execute { after.countDown() }
        assertTrue(after.await(5, TimeUnit.SECONDS))
        io.shutdown()
        assertTrue(io.awaitTermination(5, TimeUnit.SECONDS))
        assertNull(uncaught.get())
        assertEquals("Volume external_primary not found", handled.get()?.message)
    }

    @Test
    fun `a failing error handler does not escape either`() {
        IoGuard.guarded({ throw IllegalArgumentException("no") }) { throw IllegalStateException("log failed") }.run()
    }

    @Test
    fun `work that succeeds runs once`() {
        var runs = 0
        IoGuard.guarded({ runs++ }) { throw AssertionError("not called") }.run()
        assertEquals(1, runs)
    }
}
