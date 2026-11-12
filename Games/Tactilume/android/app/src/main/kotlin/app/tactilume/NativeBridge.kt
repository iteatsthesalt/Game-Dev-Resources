package app.tactilume

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import androidx.core.net.toUri
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import kotlin.math.roundToLong

/**
 * Android's Font size, as the page is told it. The WebView's own text zoom is switched off
 * (MainActivity.configure): it grows every font but none of the boxes around them, so the
 * page's controls overflowed. The page grows its controls as a whole by this scale instead.
 */
internal object FontScale {
    private const val MIN = 0.5
    private const val MAX = 4.0

    /** The scale to send: rounded to hundredths, 1 when the system reports nothing usable. */
    fun forPage(scale: Float): Double {
        if (!scale.isFinite() || scale <= 0f) return 1.0
        return (Math.round(scale.toDouble().coerceIn(MIN, MAX) * 100) / 100.0)
    }
}

/** Background work that may fail without taking the app down. Plain Kotlin, unit-tested. */
internal object IoGuard {
    /** [work], with any RuntimeException it throws handed to [onError] instead of escaping. */
    fun guarded(work: () -> Unit, onError: (RuntimeException) -> Unit): Runnable = Runnable {
        try {
            work()
        } catch (e: RuntimeException) {
            runCatching { onError(e) }
        }
    }
}

/** What the bridge asks of the Activity. Always called on the main thread. */
internal interface BridgeHost {
    fun vibrate(ms: Long)
    fun setKeepAwake(on: Boolean)
    fun openExternal(url: Uri): Boolean
    fun onBackAnswer(handled: Boolean)
    /** The page's frame-rate cap: 30, 60, or 0 for the display's own rate. */
    fun setFrameCap(fps: Int)
    /** Android 8 and 9 only: asks for the storage permission if needed, then calls back. */
    fun withStorageAccess(then: (Boolean) -> Unit)
}

/**
 * The page's line to the app: the TactilumeNative object from src/js/CONTRACTS.md
 * ("Android bridge"). Messages are JSON strings. Small ones are handled on the main thread;
 * file chunks are parsed, decoded and written on one background thread, in order.
 */
internal class NativeBridge(
    private val context: Context,
    private val host: BridgeHost,
) : WebViewCompat.WebMessageListener {

    private val main = Handler(Looper.getMainLooper())
    private val io: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, "tactilume-files") }
    private val files = FileTransfers(context.cacheDir)
    // Chunks waiting for the file thread. A phone with slow storage can fall behind a fast
    // page; when this runs out, the main thread waits briefly, which holds the page's next
    // message back instead of piling hundreds of megabytes up in memory.
    private val backlog = Semaphore(MAX_QUEUED_CHUNKS)
    private var lastReply: JavaScriptReplyProxy? = null
    private var closed = false

    init {
        onIo { files.clearLeftovers() }
    }

    /** Offers the bridge to pages in [webView] from the app origin. False when WebView is too old for it. */
    fun attach(webView: WebView): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return false
        WebViewCompat.addWebMessageListener(webView, NAME, setOf(AppWeb.ORIGIN), this)
        return true
    }

    /** The page went away (its WebView was replaced); a new one says hello again. */
    fun forgetPage() {
        lastReply = null
        // nobody is left to finish what that page was sending
        onIo { files.failAll() }
    }

    /** Android's Font size, from the Activity's configuration; the page hears of each change. */
    var fontScale: Double = 1.0
        private set

    /** Main thread: the system font scale is [scale] now; a page that has said hello is told. */
    fun setFontScale(scale: Float) {
        val next = FontScale.forPage(scale)
        if (next == fontScale) return
        fontScale = next
        lastReply?.let { post(it, JSONObject().put("t", "font").put("scale", next)) }
    }

    /** Tells the page Back was pressed. False when no page is listening. */
    fun sendBack(): Boolean {
        val proxy = lastReply ?: return false
        return post(proxy, JSONObject().put("t", "back"))
    }

    fun close() {
        closed = true
        lastReply = null
        main.removeCallbacksAndMessages(null)
        // lets a save that is under way finish; anything still streaming is dropped
        onIo { files.failAll() }
        io.shutdown()
    }

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        // the origin rule already limits this to the app; checked again so a frame can never talk
        if (closed || !isMainFrame || !AppWeb.isAppUrl(sourceOrigin)) return
        val text = message.data ?: return
        lastReply = replyProxy
        if (text.length > MAIN_THREAD_MAX_CHARS) {
            queueChunk(text, replyProxy)
            return
        }
        val msg = parse(text) ?: return
        when (msg.optString("t")) {
            "hello" -> post(replyProxy, hello())
            "begin" -> onIo { begin(msg, replyProxy) }
            "chunk" -> onIo { chunk(msg, replyProxy) }
            "end" -> onIo { end(msg, replyProxy) }
            "abort" -> onIo { files.abort(msg.optString("id")) }
            "vibrate" -> msg.optDouble("ms").takeIf { it.isFinite() }?.let {
                host.vibrate(it.roundToLong().coerceIn(MIN_VIBRATE_MS, MAX_VIBRATE_MS))
            }
            "awake" -> host.setKeepAwake(msg.optBoolean("on", true))
            "fps" -> host.setFrameCap(msg.optInt("cap", 0).takeIf { it == 30 || it == 60 } ?: 0)
            "open" -> host.openExternal(msg.optString("url").toUri())
            "back" -> host.onBackAnswer(msg.optBoolean("handled", false))
        }
    }

    private fun hello() = JSONObject()
        .put("t", "hello")
        .put("version", BuildConfig.VERSION_NAME)
        .put("sdk", Build.VERSION.SDK_INT)
        .put("device", deviceName())
        .put("webview", WebViewCheck.version(context) ?: JSONObject.NULL)
        .put("fontScale", fontScale)

    // ---- files: from here on, everything runs on the io thread unless it says otherwise -----

    /** Main thread: hands a big message (a file chunk) to the io thread. */
    private fun queueChunk(text: String, proxy: JavaScriptReplyProxy) {
        val queued = try {
            backlog.tryAcquire(BACKLOG_WAIT_MS, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            false
        }
        if (!queued) {
            onIo { files.failAll().forEach { done(proxy, it, SaveProblem.BUSY) } }
            return
        }
        val accepted = onIo {
            try {
                parse(text)?.let { chunk(it, proxy) }
            } finally {
                backlog.release()
            }
        }
        if (!accepted) backlog.release()
    }

    private fun begin(msg: JSONObject, proxy: JavaScriptReplyProxy) {
        val id = transferId(msg) ?: return
        val problem = files.begin(id, msg.optString("name"), msg.optString("mime"), msg.optLong("size", 0L))
        if (problem != null) done(proxy, id, problem)
    }

    private fun chunk(msg: JSONObject, proxy: JavaScriptReplyProxy) {
        if (msg.optString("t") != "chunk") return
        val id = transferId(msg) ?: return
        val seq = if (msg.has("seq")) msg.optInt("seq", -1) else null
        val problem = files.chunk(id, seq, msg.optString("data"))
        if (problem != null) done(proxy, id, problem)
    }

    private fun end(msg: JSONObject, proxy: JavaScriptReplyProxy) {
        val id = transferId(msg) ?: return
        when (val finished = files.finish(id)) {
            is FileTransfers.Finished.AlreadyAnswered -> Unit
            is FileTransfers.Finished.Failed -> done(proxy, id, finished.problem)
            is FileTransfers.Finished.Ready -> {
                if (MediaSaver.needsPermission(context)) {
                    onMain {
                        host.withStorageAccess { granted ->
                            if (granted) {
                                onIo { save(finished.received, id, proxy) }
                            } else {
                                onIo { finished.received.file.delete() }
                                done(proxy, id, SaveProblem.NEEDS_PERMISSION)
                            }
                        }
                    }
                } else {
                    save(finished.received, id, proxy)
                }
            }
        }
    }

    private fun save(received: ReceivedFile, id: String, proxy: JavaScriptReplyProxy) {
        val saved = try {
            MediaSaver.save(context, received)
        } catch (e: IOException) {
            Log.w(TAG, "Could not save ${received.mime}", e)
            null
        } catch (e: SecurityException) {
            Log.w(TAG, "Not allowed to save ${received.mime}", e)
            null
        } catch (e: RuntimeException) {
            // MediaStore can throw others (a storage volume gone, its database failing)
            Log.w(TAG, "Could not save ${received.mime}", e)
            null
        } finally {
            received.file.delete()
        }
        onMain {
            if (saved == null) done(proxy, id, SaveProblem.FAILED)
            else post(proxy, doneMessage(id, true).put("where", saved.where))
        }
    }

    private fun done(proxy: JavaScriptReplyProxy, id: String, problem: SaveProblem) {
        post(proxy, doneMessage(id, false).put("error", context.getString(problem.message)))
    }

    private fun doneMessage(id: String, ok: Boolean) = JSONObject().put("t", "done").put("id", id).put("ok", ok)

    // ---- plumbing ---------------------------------------------------------------------------

    /** Runs [work] on the main thread, unless the Activity has gone by then. */
    private fun onMain(work: () -> Unit) {
        main.post { if (!closed) work() }
    }

    /**
     * Runs [work] on the io thread; false once the bridge has closed. Nothing [work] throws
     * reaches the thread's uncaught-exception handler, which would end the app.
     */
    private fun onIo(work: () -> Unit): Boolean = try {
        io.execute(IoGuard.guarded(work) { e -> Log.w(TAG, "A file task failed", e) })
        true
    } catch (e: RejectedExecutionException) {
        false
    }

    /** Sends to the page from any thread; replies must go out on the main thread. */
    // A reply proxy only ever comes from onPostMessage, which only runs once attach() has
    // checked WEB_MESSAGE_LISTENER, so the feature is known to be there.
    @SuppressLint("RequiresFeature")
    private fun post(proxy: JavaScriptReplyProxy, msg: JSONObject): Boolean {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            main.post { post(proxy, msg) }
            return true
        }
        if (closed) return false
        return try {
            proxy.postMessage(msg.toString())
            true
        } catch (e: RuntimeException) {
            // the page this proxy belonged to has gone (reloaded, or its WebView was replaced)
            false
        }
    }

    private fun parse(text: String): JSONObject? = try {
        JSONObject(text)
    } catch (e: JSONException) {
        Log.w(TAG, "Ignored a message that is not JSON")
        null
    }

    private fun transferId(msg: JSONObject): String? =
        msg.optString("id").takeIf { it.isNotEmpty() && it.length <= MAX_ID_LENGTH }

    private fun deviceName(): String {
        val maker = Build.MANUFACTURER.orEmpty().replaceFirstChar(Char::titlecase)
        val model = Build.MODEL.orEmpty()
        return if (model.startsWith(maker, ignoreCase = true)) model else "$maker $model".trim()
    }

    companion object {
        const val NAME = "TactilumeNative"
        private const val TAG = "Tactilume"
        // file chunks are up to 512 KiB of text; anything this big is parsed off the main thread
        private const val MAIN_THREAD_MAX_CHARS = 8 * 1024
        private const val MAX_QUEUED_CHUNKS = 32
        // well under Android's 5 s "not responding" limit
        private const val BACKLOG_WAIT_MS = 2500L
        private const val MIN_VIBRATE_MS = 1L
        private const val MAX_VIBRATE_MS = 60L
        private const val MAX_ID_LENGTH = 80
    }
}
