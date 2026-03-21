package com.pavavak.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.AdminInvite
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminInvitesActivity : AppCompatActivity() {

    private lateinit var adapter: AdminInvitesAdapter
    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_invites)

        findViewById<MaterialToolbar>(R.id.adminInvitesToolbar).setNavigationOnClickListener { finish() }
        progress = findViewById(R.id.adminInvitesProgress)
        empty = findViewById(R.id.adminInvitesEmpty)

        adapter = AdminInvitesAdapter(emptyList(), ::copyInvite, ::confirmDeleteInvite)
        findViewById<RecyclerView>(R.id.adminInvitesRecycler).apply {
            layoutManager = LinearLayoutManager(this@AdminInvitesActivity)
            adapter = this@AdminInvitesActivity.adapter
        }

        findViewById<MaterialButton>(R.id.adminRefreshInvitesBtn).setOnClickListener { loadInvites() }
        findViewById<MaterialButton>(R.id.adminGenerateInviteBtn).setOnClickListener { generateInvite() }
    }

    override fun onResume() {
        super.onResume()
        loadInvites()
    }

    private fun loadInvites() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        lifecycleScope.launch {
            val invites = NativeApi.getAdminInvites()
            progress.visibility = View.GONE
            adapter.submit(invites)
            empty.visibility = if (invites.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    private fun generateInvite() {
        lifecycleScope.launch {
            val codes = NativeApi.generateAdminInvite()
            if (codes.isEmpty()) {
                Toast.makeText(this@AdminInvitesActivity, "Invite generation failed", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val code = codes.first()
            copyToClipboard("Invite code", code)
            AlertDialog.Builder(this@AdminInvitesActivity)
                .setTitle("Invite created")
                .setMessage("$code\n\nCopied to clipboard.")
                .setPositiveButton("OK", null)
                .show()
            loadInvites()
        }
    }

    private fun copyInvite(invite: AdminInvite) {
        copyToClipboard("Invite code", invite.code)
        Toast.makeText(this, "Invite copied", Toast.LENGTH_SHORT).show()
    }

    private fun confirmDeleteInvite(invite: AdminInvite) {
        AlertDialog.Builder(this)
            .setTitle("Delete invite")
            .setMessage("Delete invite ${invite.code}?")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.deleteAdminInvite(invite.code)
                    Toast.makeText(
                        this@AdminInvitesActivity,
                        if (ok) "Invite deleted" else "Delete failed",
                        Toast.LENGTH_SHORT
                    ).show()
                    loadInvites()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun copyToClipboard(label: String, value: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
    }
}
