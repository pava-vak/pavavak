package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.pavavak.app.nativechat.ChatListActivity
import com.pavavak.app.nativechat.NativeApi
import com.pavavak.app.notifications.NotificationBootstrap
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        NotificationBootstrap.initialize(this)

        lifecycleScope.launch {
            val session = NativeApi.getSession()
            if (!session.authenticated) {
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, false)
                startActivity(
                    Intent(this@MainActivity, LoginActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
                return@launch
            }

            if (session.isAdmin) {
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, false)
                startActivity(
                    Intent(this@MainActivity, AdminHomeActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
                return@launch
            }

            if (!hasRealPin()) {
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, false)
                startActivity(
                    Intent(this@MainActivity, LockActivity::class.java)
                        .putExtra(LockActivity.EXTRA_FORCE_SETUP, true)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
                return@launch
            }

            if (intent.hasExtra(LockActivity.EXTRA_DECOY_MODE)) {
                val decoy = intent.getBooleanExtra(LockActivity.EXTRA_DECOY_MODE, false)
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, decoy)
            }

            openNativeChat()
        }
    }

    private fun hasRealPin(): Boolean {
        return getSharedPreferences("pavavak_lock", MODE_PRIVATE)
            .getString("real_pin_hash", null) != null
    }

    private fun openNativeChat() {
        startActivity(
            Intent(this, ChatListActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }
}
