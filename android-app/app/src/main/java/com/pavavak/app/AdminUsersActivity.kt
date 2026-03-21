package com.pavavak.app

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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import com.pavavak.app.nativechat.AdminUser
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminUsersActivity : AppCompatActivity() {

    private lateinit var adapter: AdminUsersAdapter
    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView
    private lateinit var summary: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private var allUsers: List<AdminUser> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_users)

        findViewById<MaterialToolbar>(R.id.adminUsersToolbar).setNavigationOnClickListener { finish() }
        progress = findViewById(R.id.adminUsersProgress)
        empty = findViewById(R.id.adminUsersEmpty)
        summary = findViewById(R.id.adminUsersSummary)
        swipeRefresh = findViewById(R.id.adminUsersSwipeRefresh)
        swipeRefresh.setOnRefreshListener { loadUsers() }

        adapter = AdminUsersAdapter(emptyList(), ::confirmApprove, ::confirmReject)
        findViewById<RecyclerView>(R.id.adminUsersRecycler).apply {
            layoutManager = LinearLayoutManager(this@AdminUsersActivity)
            adapter = this@AdminUsersActivity.adapter
        }
    }

    override fun onResume() {
        super.onResume()
        loadUsers()
    }

    private fun loadUsers() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        lifecycleScope.launch {
            val pending = NativeApi.getAdminPendingUsers()
            allUsers = NativeApi.getAdminUsers()
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            summary.text = "Pending: ${pending.size} • Total users: ${allUsers.size}"
            adapter.submit(pending)
            empty.visibility = if (pending.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    private fun confirmApprove(user: AdminUser) {
        AlertDialog.Builder(this)
            .setTitle("Approve user")
            .setMessage("Approve @${user.username}?")
            .setPositiveButton("Approve") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.approveAdminUser(user.userId)
                    Toast.makeText(
                        this@AdminUsersActivity,
                        if (ok) "@${user.username} approved" else "Approval failed",
                        Toast.LENGTH_SHORT
                    ).show()
                    loadUsers()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun confirmReject(user: AdminUser) {
        AlertDialog.Builder(this)
            .setTitle("Reject user")
            .setMessage("Reject and remove @${user.username}?")
            .setPositiveButton("Reject") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.rejectAdminUser(user.userId)
                    Toast.makeText(
                        this@AdminUsersActivity,
                        if (ok) "@${user.username} rejected" else "Rejection failed",
                        Toast.LENGTH_SHORT
                    ).show()
                    loadUsers()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
