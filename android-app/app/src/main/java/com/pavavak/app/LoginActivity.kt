package com.pavavak.app

import android.content.Intent
import android.text.InputType
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.NativeApi
import com.pavavak.app.notifications.NotificationBootstrap
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val username = findViewById<EditText>(R.id.loginUsername)
        val password = findViewById<EditText>(R.id.loginPassword)
        val error = findViewById<TextView>(R.id.loginError)
        val progress = findViewById<ProgressBar>(R.id.loginProgress)
        val btn = findViewById<MaterialButton>(R.id.loginBtn)
        val forgotBtn = findViewById<TextView>(R.id.loginForgotPassword)

        btn.setOnClickListener {
            error.visibility = View.GONE
            val u = username.text?.toString()?.trim().orEmpty()
            val p = password.text?.toString()?.trim().orEmpty()
            if (u.isBlank() || p.isBlank()) {
                error.text = "Enter username and password"
                error.visibility = View.VISIBLE
                return@setOnClickListener
            }

            progress.visibility = View.VISIBLE
            btn.isEnabled = false

            lifecycleScope.launch {
                val result = NativeApi.login(u, p)
                progress.visibility = View.GONE
                btn.isEnabled = true

                if (!result.success) {
                    error.text = if (result.error.isBlank()) "Login failed" else result.error
                    error.visibility = View.VISIBLE
                    return@launch
                }

                if (result.requiresPasswordReset) {
                    showForceResetDialog()
                } else {
                    completeLogin()
                }
            }
        }

        forgotBtn.setOnClickListener {
            showForgotPasswordDialog()
        }
    }

    private fun completeLogin() {
        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()
        AppSecurityPrefs.setDecoyModeActive(this@LoginActivity, false)
        NotificationBootstrap.initialize(this@LoginActivity)
        lifecycleScope.launch { NativeApi.registerFcmTokenFromPrefs(this@LoginActivity) }
        startActivity(
            Intent(this@LoginActivity, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }

    private fun showForgotPasswordDialog() {
        val input = EditText(this).apply {
            hint = "Username or email"
            inputType = InputType.TYPE_CLASS_TEXT
            setPadding(40, 30, 40, 30)
        }
        AlertDialog.Builder(this)
            .setTitle("Forgot Password")
            .setMessage("Enter username or email. Admin will get a reset request.")
            .setView(input)
            .setPositiveButton("Send Request") { _, _ ->
                val value = input.text?.toString()?.trim().orEmpty()
                if (value.isBlank()) {
                    Toast.makeText(this, "Username or email required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                lifecycleScope.launch {
                    val result = NativeApi.requestPasswordReset(value)
                    val message = if (result.success) {
                        "Reset request sent to admin"
                    } else {
                        result.error.ifBlank { "Failed to send request" }
                    }
                    Toast.makeText(this@LoginActivity, message, Toast.LENGTH_LONG).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showForceResetDialog() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 20, 50, 10)
        }
        val passwordInput = EditText(this).apply {
            hint = "New password (min 8 chars)"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val confirmInput = EditText(this).apply {
            hint = "Confirm new password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        container.addView(passwordInput)
        container.addView(confirmInput)

        AlertDialog.Builder(this)
            .setCancelable(false)
            .setTitle("Reset Password Required")
            .setMessage("Admin-issued OTP login detected. Set a new password to continue.")
            .setView(container)
            .setPositiveButton("Save") { _, _ ->
                val newPassword = passwordInput.text?.toString().orEmpty()
                val confirmPassword = confirmInput.text?.toString().orEmpty()
                if (newPassword.length < 8 || newPassword != confirmPassword) {
                    Toast.makeText(this, "Passwords must match and be 8+ chars", Toast.LENGTH_LONG).show()
                    showForceResetDialog()
                    return@setPositiveButton
                }
                lifecycleScope.launch {
                    val result = NativeApi.completePasswordReset(newPassword)
                    if (!result.success) {
                        Toast.makeText(
                            this@LoginActivity,
                            result.error.ifBlank { "Failed to reset password" },
                            Toast.LENGTH_LONG
                        ).show()
                        showForceResetDialog()
                        return@launch
                    }
                    Toast.makeText(this@LoginActivity, "Password updated", Toast.LENGTH_SHORT).show()
                    completeLogin()
                }
            }
            .show()
    }
}
