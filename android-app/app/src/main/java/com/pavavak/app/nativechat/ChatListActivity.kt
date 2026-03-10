package com.pavavak.app.nativechat

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.MenuItem
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.textfield.TextInputEditText
import com.pavavak.app.AppSecurityPrefs
import com.pavavak.app.LoginActivity
import com.pavavak.app.R
import com.pavavak.app.SettingsActivity
import com.pavavak.app.UserWebActivity
import com.pavavak.app.data.local.LocalChatStore
import com.pavavak.app.data.local.LocalDatabaseProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ChatListActivity : AppCompatActivity() {

    private lateinit var adapter: ChatListAdapter
    private lateinit var progress: ProgressBar
    private lateinit var emptyText: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var searchInput: TextInputEditText
    private lateinit var newChatFab: FloatingActionButton
    private lateinit var localStore: LocalChatStore
    private var allChats: List<ChatSummary> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_list)

        val toolbar = findViewById<MaterialToolbar>(R.id.chatListToolbar)
        toolbar.setNavigationOnClickListener { finish() }
        toolbar.setOnMenuItemClickListener { onToolbarMenuClick(it) }

        progress = findViewById(R.id.chatListProgress)
        emptyText = findViewById(R.id.chatListEmpty)
        swipeRefresh = findViewById(R.id.chatListSwipeRefresh)
        swipeRefresh.setOnRefreshListener { loadChats() }
        searchInput = findViewById(R.id.chatSearchInput)
        newChatFab = findViewById(R.id.newChatFab)
        newChatFab.setOnClickListener {
            openChatByUserIdDialog()
        }
        localStore = LocalChatStore(LocalDatabaseProvider.get(this))

        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                applyFilter(s?.toString().orEmpty())
            }
        })

        val rv = findViewById<RecyclerView>(R.id.chatListRecycler)
        rv.layoutManager = LinearLayoutManager(this)

        adapter = ChatListAdapter(
            emptyList(),
            onClick = { chat ->
                startActivity(
                    Intent(this, ChatActivity::class.java)
                        .putExtra(ChatActivity.EXTRA_CHAT_ID, chat.chatId)
                        .putExtra(ChatActivity.EXTRA_CHAT_NAME, chat.name)
                )
            },
            onLongClick = { chat ->
                showRenameChatDialog(chat)
            }
        )
        rv.adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        applyDecoyUiState()
        loadChats()
    }

    private fun loadChats() {
        if (AppSecurityPrefs.isDecoyModeActive(this)) {
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            allChats = emptyList()
            adapter.submit(emptyList())
            emptyText.visibility = View.VISIBLE
            emptyText.text = "No conversations yet."
            return
        }

        progress.visibility = View.VISIBLE
        emptyText.visibility = View.GONE
        swipeRefresh.isRefreshing = false

        lifecycleScope.launch {
            val cachedChats = withContext(Dispatchers.IO) { localStore.readCachedConversations() }
            if (cachedChats.isNotEmpty()) {
                allChats = cachedChats.map { c ->
                    val id = c.chatId.toIntOrNull()
                    if (id == null) c else c.copy(name = ContactAliasPrefs.aliasFor(this@ChatListActivity, id, c.name))
                }.sortedByDescending { it.lastSentAtEpochMs }
                applyFilter(searchInput.text?.toString().orEmpty())
                progress.visibility = View.GONE
                emptyText.visibility = View.GONE
            }

            val session = NativeApi.getSession()
            if (!session.authenticated) {
                progress.visibility = View.GONE
                if (allChats.isEmpty()) {
                    emptyText.visibility = View.VISIBLE
                    emptyText.text = "Session expired. Please login again."
                }
                return@launch
            }

            var chats = NativeApi.getConversations()
            if (chats.isEmpty() && session.isAdmin) {
                // Admin may have valid connections but no user-style conversation rows yet.
                val adminConnections = NativeApi.getAdminConnections()
                chats = adminConnections.mapNotNull { c ->
                    when (session.userId) {
                        c.user1Id -> ChatSummary(
                            chatId = c.user2Id.toString(),
                            name = c.user2Name,
                            lastMessage = "Tap to open chat",
                            lastTime = "",
                            unreadCount = 0
                        )
                        c.user2Id -> ChatSummary(
                            chatId = c.user1Id.toString(),
                            name = c.user1Name,
                            lastMessage = "Tap to open chat",
                            lastTime = "",
                            unreadCount = 0
                        )
                        else -> null
                    }
                }
            }
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            if (chats.isNotEmpty()) {
                allChats = chats.map { c ->
                    val id = c.chatId.toIntOrNull()
                    if (id == null) c else c.copy(name = ContactAliasPrefs.aliasFor(this@ChatListActivity, id, c.name))
                }.sortedByDescending { it.lastSentAtEpochMs }
                applyFilter(searchInput.text?.toString().orEmpty())
                withContext(Dispatchers.IO) {
                    localStore.cacheConversations(allChats)
                }
            } else if (allChats.isEmpty()) {
                allChats = emptyList()
                applyFilter(searchInput.text?.toString().orEmpty())
            }
            if (allChats.isEmpty()) {
                emptyText.visibility = View.VISIBLE
                emptyText.text = if (session.isAdmin) {
                    "No admin chat connections found. Use 'Open By User ID' to test direct chat."
                } else {
                    "No conversations yet."
                }
            }
        }
    }

    private fun applyFilter(rawQuery: String) {
        val query = rawQuery.trim().lowercase()
        val visible = if (query.isBlank()) {
            allChats
        } else {
            allChats.filter {
                it.name.lowercase().contains(query) || it.lastMessage.lowercase().contains(query)
            }
        }
        adapter.submit(visible)
        emptyText.visibility = if (visible.isEmpty()) View.VISIBLE else View.GONE
        if (visible.isEmpty() && allChats.isNotEmpty()) {
            emptyText.text = "No chats match your search."
        }
    }

    private fun onToolbarMenuClick(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_open_web -> {
                startActivity(Intent(this, UserWebActivity::class.java))
                true
            }
            R.id.action_settings -> {
                startActivity(Intent(this, SettingsActivity::class.java))
                true
            }
            R.id.action_logout -> {
                lifecycleScope.launch {
                    AppSecurityPrefs.setDecoyModeActive(this@ChatListActivity, false)
                    NativeApi.logout()
                    startActivity(
                        Intent(this@ChatListActivity, LoginActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    )
                    finish()
                }
                true
            }
            else -> false
        }
    }

    private fun applyDecoyUiState() {
        val toolbar = findViewById<MaterialToolbar>(R.id.chatListToolbar)
        val decoy = AppSecurityPrefs.isDecoyModeActive(this)
        toolbar.subtitle = if (decoy) "Decoy mode" else null
        newChatFab.visibility = if (decoy) View.GONE else View.VISIBLE
    }

    private fun openChatByUserIdDialog() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 0)
        }

        val userIdInput = EditText(this).apply {
            hint = "User ID (number)"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        val nameInput = EditText(this).apply {
            hint = "Name (optional)"
        }

        container.addView(userIdInput)
        container.addView(nameInput)

        AlertDialog.Builder(this)
            .setTitle("Open Chat")
            .setView(container)
            .setPositiveButton("Open") { _, _ ->
                val id = userIdInput.text?.toString()?.trim().orEmpty()
                val numericId = id.toIntOrNull()
                if (numericId == null || numericId <= 0) {
                    emptyText.visibility = View.VISIBLE
                    emptyText.text = "Enter a valid numeric user ID."
                    return@setPositiveButton
                }
                val name = nameInput.text?.toString()?.trim().orEmpty().ifBlank { "User $numericId" }
                ContactAliasPrefs.setAlias(this, numericId, name)
                startActivity(
                    Intent(this, ChatActivity::class.java)
                        .putExtra(ChatActivity.EXTRA_CHAT_ID, numericId.toString())
                        .putExtra(ChatActivity.EXTRA_CHAT_NAME, name)
                )
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showRenameChatDialog(chat: ChatSummary) {
        val id = chat.chatId.toIntOrNull() ?: return
        val input = EditText(this).apply {
            setText(chat.name)
            setSelection(text?.length ?: 0)
            hint = "Contact name"
        }
        AlertDialog.Builder(this)
            .setTitle("Edit contact name")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val alias = input.text?.toString()?.trim().orEmpty()
                if (alias.isNotBlank()) {
                    ContactAliasPrefs.setAlias(this, id, alias)
                    loadChats()
                }
            }
            .setNeutralButton("Reset") { _, _ ->
                ContactAliasPrefs.clearAlias(this, id)
                loadChats()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
