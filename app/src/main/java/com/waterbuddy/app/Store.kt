package com.waterbuddy.app

import android.content.Context
import java.time.LocalDate

object Store {
    private fun p(c: Context) = c.getSharedPreferences("water", Context.MODE_PRIVATE)

    fun enabled(c: Context) = p(c).getBoolean("enabled", false)
    fun setEnabled(c: Context, v: Boolean) = p(c).edit().putBoolean("enabled", v).apply()

    fun pet(c: Context): String = p(c).getString("pet", "random") ?: "random"
    fun setPet(c: Context, v: String) = p(c).edit().putString("pet", v).apply()

    fun interval(c: Context) = p(c).getInt("interval", 60)
    fun setInterval(c: Context, v: Int) = p(c).edit().putInt("interval", v).apply()

    fun goal(c: Context) = p(c).getInt("goal", 8)
    fun setGoal(c: Context, v: Int) = p(c).edit().putInt("goal", v).apply()

    private fun rollDay(c: Context) {
        val today = LocalDate.now().toString()
        if (p(c).getString("day", "") != today) {
            p(c).edit().putString("day", today).putInt("yes", 0).putInt("no", 0).apply()
        }
    }

    fun yes(c: Context): Int { rollDay(c); return p(c).getInt("yes", 0) }
    fun no(c: Context): Int { rollDay(c); return p(c).getInt("no", 0) }

    fun addYes(c: Context) { rollDay(c); p(c).edit().putInt("yes", yes(c) + 1).apply() }
    fun addNo(c: Context) { rollDay(c); p(c).edit().putInt("no", no(c) + 1).apply() }
}
