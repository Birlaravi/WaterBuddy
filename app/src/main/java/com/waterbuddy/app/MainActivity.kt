package com.waterbuddy.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File

/** Hosts the whole app (HTML/JS in assets/app) in a full-screen WebView. */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var chooser: ValueCallback<Array<Uri>>? = null
    private val prefs by lazy { getSharedPreferences("setup", MODE_PRIVATE) }

    private fun asked(k: String) = prefs.getBoolean(k, false)
    private fun mark(k: String) = prefs.edit().putBoolean(k, true).apply()
    private var running: Boolean
        get() = prefs.getBoolean("running", false)
        set(v) = prefs.edit().putBoolean("running", v).apply()

    private fun hasOverlay() = Settings.canDrawOverlays(this)
    private fun hasNotif() = Build.VERSION.SDK_INT < 33 ||
        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    private fun hasBattery() = getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#FFF1F4")
        window.navigationBarColor = Color.WHITE
        if (Build.VERSION.SDK_INT >= 23) {
            var f = window.decorView.systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            if (Build.VERSION.SDK_INT >= 26) f = f or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.decorView.systemUiVisibility = f
        }
        Reminders.ensureChannel(this)

        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#FFF1F4"))
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            setSupportZoom(false)
            textZoom = 100
        }
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host != "appassets.androidplatform.net") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) {}
                    return true
                }
                return false
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                v: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams
            ): Boolean {
                chooser?.onReceiveValue(null)
                chooser = cb
                return try {
                    startActivityForResult(params.createIntent(), 77); true
                } catch (e: Exception) { chooser = null; false }
            }
        }
        web.addJavascriptInterface(Bridge(), "Native")
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/app/index.html")

        if (!hasOverlay() && !prefs.getBoolean("firstDone", false)) {
            prefs.edit().putBoolean("firstDone", true).apply()
            web.postDelayed({ startSetup() }, 1200)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == 77) {
            chooser?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            chooser = null
        } else super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onResume() {
        super.onResume()
        if (running) step()
        web.evaluateJavascript("window.cutieRefresh&&window.cutieRefresh()", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.cutieBack&&window.cutieBack())?'1':'0'") { r ->
            if (r == "\"1\"" || r == "1") return@evaluateJavascript
            moveTaskToBack(true)
        }
    }

    override fun onDestroy() {
        web.removeJavascriptInterface("Native")
        web.destroy()
        super.onDestroy()
    }

    // ---- permissions flow (same guided order as before) ----
    private fun startSetup() {
        prefs.edit().remove("an").remove("ao").remove("ab").apply()
        running = true
        step()
    }

    private fun step() {
        if (Build.VERSION.SDK_INT >= 33 && !hasNotif() && !asked("an")) {
            mark("an")
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            return
        }
        if (!hasOverlay()) {
            if (asked("ao")) {
                running = false
                Toast.makeText(this, "Display over other apps is needed for the buddy to appear", Toast.LENGTH_LONG).show()
                return
            }
            mark("ao")
            Toast.makeText(this, "Turn ON the switch for Cutie, then press back", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
        if (!hasBattery() && !asked("ab")) {
            mark("ab")
            try {
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            } catch (e: Exception) {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            }
            return
        }
        running = false
        Store.setEnabled(this, true)
        Scheduler.schedule(this, Store.interval(this) * 60_000L)
        Toast.makeText(this, "All set. Your water buddy is on.", Toast.LENGTH_LONG).show()
    }

    // ---- bridge used by the web UI (window.Native) ----
    inner class Bridge {
        @JavascriptInterface
        fun getWater(): String = JSONObject()
            .put("yes", Store.yes(this@MainActivity)).put("no", Store.no(this@MainActivity))
            .put("goal", Store.goal(this@MainActivity)).put("interval", Store.interval(this@MainActivity))
            .put("enabled", Store.enabled(this@MainActivity)).put("pet", Store.pet(this@MainActivity))
            .toString()

        @JavascriptInterface
        fun addGlass(delta: Int) { Store.addGlass(this@MainActivity, delta) }

        @JavascriptInterface
        fun setWater(json: String) {
            val o = try { JSONObject(json) } catch (e: Exception) { return }
            val c = this@MainActivity
            if (o.has("pet")) Store.setPet(c, o.getString("pet"))
            if (o.has("goal")) Store.setGoal(c, o.getInt("goal"))
            if (o.has("interval")) {
                Store.setInterval(c, o.getInt("interval"))
                if (Store.enabled(c)) Scheduler.schedule(c, o.getInt("interval") * 60_000L)
            }
            if (o.has("enabled")) {
                val on = o.getBoolean("enabled")
                Store.setEnabled(c, on)
                if (on) Scheduler.schedule(c, Store.interval(c) * 60_000L) else Scheduler.cancel(c)
            }
        }

        @JavascriptInterface
        fun getPerms(): String = JSONObject()
            .put("overlay", hasOverlay()).put("notif", hasNotif()).put("battery", hasBattery()).toString()

        @JavascriptInterface
        fun startSetup() { runOnUiThread { this@MainActivity.startSetup() } }

        @JavascriptInterface
        fun showPetNow() {
            runOnUiThread {
                if (!hasOverlay()) { this@MainActivity.startSetup(); return@runOnUiThread }
                ContextCompat.startForegroundService(this@MainActivity, Intent(this@MainActivity, OverlayService::class.java))
                moveTaskToBack(true)
            }
        }

        @JavascriptInterface
        fun setReminders(json: String) { Reminders.apply(this@MainActivity, json) }

        @JavascriptInterface
        fun shareText(name: String, text: String): Boolean {
            return try {
                val dir = File(cacheDir, "share").apply { mkdirs() }
                val f = File(dir, name.replace(Regex("[^A-Za-z0-9._-]"), "_"))
                f.writeText(text)
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", f)
                val i = Intent(Intent.ACTION_SEND).setType("application/json")
                    .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                runOnUiThread { startActivity(Intent.createChooser(i, "Save backup")) }
                true
            } catch (e: Exception) { false }
        }
    }
}
