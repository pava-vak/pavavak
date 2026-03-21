package com.pavavak.app

import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.checkbox.MaterialCheckBox
import com.google.android.material.textfield.TextInputEditText
import com.pavavak.app.nativechat.AdminBroadcastRecipient
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminBroadcastActivity : AppCompatActivity() {

    private lateinit var titleInput: TextInputEditText
    private lateinit var bodyInput: TextInputEditText
    private lateinit var selectedOnlyCheck: MaterialCheckBox
    private lateinit var includeSelfCheck: MaterialCheckBox
    private lateinit var summaryText: TextView
    private lateinit var selectedUsersText: TextView
    private lateinit var progress: ProgressBar

    private var recipients: List<AdminBroadcastRecipient> = emptyList()
    private val selectedUserIds = linkedSetOf<Int>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_broadcast)

        findViewById<MaterialToolbar>(R.id.adminBroadcastToolbar).setNavigationOnClickListener { finish() }
        titleInput = findViewById(R.id.adminBroadcastTitleInput)
        bodyInput = findViewById(R.id.adminBroadcastBodyInput)
        selectedOnlyCheck = findViewById(R.id.adminBroadcastSelectedOnlyCheck)
        includeSelfCheck = findViewById(R.id.adminBroadcastIncludeSelfCheck)
        summaryText = findViewById(R.id.adminBroadcastSummary)
        selectedUsersText = findViewById(R.id.adminBroadcastSelectedUsers)
        progress = findViewById(R.id.adminBroadcastProgress)

        findViewById<MaterialButton>(R.id.adminBroadcastRefreshBtn).setOnClickListener { loadRecipients() }
        findViewById<MaterialButton>(R.id.adminBroadcastPickRecipientsBtn).setOnClickListener { pickRecipients() }
        findViewById<MaterialButton>(R.id.adminBroadcastSendBtn).setOnClickListener { sendBroadcast() }
        selectedOnlyCheck.setOnCheckedChangeListener { _, _ -> renderSelectionState() }
        includeSelfCheck.setOnCheckedChangeListener { _, _ -> renderSelectionState() }
    }

    override fun onResume() {
        super.onResume()
        loadRecipients()
    }

    private fun loadRecipients() {
        progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            recipients = NativeApi.getAdminBroadcastRecipients()
            progress.visibility = View.GONE
            selectedUserIds.retainAll(recipients.map { it.userId }.toSet())
            renderSelectionState()
        }
    }

    private fun renderSelectionState() {
        val selectedOnly = selectedOnlyCheck.isChecked
        val selectedUsers = recipients.filter { selectedUserIds.contains(it.userId) }
        val sentTo = if (selectedOnly) {
            "Selected ${selectedUsers.size} user(s)"
        } else {
            "Broadcasting to ${recipients.size} approved user(s)"
        }
        val tokenUsers = if (selectedOnly) selectedUsers.count { it.activeTokenCount > 0 } else recipients.count { it.activeTokenCount > 0 }
        summaryText.text = "$sentTo • $tokenUsers currently have active device tokens"
        selectedUsersText.text = if (selectedUsers.isEmpty()) {
            "No users selected."
        } else {
            selectedUsers.joinToString(separator = "\n") {
                "@${it.username} • ${it.activeTokenCount} active token(s)"
            }
        }
    }

    private fun pickRecipients() {
        if (recipients.isEmpty()) {
            Toast.makeText(this, "Recipients are still loading", Toast.LENGTH_SHORT).show()
            return
        }
        val labels = recipients.map {
            "${it.fullName.ifBlank { it.username }} (@${it.username}) • ${it.activeTokenCount} token(s)"
        }.toTypedArray()
        val checked = recipients.map { selectedUserIds.contains(it.userId) }.toBooleanArray()
        AlertDialog.Builder(this)
            .setTitle("Select recipients")
            .setMultiChoiceItems(labels, checked) { _, which, isChecked ->
                val userId = recipients[which].userId
                if (isChecked) selectedUserIds.add(userId) else selectedUserIds.remove(userId)
            }
            .setPositiveButton("Done") { _, _ -> renderSelectionState() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun sendBroadcast() {
        val title = titleInput.text?.toString()?.trim().orEmpty()
        val body = bodyInput.text?.toString()?.trim().orEmpty()
        val selectedOnly = selectedOnlyCheck.isChecked
        val selectedIds = selectedUserIds.toList()

        if (title.isBlank()) {
            Toast.makeText(this, "Title is required", Toast.LENGTH_SHORT).show()
            return
        }
        if (body.isBlank()) {
            Toast.makeText(this, "Message is required", Toast.LENGTH_SHORT).show()
            return
        }
        if (selectedOnly && selectedIds.isEmpty()) {
            Toast.makeText(this, "Select at least one user", Toast.LENGTH_SHORT).show()
            return
        }

        progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            val result = NativeApi.sendAdminBroadcast(
                title = title,
                body = body,
                mode = if (selectedOnly) "selected" else "all",
                includeSelf = includeSelfCheck.isChecked,
                userIds = selectedIds
            )
            progress.visibility = View.GONE
            if (result == null) {
                Toast.makeText(this@AdminBroadcastActivity, "Broadcast failed", Toast.LENGTH_SHORT).show()
                return@launch
            }
            titleInput.setText("")
            bodyInput.setText("")
            val message = buildString {
                append("Targeted ${result.summary.targetedCount} users.\n")
                append("Sent to ${result.summary.sentUsers} user(s).\n")
                append("Skipped ${result.summary.skippedNoTokenCount} with no active token(s).\n")
                append("Failed ${result.summary.failedCount} user(s).")
                if (result.skippedUsers.isNotEmpty()) {
                    append("\n\nNo token: ${result.skippedUsers.joinToString(prefix = "@", separator = ", @")}")
                }
                if (result.failedUsers.isNotEmpty()) {
                    append("\n\nFailed: ${result.failedUsers.joinToString(prefix = "@", separator = ", @")}")
                }
            }
            AlertDialog.Builder(this@AdminBroadcastActivity)
                .setTitle("Broadcast result")
                .setMessage(message)
                .setPositiveButton("OK", null)
                .show()
            loadRecipients()
        }
    }
}
