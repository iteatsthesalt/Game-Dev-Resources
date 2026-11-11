package app.tactilume

import android.content.Context
import android.net.Uri
import android.webkit.WebSettings
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
    // Chromium 100 on, and anything older is years out of date anyway.
    private const val MIN_MAJOR_VERSION = 100
    private const val GOOGLE_WEBVIEW = "com.google.android.webview"
    private val CHROME_VERSION = Regex("Chrome/(\\d+)")

    fun find(context: Context): WebViewProblem? {
        val (pkg, userAgent) = try {
            val pkg = WebViewCompat.getCurrentWebViewPackage(context) ?: return WebViewProblem.MISSING
            // the engine's own Chromium version, whatever its package calls itself
            pkg to WebSettings.getDefaultUserAgent(context)
        } catch (e: RuntimeException) {
            // some builds throw instead of returning null while WebView is being updated
            return WebViewProblem.MISSING
        }
        return problemFor(pkg.packageName, pkg.versionName, userAgent)
    }

    /**
     * The version decision on its own, so the unit tests can run it without Android. The user
     * agent's Chrome/NNN is the engine's version. A package's own versionName stands in only
     * when the user agent has no number, and only for packages that number themselves after
     * Chromium: Huawei's WebView, for one, is numbered 12 or 14 while it runs Chromium 99 to 114.
     * A version that cannot be read gets the benefit of the doubt.
     */
    fun problemFor(packageName: String, versionName: String?, userAgent: String?): WebViewProblem? {
        val major = CHROME_VERSION.find(userAgent.orEmpty())?.groupValues?.get(1)?.toIntOrNull()
            ?: versionName?.takeIf { usesChromiumNumbers(packageName) }?.substringBefore('.')?.trim()?.toIntOrNull()
        return if (major != null && major < MIN_MAJOR_VERSION) WebViewProblem.OUTDATED else null
    }

    /**
     * The package whose Play Store page can fix the current WebView, or null when the Play
     * Store has nothing for it (Huawei's, AOSP's). With no WebView at all, Google's is the one
     * to install or turn on.
     */
    fun storePackage(packageName: String?): String? = when {
        packageName == null -> GOOGLE_WEBVIEW
        isGoogleBuild(packageName) -> packageName
        else -> null
    }

    fun providerPackage(context: Context): String? = current(context)?.packageName

    fun version(context: Context): String? = current(context)?.versionName

    private fun current(context: Context) = try {
        WebViewCompat.getCurrentWebViewPackage(context)
    } catch (e: RuntimeException) {
        null
    }

    // Google's WebView (with its Beta, Dev and Canary channels) and Chrome's channels, which
    // can each be the WebView and which the Play Store updates
    private fun isGoogleBuild(name: String) =
        name.startsWith(GOOGLE_WEBVIEW) || name == "com.android.chrome" || name.startsWith("com.chrome.")

    // AOSP's own WebView also takes Chromium's numbers, but is not on the Play Store
    private fun usesChromiumNumbers(name: String) = isGoogleBuild(name) || name == "com.android.webview"
}
