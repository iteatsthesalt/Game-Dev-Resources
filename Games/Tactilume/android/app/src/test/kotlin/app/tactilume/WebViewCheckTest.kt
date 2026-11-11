package app.tactilume

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WebViewCheckTest {
    private fun agent(chrome: String) =
        "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Version/4.0 Chrome/$chrome Mobile Safari/537.36"

    private val outdated = WebViewProblem.OUTDATED

    @Test
    fun `Huawei's WebView is judged by its engine, not its own numbers`() {
        assertNull(WebViewCheck.problemFor("com.huawei.webview", "14.0.0.300", agent("114.0.5735.196")))
        assertNull(WebViewCheck.problemFor("com.huawei.webview", "12.0.4.300", agent("100.0.4896.58")))
        assertEquals(outdated, WebViewCheck.problemFor("com.huawei.webview", "14.0.0.300", agent("99.0.4844.88")))
    }

    @Test
    fun `a provider with its own numbers and no readable engine gets the benefit of the doubt`() {
        assertNull(WebViewCheck.problemFor("com.huawei.webview", "12.0.4.300", null))
        assertNull(WebViewCheck.problemFor("com.huawei.webview", "12.0.4.300", "Mozilla/5.0 (Linux; Android 10; wv)"))
        assertNull(WebViewCheck.problemFor("com.example.vendor.webview", "5.2", ""))
    }

    @Test
    fun `the user agent wins over the package version`() {
        assertNull(WebViewCheck.problemFor("com.google.android.webview", "99.0.4844.88", agent("120.0.6099.230")))
        assertEquals(outdated, WebViewCheck.problemFor("com.google.android.webview", "130.0.6723.102", agent("96.0.4664.104")))
    }

    @Test
    fun `Chromium-numbered packages fall back to their version when the user agent has none`() {
        assertEquals(outdated, WebViewCheck.problemFor("com.google.android.webview", "99.0.4844.88", null))
        assertNull(WebViewCheck.problemFor("com.google.android.webview", "114.0.5735.196", null))
        assertEquals(outdated, WebViewCheck.problemFor("com.google.android.webview.beta", "98.0.4758.40", ""))
        assertEquals(outdated, WebViewCheck.problemFor("com.android.webview", "95.0.4638.74", null))
        assertEquals(outdated, WebViewCheck.problemFor("com.android.chrome", "90.0.4430.91", null))
        assertEquals(outdated, WebViewCheck.problemFor("com.chrome.beta", "97.0.4692.20", null))
    }

    @Test
    fun `a version that cannot be read gets the benefit of the doubt`() {
        assertNull(WebViewCheck.problemFor("com.google.android.webview", null, null))
        assertNull(WebViewCheck.problemFor("com.google.android.webview", "unknown", "Chrome/"))
    }

    @Test
    fun `the Play Store is offered only for Google's builds, or when there is no WebView at all`() {
        assertEquals("com.google.android.webview", WebViewCheck.storePackage(null))
        assertEquals("com.google.android.webview", WebViewCheck.storePackage("com.google.android.webview"))
        assertEquals("com.google.android.webview.dev", WebViewCheck.storePackage("com.google.android.webview.dev"))
        assertEquals("com.android.chrome", WebViewCheck.storePackage("com.android.chrome"))
        assertEquals("com.chrome.canary", WebViewCheck.storePackage("com.chrome.canary"))
        assertNull(WebViewCheck.storePackage("com.huawei.webview"))
        assertNull(WebViewCheck.storePackage("com.android.webview"))
    }
}
