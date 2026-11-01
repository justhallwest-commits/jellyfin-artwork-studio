package net.hallflix.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * HallFlix for Android TV / Google TV / Fire TV.
 *
 * Shows the HallFlix TV interface that the Artwork Studio plugin serves at
 * <server>/ArtworkStudio/TV/, so the look and features always match the server. Video plays in
 * [PlayerActivity] (Media3 / ExoPlayer), which plays far more formats than the WebView can.
 */
class MainActivity : Activity() {

    companion object {
        var instance: MainActivity? = null
        private const val PREFS = "hallflix"
        private const val LAUNCHER = "file:///android_asset/index.html?platform=android"
    }

    private lateinit var web: WebView
    private val prefs by lazy { getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        web = WebView(this)
        web.setBackgroundColor(Color.rgb(11, 11, 15))
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            allowFileAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            userAgentString = "$userAgentString HallFlixTV/${BuildConfig.VERSION_NAME}"
        }
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                // the server is off or the address changed: back to the launcher to fix it
                if (request.isForMainFrame && !request.url.toString().startsWith("file:")) {
                    view.loadUrl("$LAUNCHER&change=1&offline=1")
                }
            }
        }
        web.addJavascriptInterface(Bridge(), "HallFlixNative")
        setContentView(web)
        web.requestFocus(View.FOCUS_DOWN)

        val server = prefs.getString("server", null)
        if (server.isNullOrEmpty()) web.loadUrl(LAUNCHER) else web.loadUrl(tvUrl(server))
    }

    private fun tvUrl(server: String) = "${server.trimEnd('/')}/ArtworkStudio/TV/?platform=android"

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                // the interface decides: it goes back a screen, or says "close the app"
                web.evaluateJavascript("(window.HallFlix && window.HallFlix.back()) ? 'yes' : 'no'") { r ->
                    if (r?.contains("yes") != true) finish()
                }
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    /** Tells the interface what the player is doing: progress, ended, stopped or error. */
    fun sendEvent(name: String, data: JSONObject) {
        runOnUiThread {
            web.evaluateJavascript("window.HallFlix && window.HallFlix.nativeEvent(${JSONObject.quote(name)}, ${data})", null)
        }
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        web.destroy()
        super.onDestroy()
    }

    /** window.HallFlixNative in the page. */
    inner class Bridge {
        @JavascriptInterface
        fun play(json: String) = runOnUiThread { PlayerActivity.load(this@MainActivity, json) }

        @JavascriptInterface
        fun stop() = runOnUiThread { PlayerActivity.current?.finishFromWeb() }

        @JavascriptInterface
        fun getServer(): String = prefs.getString("server", "") ?: ""

        @JavascriptInterface
        fun setServer(url: String) {
            prefs.edit().putString("server", url).apply()
            runOnUiThread { web.loadUrl(tvUrl(url)) }
        }

        @JavascriptInterface
        fun changeServer() = runOnUiThread { web.loadUrl("$LAUNCHER&change=1") }

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME
    }
}
