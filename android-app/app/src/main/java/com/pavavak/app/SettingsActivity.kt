package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.pavavak.app.nativechat.NativeApi
import com.pavavak.app.notifications.NotificationHelper
import com.pavavak.app.notifications.NotificationPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsActivity : AppCompatActivity() {
    private lateinit var hideLastSeenSwitch: SwitchMaterial
    private lateinit var notificationsEnabledSwitch: SwitchMaterial
    private lateinit var notificationDirectReplySwitch: SwitchMaterial
    private lateinit var notificationMarkReadSwitch: SwitchMaterial
    private lateinit var notificationPreviewModeBtn: MaterialButton
    private lateinit var notificationStealthBtn: MaterialButton
    private lateinit var profilePhotoPreview: ImageView
    private lateinit var profilePhotoInitial: TextView
    private var currentProfileName: String = "User"
    private var currentProfilePhotoBase64: String? = null
    private var suppressHideLastSeenListener = false
    private var suppressNotificationListeners = false
    private val profilePhotoPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@registerForActivityResult
        lifecycleScope.launch {
            val bytes = withContext(Dispatchers.IO) {
                contentResolver.openInputStream(uri)?.use { it.readBytes() }
            }
            val encoded = bytes?.let { AvatarUtils.encodeAvatarBase64(it) }
            if (encoded.isNullOrBlank()) {
                Toast.makeText(this@SettingsActivity, "Image too large or unreadable", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val result = NativeApi.updateProfile(profilePhotoBase64 = encoded)
            if (!result.success) {
                Toast.makeText(this@SettingsActivity, result.error, Toast.LENGTH_SHORT).show()
                return@launch
            }
            currentProfilePhotoBase64 = encoded
            renderProfilePreview(currentProfileName, currentProfilePhotoBase64)
            Toast.makeText(this@SettingsActivity, "Profile photo updated", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        findViewById<MaterialToolbar>(R.id.settingsToolbar).setNavigationOnClickListener { finish() }

        val light = findViewById<MaterialButton>(R.id.themeLightBtn)
        val dark = findViewById<MaterialButton>(R.id.themeDarkBtn)
        val colorComboBtn = findViewById<MaterialButton>(R.id.colorComboBtn)
        val currentIsDark = ThemeManager.isDark(this)
        updateButtons(light, dark, currentIsDark)
        updateColorComboButton(colorComboBtn)

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
        colorComboBtn.setOnClickListener { showColorComboPicker(colorComboBtn) }

        val appLockSwitch = findViewById<SwitchMaterial>(R.id.appLockSwitch)
        val biometricResumeSwitch = findViewById<SwitchMaterial>(R.id.biometricResumeSwitch)
        val hideRecentsSwitch = findViewById<SwitchMaterial>(R.id.hideRecentsSwitch)
        val timeoutBtn = findViewById<MaterialButton>(R.id.lockTimeoutBtn)
        val setupPinBtn = findViewById<MaterialButton>(R.id.setupPinBtn)
        val managePinBtn = findViewById<MaterialButton>(R.id.managePinBtn)
        val editMyNameBtn = findViewById<MaterialButton>(R.id.editMyNameBtn)
        val changeProfilePhotoBtn = findViewById<MaterialButton>(R.id.changeProfilePhotoBtn)
        val removeProfilePhotoBtn = findViewById<MaterialButton>(R.id.removeProfilePhotoBtn)
        val changePasswordBtn = findViewById<MaterialButton>(R.id.changePasswordBtn)
        val deleteAccountBtn = findViewById<MaterialButton>(R.id.deleteAccountBtn)
        hideLastSeenSwitch = findViewById(R.id.hideLastSeenSwitch)
        notificationsEnabledSwitch = findViewById(R.id.notificationsEnabledSwitch)
        notificationDirectReplySwitch = findViewById(R.id.notificationDirectReplySwitch)
        notificationMarkReadSwitch = findViewById(R.id.notificationMarkReadSwitch)
        notificationPreviewModeBtn = findViewById(R.id.notificationPreviewModeBtn)
        notificationStealthBtn = findViewById(R.id.notificationStealthBtn)
        profilePhotoPreview = findViewById(R.id.profilePhotoPreview)
        profilePhotoInitial = findViewById(R.id.profilePhotoInitial)

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
        changeProfilePhotoBtn.setOnClickListener { profilePhotoPicker.launch("image/*") }
        removeProfilePhotoBtn.setOnClickListener { removeProfilePhoto() }
        changePasswordBtn.setOnClickListener { showChangePasswordDialog() }
        deleteAccountBtn.setOnClickListener { showDeleteAccountDialog() }
        notificationPreviewModeBtn.setOnClickListener { showNotificationPreviewPicker() }
        notificationStealthBtn.setOnClickListener {
            NotificationPrefs.enableStealthFor(this, 60L * 60L * 1000L)
            renderNotificationSettings()
            lifecycleScope.launch { NotificationHelper.refreshSummaryNotification(this@SettingsActivity) }
            Toast.makeText(this, "Stealth mode enabled for 1 hour", Toast.LENGTH_SHORT).show()
        }
        hideLastSeenSwitch.setOnCheckedChangeListener { _, checked ->
            if (suppressHideLastSeenListener) return@setOnCheckedChangeListener
            lifecycleScope.launch {
                val result = NativeApi.updateProfile(hideLastSeen = checked)
                if (!result.success) {
                    suppressHideLastSeenListener = true
                    hideLastSeenSwitch.isChecked = !checked
                    suppressHideLastSeenListener = false
                    Toast.makeText(this@SettingsActivity, result.error, Toast.LENGTH_SHORT).show()
                }
            }
        }
        notificationsEnabledSwitch.setOnCheckedChangeListener { _, checked ->
            if (suppressNotificationListeners) return@setOnCheckedChangeListener
            NotificationPrefs.setNotificationsEnabled(this, checked)
            renderNotificationSettings()
            lifecycleScope.launch { NotificationHelper.refreshSummaryNotification(this@SettingsActivity) }
        }
        notificationDirectReplySwitch.setOnCheckedChangeListener { _, checked ->
            if (suppressNotificationListeners) return@setOnCheckedChangeListener
            NotificationPrefs.setDirectReplyEnabled(this, checked)
        }
        notificationMarkReadSwitch.setOnCheckedChangeListener { _, checked ->
            if (suppressNotificationListeners) return@setOnCheckedChangeListener
            NotificationPrefs.setMarkReadEnabled(this, checked)
        }
    }

    override fun onResume() {
        super.onResume()
        val setupPinBtn = findViewById<MaterialButton>(R.id.setupPinBtn)
        val managePinBtn = findViewById<MaterialButton>(R.id.managePinBtn)
        updatePinButtons(setupPinBtn, managePinBtn)
        loadProfileSettings()
        renderNotificationSettings()
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

    private fun updateColorComboButton(button: MaterialButton) {
        val label = when (ThemeManager.getColorCombo(this)) {
            ThemeManager.COMBO_FOREST -> "Forest"
            ThemeManager.COMBO_SUNSET -> "Sunset"
            else -> "Ocean"
        }
        button.text = "Color Combo: $label"
    }

    private fun showColorComboPicker(button: MaterialButton) {
        val labels = arrayOf("Ocean", "Forest", "Sunset")
        val values = arrayOf(
            ThemeManager.COMBO_OCEAN,
            ThemeManager.COMBO_FOREST,
            ThemeManager.COMBO_SUNSET
        )
        val current = ThemeManager.getColorCombo(this)
        val checked = values.indexOf(current).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle("Choose color combo")
            .setSingleChoiceItems(labels, checked) { dialog, which ->
                ThemeManager.setColorCombo(this, values[which])
                updateColorComboButton(button)
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
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
                        if (ok) {
                            currentProfileName = name
                            renderProfilePreview(currentProfileName, currentProfilePhotoBase64)
                        }
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun showChangePasswordDialog() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 12, 48, 0)
        }
        val currentInput = EditText(this).apply {
            hint = "Current password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val newInput = EditText(this).apply {
            hint = "New password (min 8 chars)"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        container.addView(currentInput)
        container.addView(newInput)

        AlertDialog.Builder(this)
            .setTitle("Change Password")
            .setView(container)
            .setPositiveButton("Save") { _, _ ->
                val current = currentInput.text?.toString().orEmpty()
                val next = newInput.text?.toString().orEmpty()
                if (current.isBlank() || next.length < 8) {
                    Toast.makeText(this, "Enter valid passwords", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                lifecycleScope.launch {
                    val result = NativeApi.changePassword(current, next)
                    Toast.makeText(
                        this@SettingsActivity,
                        if (result.success) "Password changed" else result.error,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showDeleteAccountDialog() {
        val input = EditText(this).apply {
            hint = "Enter password to confirm"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle("Delete My Account")
            .setMessage("This action cannot be undone.")
            .setView(input)
            .setPositiveButton("Delete") { _, _ ->
                val password = input.text?.toString().orEmpty()
                if (password.isBlank()) {
                    Toast.makeText(this, "Password required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                lifecycleScope.launch {
                    val result = NativeApi.deleteMyAccount(password)
                    if (!result.success) {
                        Toast.makeText(this@SettingsActivity, result.error, Toast.LENGTH_SHORT).show()
                        return@launch
                    }
                    Toast.makeText(this@SettingsActivity, "Account deleted", Toast.LENGTH_SHORT).show()
                    NativeApi.logout()
                    startActivity(
                        Intent(this@SettingsActivity, LoginActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    )
                    finish()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun loadProfileSettings() {
        lifecycleScope.launch {
            val profile = NativeApi.getProfile()
            if (!profile.success) return@launch
            currentProfileName = profile.fullName.ifBlank { profile.username.ifBlank { "User" } }
            currentProfilePhotoBase64 = profile.profilePhotoBase64
            renderProfilePreview(currentProfileName, currentProfilePhotoBase64)
            suppressHideLastSeenListener = true
            hideLastSeenSwitch.isChecked = profile.hideLastSeen
            suppressHideLastSeenListener = false
        }
    }

    private fun renderProfilePreview(displayName: String, photoBase64: String?) {
        profilePhotoInitial.text = displayName.take(1).uppercase()
        val avatar = AvatarUtils.decodeBase64Avatar(photoBase64)
        if (avatar != null) {
            profilePhotoPreview.setImageBitmap(avatar)
            profilePhotoPreview.visibility = View.VISIBLE
            profilePhotoInitial.visibility = View.GONE
        } else {
            profilePhotoPreview.setImageDrawable(null)
            profilePhotoPreview.visibility = View.GONE
            profilePhotoInitial.visibility = View.VISIBLE
        }
    }

    private fun removeProfilePhoto() {
        lifecycleScope.launch {
            val result = NativeApi.updateProfile(clearProfilePhoto = true)
            if (!result.success) {
                Toast.makeText(this@SettingsActivity, result.error, Toast.LENGTH_SHORT).show()
                return@launch
            }
            currentProfilePhotoBase64 = null
            renderProfilePreview(currentProfileName, null)
            Toast.makeText(this@SettingsActivity, "Profile photo removed", Toast.LENGTH_SHORT).show()
        }
    }

    private fun renderNotificationSettings() {
        suppressNotificationListeners = true
        notificationsEnabledSwitch.isChecked = NotificationPrefs.notificationsEnabled(this)
        notificationDirectReplySwitch.isChecked = NotificationPrefs.directReplyEnabled(this)
        notificationMarkReadSwitch.isChecked = NotificationPrefs.markReadEnabled(this)

        val previewLabel = when (NotificationPrefs.rawPreviewMode(this)) {
            NotificationPrefs.PREVIEW_FULL -> "Full preview"
            NotificationPrefs.PREVIEW_HIDDEN -> "Hidden"
            else -> "Name only"
        }
        val stealthUntil = NotificationPrefs.stealthUntilMs(this)
        val stealthActive = NotificationPrefs.isStealthActive(this)
        notificationPreviewModeBtn.text = if (stealthActive) {
            "Notification Preview: Hidden (Stealth active)"
        } else {
            "Notification Preview: $previewLabel"
        }
        notificationStealthBtn.text = if (stealthActive) {
            "Stealth active until ${java.text.SimpleDateFormat("h:mm a", java.util.Locale("en", "IN")).format(java.util.Date(stealthUntil))}"
        } else {
            "Enable Stealth Mode for 1 Hour"
        }

        notificationPreviewModeBtn.isEnabled = notificationsEnabledSwitch.isChecked
        notificationStealthBtn.isEnabled = notificationsEnabledSwitch.isChecked
        notificationDirectReplySwitch.isEnabled = notificationsEnabledSwitch.isChecked
        notificationMarkReadSwitch.isEnabled = notificationsEnabledSwitch.isChecked
        suppressNotificationListeners = false
    }

    private fun showNotificationPreviewPicker() {
        val labels = arrayOf("Hidden", "Name only", "Full preview")
        val values = intArrayOf(
            NotificationPrefs.PREVIEW_HIDDEN,
            NotificationPrefs.PREVIEW_NAME_ONLY,
            NotificationPrefs.PREVIEW_FULL
        )
        val checked = values.indexOf(NotificationPrefs.rawPreviewMode(this)).coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle("Notification privacy")
            .setSingleChoiceItems(labels, checked) { dialog, which ->
                NotificationPrefs.clearStealth(this)
                NotificationPrefs.setPreviewMode(this, values[which])
                renderNotificationSettings()
                lifecycleScope.launch { NotificationHelper.refreshSummaryNotification(this@SettingsActivity) }
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
