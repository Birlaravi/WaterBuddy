package com.waterbuddy.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Store.enabled(context)) {
            Scheduler.schedule(context, Store.interval(context) * 60_000L)
        }
        Reminders.rescheduleAll(context)
    }
}
