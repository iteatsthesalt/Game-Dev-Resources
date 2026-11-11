package app.tactilume

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.IOException
import java.nio.file.Files

// The Android 8 and 9 save path: the file handling around MediaStore, which runs on a plain JVM
class MediaSaverTest {
    private lateinit var dir: File
    private lateinit var source: File
    private val bytes = ByteArray(200_000) { (it * 31).toByte() }

    @Before
    fun setUp() {
        dir = Files.createTempDirectory("tactilume-saver").toFile()
        source = File(dir, "cached.mp4").apply { writeBytes(bytes) }
    }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private fun shared() = File(dir, "shared").apply { mkdirs() }

    private fun assertFails(block: () -> Unit): IOException = assertThrows(IOException::class.java) { block() }

    @Test
    fun `a free name is claimed, and a taken one gets a number`() {
        val folder = shared()
        val first = MediaSaver.createUniqueFile(folder, "tactilume-clip.mp4")
        val second = MediaSaver.createUniqueFile(folder, "tactilume-clip.mp4")
        val bare = MediaSaver.createUniqueFile(folder, "notes")
        val bareAgain = MediaSaver.createUniqueFile(folder, "notes")
        assertEquals("tactilume-clip.mp4", first.name)
        assertEquals("tactilume-clip (2).mp4", second.name)
        assertEquals("notes (2)", bareAgain.name)
        assertTrue(first.isFile && second.isFile && bare.isFile)
    }

    @Test
    fun `a saved file has every byte and stays`() {
        val target = MediaSaver.createUniqueFile(shared(), "clip.mp4")
        assertEquals("content://media/1", MediaSaver.copyThenRegister(source, target) { "content://media/1" })
        assertArrayEquals(bytes, target.readBytes())
    }

    @Test
    fun `a refused MediaStore entry removes the file`() {
        val target = MediaSaver.createUniqueFile(shared(), "clip.mp4")
        assertFails { MediaSaver.copyThenRegister<String>(source, target) { null } }
        assertFalse(target.exists())
    }

    @Test
    fun `a MediaStore that throws removes the file and the error stays an IOException`() {
        val target = MediaSaver.createUniqueFile(shared(), "clip.mp4")
        val thrown = IllegalStateException("unknown URL")
        val e = assertFails { MediaSaver.copyThenRegister<String>(source, target) { throw thrown } }
        assertSame(thrown, e.cause)
        assertFalse(target.exists())
    }

    @Test
    fun `a copy that fails removes the file and MediaStore is never asked`() {
        val target = MediaSaver.createUniqueFile(shared(), "clip.mp4")
        var asked = false
        assertFails { MediaSaver.copyThenRegister<String>(File(dir, "gone.mp4"), target) { asked = true; "uri" } }
        assertFalse(asked)
        assertFalse(target.exists())
    }

    @Test
    fun `only the file this save created is removed`() {
        val folder = shared()
        val earlier = File(folder, "clip.mp4").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        val target = MediaSaver.createUniqueFile(folder, "clip.mp4")
        assertFails { MediaSaver.copyThenRegister<String>(source, target) { null } }
        assertArrayEquals(byteArrayOf(1, 2, 3), earlier.readBytes())
    }
}
