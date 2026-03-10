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
import com.pavavak.app.nativechat.AdminMessage
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminMessagesActivity : AppCompatActivity() {

    private lateinit var adapter: AdminMessagesAdapter
    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_messages)

        findViewById<MaterialToolbar>(R.id.adminMessagesToolbar).setNavigationOnClickListener { finish() }

        progress = findViewById(R.id.adminMessagesProgress)
        empty = findViewById(R.id.adminMessagesEmpty)
        swipeRefresh = findViewById(R.id.adminMessagesSwipeRefresh)
        swipeRefresh.setOnRefreshListener { loadMessages() }

        val rv = findViewById<RecyclerView>(R.id.adminMessagesRecycler)
        rv.layoutManager = LinearLayoutManager(this)

        adapter = AdminMessagesAdapter(emptyList()) { msg ->
            confirmDelete(msg)
        }
        rv.adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        loadMessages()
    }

    private fun loadMessages() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        swipeRefresh.isRefreshing = false
        lifecycleScope.launch {
            val msgs = NativeApi.getAdminRecentMessages()
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            adapter.submit(msgs)
            empty.visibility = if (msgs.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    private fun confirmDelete(msg: AdminMessage) {
        val scopes = arrayOf(
            "Delete for all",
            "Delete sender side",
            "Delete receiver side"
        )
        AlertDialog.Builder(this)
            .setTitle("Delete message #${msg.messageId}")
            .setItems(scopes) { _, which ->
                val scope = when (which) {
                    1 -> "sender"
                    2 -> "receiver"
                    else -> "all"
                }
                lifecycleScope.launch {
                    val ok = NativeApi.adminDeleteMessage(msg.messageId, scope)
                    if (!ok) {
                        Toast.makeText(this@AdminMessagesActivity, "Delete failed", Toast.LENGTH_SHORT).show()
                    }
                    loadMessages()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
