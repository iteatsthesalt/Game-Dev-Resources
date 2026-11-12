package app.tactilume

import android.util.Base64
import android.webkit.MimeTypeMap
import androidx.annotation.StringRes
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream

/** Why a file could not be saved, as the short message the page shows. */
internal enum class SaveProblem(@param:StringRes val message: Int) {
    FAILED(R.string.save_failed),
    TOO_BIG(R.string.save_too_big),
    WRONG_TYPE(R.string.save_wrong_type),
    INCOMPLETE(R.string.save_incomplete),
    BUSY(R.string.save_busy),
    NEEDS_PERMISSION(R.string.save_needs_permission),
}

/** A file that arrived whole and is waiting in the cache to be saved. */
internal class ReceivedFile(val file: File, val name: String, val mime: String)

/**
 * Collects files the page streams over in base64 chunks into temporary files in the cache.
 * Used only from the bridge's single file thread, so it needs no locking. The decoder and
 * the extension lookup are parameters so the unit tests can run it on a plain JVM.
 */
internal class FileTransfers(
    cacheDir: File,
    private val maxBytes: Long = MAX_BYTES,
    private val decode: (String) -> ByteArray = { Base64.decode(it, Base64.DEFAULT) },
    private val extensionFor: (String) -> String? = { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) },
) {

    sealed interface Finished {
        class Ready(val received: ReceivedFile) : Finished
        class Failed(val problem: SaveProblem) : Finished
        // the page was already told this transfer failed
        data object AlreadyAnswered : Finished
    }

    private class Open(val name: String, val mime: String, val file: File, val out: OutputStream) {
        var bytes = 0L
        var nextSeq = 0
    }

    private val dir = File(cacheDir, "transfers")
    private val open = HashMap<String, Open>()
    private val answered = ArrayDeque<String>()

    /** Removes parts left behind if the app was closed in the middle of a transfer. */
    fun clearLeftovers() {
        dir.listFiles()?.forEach { it.delete() }
    }

    /** Starts a transfer. Returns why it cannot start, or null when it has. */
    fun begin(id: String, name: String, mime: String, declaredSize: Long): SaveProblem? {
        close(id)
        val type = cleanMime(mime) ?: return refuse(id, SaveProblem.WRONG_TYPE)
        if (declaredSize > maxBytes) return refuse(id, SaveProblem.TOO_BIG)
        return try {
            if (!dir.isDirectory && !dir.mkdirs()) throw IOException("could not create $dir")
            val file = File.createTempFile("transfer", ".part", dir)
            val out = BufferedOutputStream(FileOutputStream(file), BUFFER_BYTES)
            open[id] = Open(cleanName(name, type, extensionFor(type)), type, file, out)
            null
        } catch (e: IOException) {
            refuse(id, SaveProblem.FAILED)
        }
    }

    /** Adds one chunk. Returns a problem when the transfer has to stop, else null. */
    fun chunk(id: String, seq: Int?, data: String): SaveProblem? {
        // unknown: already finished, aborted or failed, and the page has its answer
        val t = open[id] ?: return null
        if (seq != null && seq != t.nextSeq) return fail(id, SaveProblem.INCOMPLETE)
        // every 4 base64 characters hold 3 bytes, so the size is known before decoding
        if (t.bytes + data.length / 4 * 3 > maxBytes) return fail(id, SaveProblem.TOO_BIG)
        val bytes = try {
            decode(data)
        } catch (e: IllegalArgumentException) {
            return fail(id, SaveProblem.INCOMPLETE)
        }
        try {
            t.out.write(bytes)
        } catch (e: IOException) {
            return fail(id, SaveProblem.FAILED)
        }
        t.bytes += bytes.size
        t.nextSeq++
        return null
    }

    /** Closes a transfer whose last chunk has arrived and hands its file over. */
    fun finish(id: String): Finished {
        val t = open.remove(id) ?: return if (id in answered) Finished.AlreadyAnswered else Finished.Failed(SaveProblem.FAILED)
        return try {
            t.out.close()
            if (t.bytes == 0L) {
                t.file.delete()
                Finished.Failed(SaveProblem.INCOMPLETE)
            } else {
                Finished.Ready(ReceivedFile(t.file, t.name, t.mime))
            }
        } catch (e: IOException) {
            t.file.delete()
            Finished.Failed(SaveProblem.FAILED)
        }
    }

    /** Drops a transfer the page gave up on. */
    fun abort(id: String) = close(id)

    /** Drops every open transfer (the bridge is closing, or it could not keep up). */
    fun failAll(): List<String> {
        val ids = open.keys.toList()
        ids.forEach { fail(it, SaveProblem.BUSY) }
        return ids
    }

    private fun fail(id: String, problem: SaveProblem): SaveProblem {
        close(id)
        return refuse(id, problem)
    }

    private fun refuse(id: String, problem: SaveProblem): SaveProblem {
        answered.addLast(id)
        while (answered.size > REMEMBERED_ANSWERS) answered.removeFirst()
        return problem
    }

    private fun close(id: String) {
        val t = open.remove(id) ?: return
        try {
            t.out.close()
        } catch (e: IOException) {
            // the file is deleted next; a failed close changes nothing
        }
        t.file.delete()
    }

    companion object {
        const val MAX_BYTES = 512L * 1024 * 1024
        private const val BUFFER_BYTES = 256 * 1024
        private const val REMEMBERED_ANSWERS = 16
        private val MEDIA_TYPE = Regex("^(image|video)/[a-z0-9][a-z0-9.+-]*$")
        private val UNSAFE_CHARS = Regex("[\\\\/:*?\"<>|\\p{Cntrl}]")
        private val EXTENSION = Regex("\\.[A-Za-z0-9]{1,5}$")

        /** "video/webm;codecs=vp9" becomes "video/webm"; anything but a picture or video is refused. */
        fun cleanMime(mime: String): String? =
            mime.substringBefore(';').trim().lowercase().takeIf { MEDIA_TYPE.matches(it) }

        /**
         * A safe file name ending in the extension that matches the file's type: no folders,
         * no characters that file systems or galleries trip over, not hidden, not too long.
         */
        fun cleanName(name: String, mime: String, knownExtension: String?): String {
            val ext = knownExtension ?: mime.substringAfter('/').filter(Char::isLetterOrDigit).take(5)
            val stem = name.substringAfterLast('/').substringAfterLast('\\')
                .replace(UNSAFE_CHARS, "")
                .trim()
                .replace(EXTENSION, "")
                .trim(' ', '.')
                .take(80)
                .trimEnd(' ', '.')
                .ifEmpty { "Tactilume" }
            return "$stem.$ext"
        }
    }
}
