package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.pavavak.app.BroadcastInboxActivity
import com.pavavak.app.nativechat.ChatActivity
import com.pavavak.app.nativechat.ChatListActivity
import com.pavavak.app.nativechat.NativeApi
import com.pavavak.app.notifications.NotificationBootstrap
import com.pavavak.app.notifications.NotificationHelper
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

            if (session.forcePasswordReset) {
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, false)
                startActivity(
                    Intent(this@MainActivity, ForcePasswordResetActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
                return@launch
            }

            if (NotificationHelper.notificationIntentWantsChat(intent)) {
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, false)
                openLaunchTarget()
                return@launch
            }

            if (NotificationHelper.notificationIntentWantsBroadcasts(intent)) {
                AppSecurityPrefs.setDecoyModeActive(this@MainActivity, false)
                openLaunchTarget()
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

            openLaunchTarget()
        }
    }

    private fun hasRealPin(): Boolean {
        return getSharedPreferences("pavavak_lock", MODE_PRIVATE)
            .getString("real_pin_hash", null) != null
    }

    private fun openLaunchTarget() {
        val targetIntent = if (NotificationHelper.notificationIntentWantsChat(intent)) {
            val chatUserId = NotificationHelper.notificationChatId(intent)
            val chatName = NotificationHelper.notificationChatName(intent)
            if (chatUserId > 0) {
                Intent(this, ChatActivity::class.java)
                    .putExtra(ChatActivity.EXTRA_CHAT_ID, chatUserId.toString())
                    .putExtra(ChatActivity.EXTRA_CHAT_NAME, chatName.ifBlank { "Chat" })
            } else {
                Intent(this, ChatListActivity::class.java)
            }
        } else if (NotificationHelper.notificationIntentWantsBroadcasts(intent)) {
            Intent(this, BroadcastInboxActivity::class.java)
                .putExtra(BroadcastInboxActivity.EXTRA_TARGET_BROADCAST_ID, NotificationHelper.notificationBroadcastId(intent))
        } else {
            Intent(this, ChatListActivity::class.java)
        }
        startActivity(
            targetIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }
}
