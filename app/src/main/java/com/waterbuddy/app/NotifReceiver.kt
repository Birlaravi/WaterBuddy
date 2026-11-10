package com.waterbuddy.app

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject

class NotifReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val o = try { JSONObject(intent.getStringExtra("json") ?: return) } catch (e: Exception) { return }
        Reminders.ensureChannel(context)
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, Reminders.CH) else Notification.Builder(context)
        val n = b.setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(o.optString("title"))
            .setContentText(o.optString("text"))
            .setStyle(Notification.BigTextStyle().bigText(o.optString("text")))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            context.getSystemService(NotificationManager::class.java).notify(o.optString("id").hashCode(), n)
        } catch (e: SecurityException) { /* notification permission missing */ }
        // repeat daily reminders
        if (o.optString("type") == "daily") Reminders.schedule(context, o)
    }
}
