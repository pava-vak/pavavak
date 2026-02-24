package com.pavavak.app.nativechat

import android.os.Bundle
import android.util.Log
import android.text.TextUtils
import android.view.MenuItem
import android.view.View
import android.view.HapticFeedbackConstants
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.pavavak.app.AppSecurityPrefs
import com.pavavak.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

class ChatActivity : AppCompatActivity() {
    private val tag = "PaVaVakChat"
    private var decoyMode = false

    private var otherUserId: Int = 0
    private var currentChatName: String = "Chat"
    private lateinit var messages: MutableList<ChatMessage>
    private lateinit var adapter: MessageAdapter

    private lateinit var replyBox: LinearLayout
    private lateinit var replyText: TextView
    private lateinit var selectionBar: LinearLayout
    private lateinit var selectionCount: TextView
    private lateinit var progress: ProgressBar
    private lateinit var emptyText: TextView
    private lateinit var recycler: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    private var replyTarget: ChatMessage? = null
    private var refreshJob: Job? = null
    private val pendingMessages = mutableListOf<ChatMessage>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        otherUserId = (intent.getStringExtra(EXTRA_CHAT_ID) ?: "0").toIntOrNull() ?: 0
        val chatName = intent.getStringExtra(EXTRA_CHAT_NAME) ?: "Chat"
        currentChatName = ContactAliasPrefs.aliasFor(this, otherUserId, chatName)
        decoyMode = AppSecurityPrefs.isDecoyModeActive(this)

        val toolbar = findViewById<MaterialToolbar>(R.id.chatToolbar)
        toolbar.title = if (decoyMode) "$currentChatName (Decoy)" else currentChatName
        toolbar.setNavigationOnClickListener { finish() }
        toolbar.setOnMenuItemClickListener { onToolbarMenuClick(it) }
        findViewById<MaterialButton>(R.id.attachBtn).setOnClickListener {
            Toast.makeText(this, "File send: next step", Toast.LENGTH_SHORT).show()
        }
        findViewById<MaterialButton>(R.id.cameraBtn).setOnClickListener {
            Toast.makeText(this, "Camera send: next step", Toast.LENGTH_SHORT).show()
        }

        progress = findViewById(R.id.chatProgress)
        emptyText = findViewById(R.id.chatEmpty)
        recycler = findViewById(R.id.messagesRecycler)
        swipeRefresh = findViewById(R.id.chatSwipeRefresh)
        swipeRefresh.setOnRefreshListener { refreshMessagesSilently() }
        recycler.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }

        messages = mutableListOf()
        adapter = MessageAdapter(messages) { message ->
            if (adapter.isSelectionMode()) {
                adapter.toggleSelection(message.id)
                updateSelectionBar()
            } else {
                showMessageActions(message)
            }
        }
        recycler.adapter = adapter
        attachSwipeToReply()

        replyBox = findViewById(R.id.replyPreviewBox)
        replyText = findViewById(R.id.replyPreviewText)
        selectionBar = findViewById(R.id.selectionBar)
        selectionCount = findViewById(R.id.selectionCount)

        findViewById<MaterialButton>(R.id.cancelReplyBtn).setOnClickListener {
            replyTarget = null
            replyBox.visibility = View.GONE
        }

        findViewById<MaterialButton>(R.id.cancelSelectionBtn).setOnClickListener {
            adapter.exitSelection()
            updateSelectionBar()
        }

        findViewById<MaterialButton>(R.id.deleteSelectedBtn).setOnClickListener {
            deleteSelectedLive()
        }

        val input = findViewById<EditText>(R.id.messageInput)
        findViewById<MaterialButton>(R.id.sendBtn).setOnClickListener {
            if (decoyMode) {
                Toast.makeText(this, "Decoy mode: sending disabled", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val text = input.text?.toString()?.trim().orEmpty()
            Log.d(tag, "Send clicked. otherUserId=$otherUserId textLen=${text.length}")
            if (TextUtils.isEmpty(text)) return@setOnClickListener

            val preview = replyTarget?.text
            val pendingLocal = ChatMessage(
                id = UUID.randomUUID().toString(),
                isMine = true,
                text = text,
                time = "sending...",
                replyPreview = preview
            )
            messages.add(pendingLocal)
            pendingMessages.add(pendingLocal)
            adapter.refresh()
            input.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            progress.visibility = View.GONE
            emptyText.visibility = View.GONE
            recycler.visibility = View.VISIBLE
            recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))

            input.text?.clear()
            input.clearFocus()
            hideKeyboard(input)
            replyTarget = null
            replyBox.visibility = View.GONE

            lifecycleScope.launch {
                val sent = NativeApi.sendMessage(otherUserId, text)
                Log.d(tag, "Send result success=${sent.success} error='${sent.error}' hasMessage=${sent.message != null}")
                if (!sent.success || sent.message == null) {
                    pendingLocal.time = "failed"
                    adapter.refresh()
                    Toast.makeText(
                        this@ChatActivity,
                        "Send failed: ${sent.error.ifBlank { "unknown error" }}",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@launch
                }
                pendingLocal.time = if (sent.message.time.isBlank()) "queued" else sent.message.time
                pendingLocal.isDelivered = sent.message.isDelivered
                pendingLocal.isRead = sent.message.isRead
                adapter.refresh()
                refreshMessagesSilently()
            }
        }

        loadMessages()
    }

    override fun onResume() {
        super.onResume()
        startAutoRefresh()
    }

    override fun onPause() {
        super.onPause()
        refreshJob?.cancel()
        refreshJob = null
    }

    private fun loadMessages() {
        if (decoyMode) {
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            messages.clear()
            adapter.refresh()
            emptyText.visibility = View.VISIBLE
            emptyText.text = "No messages yet."
            recycler.visibility = View.INVISIBLE
            return
        }
        progress.visibility = View.VISIBLE
        swipeRefresh.isRefreshing = false
        emptyText.visibility = View.GONE
        recycler.visibility = View.INVISIBLE

        lifecycleScope.launch {
            val list = NativeApi.getMessages(otherUserId)
            Log.d(tag, "loadMessages serverCount=${list.size} pendingCount=${pendingMessages.size}")
            applyServerMessages(list)
            markIncomingAsRead(list)
            syncListVisibility()

            progress.visibility = View.GONE
            if (messages.isNotEmpty()) {
                recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))
            }
        }
    }

    private fun refreshMessagesSilently() {
        if (decoyMode) {
            swipeRefresh.isRefreshing = false
            return
        }
        lifecycleScope.launch {
            val list = NativeApi.getMessages(otherUserId)
            Log.d(tag, "refreshMessagesSilently serverCount=${list.size} pendingCount=${pendingMessages.size}")
            applyServerMessages(list)
            markIncomingAsRead(list)
            swipeRefresh.isRefreshing = false
            syncListVisibility()
            if (messages.isNotEmpty()) {
                recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))
            }
        }
    }

    private fun startAutoRefresh() {
        if (refreshJob != null) return
        refreshJob = lifecycleScope.launch {
            while (true) {
                delay(3500)
                refreshMessagesSilently()
            }
        }
    }

    private fun markIncomingAsRead(list: List<ChatMessage>) {
        val unreadIncoming = list.filter { !it.isMine && !it.isRead }.map { it.id }
        if (unreadIncoming.isEmpty()) return
        lifecycleScope.launch(Dispatchers.IO) {
            unreadIncoming.forEach { NativeApi.markMessageRead(it) }
        }
    }

    private fun updateSelectionBar() {
        if (adapter.isSelectionMode()) {
            selectionBar.visibility = View.VISIBLE
            selectionCount.text = "${adapter.selectedCount()} selected"
        } else {
            selectionBar.visibility = View.GONE
        }
    }

    private fun showMessageActions(message: ChatMessage) {
        val options = arrayOf("Reply", "React", "Delete message", "Select")
        AlertDialog.Builder(this)
            .setTitle("Message actions")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> {
                        replyTarget = message
                        replyText.text = message.text
                        replyBox.visibility = View.VISIBLE
                    }
                    1 -> pickReaction(message)
                    2 -> deleteSingleLive(message)
                    3 -> {
                        adapter.enterSelection(message.id)
                        updateSelectionBar()
                    }
                }
            }
            .show()
    }

    private fun pickReaction(message: ChatMessage) {
        val emojis = arrayOf("👍", "❤️", "😂", "😮", "😢", "🙏", "❌ Remove")
        AlertDialog.Builder(this)
            .setTitle("React")
            .setItems(emojis) { _, which ->
                message.reaction = if (which == emojis.lastIndex) null else emojis[which]
                MessageReactionPrefs.setReaction(this, otherUserId, message.id, message.reaction)
                adapter.refresh()
            }
            .show()
    }

    private fun deleteSingleLive(message: ChatMessage) {
        if (!isServerMessageId(message.id)) {
            pendingMessages.removeAll { it.id == message.id }
            messages.removeAll { it.id == message.id }
            MessageReactionPrefs.clearReactionsForMessages(this, otherUserId, listOf(message.id))
            adapter.refresh()
            updateSelectionBar()
            return
        }
        lifecycleScope.launch {
            val ok = NativeApi.deleteMessage(message.id)
            if (!ok) {
                Toast.makeText(this@ChatActivity, "Delete failed", Toast.LENGTH_SHORT).show()
                return@launch
            }
            MessageReactionPrefs.clearReactionsForMessages(this@ChatActivity, otherUserId, listOf(message.id))
            loadMessages()
        }
    }

    private fun deleteSelectedLive() {
        val ids = adapter.selectedIds().toList()
        if (ids.isEmpty()) return

        val localIds = ids.filterNot(::isServerMessageId).toSet()
        if (localIds.isNotEmpty()) {
            pendingMessages.removeAll { localIds.contains(it.id) }
            messages.removeAll { localIds.contains(it.id) }
            MessageReactionPrefs.clearReactionsForMessages(this, otherUserId, localIds)
        }
        val serverIds = ids.filter(::isServerMessageId)

        lifecycleScope.launch {
            var failed = 0
            withContext(Dispatchers.IO) {
                serverIds.forEach { id ->
                    if (!NativeApi.deleteMessage(id)) failed++
                }
            }
            adapter.exitSelection()
            updateSelectionBar()
            if (failed > 0) {
                Toast.makeText(this@ChatActivity, "$failed delete(s) failed", Toast.LENGTH_SHORT).show()
            }
            MessageReactionPrefs.clearReactionsForMessages(this@ChatActivity, otherUserId, ids)
            loadMessages()
        }
    }

    private fun clearChat() {
        AlertDialog.Builder(this)
            .setTitle("Clear chat")
            .setMessage("Delete all messages from this chat view?")
            .setPositiveButton("Clear") { _, _ ->
                lifecycleScope.launch {
                    val ok = NativeApi.clearChat(otherUserId)
                    if (!ok) {
                        Toast.makeText(this@ChatActivity, "Clear chat failed", Toast.LENGTH_SHORT).show()
                        return@launch
                    }
                    replyTarget = null
                    replyBox.visibility = View.GONE
                    pendingMessages.clear()
                    MessageReactionPrefs.clearReactionsForMessages(
                        this@ChatActivity,
                        otherUserId,
                        messages.map { it.id }
                    )
                    adapter.exitSelection()
                    updateSelectionBar()
                    loadMessages()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun applyServerMessages(serverMessages: List<ChatMessage>) {
        val remainingLocal = mutableListOf<ChatMessage>()
        pendingMessages.forEach { local ->
            if (local.time == "failed") {
                remainingLocal.add(local)
                return@forEach
            }
            val matched = serverMessages.any { it.isMine && it.text == local.text }
            if (!matched) remainingLocal.add(local)
        }
        pendingMessages.clear()
        pendingMessages.addAll(remainingLocal)

        messages.clear()
        messages.addAll(serverMessages)
        messages.addAll(remainingLocal)
        messages.forEach { msg ->
            msg.reaction = MessageReactionPrefs.getReaction(this, otherUserId, msg.id)
        }
        Log.d(tag, "applyServerMessages mergedCount=${messages.size} server=${serverMessages.size} local=${remainingLocal.size}")
        adapter.refresh()
    }

    private fun syncListVisibility() {
        if (messages.isEmpty()) {
            emptyText.visibility = View.VISIBLE
            recycler.visibility = View.INVISIBLE
        } else {
            emptyText.visibility = View.GONE
            recycler.visibility = View.VISIBLE
        }
    }

    private fun isServerMessageId(id: String): Boolean = id.all { it.isDigit() }

    private fun hideKeyboard(target: View) {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager ?: return
        imm.hideSoftInputFromWindow(target.windowToken, 0)
    }

    private fun attachSwipeToReply() {
        val callback = object : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.RIGHT or ItemTouchHelper.LEFT) {
            override fun onMove(
                recyclerView: RecyclerView,
                viewHolder: RecyclerView.ViewHolder,
                target: RecyclerView.ViewHolder
            ): Boolean = false

            override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
                val position = viewHolder.bindingAdapterPosition
                val message = adapter.itemAt(position)
                if (message != null) {
                    if (direction == ItemTouchHelper.RIGHT) {
                        replyTarget = message
                        replyText.text = message.text
                        replyBox.visibility = View.VISIBLE
                        recycler.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                    } else if (direction == ItemTouchHelper.LEFT) {
                        // Quick reaction shortcut
                        message.reaction = if (message.reaction == "❤️") null else "❤️"
                        MessageReactionPrefs.setReaction(this@ChatActivity, otherUserId, message.id, message.reaction)
                        recycler.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    }
                }
                adapter.notifyItemChanged(position)
            }
        }
        ItemTouchHelper(callback).attachToRecyclerView(recycler)
    }

    private fun onToolbarMenuClick(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_edit_chat_name -> {
                showEditChatNameDialog()
                true
            }
            R.id.action_clear_chat -> {
                clearChat()
                true
            }
            else -> false
        }
    }

    private fun showEditChatNameDialog() {
        val input = EditText(this).apply {
            setText(currentChatName)
            setSelection(text?.length ?: 0)
            hint = "Contact name"
        }
        AlertDialog.Builder(this)
            .setTitle("Edit chat name")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val name = input.text?.toString()?.trim().orEmpty()
                if (name.isNotBlank()) {
                    ContactAliasPrefs.setAlias(this, otherUserId, name)
                    currentChatName = name
                    findViewById<MaterialToolbar>(R.id.chatToolbar).title = currentChatName
                }
            }
            .setNeutralButton("Reset") { _, _ ->
                ContactAliasPrefs.clearAlias(this, otherUserId)
                currentChatName = intent.getStringExtra(EXTRA_CHAT_NAME) ?: "Chat"
                findViewById<MaterialToolbar>(R.id.chatToolbar).title = currentChatName
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    companion object {
        const val EXTRA_CHAT_ID = "chat_id"
        const val EXTRA_CHAT_NAME = "chat_name"
    }
}
