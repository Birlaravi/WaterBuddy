package com.waterbuddy.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/** Generic reminders (skincare, diary, love note, special dates...) sent from the web UI. */
object Reminders {
    const val CH = "cutie_reminders"

    private fun prefs(c: Context) = c.getSharedPreferences("reminders", Context.MODE_PRIVATE)

    private fun pending(c: Context, id: String, o: JSONObject?): PendingIntent {
        val i = Intent(c, NotifReceiver::class.java).setAction("cutie.$id")
        if (o != null) i.putExtra("json", o.toString())
        return PendingIntent.getBroadcast(
            c, id.hashCode(), i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** Replace all reminders with the given JSON array and schedule them. */
    fun apply(c: Context, json: String) {
        val old = try { JSONArray(prefs(c).getString("list", "[]")) } catch (e: Exception) { JSONArray() }
        for (i in 0 until old.length()) cancel(c, old.getJSONObject(i).optString("id"))
        val list = try { JSONArray(json) } catch (e: Exception) { JSONArray() }
        prefs(c).edit().putString("list", list.toString()).apply()
        for (i in 0 until list.length()) schedule(c, list.getJSONObject(i))
    }

    fun rescheduleAll(c: Context) {
        val list = try { JSONArray(prefs(c).getString("list", "[]")) } catch (e: Exception) { JSONArray() }
        for (i in 0 until list.length()) schedule(c, list.getJSONObject(i))
    }

    private fun cancel(c: Context, id: String) {
        c.getSystemService(AlarmManager::class.java).cancel(pending(c, id, null))
    }

    fun nextDaily(h: Int, m: Int): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, h); cal.set(Calendar.MINUTE, m)
        cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= System.currentTimeMillis() + 1000) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }

    fun schedule(c: Context, o: JSONObject) {
        val id = o.optString("id")
        val at = if (o.optString("type") == "daily") nextDaily(o.optInt("h"), o.optInt("m")) else o.optLong("at")
        if (at <= System.currentTimeMillis()) return
        val am = c.getSystemService(AlarmManager::class.java)
        val pi = pending(c, id, o)
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }

    fun ensureChannel(c: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            c.getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CH, "Cutie reminders", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
    }
}
