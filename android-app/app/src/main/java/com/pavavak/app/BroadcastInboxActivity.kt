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
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.NativeApi
import com.pavavak.app.nativechat.UserBroadcast
import kotlinx.coroutines.launch

class BroadcastInboxActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_TARGET_BROADCAST_ID = "target_broadcast_id"
    }

    private lateinit var adapter: BroadcastAdapter
    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView
    private lateinit var summary: TextView
    private lateinit var markAllReadButton: MaterialButton
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private var broadcasts: List<UserBroadcast> = emptyList()
    private var pendingOpenBroadcastId: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_broadcast_inbox)

        pendingOpenBroadcastId = intent.getIntExtra(EXTRA_TARGET_BROADCAST_ID, 0)

        findViewById<MaterialToolbar>(R.id.broadcastInboxToolbar).apply {
            subtitle = "Only admins can send here"
            setNavigationOnClickListener { finish() }
        }
        progress = findViewById(R.id.broadcastInboxProgress)
        empty = findViewById(R.id.broadcastInboxEmpty)
        summary = findViewById(R.id.broadcastInboxSummary)
        swipeRefresh = findViewById(R.id.broadcastInboxSwipeRefresh)
        swipeRefresh.setOnRefreshListener { loadBroadcasts() }
        markAllReadButton = findViewById<MaterialButton>(R.id.broadcastInboxMarkAllReadBtn).apply {
            setOnClickListener { markAllRead() }
        }

        adapter = BroadcastAdapter(emptyList(), ::openBroadcast)
        findViewById<RecyclerView>(R.id.broadcastInboxRecycler).apply {
            layoutManager = LinearLayoutManager(this@BroadcastInboxActivity)
            adapter = this@BroadcastInboxActivity.adapter
        }
    }

    override fun onResume() {
        super.onResume()
        loadBroadcasts()
    }

    private fun loadBroadcasts() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        lifecycleScope.launch {
            broadcasts = NativeApi.getUserBroadcasts()
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            adapter.submit(broadcasts)
            val unread = broadcasts.count { !it.isRead }
            markAllReadButton.visibility = if (unread > 0) View.VISIBLE else View.GONE
            summary.text = if (broadcasts.isEmpty()) {
                "Only admins can send here."
            } else {
                "${broadcasts.size} announcement(s) - $unread unread"
            }
            empty.visibility = if (broadcasts.isEmpty()) View.VISIBLE else View.GONE

            if (pendingOpenBroadcastId > 0) {
                broadcasts.firstOrNull { it.broadcastId == pendingOpenBroadcastId }?.let {
                    pendingOpenBroadcastId = 0
                    openBroadcast(it)
                }
            }
        }
    }

    private fun markAllRead() {
        lifecycleScope.launch {
            val ok = NativeApi.markAllBroadcastsRead()
            Toast.makeText(
                this@BroadcastInboxActivity,
                if (ok) "All announcements marked as read" else "Update failed",
                Toast.LENGTH_SHORT
            ).show()
            if (ok) loadBroadcasts()
        }
    }

    private fun openBroadcast(item: UserBroadcast) {
        lifecycleScope.launch {
            if (!item.isRead) {
                NativeApi.markBroadcastRead(item.broadcastId)
            }
            AlertDialog.Builder(this@BroadcastInboxActivity)
                .setTitle(item.title)
                .setMessage(
                    buildString {
                        append(item.body)
                        append("\n\n")
                        append(item.createdAt)
                        if (item.createdByUsername.isNotBlank()) append(" - @${item.createdByUsername}")
                    }
                )
                .setPositiveButton("OK", null)
                .show()
            loadBroadcasts()
        }
    }
}
