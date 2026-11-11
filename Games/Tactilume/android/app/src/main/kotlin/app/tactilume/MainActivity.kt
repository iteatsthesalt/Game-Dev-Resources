package app.tactilume

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.core.graphics.Insets
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import java.util.Locale

/**
 * The whole app: one full-screen WebView showing Tactilume.html from the APK, with the
 * native pieces a browser tab cannot offer (saving to the gallery, sharing, haptics, the
 * screen staying on, Back) reached through [NativeBridge].
 */
class MainActivity : ComponentActivity(), WebHost, BridgeHost {

    private val main = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private var webView: WebView? = null
    private var bridge: NativeBridge? = null
    private var notice: View? = null

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(AppWeb.HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    // Launch: the first frame waits (up to a limit) for the page, so the splash fades
    // straight into the light instead of into black.
    private var holdingFirstDraw = false
    private var pageVisible = false
    private val revealAnyway = Runnable { webView?.let(::reveal) }
    private val releaseDrawAnyway = Runnable { releaseFirstDraw() }

    // A WebView whose page process died is replaced; this stops a page that keeps crashing
    // from being reloaded forever.
    private var webViewWanted = false
    private val rendererDeaths = ArrayDeque<Long>()

    private var cutout = Insets.NONE
    private var cutoutOnPage = Insets.NONE

    private var backPending = false
    private var lastUnhandledBack = 0L
    private val backTimeout = Runnable { onBackAnswer(false) }
    private val backCallback = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() = onBack()
    }

    private var micRequest: PermissionRequest? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val storageWaiters = ArrayList<(Boolean) -> Unit>()

    private val micPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val request = micRequest ?: return@registerForActivityResult
        micRequest = null
        if (granted) grantMic(request) else request.deny()
    }

    private val storagePermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val waiting = storageWaiters.toList()
        storageWaiters.clear()
        waiting.forEach { it(granted) }
    }

    private val fileChooser = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            getSystemService(Vibrator::class.java)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        // after enableEdgeToEdge, which picks short edges only
        DisplayTuning.drawIntoCutouts(window)
        DisplayTuning.hideSystemBars(window)
        DisplayTuning.preferHighestRefreshRate(this)
        // the hardware volume keys set the volume of Tactilume's sound, even before it plays
        volumeControlStream = AudioManager.STREAM_MUSIC

        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root, ::onInsets)
        onBackPressedDispatcher.addCallback(this, backCallback)

        val problem = WebViewCheck.find(this)
        if (problem != null) {
            showWebViewProblem(problem)
            return
        }
        holdFirstDraw()
        startWebView()
    }

    override fun onStart() {
        super.onStart()
        if (webViewWanted) startWebView()
        webView?.onResume()
    }

    override fun onResume() {
        super.onResume()
        DisplayTuning.hideSystemBars(window)
    }

    // Paused only when hidden, not on onPause: in split screen the light keeps moving while
    // another app has focus.
    override fun onStop() {
        webView?.onPause()
        super.onStop()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // dialogs, the keyboard and transient swipes can bring the bars back
        if (hasFocus) DisplayTuning.hideSystemBars(window)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // a foldable can move the app to another panel with other refresh rates
        DisplayTuning.preferHighestRefreshRate(this)
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        disposeWebView()
        bridge?.close()
        bridge = null
        super.onDestroy()
    }

    // ---- the WebView ----------------------------------------------------------------------------

    private fun startWebView() {
        webViewWanted = false
        hideNotice()
        // on until the page's 'awake' message says otherwise; on for good if the bridge cannot attach
        setKeepAwake(true)
        val view = try {
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            WebView(this)
        } catch (e: RuntimeException) {
            // thrown when the WebView package is missing, disabled or being updated right now
            Log.w(TAG, "WebView could not start", e)
            showWebViewProblem(WebViewProblem.MISSING)
            return
        }
        configure(view)
        val pageBridge = bridge ?: NativeBridge(applicationContext, this).also { bridge = it }
        if (!pageBridge.attach(view)) Log.w(TAG, "This WebView cannot talk to the app; saving and sharing are off")
        // invisible until the page has drawn its first frame, so no blank flash shows through
        view.alpha = 0f
        root.addView(view, 0, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        DisplayTuning.keepEdgesForPlay(view)
        webView = view
        pageVisible = false
        view.loadUrl(AppWeb.START_URL)
        view.requestFocus()
        main.postDelayed(revealAnyway, REVEAL_MAX_WAIT_MS)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(view: WebView) {
        view.setBackgroundColor(Color.BLACK)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // sound can start from the page's own taps; there is no media to autoplay otherwise
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // keeps the page drawn while the app is half covered (split screen, a dialog)
            offscreenPreRaster = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            setGeolocationEnabled(false)
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = false
            // Safe Browsing is left at its default, which is on
        }
        // the page is designed dark already; Android must not try to darken it again
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(view.settings, false)
        }
        // the page is the app: Android should not kill its process before the app's own
        view.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true)
        view.webViewClient = TactilumeWebViewClient(assetLoader, this)
        view.webChromeClient = TactilumeChromeClient(this)
        view.isVerticalScrollBarEnabled = false
        view.isHorizontalScrollBarEnabled = false
        view.overScrollMode = View.OVER_SCROLL_NEVER
        // keyboards and switch access reach the page's own controls
        view.isFocusable = true
        view.isFocusableInTouchMode = true
    }

    private fun disposeWebView() {
        val view = webView ?: return
        webView = null
        pageVisible = false
        main.removeCallbacks(revealAnyway)
        bridge?.forgetPage()
        // the page that asked for these is gone
        micRequest = null
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        if (backPending) {
            backPending = false
            main.removeCallbacks(backTimeout)
        }
        root.removeView(view)
        view.destroy()
    }

    override fun onPageVisible(view: WebView) {
        if (view !== webView) return
        pageVisible = true
        // a new document has none of the values pushed into the last one
        cutoutOnPage = Insets.NONE
        pushSafeArea()
        reveal(view)
    }

    private fun reveal(view: WebView) {
        main.removeCallbacks(revealAnyway)
        releaseFirstDraw()
        if (view.alpha < 1f) {
            view.animate().alpha(1f).setDuration(REVEAL_FADE_MS).setInterpolator(DecelerateInterpolator()).start()
        }
    }

    override fun onRendererGone(view: WebView) {
        if (view !== webView) return
        Log.w(TAG, "The page's process stopped; starting a fresh one")
        disposeWebView()
        val now = SystemClock.elapsedRealtime()
        while (rendererDeaths.isNotEmpty() && now - rendererDeaths.first() > RENDERER_DEATH_WINDOW_MS) rendererDeaths.removeFirst()
        rendererDeaths.addLast(now)
        when {
            rendererDeaths.size >= MAX_RENDERER_DEATHS -> showNotice(R.string.paused_title, R.string.paused_body, onTap = {
                rendererDeaths.clear()
                startWebView()
            })
            // in the background it waits until the app is seen again, to spare memory
            lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED) -> startWebView()
            else -> webViewWanted = true
        }
    }

    // ---- launch -----------------------------------------------------------------------------------

    private fun holdFirstDraw() {
        holdingFirstDraw = true
        val content = findViewById<View>(android.R.id.content)
        content.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
            override fun onPreDraw(): Boolean {
                if (holdingFirstDraw) return false
                content.viewTreeObserver.removeOnPreDrawListener(this)
                return true
            }
        })
        main.postDelayed(releaseDrawAnyway, FIRST_DRAW_MAX_WAIT_MS)
    }

    private fun releaseFirstDraw() {
        if (!holdingFirstDraw) return
        holdingFirstDraw = false
        main.removeCallbacks(releaseDrawAnyway)
        root.invalidate()
    }

    // ---- insets -------------------------------------------------------------------------------------

    private fun onInsets(view: View, insets: WindowInsetsCompat): WindowInsetsCompat {
        // the keyboard pushes the page up instead of covering the field being typed in
        val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
        view.setPadding(0, 0, 0, ime.bottom)
        cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
        pushSafeArea()
        // handled here, so the WebView must not make room for the keyboard a second time
        return WindowInsetsCompat.Builder(insets).setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE).build()
    }

    /**
     * Not every WebView reports camera cutouts to CSS (env(safe-area-inset-*) can read 0), so
     * the cutout is handed to the page's own --safe-* variables. max() keeps whatever the
     * WebView reports when it is larger. Devices without a cutout are never touched.
     */
    private fun pushSafeArea() {
        val view = webView ?: return
        if (!pageVisible || cutout == cutoutOnPage) return
        cutoutOnPage = cutout
        val density = resources.displayMetrics.density
        val sides = listOf("t" to ("top" to cutout.top), "r" to ("right" to cutout.right), "b" to ("bottom" to cutout.bottom), "l" to ("left" to cutout.left))
        val js = buildString {
            append("(function(s){")
            for ((key, side) in sides) {
                val css = String.format(Locale.ROOT, "%.1fpx", side.second / density)
                append("s.setProperty('--safe-$key','max(env(safe-area-inset-${side.first}, 0px), $css)');")
            }
            append("})(document.documentElement.style)")
        }
        view.evaluateJavascript(js, null)
    }

    // ---- Back -----------------------------------------------------------------------------------------

    // The page gets the first say (it closes its panel, for example). If it does not use the
    // press, a second press soon after leaves, so one stray Back never ends a session.
    private fun onBack() {
        if (backPending) return
        if (bridge?.sendBack() == true) {
            backPending = true
            main.postDelayed(backTimeout, BACK_ANSWER_WAIT_MS)
        } else {
            backNotHandled()
        }
    }

    override fun onBackAnswer(handled: Boolean) {
        if (!backPending) return
        backPending = false
        main.removeCallbacks(backTimeout)
        if (!handled) backNotHandled()
    }

    private fun backNotHandled() {
        val now = SystemClock.uptimeMillis()
        if (lastUnhandledBack != 0L && now - lastUnhandledBack <= LEAVE_WINDOW_MS) {
            lastUnhandledBack = 0L
            leave()
        } else {
            lastUnhandledBack = now
            Toast.makeText(this, R.string.back_again, Toast.LENGTH_SHORT).show()
        }
    }

    // Hands this Back to Android, which closes the app (Android 11 and older) or sends it to
    // the background (Android 12 and later), so coming back to it is instant.
    private fun leave() {
        backCallback.isEnabled = false
        onBackPressedDispatcher.onBackPressed()
        backCallback.isEnabled = true
    }

    // ---- BridgeHost -----------------------------------------------------------------------------------

    override fun vibrate(ms: Long) {
        val v = vibrator?.takeIf { it.hasVibrator() } ?: return
        val effect = VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // as touch feedback, so the system's "touch vibration" switch is respected
            v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH))
        } else {
            v.vibrate(effect)
        }
    }

    override fun setKeepAwake(on: Boolean) {
        if (on) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    override fun openExternal(url: Uri): Boolean {
        if (!url.scheme.equals("https", ignoreCase = true) || url.host.isNullOrEmpty() || AppWeb.isAppUrl(url)) return false
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE))
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
    }

    override fun shareSaved(uri: Uri, mime: String, text: String?): Boolean {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            if (!text.isNullOrBlank()) putExtra(Intent.EXTRA_TEXT, text)
            // ClipData carries the read grant through the chooser to the app picked
            clipData = ClipData.newRawUri(null, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return try {
            startActivity(Intent.createChooser(send, null))
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
    }

    override fun withStorageAccess(then: (Boolean) -> Unit) {
        if (!MediaSaver.needsPermission(this)) {
            then(true)
            return
        }
        storageWaiters += then
        if (storageWaiters.size == 1) storagePermission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
    }

    // ---- WebHost: microphone and files ----------------------------------------------------------

    // Only the microphone, only for the app's own page, and only after Android's own question
    override fun onWebPermissionRequest(request: PermissionRequest) {
        if (!AppWeb.isAppUrl(request.origin) || PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources) {
            request.deny()
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            grantMic(request)
            return
        }
        micRequest?.deny()
        micRequest = request
        micPermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    override fun onWebPermissionCanceled(request: PermissionRequest) {
        if (micRequest === request) micRequest = null
    }

    private fun grantMic(request: PermissionRequest) {
        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
    }

    // For "move with a song": the page's file picker opens Android's
    override fun showFileChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams,
    ): Boolean {
        fileCallback?.onReceiveValue(null)
        fileCallback = callback
        try {
            fileChooser.launch(params.createIntent())
        } catch (e: ActivityNotFoundException) {
            fileCallback = null
            callback.onReceiveValue(null)
        }
        return true
    }

    // ---- notices ------------------------------------------------------------------------------------

    private fun showWebViewProblem(problem: WebViewProblem) {
        // nothing in the page to go back through, so Back simply leaves
        backCallback.isEnabled = false
        val missing = problem == WebViewProblem.MISSING
        // no button where the Play Store cannot help, such as Huawei's own WebView
        val store = WebViewCheck.storePackage(WebViewCheck.providerPackage(this))
        showNotice(
            title = if (missing) R.string.webview_missing_title else R.string.webview_old_title,
            body = if (missing) R.string.webview_missing_body else R.string.webview_old_body,
            button = store?.let { R.string.webview_open_store },
            onButton = store?.let { pkg -> { openInStore(pkg) } },
        )
    }

    private fun openInStore(packageName: String) {
        val market = Intent(Intent.ACTION_VIEW, "market://details?id=$packageName".toUri())
        try {
            startActivity(market)
        } catch (e: ActivityNotFoundException) {
            openExternal("https://play.google.com/store/apps/details?id=$packageName".toUri())
        }
    }

    /** A calm full-screen message on black, used only when the light cannot run. */
    private fun showNotice(
        @StringRes title: Int,
        @StringRes body: Int,
        @StringRes button: Int? = null,
        onButton: (() -> Unit)? = null,
        onTap: (() -> Unit)? = null,
    ) {
        // no page is left to let the screen sleep, and a still message has no reason to keep it lit
        setKeepAwake(false)
        hideNotice()
        releaseFirstDraw()
        val dp = resources.displayMetrics.density
        val accent = getColor(R.color.notice_accent)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val pad = (32 * dp).toInt()
            setPadding(pad, pad, pad, pad)
        }
        column.addView(TextView(this).apply {
            setText(title)
            textSize = 22f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(getColor(R.color.notice_title))
            gravity = Gravity.CENTER
            ViewCompat.setAccessibilityHeading(this, true)
        })
        column.addView(
            TextView(this).apply {
                setText(body)
                textSize = 16f
                setLineSpacing(0f, 1.3f)
                setTextColor(getColor(R.color.notice_body))
                gravity = Gravity.CENTER
            },
            LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = (16 * dp).toInt() },
        )
        if (button != null && onButton != null) {
            val pill = GradientDrawable().apply {
                cornerRadius = 28 * dp
                setStroke((1.5f * dp).toInt(), accent)
            }
            column.addView(
                TextView(this).apply {
                    setText(button)
                    textSize = 16f
                    setTextColor(accent)
                    gravity = Gravity.CENTER
                    minHeight = (48 * dp).toInt()
                    setPadding((28 * dp).toInt(), 0, (28 * dp).toInt(), 0)
                    background = RippleDrawable(ColorStateList.valueOf(accent and 0x40FFFFFF), pill, pill)
                    isFocusable = true
                    setOnClickListener { onButton() }
                },
                LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = (28 * dp).toInt() },
            )
        }
        if (onTap != null) column.setOnClickListener { onTap() }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            setBackgroundColor(Color.BLACK)
            addView(column, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }
        root.addView(scroll, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        notice = scroll
    }

    private fun hideNotice() {
        notice?.let(root::removeView)
        notice = null
    }

    private companion object {
        const val TAG = "Tactilume"
        const val FIRST_DRAW_MAX_WAIT_MS = 1500L
        const val REVEAL_MAX_WAIT_MS = 1500L
        const val REVEAL_FADE_MS = 260L
        const val BACK_ANSWER_WAIT_MS = 300L
        const val LEAVE_WINDOW_MS = 2000L
        const val MAX_RENDERER_DEATHS = 3
        const val RENDERER_DEATH_WINDOW_MS = 60_000L
    }
}
