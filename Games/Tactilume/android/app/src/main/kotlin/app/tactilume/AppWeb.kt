package app.tactilume

import android.content.Context
import android.net.Uri
import androidx.webkit.WebViewCompat

/**
 * Where the page lives. WebViewAssetLoader serves the APK's assets under this https origin,
 * which gives the page a secure context (needed for the microphone) without any server.
 */
internal object AppWeb {
    const val HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$HOST"
    const val START_URL = "$ORIGIN/assets/index.html"

    fun isAppUrl(uri: Uri?): Boolean =
        uri != null &&
            uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals(HOST, ignoreCase = true) &&
            (uri.port == -1 || uri.port == 443)
}

internal enum class WebViewProblem { MISSING, OUTDATED }

internal object WebViewCheck {
    // Tactilume leans on WebGL 2, modern JavaScript and WebMessageListener; all are solid from
    // WebView 100 on, and anything older is years out of date anyway.
    private const val MIN_MAJOR_VERSION = 100

    fun find(context: Context): WebViewProblem? {
        val pkg = try {
            WebViewCompat.getCurrentWebViewPackage(context)
        } catch (e: RuntimeException) {
            // some builds throw instead of returning null while WebView is being updated
            null
        } ?: return WebViewProblem.MISSING
        val major = pkg.versionName?.substringBefore('.')?.trim()?.toIntOrNull()
        // a version that cannot be read gets the benefit of the doubt
        return if (major != null && major < MIN_MAJOR_VERSION) WebViewProblem.OUTDATED else null
    }

    fun version(context: Context): String? = try {
        WebViewCompat.getCurrentWebViewPackage(context)?.versionName
    } catch (e: RuntimeException) {
        null
    }
}
