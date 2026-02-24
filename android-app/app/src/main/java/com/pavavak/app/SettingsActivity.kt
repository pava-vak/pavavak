package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        findViewById<MaterialToolbar>(R.id.settingsToolbar).setNavigationOnClickListener { finish() }

        val light = findViewById<MaterialButton>(R.id.themeLightBtn)
        val dark = findViewById<MaterialButton>(R.id.themeDarkBtn)
        val currentIsDark = ThemeManager.isDark(this)
        updateButtons(light, dark, currentIsDark)

        light.setOnClickListener {
            ThemeManager.set(this, ThemeManager.MODE_LIGHT)
            updateButtons(light, dark, false)
            recreate()
        }
        dark.setOnClickListener {
            ThemeManager.set(this, ThemeManager.MODE_DARK)
            updateButtons(light, dark, true)
            recreate()
        }

        val appLockSwitch = findViewById<SwitchMaterial>(R.id.appLockSwitch)
        val biometricResumeSwitch = findViewById<SwitchMaterial>(R.id.biometricResumeSwitch)
        val hideRecentsSwitch = findViewById<SwitchMaterial>(R.id.hideRecentsSwitch)
        val timeoutBtn = findViewById<MaterialButton>(R.id.lockTimeoutBtn)
        val setupPinBtn = findViewById<MaterialButton>(R.id.setupPinBtn)
        val managePinBtn = findViewById<MaterialButton>(R.id.managePinBtn)
        val editMyNameBtn = findViewById<MaterialButton>(R.id.editMyNameBtn)

        appLockSwitch.isChecked = AppSecurityPrefs.isAppLockEnabled(this)
        biometricResumeSwitch.isChecked = AppSecurityPrefs.allowBiometricOnResume(this)
        hideRecentsSwitch.isChecked = AppSecurityPrefs.hideInRecentsEnabled(this)
        timeoutBtn.text = "Lock timeout: ${timeoutLabel(AppSecurityPrefs.lockTimeoutMs(this))}"
        updatePinButtons(setupPinBtn, managePinBtn)

        appLockSwitch.setOnCheckedChangeListener { _, checked ->
            AppSecurityPrefs.setAppLockEnabled(this, checked)
            if (!checked) {
                AppSecurityPrefs.setLockRequiredOnResume(this, false)
            }
        }
        biometricResumeSwitch.setOnCheckedChangeListener { _, checked ->
            AppSecurityPrefs.setAllowBiometricOnResume(this, checked)
        }
        hideRecentsSwitch.setOnCheckedChangeListener { _, checked ->
            AppSecurityPrefs.setHideInRecentsEnabled(this, checked)
            recreate()
        }
        timeoutBtn.setOnClickListener { showTimeoutPicker(timeoutBtn) }
        setupPinBtn.setOnClickListener { launchPinSetup() }
        managePinBtn.setOnClickListener { launchPinManager() }
        editMyNameBtn.setOnClickListener { showEditMyNameDialog() }
    }

    override fun onResume() {
        super.onResume()
        val setupPinBtn = findViewById<MaterialButton>(R.id.setupPinBtn)
        val managePinBtn = findViewById<MaterialButton>(R.id.managePinBtn)
        updatePinButtons(setupPinBtn, managePinBtn)
    }

    private fun hasRealPin(): Boolean {
        return getSharedPreferences("pavavak_lock", MODE_PRIVATE)
            .getString("real_pin_hash", null) != null
    }

    private fun updatePinButtons(setupPinBtn: MaterialButton, managePinBtn: MaterialButton) {
        val hasPin = hasRealPin()
        setupPinBtn.text = if (hasPin) "Re-verify PIN Setup" else "Set PIN"
        managePinBtn.visibility = if (hasPin) View.VISIBLE else View.GONE
    }

    private fun launchPinSetup() {
        val intent = Intent(this, LockActivity::class.java).apply {
            putExtra(LockActivity.EXTRA_FORCE_SETUP, true)
            putExtra(LockActivity.EXTRA_ALLOW_BIOMETRIC, false)
        }
        startActivity(intent)
    }

    private fun launchPinManager() {
        val intent = Intent(this, LockActivity::class.java).apply {
            putExtra(LockActivity.EXTRA_MANAGE_PIN_MODE, true)
            putExtra(LockActivity.EXTRA_ALLOW_BIOMETRIC, false)
        }
        startActivity(intent)
    }

    private fun updateButtons(light: MaterialButton, dark: MaterialButton, isDark: Boolean) {
        light.text = if (isDark) "Light Mode" else "Light Mode (Current)"
        dark.text = if (isDark) "Dark Mode (Current)" else "Dark Mode"
    }

    private fun showTimeoutPicker(timeoutBtn: MaterialButton) {
        val values = longArrayOf(0L, 15_000L, 30_000L, 60_000L, 300_000L, -1L)
        val labels = arrayOf("Immediate", "15 seconds", "30 seconds", "1 minute", "5 minutes", "Custom...")
        val current = AppSecurityPrefs.lockTimeoutMs(this)
        val checkedIndex = values.indexOf(current).let { if (it >= 0) it else labels.lastIndex }

        AlertDialog.Builder(this)
            .setTitle("Lock timeout")
            .setSingleChoiceItems(labels, checkedIndex) { dialog, which ->
                val selected = values[which]
                if (selected == -1L) {
                    dialog.dismiss()
                    showCustomTimeoutDialog(timeoutBtn, current)
                    return@setSingleChoiceItems
                }
                AppSecurityPrefs.setLockTimeoutMs(this, selected)
                timeoutBtn.text = "Lock timeout: ${timeoutLabel(selected)}"
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showCustomTimeoutDialog(timeoutBtn: MaterialButton, currentMs: Long) {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 12, 48, 0)
        }
        val input = EditText(this).apply {
            hint = "Seconds (example: 45)"
            inputType = InputType.TYPE_CLASS_NUMBER
            val currentSeconds = (currentMs / 1000L).coerceAtLeast(1L)
            setText(currentSeconds.toString())
            setSelection(text?.length ?: 0)
        }
        container.addView(input)

        AlertDialog.Builder(this)
            .setTitle("Custom lock timeout")
            .setView(container)
            .setPositiveButton("Save") { _, _ ->
                val seconds = input.text?.toString()?.trim()?.toLongOrNull()
                if (seconds == null || seconds <= 0L) return@setPositiveButton
                val clamped = seconds.coerceIn(1L, 86_400L) // 1s to 24h
                val selectedMs = clamped * 1000L
                AppSecurityPrefs.setLockTimeoutMs(this, selectedMs)
                timeoutBtn.text = "Lock timeout: ${timeoutLabel(selectedMs)}"
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun timeoutLabel(timeoutMs: Long): String {
        return when (timeoutMs) {
            0L -> "Immediate"
            15_000L -> "15 seconds"
            30_000L -> "30 seconds"
            60_000L -> "1 minute"
            300_000L -> "5 minutes"
            else -> {
                val seconds = timeoutMs / 1000L
                if (seconds % 60L == 0L) {
                    val minutes = seconds / 60L
                    if (minutes == 1L) "1 minute" else "$minutes minutes"
                } else {
                    "$seconds seconds"
                }
            }
        }
    }

    private fun showEditMyNameDialog() {
        lifecycleScope.launch {
            val profile = NativeApi.getProfile()
            if (!profile.success) {
                Toast.makeText(
                    this@SettingsActivity,
                    "Could not load profile",
                    Toast.LENGTH_SHORT
                ).show()
                return@launch
            }

            val input = EditText(this@SettingsActivity).apply {
                hint = "Full name"
                setText(profile.fullName.ifBlank { profile.username })
                setSelection(text?.length ?: 0)
            }

            AlertDialog.Builder(this@SettingsActivity)
                .setTitle("Edit My Name")
                .setView(input)
                .setPositiveButton("Save") { _, _ ->
                    val name = input.text?.toString()?.trim().orEmpty()
                    if (name.isBlank()) return@setPositiveButton
                    lifecycleScope.launch {
                        val ok = NativeApi.updateProfileName(name)
                        Toast.makeText(
                            this@SettingsActivity,
                            if (ok) "Name updated" else "Update failed",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }
}
