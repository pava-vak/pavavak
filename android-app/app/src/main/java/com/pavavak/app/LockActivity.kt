package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.security.MessageDigest

class LockActivity : AppCompatActivity() {

    private lateinit var pinInput: EditText
    private lateinit var errorText: TextView
    private lateinit var subtitleText: TextView
    private lateinit var unlockButton: Button

    private val prefs by lazy { getSharedPreferences("pavavak_lock", MODE_PRIVATE) }
    private var firstPinEntry: String? = null
    private var mode: Mode = Mode.UNLOCK
    private var forceSetupOnly: Boolean = false
    private var overlayUnlockOnly: Boolean = false
    private var allowBiometricForThisEntry: Boolean = true
    private var managePinMode: Boolean = false

    private enum class Mode {
        UNLOCK,
        SET_REAL,
        CHANGE_REAL_VERIFY,
        CHANGE_REAL_SET,
        SET_DECOY_VERIFY_REAL,
        SET_DECOY
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lock)
        forceSetupOnly = intent.getBooleanExtra(EXTRA_FORCE_SETUP, false)
        overlayUnlockOnly = intent.getBooleanExtra(EXTRA_OVERLAY_UNLOCK_ONLY, false)
        allowBiometricForThisEntry = intent.getBooleanExtra(EXTRA_ALLOW_BIOMETRIC, true)
        managePinMode = intent.getBooleanExtra(EXTRA_MANAGE_PIN_MODE, false)

        pinInput = findViewById(R.id.pinInput)
        errorText = findViewById(R.id.errorText)
        subtitleText = findViewById(R.id.subtitleText)
        unlockButton = findViewById(R.id.unlockButton)
        val biometricButton = findViewById<Button>(R.id.biometricButton)
        val changePinButton = findViewById<Button>(R.id.changePinButton)
        val decoyPinButton = findViewById<Button>(R.id.decoyPinButton)

        unlockButton.setOnClickListener { handlePinUnlock() }
        biometricButton.setOnClickListener { startBiometricPrompt() }
        changePinButton.setOnClickListener { startChangeRealPinFlow() }
        decoyPinButton.setOnClickListener { startSetDecoyFlow() }

        val showPinManagement = managePinMode && !overlayUnlockOnly
        changePinButton.visibility = if (showPinManagement) View.VISIBLE else View.GONE
        decoyPinButton.visibility = if (showPinManagement) View.VISIBLE else View.GONE

        val hasRealPin = prefs.getString(KEY_REAL_PIN_HASH, null) != null
        if (!forceSetupOnly && !hasRealPin) {
            openMain(decoyMode = false)
            return
        }

        if (forceSetupOnly) {
            changePinButton.isEnabled = false
            changePinButton.alpha = 0.5f
            decoyPinButton.isEnabled = false
            decoyPinButton.alpha = 0.5f
            mode = if (hasRealPin) Mode.UNLOCK else Mode.SET_REAL
            showError(
                if (hasRealPin) "PIN already set. Tap Continue."
                else "Enter a new 4-digit PIN and tap Set PIN."
            )
        }

        if (!allowBiometricForThisEntry || !isBiometricAvailable()) {
            biometricButton.isEnabled = false
            biometricButton.alpha = 0.4f
        }

        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
    }

    private fun handlePinUnlock() {
        if (forceSetupOnly && prefs.getString(KEY_REAL_PIN_HASH, null) != null) {
            completeSetup()
            return
        }

        val entered = pinInput.text?.toString()?.trim().orEmpty()
        if (entered.length != 4 || !entered.all { it.isDigit() }) {
            showError("PIN must be 4 digits")
            return
        }

        when (mode) {
            Mode.UNLOCK -> handleUnlockFlow(entered)
            Mode.SET_REAL -> handleSetRealPinFlow(entered)
            Mode.CHANGE_REAL_VERIFY -> handleChangeRealPinVerifyFlow(entered)
            Mode.CHANGE_REAL_SET -> handleChangeRealPinSetFlow(entered)
            Mode.SET_DECOY_VERIFY_REAL -> handleSetDecoyVerifyFlow(entered)
            Mode.SET_DECOY -> handleSetDecoyPinFlow(entered)
        }
    }

    private fun handleUnlockFlow(entered: String) {
        val realHash = prefs.getString(KEY_REAL_PIN_HASH, null)
        val decoyHash = prefs.getString(KEY_DECOY_PIN_HASH, null)
        val enteredHash = sha256(entered)

        if (realHash == null) {
            mode = Mode.SET_REAL
            firstPinEntry = null
            updateSubtitleForCurrentState()
            handleSetRealPinFlow(entered)
            return
        }

        if (enteredHash == realHash) {
            resetFailCount()
            onSuccessfulUnlock(decoyMode = false)
            return
        }

        if (decoyHash != null && enteredHash == decoyHash) {
            resetFailCount()
            onSuccessfulUnlock(decoyMode = true)
            return
        }

        val fails = incrementFailCount()
        pinInput.text?.clear()
        if (fails >= 3) {
            resetFailCount()
            onSuccessfulUnlock(decoyMode = true)
        } else {
            showError("Incorrect PIN")
        }
    }

    private fun handleSetRealPinFlow(entered: String) {
        if (firstPinEntry == null) {
            firstPinEntry = entered
            pinInput.text?.clear()
            showError("Re-enter same PIN and tap Confirm PIN.")
            updatePrimaryActionLabel()
            return
        }

        if (firstPinEntry != entered) {
            firstPinEntry = null
            pinInput.text?.clear()
            showError("PIN mismatch. Set again.")
            return
        }

        prefs.edit().putString(KEY_REAL_PIN_HASH, sha256(entered)).apply()
        firstPinEntry = null
        mode = Mode.UNLOCK
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        showError(
            if (forceSetupOnly) "PIN set. Tap Continue."
            else "Real PIN saved. Unlock now."
        )
        pinInput.text?.clear()
    }

    private fun handleChangeRealPinVerifyFlow(entered: String) {
        val realHash = prefs.getString(KEY_REAL_PIN_HASH, null)
        if (realHash == null || sha256(entered) != realHash) {
            pinInput.text?.clear()
            showError("Current real PIN is incorrect")
            return
        }

        firstPinEntry = null
        mode = Mode.CHANGE_REAL_SET
        pinInput.text?.clear()
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        showError("Enter new real PIN")
    }

    private fun handleChangeRealPinSetFlow(entered: String) {
        val decoyHash = prefs.getString(KEY_DECOY_PIN_HASH, null)
        val enteredHash = sha256(entered)

        if (firstPinEntry == null) {
            if (decoyHash != null && decoyHash == enteredHash) {
                pinInput.text?.clear()
                showError("Real PIN must differ from decoy PIN")
                return
            }
            firstPinEntry = entered
            pinInput.text?.clear()
            showError("Confirm new real PIN")
            updatePrimaryActionLabel()
            return
        }

        if (firstPinEntry != entered) {
            firstPinEntry = null
            pinInput.text?.clear()
            showError("PIN mismatch. Try again.")
            return
        }

        prefs.edit().putString(KEY_REAL_PIN_HASH, enteredHash).apply()
        firstPinEntry = null
        mode = Mode.UNLOCK
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        showError("Real PIN changed successfully")
        pinInput.text?.clear()
    }

    private fun handleSetDecoyVerifyFlow(entered: String) {
        val realHash = prefs.getString(KEY_REAL_PIN_HASH, null)
        if (realHash == null) {
            mode = Mode.SET_REAL
            updateSubtitleForCurrentState()
            showError("Set real PIN first")
            pinInput.text?.clear()
            return
        }

        if (sha256(entered) != realHash) {
            pinInput.text?.clear()
            showError("Enter real PIN to continue")
            return
        }

        firstPinEntry = null
        mode = Mode.SET_DECOY
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        pinInput.text?.clear()
        showError("Enter decoy PIN")
    }

    private fun handleSetDecoyPinFlow(entered: String) {
        val realHash = prefs.getString(KEY_REAL_PIN_HASH, null)
        val enteredHash = sha256(entered)

        if (realHash != null && enteredHash == realHash) {
            pinInput.text?.clear()
            showError("Decoy PIN must differ from real PIN")
            return
        }

        if (firstPinEntry == null) {
            firstPinEntry = entered
            pinInput.text?.clear()
            showError("Confirm decoy PIN")
            updatePrimaryActionLabel()
            return
        }

        if (firstPinEntry != entered) {
            firstPinEntry = null
            pinInput.text?.clear()
            showError("PIN mismatch. Try again.")
            return
        }

        prefs.edit().putString(KEY_DECOY_PIN_HASH, enteredHash).apply()
        firstPinEntry = null
        mode = Mode.UNLOCK
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        showError("Decoy PIN saved successfully")
        pinInput.text?.clear()
    }

    private fun startChangeRealPinFlow() {
        val realHash = prefs.getString(KEY_REAL_PIN_HASH, null)
        if (realHash == null) {
            mode = Mode.SET_REAL
            firstPinEntry = null
            updateSubtitleForCurrentState()
            updatePrimaryActionLabel()
            showError("Set real PIN")
            pinInput.text?.clear()
            return
        }

        mode = Mode.CHANGE_REAL_VERIFY
        firstPinEntry = null
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        showError("Enter current real PIN")
        pinInput.text?.clear()
    }

    private fun startSetDecoyFlow() {
        val realHash = prefs.getString(KEY_REAL_PIN_HASH, null)
        if (realHash == null) {
            mode = Mode.SET_REAL
            firstPinEntry = null
            updateSubtitleForCurrentState()
            updatePrimaryActionLabel()
            showError("Set real PIN first")
            pinInput.text?.clear()
            return
        }

        mode = Mode.SET_DECOY_VERIFY_REAL
        firstPinEntry = null
        updateSubtitleForCurrentState()
        updatePrimaryActionLabel()
        showError("Verify real PIN first")
        pinInput.text?.clear()
    }

    private fun updateSubtitleForCurrentState() {
        subtitleText.text = when (mode) {
            Mode.UNLOCK -> if (forceSetupOnly) "Security setup complete" else "Enter real or decoy PIN"
            Mode.SET_REAL -> "Set real PIN (step 1/2)"
            Mode.CHANGE_REAL_VERIFY -> "Verify current real PIN"
            Mode.CHANGE_REAL_SET -> "Set new real PIN (step 1/2)"
            Mode.SET_DECOY_VERIFY_REAL -> "Verify real PIN for decoy setup"
            Mode.SET_DECOY -> "Set decoy PIN (step 1/2)"
        }
    }

    private fun updatePrimaryActionLabel() {
        unlockButton.text = when (mode) {
            Mode.UNLOCK -> if (forceSetupOnly) "Continue" else "Unlock"
            Mode.SET_REAL -> if (firstPinEntry == null) "Set PIN" else "Confirm PIN"
            Mode.CHANGE_REAL_VERIFY -> "Verify PIN"
            Mode.CHANGE_REAL_SET -> if (firstPinEntry == null) "Set New PIN" else "Confirm New PIN"
            Mode.SET_DECOY_VERIFY_REAL -> "Verify PIN"
            Mode.SET_DECOY -> if (firstPinEntry == null) "Set Decoy PIN" else "Confirm Decoy PIN"
        }
    }

    private fun isBiometricAvailable(): Boolean {
        val result = BiometricManager.from(this)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
        return result == BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun startBiometricPrompt() {
        if (!allowBiometricForThisEntry) {
            showError("Biometric disabled in settings")
            return
        }
        if (!isBiometricAvailable()) {
            showError("Biometric is not available")
            return
        }

        val executor = ContextCompat.getMainExecutor(this)
        val biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccessfulUnlock(decoyMode = false)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    showError(errString.toString())
                }

                override fun onAuthenticationFailed() {
                    showError("Biometric not recognized")
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock PaVa-Vak")
            .setSubtitle("Authenticate to continue")
            .setNegativeButtonText("Use PIN")
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    private fun openMain(decoyMode: Boolean) {
        val intent = Intent(this, MainActivity::class.java)
        intent.putExtra(EXTRA_DECOY_MODE, decoyMode)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    private fun onSuccessfulUnlock(decoyMode: Boolean) {
        AppSecurityPrefs.setLastUnlockAt(this, System.currentTimeMillis())
        AppSecurityPrefs.setLockRequiredOnResume(this, false)
        AppSecurityPrefs.setDecoyModeActive(this, decoyMode)
        if (overlayUnlockOnly) {
            setResult(RESULT_OK)
            finish()
            return
        }
        if (forceSetupOnly) {
            completeSetup()
            return
        }
        openMain(decoyMode)
    }

    private fun completeSetup() {
        if (forceSetupOnly) {
            openMain(decoyMode = false)
            return
        }
        setResult(RESULT_OK)
        finish()
    }

    private fun showError(message: String) {
        errorText.text = message
        errorText.visibility = TextView.VISIBLE
    }

    private fun incrementFailCount(): Int {
        val next = prefs.getInt(KEY_FAIL_COUNT, 0) + 1
        prefs.edit().putInt(KEY_FAIL_COUNT, next).apply()
        return next
    }

    private fun resetFailCount() {
        prefs.edit().putInt(KEY_FAIL_COUNT, 0).apply()
    }

    private fun sha256(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(value.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    companion object {
        const val EXTRA_DECOY_MODE = "extra_decoy_mode"
        const val EXTRA_FORCE_SETUP = "extra_force_setup"
        const val EXTRA_OVERLAY_UNLOCK_ONLY = "extra_overlay_unlock_only"
        const val EXTRA_ALLOW_BIOMETRIC = "extra_allow_biometric"
        const val EXTRA_MANAGE_PIN_MODE = "extra_manage_pin_mode"
        private const val KEY_REAL_PIN_HASH = "real_pin_hash"
        private const val KEY_DECOY_PIN_HASH = "decoy_pin_hash"
        private const val KEY_FAIL_COUNT = "pin_fail_count"
    }

    override fun onBackPressed() {
        if (overlayUnlockOnly) return
        super.onBackPressed()
    }
}
