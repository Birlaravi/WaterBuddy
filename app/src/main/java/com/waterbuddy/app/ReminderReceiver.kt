package com.waterbuddy.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!Store.enabled(context)) return
        Scheduler.schedule(context, Store.interval(context) * 60_000L)
        ContextCompat.startForegroundService(context, Intent(context, OverlayService::class.java))
    }
}
