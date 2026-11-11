package app.tactilume

import android.Manifest
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import java.io.File
import java.io.IOException

/** Puts photos into Pictures/Tactilume and clips into Movies/Tactilume, where galleries find them. */
internal object MediaSaver {
    class Saved(val uri: Uri, val where: String)

    private const val FOLDER = "Tactilume"

    /** Only Android 8 and 9 need a permission to add to the shared folders. */
    fun needsPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED

    @Throws(IOException::class)
    fun save(context: Context, received: ReceivedFile): Saved {
        val video = received.mime.startsWith("video/")
        val where = (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/" + FOLDER
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveScoped(context.contentResolver, received, video, where)
        } else {
            saveLegacy(context, received, video)
        }
        return Saved(uri, where)
    }

    // Android 10 and later: the entry stays hidden (pending) until the bytes are all in, so a
    // gallery never shows a half-written video.
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveScoped(resolver: ContentResolver, received: ReceivedFile, video: Boolean, where: String): Uri {
        val collection = if (video) {
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        }
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, received.name)
            put(MediaStore.MediaColumns.MIME_TYPE, received.mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, where)
            put(MediaStore.MediaColumns.DATE_TAKEN, System.currentTimeMillis())
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values) ?: throw IOException("MediaStore did not create an entry")
        try {
            val out = resolver.openOutputStream(uri, "w") ?: throw IOException("MediaStore gave no stream")
            out.use { sink -> received.file.inputStream().use { it.copyTo(sink, COPY_BUFFER) } }
            resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e as? IOException ?: IOException(e)
        }
        return uri
    }

    // Android 8 and 9: write the file into the shared folder, then register it with MediaStore
    // so it has a content Uri to share and shows up in galleries straight away.
    @Suppress("DEPRECATION")
    private fun saveLegacy(context: Context, received: ReceivedFile, video: Boolean): Uri {
        val base = Environment.getExternalStoragePublicDirectory(
            if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES,
        )
        val dir = File(base, FOLDER)
        if (!dir.isDirectory && !dir.mkdirs()) throw IOException("could not create $dir")
        val target = uniqueFile(dir, received.name)
        received.file.copyTo(target)
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DATA, target.absolutePath)
            put(MediaStore.MediaColumns.DISPLAY_NAME, target.name)
            put(MediaStore.MediaColumns.TITLE, target.nameWithoutExtension)
            put(MediaStore.MediaColumns.MIME_TYPE, received.mime)
            put(MediaStore.MediaColumns.SIZE, target.length())
            put(MediaStore.MediaColumns.DATE_ADDED, now / 1000)
            put(MediaStore.MediaColumns.DATE_MODIFIED, now / 1000)
            put(if (video) MediaStore.Video.VideoColumns.DATE_TAKEN else MediaStore.Images.ImageColumns.DATE_TAKEN, now)
        }
        val collection = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val uri = context.contentResolver.insert(collection, values)
        if (uri == null) {
            target.delete()
            throw IOException("MediaStore did not create an entry")
        }
        // fills in the dimensions and duration that galleries show
        MediaScannerConnection.scanFile(context, arrayOf(target.absolutePath), arrayOf(received.mime), null)
        return uri
    }

    private fun uniqueFile(dir: File, name: String): File {
        val stem = name.substringBeforeLast('.')
        val ext = name.substringAfterLast('.', "")
        var candidate = File(dir, name)
        var n = 2
        while (candidate.exists()) {
            candidate = File(dir, if (ext.isEmpty()) "$stem ($n)" else "$stem ($n).$ext")
            n++
        }
        return candidate
    }

    private const val COPY_BUFFER = 64 * 1024
}
