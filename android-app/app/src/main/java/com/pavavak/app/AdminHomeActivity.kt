package com.pavavak.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.ChatListActivity
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminHomeActivity : AppCompatActivity() {

    private lateinit var progress: ProgressBar
    private lateinit var statUsers: TextView
    private lateinit var statPending: TextView
    private lateinit var statMessages: TextView
    private lateinit var statConnections: TextView
    private lateinit var statResets: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private var resetPopupShown = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_home)

        progress = findViewById(R.id.adminProgress)
        statUsers = findViewById(R.id.statUsers)
        statPending = findViewById(R.id.statPending)
        statMessages = findViewById(R.id.statMessages)
        statConnections = findViewById(R.id.statConnections)
        statResets = findViewById(R.id.statResets)
        swipeRefresh = findViewById(R.id.adminHomeSwipeRefresh)
        swipeRefresh.setOnRefreshListener { loadStats() }

        findViewById<MaterialButton>(R.id.adminMessagesBtn).setOnClickListener {
            startActivity(Intent(this, AdminMessagesActivity::class.java))
        }

        findViewById<MaterialButton>(R.id.openWebAdminBtn).setOnClickListener {
            startActivity(Intent(this, AdminWebActivity::class.java))
        }
        findViewById<MaterialButton>(R.id.adminOpenChatBtn).setOnClickListener {
            startActivity(Intent(this, ChatListActivity::class.java))
        }
        findViewById<MaterialButton>(R.id.adminReviewConvBtn).setOnClickListener {
            startActivity(Intent(this, AdminConversationListActivity::class.java))
        }

        findViewById<MaterialButton>(R.id.adminLogoutBtn).setOnClickListener {
            lifecycleScope.launch {
                NativeApi.logout()
                startActivity(
                    Intent(this@AdminHomeActivity, LoginActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
            }
        }
        findViewById<MaterialButton>(R.id.adminSettingsBtn).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        resetPopupShown = false
        loadStats()
    }

    private fun loadStats() {
        progress.visibility = View.VISIBLE
        swipeRefresh.isRefreshing = false
        lifecycleScope.launch {
            val stats = NativeApi.getAdminStats()
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            if (stats == null) {
                statUsers.text = "-"
                statPending.text = "-"
                statMessages.text = "-"
                statConnections.text = "-"
                statResets.text = "-"
                return@launch
            }
            statUsers.text = stats.totalUsers.toString()
            statPending.text = stats.pendingUsers.toString()
            statMessages.text = stats.totalMessages.toString()
            statConnections.text = stats.activeConnections.toString()
            statResets.text = stats.pendingResets.toString()
            if (stats.pendingResets > 0 && !resetPopupShown) {
                resetPopupShown = true
                showPendingResetPopup()
            }
        }
    }

    private fun showPendingResetPopup() {
        lifecycleScope.launch {
            val requests = NativeApi.getPendingPasswordResets()
            if (requests.isEmpty()) return@launch

            val labels = requests.map { "${it.username} (${it.email})" }.toTypedArray()
            AlertDialog.Builder(this@AdminHomeActivity)
                .setTitle("Password Reset Requests")
                .setMessage("Select a request to generate one-time password.")
                .setItems(labels) { _, which ->
                    val selected = requests.getOrNull(which) ?: return@setItems
                    generateOtpForRequest(selected.requestId, selected.username)
                }
                .setNeutralButton("Dismiss All Pending") { _, _ ->
                    lifecycleScope.launch {
                        requests.forEach { NativeApi.dismissResetRequest(it.requestId) }
                        loadStats()
                    }
                }
                .setNegativeButton("Later", null)
                .show()
        }
    }

    private fun generateOtpForRequest(requestId: Int, username: String) {
        lifecycleScope.launch {
            val generated = NativeApi.generateResetOtp(requestId)
            if (generated == null) {
                Toast.makeText(this@AdminHomeActivity, "Failed to generate OTP", Toast.LENGTH_LONG).show()
                return@launch
            }
            val otp = generated.first
            val expiresAt = generated.second
            copyToClipboard("Reset OTP $username", otp)
            AlertDialog.Builder(this@AdminHomeActivity)
                .setTitle("One-time Password")
                .setMessage("User: $username\nOTP: $otp\nExpires: $expiresAt\n\nOTP copied to clipboard.")
                .setPositiveButton("OK", null)
                .show()
            loadStats()
        }
    }

    private fun copyToClipboard(label: String, value: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
    }
}
