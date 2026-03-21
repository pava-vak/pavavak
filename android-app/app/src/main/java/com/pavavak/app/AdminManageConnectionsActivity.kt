package com.pavavak.app

import android.content.Intent
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
import com.pavavak.app.nativechat.AdminConnection
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminManageConnectionsActivity : AppCompatActivity() {

    private lateinit var adapter: AdminManageConnectionsAdapter
    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_manage_connections)

        findViewById<MaterialToolbar>(R.id.adminManageConnectionsToolbar).setNavigationOnClickListener { finish() }
        progress = findViewById(R.id.adminManageConnectionsProgress)
        empty = findViewById(R.id.adminManageConnectionsEmpty)

        adapter = AdminManageConnectionsAdapter(emptyList(), ::openConnection, ::confirmDeleteConnection)
        findViewById<RecyclerView>(R.id.adminManageConnectionsRecycler).apply {
            layoutManager = LinearLayoutManager(this@AdminManageConnectionsActivity)
            adapter = this@AdminManageConnectionsActivity.adapter
        }

        findViewById<MaterialButton>(R.id.adminRefreshConnectionsBtn).setOnClickListener { loadConnections() }
        findViewById<MaterialButton>(R.id.adminCreateConnectionBtn).setOnClickListener { showCreateConnectionDialog() }
    }

    override fun onResume() {
        super.onResume()
        loadConnections()
    }

    private fun loadConnections() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        lifecycleScope.launch {
            val connections = NativeApi.getAdminConnectionPairs()
            progress.visibility = View.GONE
            adapter.submit(connections)
            empty.visibility = if (connections.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    private fun openConnection(connection: AdminConnection) {
        startActivity(
            Intent(this, AdminConversationActivity::class.java)
                .putExtra("user1Id", connection.user1Id)
                .putExtra("user2Id", connection.user2Id)
                .putExtra("title", "${connection.user1Name} <> ${connection.user2Name}")
        )
    }

    private fun confirmDeleteConnection(connection: AdminConnection) {
        AlertDialog.Builder(this)
            .setTitle("Delete link")
            .setMessage("Delete the link between ${connection.user1Name} and ${connection.user2Name}? Messages will remain.")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.deleteAdminConnection(connection.connectionId)
                    Toast.makeText(
                        this@AdminManageConnectionsActivity,
                        if (ok) "Link deleted" else "Delete failed",
                        Toast.LENGTH_SHORT
                    ).show()
                    loadConnections()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showCreateConnectionDialog() {
        lifecycleScope.launch {
            val users = NativeApi.getAdminUsers().filter { it.isApproved }
            if (users.size < 2) {
                Toast.makeText(this@AdminManageConnectionsActivity, "Need at least two approved users", Toast.LENGTH_SHORT).show()
                return@launch
            }

            val labels = users.map { "${it.fullName.ifBlank { it.username }} (@${it.username})" }
            var firstIndex = -1
            var secondIndex = -1

            AlertDialog.Builder(this@AdminManageConnectionsActivity)
                .setTitle("Pick first user")
                .setItems(labels.toTypedArray()) { _, which ->
                    firstIndex = which
                    AlertDialog.Builder(this@AdminManageConnectionsActivity)
                        .setTitle("Pick second user")
                        .setItems(labels.toTypedArray()) { _, secondWhich ->
                            secondIndex = secondWhich
                            if (firstIndex == secondIndex) {
                                Toast.makeText(this@AdminManageConnectionsActivity, "Choose two different users", Toast.LENGTH_SHORT).show()
                                return@setItems
                            }
                            lifecycleScope.launch {
                                val ok = NativeApi.createAdminConnection(
                                    users[firstIndex].userId,
                                    users[secondIndex].userId
                                )
                                Toast.makeText(
                                    this@AdminManageConnectionsActivity,
                                    if (ok) "Link created" else "Create link failed",
                                    Toast.LENGTH_SHORT
                                ).show()
                                loadConnections()
                            }
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }
}
