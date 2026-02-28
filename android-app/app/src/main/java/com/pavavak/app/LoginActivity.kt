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

                Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()
                AppSecurityPrefs.setDecoyModeActive(this@LoginActivity, false)
                NotificationBootstrap.initialize(this@LoginActivity)
                NativeApi.registerFcmTokenFromPrefs(this@LoginActivity)
                startActivity(
                    Intent(this@LoginActivity, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
            }
        }
    }
}
