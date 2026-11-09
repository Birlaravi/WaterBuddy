package com.waterbuddy.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat

class MainActivity : Activity() {

    private val petValues = arrayOf("random", "puppy", "kitten", "bunny", "unicorn", "fox", "piglet", "panda", "penguin", "duckling", "teddy")
    private val petLabels = arrayOf("Surprise me (random)", "Puppy", "Kitten", "Bunny", "Unicorn", "Fox", "Piglet", "Panda", "Penguin", "Duckling", "Teddy")
    private val intervalValues = intArrayOf(1, 30, 60, 90, 120)
    private val intervalLabels = arrayOf(
        "Every 1 minute (test)", "Every 30 minutes", "Every 1 hour", "Every 90 minutes", "Every 2 hours"
    )
    private val goalValues = intArrayOf(6, 8, 10, 12)

    private lateinit var switchEnabled: Switch
    private lateinit var spinnerPet: Spinner
    private lateinit var spinnerInterval: Spinner
    private lateinit var spinnerGoal: Spinner

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        switchEnabled = findViewById(R.id.switchEnabled)
        spinnerPet = findViewById(R.id.spinnerPet)
        spinnerInterval = findViewById(R.id.spinnerInterval)
        spinnerGoal = findViewById(R.id.spinnerGoal)

        spinnerPet.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, petLabels)
        spinnerInterval.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, intervalLabels)
        spinnerGoal.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, goalValues.map { "$it glasses" }
        )

        spinnerPet.setSelection(petValues.indexOf(Store.pet(this)).coerceAtLeast(0))
        spinnerInterval.setSelection(intervalValues.indexOf(Store.interval(this)).coerceAtLeast(0))
        spinnerGoal.setSelection(goalValues.indexOf(Store.goal(this)).coerceAtLeast(0))
        switchEnabled.isChecked = Store.enabled(this)

        spinnerPet.onItemSelectedListener = listener { i -> Store.setPet(this, petValues[i]) }
        spinnerGoal.onItemSelectedListener = listener { i ->
            Store.setGoal(this, goalValues[i])
            refresh()
        }
        spinnerInterval.onItemSelectedListener = listener { i ->
            if (intervalValues[i] != Store.interval(this)) {
                Store.setInterval(this, intervalValues[i])
                if (Store.enabled(this)) Scheduler.schedule(this, intervalValues[i] * 60_000L)
            }
        }

        switchEnabled.setOnCheckedChangeListener { _, on ->
            if (on && !Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "Allow display over other apps first", Toast.LENGTH_LONG).show()
                switchEnabled.isChecked = false
                openOverlaySettings()
                return@setOnCheckedChangeListener
            }
            Store.setEnabled(this, on)
            if (on) {
                Scheduler.schedule(this, Store.interval(this) * 60_000L)
                Toast.makeText(this, "Reminders on", Toast.LENGTH_SHORT).show()
            } else {
                Scheduler.cancel(this)
            }
        }

        findViewById<Button>(R.id.btnOverlayPerm).setOnClickListener { openOverlaySettings() }

        findViewById<Button>(R.id.btnNotifPerm).setOnClickListener {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            } else {
                Toast.makeText(this, "Already allowed", Toast.LENGTH_SHORT).show()
            }
        }

        findViewById<Button>(R.id.btnBattery).setOnClickListener {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }

        findViewById<Button>(R.id.btnTest).setOnClickListener {
            if (!Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "Allow display over other apps first", Toast.LENGTH_LONG).show()
                openOverlaySettings()
            } else {
                ContextCompat.startForegroundService(this, Intent(this, OverlayService::class.java))
                moveTaskToBack(true)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun openOverlaySettings() {
        startActivity(
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
        )
    }

    private fun refresh() {
        val yes = Store.yes(this)
        val no = Store.no(this)
        val pct = minOf(100, yes * 100 / Store.goal(this))
        findViewById<TextView>(R.id.statYes).text = "Drank\n$yes"
        findViewById<TextView>(R.id.statNo).text = "Skipped\n$no"
        findViewById<TextView>(R.id.statGoal).text = "Goal\n$pct%"

        val overlay = Settings.canDrawOverlays(this)
        val notif = Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        findViewById<TextView>(R.id.permStatus).text =
            "Display over apps: ${if (overlay) "✓ allowed" else "✗ needed"}\n" +
                "Notifications: ${if (notif) "✓ allowed" else "✗ needed"}"
    }

    private fun listener(onPick: (Int) -> Unit) = object : AdapterView.OnItemSelectedListener {
        override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = onPick(position)
        override fun onNothingSelected(parent: AdapterView<*>?) {}
    }
}
