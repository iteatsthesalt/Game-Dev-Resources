package app.tactilume

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.Base64

class FileTransfersTest {
    private lateinit var cache: File
    private lateinit var files: FileTransfers

    private val extensions = mapOf("image/png" to "png", "video/mp4" to "mp4", "video/webm" to "webm")

    private fun transfers(maxBytes: Long = FileTransfers.MAX_BYTES) =
        FileTransfers(cache, maxBytes, { Base64.getDecoder().decode(it) }, extensions::get)

    private fun b64(bytes: ByteArray) = Base64.getEncoder().encodeToString(bytes)

    private fun partFiles() = File(cache, "transfers").listFiles()?.toList().orEmpty()

    @Before
    fun setUp() {
        cache = Files.createTempDirectory("tactilume-test").toFile()
        files = transfers()
    }

    @After
    fun tearDown() {
        cache.deleteRecursively()
    }

    @Test
    fun `chunks arrive in order and come out as the same bytes`() {
        val one = ByteArray(1000) { it.toByte() }
        val two = ByteArray(777) { (it * 7).toByte() }
        assertNull(files.begin("f1", "tactilume-photo.png", "image/png", 1777))
        assertNull(files.chunk("f1", 0, b64(one)))
        assertNull(files.chunk("f1", 1, b64(two)))
        val finished = files.finish("f1") as FileTransfers.Finished.Ready
        assertEquals("tactilume-photo.png", finished.received.name)
        assertEquals("image/png", finished.received.mime)
        assertArrayEquals(one + two, finished.received.file.readBytes())
    }

    @Test
    fun `a missing chunk stops the transfer and removes the part file`() {
        files.begin("f1", "clip.mp4", "video/mp4", 0)
        files.chunk("f1", 0, b64(ByteArray(10)))
        assertEquals(SaveProblem.INCOMPLETE, files.chunk("f1", 2, b64(ByteArray(10))))
        assertTrue(partFiles().isEmpty())
        // later chunks and the end are quiet: the page already has its answer
        assertNull(files.chunk("f1", 3, b64(ByteArray(10))))
        assertSame(FileTransfers.Finished.AlreadyAnswered, files.finish("f1"))
    }

    @Test
    fun `chunks without a sequence number are accepted`() {
        files.begin("f1", "a.png", "image/png", 0)
        assertNull(files.chunk("f1", null, b64(byteArrayOf(1, 2, 3))))
        assertTrue(files.finish("f1") is FileTransfers.Finished.Ready)
    }

    @Test
    fun `broken base64 is refused`() {
        files.begin("f1", "a.png", "image/png", 0)
        assertEquals(SaveProblem.INCOMPLETE, files.chunk("f1", 0, "not base64 at all!"))
    }

    @Test
    fun `files over the limit are refused up front and while streaming`() {
        files = transfers(maxBytes = 16)
        assertEquals(SaveProblem.TOO_BIG, files.begin("big", "a.mp4", "video/mp4", 17))
        assertNull(files.begin("f1", "a.mp4", "video/mp4", 0))
        assertNull(files.chunk("f1", 0, b64(ByteArray(12))))
        assertEquals(SaveProblem.TOO_BIG, files.chunk("f1", 1, b64(ByteArray(12))))
        assertTrue(partFiles().isEmpty())
    }

    @Test
    fun `only pictures and videos can be saved`() {
        assertEquals(SaveProblem.WRONG_TYPE, files.begin("f1", "page.html", "text/html", 10))
        assertEquals(SaveProblem.WRONG_TYPE, files.begin("f2", "x", "application/octet-stream", 10))
        assertNull(files.begin("f3", "clip", "video/webm;codecs=vp9,opus", 10))
    }

    @Test
    fun `an empty file is not saved`() {
        files.begin("f1", "a.png", "image/png", 0)
        val finished = files.finish("f1") as FileTransfers.Finished.Failed
        assertEquals(SaveProblem.INCOMPLETE, finished.problem)
    }

    @Test
    fun `an end for a transfer that never began gets an answer`() {
        val finished = files.finish("nobody") as FileTransfers.Finished.Failed
        assertEquals(SaveProblem.FAILED, finished.problem)
    }

    @Test
    fun `abort and failAll clean up`() {
        files.begin("f1", "a.png", "image/png", 0)
        files.chunk("f1", 0, b64(ByteArray(5)))
        files.abort("f1")
        assertTrue(partFiles().isEmpty())
        files.begin("f2", "a.png", "image/png", 0)
        files.begin("f3", "b.png", "image/png", 0)
        assertEquals(setOf("f2", "f3"), files.failAll().toSet())
        assertTrue(partFiles().isEmpty())
    }

    @Test
    fun `leftovers from an earlier run are cleared`() {
        val dir = File(cache, "transfers").apply { mkdirs() }
        File(dir, "transfer123.part").writeText("old")
        files.clearLeftovers()
        assertTrue(partFiles().isEmpty())
    }

    @Test
    fun `mime types are cleaned`() {
        assertEquals("video/webm", FileTransfers.cleanMime(" Video/WebM ; codecs=vp9"))
        assertEquals("image/png", FileTransfers.cleanMime("image/png"))
        assertNull(FileTransfers.cleanMime("image/"))
        assertNull(FileTransfers.cleanMime("text/plain"))
    }

    @Test
    fun `names are made safe and get the right extension`() {
        assertEquals("tactilume-2026.png", FileTransfers.cleanName("tactilume-2026.png", "image/png", "png"))
        assertEquals("clip.mp4", FileTransfers.cleanName("clip.webm", "video/mp4", "mp4"))
        assertEquals("passwd.png", FileTransfers.cleanName("../../etc/passwd", "image/png", "png"))
        assertEquals("evil.png", FileTransfers.cleanName("C:\\temp\\ev:il?.png", "image/png", "png"))
        assertEquals("hidden.png", FileTransfers.cleanName(".hidden", "image/png", "png"))
        assertEquals("Tactilume.png", FileTransfers.cleanName("  ", "image/png", "png"))
        assertEquals("Tactilume.mp4", FileTransfers.cleanName("...", "video/mp4", "mp4"))
        // a type Android has no extension for still gets a short, plain one
        assertEquals("a.quick", FileTransfers.cleanName("a", "video/quicktime", null))
        assertEquals(80 + ".png".length, FileTransfers.cleanName("x".repeat(300), "image/png", "png").length)
    }
}
