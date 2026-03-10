package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class ForcePasswordResetActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_force_password_reset)

        val newPasswordInput = findViewById<EditText>(R.id.forceResetNewPassword)
        val confirmPasswordInput = findViewById<EditText>(R.id.forceResetConfirmPassword)
        val errorText = findViewById<TextView>(R.id.forceResetError)
        val progress = findViewById<ProgressBar>(R.id.forceResetProgress)
        val saveButton = findViewById<MaterialButton>(R.id.forceResetSaveBtn)
        val logoutButton = findViewById<MaterialButton>(R.id.forceResetLogoutBtn)

        saveButton.setOnClickListener {
            errorText.visibility = View.GONE
            val newPassword = newPasswordInput.text?.toString().orEmpty()
            val confirmPassword = confirmPasswordInput.text?.toString().orEmpty()

            if (newPassword.length < 8) {
                errorText.text = "Password must be at least 8 characters"
                errorText.visibility = View.VISIBLE
                return@setOnClickListener
            }
            if (newPassword != confirmPassword) {
                errorText.text = "Passwords do not match"
                errorText.visibility = View.VISIBLE
                return@setOnClickListener
            }

            progress.visibility = View.VISIBLE
            saveButton.isEnabled = false
            lifecycleScope.launch {
                val result = NativeApi.completePasswordReset(newPassword)
                progress.visibility = View.GONE
                saveButton.isEnabled = true

                if (!result.success) {
                    errorText.text = result.error.ifBlank { "Failed to update password" }
                    errorText.visibility = View.VISIBLE
                    return@launch
                }

                Toast.makeText(this@ForcePasswordResetActivity, "Password updated", Toast.LENGTH_SHORT).show()
                startActivity(
                    Intent(this@ForcePasswordResetActivity, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
            }
        }

        logoutButton.setOnClickListener {
            lifecycleScope.launch {
                NativeApi.logout()
                startActivity(
                    Intent(this@ForcePasswordResetActivity, LoginActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
            }
        }
    }
}
