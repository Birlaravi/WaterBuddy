package com.waterbuddy.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.webkit.WebViewAssetLoader

class OverlayService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var windowManager: WindowManager? = null
    private var webView: WebView? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    inner class Bridge {
        @JavascriptInterface
        fun askShown() {
            handler.post {
                setTouchable(true)
                vibrate(longArrayOf(0, 120, 80, 120))
            }
        }

        @JavascriptInterface
        fun answered(yes: Boolean) {
            handler.post { onAnswer(yes) }
        }

        @JavascriptInterface
        fun finished() {
            handler.post { finish() }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createChannels()
        val fg = NotificationCompat.Builder(this, CH_FG)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("Water Buddy")
            .setContentText("Your pet is on its way…")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            ServiceCompat.startForeground(this, 1, fg, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, fg)
        }

        removeView()
        if (Settings.canDrawOverlays(this)) {
            showPet()
        } else {
            postFallbackNotification()
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun showPet() {
        val wv = WebView(ContextThemeWrapper(this, android.R.style.Theme_Material_Light))
        wv.setBackgroundColor(Color.TRANSPARENT)
        wv.settings.javaScriptEnabled = true
        wv.settings.allowFileAccess = false
        wv.settings.allowContentAccess = false

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)
        }
        wv.addJavascriptInterface(Bridge(), "Android")

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            dp(340),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            y = dp(40)
        }

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager?.addView(wv, lp)
        webView = wv
        layoutParams = lp

        val url = "https://appassets.androidplatform.net/assets/pet/index.html" +
            "?pet=${Store.pet(this)}&interval=${Store.interval(this)}"
        wv.loadUrl(url)

        handler.postDelayed({ finish() }, 240_000)
    }

    private fun setTouchable(on: Boolean) {
        val lp = layoutParams ?: return
        val wv = webView ?: return
        lp.flags = if (on) {
            lp.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        } else {
            lp.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        }
        try { windowManager?.updateViewLayout(wv, lp) } catch (_: Exception) {}
    }

    private fun onAnswer(yes: Boolean) {
        setTouchable(false)
        if (yes) {
            Store.addYes(this)
            if (Store.enabled(this)) Scheduler.schedule(this, Store.interval(this) * 60_000L)
            vibrate(longArrayOf(0, 60))
        } else {
            Store.addNo(this)
            if (Store.enabled(this)) Scheduler.schedule(this, 10 * 60_000L)
            vibrate(longArrayOf(0, 300))
        }
    }

    private fun finish() {
        removeView()
        stopSelf()
    }

    private fun removeView() {
        handler.removeCallbacksAndMessages(null)
        webView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
            it.stopLoading()
            it.destroy()
        }
        webView = null
        layoutParams = null
    }

    private fun vibrate(pattern: LongArray) {
        try {
            val vib = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            vib.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } catch (_: Exception) {}
    }

    private fun createChannels() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CH_FG, "Water Buddy running", NotificationManager.IMPORTANCE_LOW)
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_ALERT, "Water reminders", NotificationManager.IMPORTANCE_HIGH)
        )
    }

    private fun postFallbackNotification() {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n: Notification = NotificationCompat.Builder(this, CH_ALERT)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("💧 Water time!")
            .setContentText("Have you drunk water? Allow 'display over other apps' to see your pet.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try {
            getSystemService(NotificationManager::class.java).notify(2, n)
        } catch (_: SecurityException) {}
    }

    override fun onDestroy() {
        removeView()
        super.onDestroy()
    }

    companion object {
        private const val CH_FG = "water_fg"
        private const val CH_ALERT = "water_alert"
    }
}
