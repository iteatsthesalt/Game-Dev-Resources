package app.tactilume

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.graphics.createBitmap
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** What the WebView clients need from the Activity that hosts the page. */
internal interface WebHost {
    fun onPageVisible(view: WebView)
    fun onRendererGone(view: WebView)
    fun openExternal(url: Uri): Boolean
    fun onWebPermissionRequest(request: PermissionRequest)
    fun onWebPermissionCanceled(request: PermissionRequest)
    fun showFileChooser(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean
}

/**
 * Serves the page from the APK and keeps it there: the app origin is the only thing the
 * WebView may load, https links open in the browser, and nothing else leaves the device.
 */
internal class TactilumeWebViewClient(
    private val assets: WebViewAssetLoader,
    private val host: WebHost,
) : WebViewClient() {

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val url = request.url
        if (!AppWeb.isAppUrl(url)) return refused(403, "Forbidden")
        return assets.shouldInterceptRequest(url) ?: refused(404, "Not Found")
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url
        if (AppWeb.isAppUrl(url)) return false
        if (request.isForMainFrame) host.openExternal(url)
        return true
    }

    override fun onPageCommitVisible(view: WebView, url: String) {
        host.onPageVisible(view)
    }

    // The page's process was killed (low memory) or crashed. Returning true keeps the app
    // alive; the host swaps in a fresh WebView and the page picks up from saved settings.
    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        host.onRendererGone(view)
        return true
    }

    private fun refused(code: Int, reason: String) =
        WebResourceResponse("text/plain", "utf-8", code, reason, emptyMap(), ByteArrayInputStream(ByteArray(0)))
}

internal class TactilumeChromeClient(private val host: WebHost) : WebChromeClient() {

    override fun onPermissionRequest(request: PermissionRequest) {
        host.onWebPermissionRequest(request)
    }

    override fun onPermissionRequestCanceled(request: PermissionRequest) {
        host.onWebPermissionCanceled(request)
    }

    override fun onShowFileChooser(
        webView: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
    ): Boolean = host.showFileChooser(filePathCallback, fileChooserParams)

    // Without this, a <video> with no poster shows WebView's grey play button for a moment
    override fun getDefaultVideoPoster(): Bitmap = createBitmap(1, 1)
}
