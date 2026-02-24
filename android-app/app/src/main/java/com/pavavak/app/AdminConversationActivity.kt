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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AdminConversationActivity : AppCompatActivity() {

    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView
    private lateinit var adapter: AdminConversationMessageAdapter
    private lateinit var selectionBar: View
    private lateinit var selectionCount: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private var user1Id: Int = 0
    private var user2Id: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_conversation)

        user1Id = intent.getIntExtra("user1Id", 0)
        user2Id = intent.getIntExtra("user2Id", 0)
        val title = intent.getStringExtra("title") ?: "Conversation"

        val toolbar = findViewById<MaterialToolbar>(R.id.adminConversationToolbar)
        toolbar.title = title
        toolbar.setNavigationOnClickListener { finish() }

        progress = findViewById(R.id.adminConversationProgress)
        empty = findViewById(R.id.adminConversationEmpty)
        selectionBar = findViewById(R.id.adminConvSelectionBar)
        selectionCount = findViewById(R.id.adminConvSelectionCount)
        swipeRefresh = findViewById(R.id.adminConversationSwipeRefresh)
        swipeRefresh.setOnRefreshListener { load() }

        val rv = findViewById<RecyclerView>(R.id.adminConversationRecycler)
        rv.layoutManager = LinearLayoutManager(this)
        adapter = AdminConversationMessageAdapter(emptyList()) { msg ->
            if (adapter.isSelectionMode()) {
                adapter.toggleSelection(msg.messageId)
                updateSelectionBar()
            } else {
                showMessageActions(msg.messageId)
            }
        }
        rv.adapter = adapter

        findViewById<MaterialButton>(R.id.adminConvCancelSelectionBtn).setOnClickListener {
            adapter.exitSelection()
            updateSelectionBar()
        }
        findViewById<MaterialButton>(R.id.adminConvDeleteSelectedBtn).setOnClickListener {
            deleteSelectedMessages()
        }
        findViewById<MaterialButton>(R.id.adminConvClearChatBtn).setOnClickListener {
            confirmClearConversation()
        }
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun load() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        swipeRefresh.isRefreshing = false
        lifecycleScope.launch {
            val messages = NativeApi.getAdminConversation(user1Id, user2Id)
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            adapter.submit(messages)
            updateSelectionBar()
            if (messages.isEmpty()) {
                empty.visibility = View.VISIBLE
                empty.text = "No messages in this conversation."
            }
        }
    }

    private fun showMessageActions(messageId: Int) {
        val options = arrayOf("Delete message", "Select")
        AlertDialog.Builder(this)
            .setTitle("Admin actions")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> confirmDeleteOne(messageId)
                    1 -> {
                        adapter.enterSelection(messageId)
                        updateSelectionBar()
                    }
                }
            }
            .show()
    }

    private fun confirmDeleteOne(messageId: Int) {
        AlertDialog.Builder(this)
            .setTitle("Delete message")
            .setMessage("Delete this message from server for everyone?")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.adminDeleteMessage(messageId)
                    if (!ok) Toast.makeText(this@AdminConversationActivity, "Delete failed", Toast.LENGTH_SHORT).show()
                    load()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun deleteSelectedMessages() {
        val ids = adapter.selectedIds().toList()
        if (ids.isEmpty()) return

        AlertDialog.Builder(this)
            .setTitle("Delete selected")
            .setMessage("Delete ${ids.size} selected message(s) from server for everyone?")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    var failed = 0
                    withContext(Dispatchers.IO) {
                        ids.forEach { id ->
                            if (!NativeApi.adminDeleteMessage(id)) failed++
                        }
                    }
                    adapter.exitSelection()
                    updateSelectionBar()
                    if (failed > 0) {
                        Toast.makeText(this@AdminConversationActivity, "$failed delete(s) failed", Toast.LENGTH_SHORT).show()
                    }
                    load()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun confirmClearConversation() {
        AlertDialog.Builder(this)
            .setTitle("Clear chat")
            .setMessage("Delete all messages in this conversation from server for both users?")
            .setPositiveButton("Clear") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.adminClearConversation(user1Id, user2Id)
                    if (!ok) {
                        Toast.makeText(this@AdminConversationActivity, "Clear chat failed", Toast.LENGTH_SHORT).show()
                        return@launch
                    }
                    adapter.exitSelection()
                    updateSelectionBar()
                    load()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateSelectionBar() {
        if (adapter.isSelectionMode()) {
            selectionBar.visibility = View.VISIBLE
            selectionCount.text = "${adapter.selectedCount()} selected"
        } else {
            selectionBar.visibility = View.GONE
        }
    }
}
