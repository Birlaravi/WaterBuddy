package com.waterbuddy.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object Scheduler {
    private fun pending(c: Context): PendingIntent =
        PendingIntent.getBroadcast(
            c,
            100,
            Intent(c, ReminderReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    fun schedule(c: Context, delayMs: Long) {
        val am = c.getSystemService(AlarmManager::class.java)
        val at = System.currentTimeMillis() + delayMs
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        if (exact) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c))
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c))
        }
    }

    fun cancel(c: Context) {
        c.getSystemService(AlarmManager::class.java).cancel(pending(c))
    }
}
