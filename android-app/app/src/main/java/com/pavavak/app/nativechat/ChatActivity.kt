package com.pavavak.app.nativechat

import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.util.Base64
import android.text.TextUtils
import android.view.MenuItem
import android.view.View
import android.view.HapticFeedbackConstants
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.pavavak.app.AppSecurityPrefs
import com.pavavak.app.AvatarUtils
import com.pavavak.app.R
import com.pavavak.app.data.local.LocalChatStore
import com.pavavak.app.data.local.LocalDatabaseProvider
import com.pavavak.app.data.local.model.LocalMessageSyncStatus
import com.pavavak.app.notifications.NotificationHelper
import com.pavavak.app.notifications.NotificationPrefs
import com.pavavak.app.sync.PendingSyncScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ChatActivity : AppCompatActivity() {
    private val tag = "PaVaVakChat"
    private var decoyMode = false

    private var otherUserId: Int = 0
    private var currentChatName: String = "Chat"
    private var currentChatPhotoBase64: String? = null
    private lateinit var toolbar: MaterialToolbar
    private lateinit var toolbarName: TextView
    private lateinit var toolbarSubtitleInline: TextView
    private lateinit var toolbarAvatarImage: ImageView
    private lateinit var toolbarAvatarFallback: TextView
    private lateinit var messages: MutableList<ChatMessage>
    private lateinit var adapter: MessageAdapter

    private lateinit var replyBox: LinearLayout
    private lateinit var replyText: TextView
    private lateinit var selectionBar: LinearLayout
    private lateinit var selectionCount: TextView
    private lateinit var presenceDot: View
    private lateinit var syncStatusChip: TextView
    private lateinit var progress: ProgressBar
    private lateinit var emptyText: TextView
    private lateinit var recycler: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var localStore: LocalChatStore

    private var replyTarget: ChatMessage? = null
    private var refreshJob: Job? = null
    private var typingGuardJob: Job? = null
    private var presenceRefreshJob: Job? = null
    private var realtimeConnected: Boolean = false
    private var lastServerSignature: String = ""
    private var initialResumeRefreshPending = false
    private var latestPresence: PresenceResult? = null
    private val pendingMessages = mutableListOf<ChatMessage>()
    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@registerForActivityResult
        lifecycleScope.launch {
            val payload = withContext(Dispatchers.IO) { encodeImageAsInlinePayload(uri) }
            if (payload == null) {
                Toast.makeText(this@ChatActivity, "Image too large or unreadable", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val preview = replyTarget?.text?.let(::inlineMessagePreview)
            sendOutgoingMessage(payload, preview)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(savedInstanceState)
            setContentView(R.layout.activity_chat)

        otherUserId = (intent.getStringExtra(EXTRA_CHAT_ID) ?: "0").toIntOrNull() ?: 0
        val chatName = intent.getStringExtra(EXTRA_CHAT_NAME) ?: "Chat"
        currentChatPhotoBase64 = intent.getStringExtra(EXTRA_CHAT_PHOTO)
        currentChatName = ContactAliasPrefs.aliasFor(this, otherUserId, chatName)
        decoyMode = AppSecurityPrefs.isDecoyModeActive(this)

        toolbar = findViewById(R.id.chatToolbar)
        toolbarName = findViewById(R.id.chatToolbarName)
        toolbarSubtitleInline = findViewById(R.id.chatToolbarSubtitleInline)
        toolbarAvatarImage = findViewById(R.id.chatToolbarAvatarImage)
        toolbarAvatarFallback = findViewById(R.id.chatToolbarAvatarFallback)
        toolbar.title = ""
        toolbar.subtitle = "Status unavailable"
        toolbar.setNavigationOnClickListener { finish() }
        toolbar.setOnMenuItemClickListener { onToolbarMenuClick(it) }
        renderToolbarHeader()
        findViewById<MaterialButton>(R.id.attachBtn).setOnClickListener {
            if (decoyMode) {
                Toast.makeText(this, "Decoy mode: sending disabled", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            pickImageLauncher.launch("image/*")
        }
        findViewById<MaterialButton>(R.id.cameraBtn).setOnClickListener {
            Toast.makeText(this, "Camera send: next step", Toast.LENGTH_SHORT).show()
        }

        progress = findViewById(R.id.chatProgress)
        emptyText = findViewById(R.id.chatEmpty)
        recycler = findViewById(R.id.messagesRecycler)
        swipeRefresh = findViewById(R.id.chatSwipeRefresh)
        swipeRefresh.setOnRefreshListener { refreshMessagesSilently(forceFull = true) }
        recycler.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        localStore = LocalChatStore(LocalDatabaseProvider.get(this))

        messages = mutableListOf()
        adapter = MessageAdapter(
            items = messages,
            onLongPress = { message ->
                if (adapter.isSelectionMode()) {
                    adapter.toggleSelection(message.id)
                    updateSelectionBar()
                } else {
                    showMessageActions(message)
                }
            },
            onRetryTap = { message ->
                retryQueuedMessage(message)
            },
            onRemoteMediaTap = { message, full ->
                loadRemoteMedia(message, full)
            }
        )
        recycler.adapter = adapter
        attachSwipeToReply()

        replyBox = findViewById(R.id.replyPreviewBox)
        replyText = findViewById(R.id.replyPreviewText)
        selectionBar = findViewById(R.id.selectionBar)
        selectionCount = findViewById(R.id.selectionCount)
        presenceDot = findViewById(R.id.presenceDot)
        syncStatusChip = findViewById(R.id.syncStatusChip)

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

            val preview = replyTarget?.text?.let(::inlineMessagePreview)
            sendOutgoingMessage(text, preview)
            input.text?.clear()
            input.clearFocus()
            hideKeyboard(input)
        }

            loadMessages()
            initialResumeRefreshPending = true
        } catch (e: Exception) {
            logChatError("onCreate", e)
            Toast.makeText(this, "Chat opened with errors. Pull to refresh.", Toast.LENGTH_LONG).show()
            runCatching {
                progress = findViewById(R.id.chatProgress)
                emptyText = findViewById(R.id.chatEmpty)
                recycler = findViewById(R.id.messagesRecycler)
                swipeRefresh = findViewById(R.id.chatSwipeRefresh)
                progress.visibility = View.GONE
                emptyText.visibility = View.VISIBLE
                emptyText.text = "Chat initialization issue. Pull to refresh."
                recycler.visibility = View.INVISIBLE
                swipeRefresh.setOnRefreshListener { refreshMessagesSilently(forceFull = true) }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (!::toolbar.isInitialized || !::localStore.isInitialized || !::syncStatusChip.isInitialized) {
            return
        }
        NotificationPrefs.setActiveChatId(this, otherUserId)
        NotificationHelper.cancelChatNotification(this, otherUserId)
        startAutoRefresh()
        lifecycleScope.launch {
            realtimeConnected = NativeApi.connectRealtime(otherUserId, object : NativeApi.RealtimeListener {
                override fun onNewMessage(message: ChatMessage) {
                    runOnUiThread { applyRealtimeNewMessage(message) }
                }

                override fun onMessageDelivered(messageId: String) {
                    runOnUiThread { applyRealtimeDelivered(messageId) }
                }

                override fun onMessageRead(messageId: String) {
                    runOnUiThread { applyRealtimeRead(messageId) }
                }

                override fun onMessageEdited(messageId: String, content: String, isEdited: Boolean, remoteMediaId: String?) {
                    runOnUiThread { applyRealtimeEdited(messageId, content, isEdited, remoteMediaId) }
                }
            })
        }
        enqueuePendingIfAny()
        startPresenceRefresh()
        updateToolbarPresence()
        if (initialResumeRefreshPending) {
            initialResumeRefreshPending = false
        } else {
            lifecycleScope.launch { refreshMessagesSilently(forceFull = true) }
        }
    }

    override fun onPause() {
        super.onPause()
        NotificationPrefs.setActiveChatId(this, null)
        refreshJob?.cancel()
        refreshJob = null
        typingGuardJob?.cancel()
        typingGuardJob = null
        presenceRefreshJob?.cancel()
        presenceRefreshJob = null
        NativeApi.disconnectRealtime()
        realtimeConnected = false
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
            toolbar.subtitle = "Decoy mode"
            syncStatusChip.visibility = View.GONE
            presenceDot.visibility = View.GONE
            return
        }
        progress.visibility = View.VISIBLE
        swipeRefresh.isRefreshing = false
        emptyText.visibility = View.GONE
        recycler.visibility = View.INVISIBLE

        lifecycleScope.launch {
            try {
            val cached = withContext(Dispatchers.IO) { localStore.readCachedMessages(otherUserId) }
            if (cached.isNotEmpty()) {
                messages.clear()
                messages.addAll(cached)
                pendingMessages.clear()
                pendingMessages.addAll(messages.filter { it.isMine && !isServerMessageId(it.id) })
                adapter.refresh()
                syncListVisibility()
                progress.visibility = View.GONE
                updateToolbarPresence()
            }

            val list = NativeApi.getMessages(otherUserId)
            Log.d(tag, "loadMessages fullSyncCount=${list.size} cached=${cached.size} pendingCount=${pendingMessages.size}")
            markIncomingAsRead(list)
            val signature = buildServerSignature(list)
            val changed = signature != lastServerSignature || cached.isEmpty()
            if (changed) {
                applyServerMessages(list)
                syncListVisibility()
                withContext(Dispatchers.IO) {
                    localStore.cacheMessages(otherUserId, messages)
                }
                lastServerSignature = signature
            }

            progress.visibility = View.GONE
            if (messages.isNotEmpty()) {
                recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))
            }
            updateToolbarPresence()
            } catch (e: Exception) {
                logChatError("loadMessages", e)
                progress.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                updateToolbarPresence()
            }
        }
    }

    private fun refreshMessagesSilently(forceFull: Boolean = false) {
        if (decoyMode) {
            swipeRefresh.isRefreshing = false
            return
        }
        lifecycleScope.launch {
            try {
            val wasAtBottom = isAtBottom()
            val prevLastId = messages.lastOrNull()?.id
            val latestServerMessageId = if (forceFull) {
                null
            } else {
                withContext(Dispatchers.IO) { localStore.latestServerMessageId(otherUserId) }
            }
            val list = NativeApi.getMessages(otherUserId, latestServerMessageId)
            Log.d(
                tag,
                "refreshMessagesSilently serverCount=${list.size} pendingCount=${pendingMessages.size} forceFull=$forceFull afterId=${latestServerMessageId ?: 0}"
            )
            if (forceFull) {
                markIncomingAsRead(list)
                val signature = buildServerSignature(list)
                val changed = signature != lastServerSignature
                if (changed) {
                    applyServerMessages(list)
                    withContext(Dispatchers.IO) {
                        localStore.cacheMessages(otherUserId, messages)
                    }
                    lastServerSignature = signature
                }
            } else if (list.isNotEmpty()) {
                mergeIncrementalServerMessages(list)
                markIncomingAsRead(list)
                withContext(Dispatchers.IO) {
                    localStore.cacheMessages(otherUserId, messages)
                }
                lastServerSignature = buildServerSignature(messages.filter { isServerMessageId(it.id) })
            }

            if (forceFull || list.isNotEmpty()) {
                val newLastId = messages.lastOrNull()?.id
                val hasNewTail = newLastId != null && newLastId != prevLastId
                if (messages.isNotEmpty() && (wasAtBottom || hasNewTail || forceFull)) {
                    recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))
                }
            }
            swipeRefresh.isRefreshing = false
            syncListVisibility()
            updateToolbarPresence()
            } catch (e: Exception) {
                logChatError("refreshMessagesSilently", e)
                swipeRefresh.isRefreshing = false
                updateToolbarPresence()
            }
        }
    }

    private fun startAutoRefresh() {
        if (refreshJob != null) return
        refreshJob = lifecycleScope.launch {
            while (true) {
                // Realtime socket is primary. Polling is only fallback.
                delay(if (realtimeConnected) 60_000 else 12_000)
                refreshMessagesSilently()
            }
        }
    }

    private fun startPresenceRefresh() {
        if (decoyMode || presenceRefreshJob != null) return
        presenceRefreshJob = lifecycleScope.launch {
            while (true) {
                refreshPresence()
                delay(if (realtimeConnected) 20_000 else 8_000)
            }
        }
    }

    private suspend fun refreshPresence() {
        if (decoyMode) return
        latestPresence = NativeApi.getPresence(otherUserId)
        updateToolbarPresence()
    }

    private fun enqueuePendingIfAny() {
        lifecycleScope.launch(Dispatchers.IO) {
            runCatching {
                val pending = localStore.readPendingMessages(otherUserId)
                if (pending.isNotEmpty()) {
                    PendingSyncScheduler.enqueueNow(this@ChatActivity)
                }
            }
        }
    }

    private fun markIncomingAsRead(list: List<ChatMessage>) {
        val hasUnreadIncoming = list.any { !it.isMine && !it.isRead }
        if (!hasUnreadIncoming) return
        lifecycleScope.launch(Dispatchers.IO) {
            NativeApi.markConversationRead(otherUserId)
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
        val actions = mutableListOf<Pair<String, () -> Unit>>()
        actions.add("Reply" to {
            replyTarget = message
            replyText.text = inlineMessagePreview(message.text)
            replyBox.visibility = View.VISIBLE
        })
        actions.add("React" to { pickReaction(message) })
        if (message.isMine && !isServerMessageId(message.id) && (message.time == "failed" || message.time == "queued")) {
            actions.add("Retry now" to { retryQueuedMessage(message) })
        }
        if (message.isMine && isServerMessageId(message.id) && message.remoteMediaId.isNullOrBlank()) {
            actions.add("Edit message" to { showEditMessageDialog(message) })
        }
        if (isServerMessageId(message.id)) {
            actions.add("Delete for everyone" to { deleteSingleLive(message, "all") })
            actions.add("Delete for me" to { deleteSingleLive(message, "me") })
        } else {
            actions.add("Delete message" to { deleteSingleLive(message, "me") })
        }
        actions.add("Select" to {
            adapter.enterSelection(message.id)
            updateSelectionBar()
        })
        val options = actions.map { it.first }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Message actions")
            .setItems(options) { _, which ->
                actions[which].second.invoke()
            }
            .show()
    }

    private fun showEditMessageDialog(message: ChatMessage) {
        val current = if (isRemoteImagePayload(message.text)) "" else message.text
        val input = EditText(this).apply {
            setText(current)
            setSelection(text.length)
        }
        AlertDialog.Builder(this)
            .setTitle("Edit message")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val updated = input.text?.toString()?.trim().orEmpty()
                if (updated.isBlank()) {
                    Toast.makeText(this, "Message cannot be empty", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                lifecycleScope.launch {
                    val result = NativeApi.editMessage(message.id, updated)
                    if (!result.success) {
                        Toast.makeText(this@ChatActivity, result.error.ifBlank { "Edit failed" }, Toast.LENGTH_SHORT).show()
                        return@launch
                    }
                    refreshMessagesSilently(forceFull = true)
                }
            }
            .show()
    }

    private fun pickReaction(message: ChatMessage) {
        val emojis = arrayOf("ðŸ‘", "â¤ï¸", "ðŸ˜‚", "ðŸ˜®", "ðŸ˜¢", "ðŸ™", "âŒ Remove")
        AlertDialog.Builder(this)
            .setTitle("React")
            .setItems(emojis) { _, which ->
                message.reaction = if (which == emojis.lastIndex) null else emojis[which]
                MessageReactionPrefs.setReaction(this, otherUserId, message.id, message.reaction)
                adapter.refresh()
                if (isServerMessageId(message.id)) {
                    lifecycleScope.launch(Dispatchers.IO) {
                        NativeApi.sendReaction(otherUserId, message.id, message.reaction)
                    }
                    lifecycleScope.launch { refreshMessagesSilently(forceFull = true) }
                }
            }
            .show()
    }

    private fun deleteSingleLive(message: ChatMessage, scope: String = "all") {
        if (!isServerMessageId(message.id)) {
            pendingMessages.removeAll { it.id == message.id }
            messages.removeAll { it.id == message.id }
            MessageReactionPrefs.clearReactionsForMessages(this, otherUserId, listOf(message.id))
            adapter.refresh()
            updateSelectionBar()
            return
        }
        lifecycleScope.launch {
            val ok = NativeApi.deleteMessage(message.id, scope)
            if (!ok) {
                Toast.makeText(this@ChatActivity, "Delete failed", Toast.LENGTH_SHORT).show()
                return@launch
            }
            MessageReactionPrefs.clearReactionsForMessages(this@ChatActivity, otherUserId, listOf(message.id))
            loadMessages()
        }
    }

    private fun loadRemoteMedia(message: ChatMessage, full: Boolean) {
        val mediaId = message.remoteMediaId ?: return
        lifecycleScope.launch {
            val base64 = withContext(Dispatchers.IO) {
                NativeApi.fetchMediaBase64(mediaId, if (full) "full" else "preview")
            }
            if (base64.isNullOrBlank()) {
                Toast.makeText(this@ChatActivity, "Failed to load image", Toast.LENGTH_SHORT).show()
                return@launch
            }
            if (full) {
                message.remoteFullBase64 = base64
            } else {
                message.remotePreviewBase64 = base64
            }
            adapter.refresh()
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

    private fun retryQueuedMessage(message: ChatMessage) {
        if (!message.isMine || isServerMessageId(message.id)) return
        if (pendingMessages.none { it.id == message.id }) {
            pendingMessages.add(message)
        }
        lifecycleScope.launch(Dispatchers.IO) {
            localStore.retryPendingNow(
                localId = message.id,
                chatId = otherUserId,
                contentPlain = message.text,
                replyPreviewPlain = message.replyPreview
            )
        }
        message.time = "queued"
        adapter.refresh()
        PendingSyncScheduler.enqueueNow(this)
        updateToolbarPresence()
        Toast.makeText(this, "Retry scheduled", Toast.LENGTH_SHORT).show()
    }

    private fun sendOutgoingMessage(content: String, replyPreview: String?) {
        if (content.isBlank()) return
        val pendingLocal = ChatMessage(
            id = UUID.randomUUID().toString(),
            isMine = true,
            text = content,
            time = "sending...",
            replyPreview = replyPreview
        )
        messages.add(pendingLocal)
        pendingMessages.add(pendingLocal)
        adapter.refresh()
        progress.visibility = View.GONE
        emptyText.visibility = View.GONE
        recycler.visibility = View.VISIBLE
        recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))
        replyTarget = null
        replyBox.visibility = View.GONE

        lifecycleScope.launch(Dispatchers.IO) {
            localStore.upsertMessage(
                messageId = pendingLocal.id,
                chatId = otherUserId,
                isMine = true,
                contentPlain = pendingLocal.text,
                replyPreviewPlain = pendingLocal.replyPreview,
                sentAtRaw = null,
                sentAtDisplay = pendingLocal.time,
                sentAtEpochMs = System.currentTimeMillis(),
                isDelivered = false,
                isRead = false,
                reaction = pendingLocal.reaction,
                syncStatus = LocalMessageSyncStatus.QUEUED,
                nowMs = System.currentTimeMillis()
            )
        }

        lifecycleScope.launch {
            val sent = NativeApi.sendMessage(otherUserId, content, replyPreview)
            Log.d(tag, "Send result success=${sent.success} error='${sent.error}' hasMessage=${sent.message != null}")
            if (!sent.success || sent.message == null) {
                pendingLocal.time = "queued"
                adapter.refresh()
                lifecycleScope.launch(Dispatchers.IO) {
                    localStore.enqueuePendingMessage(
                        localId = pendingLocal.id,
                        chatId = otherUserId,
                        contentPlain = pendingLocal.text,
                        replyPreviewPlain = pendingLocal.replyPreview,
                        createdAtMs = System.currentTimeMillis()
                    )
                    localStore.markPendingQueued(pendingLocal.id, sent.error.ifBlank { "Network unavailable" })
                }
                PendingSyncScheduler.enqueueNow(this@ChatActivity)
                updateToolbarPresence()
                Toast.makeText(
                    this@ChatActivity,
                    "Network unavailable. Message queued.",
                    Toast.LENGTH_SHORT
                ).show()
                return@launch
            }
            pendingLocal.time = if (sent.message.time.isBlank()) "queued" else sent.message.time
            pendingLocal.isDelivered = sent.message.isDelivered
            pendingLocal.isRead = sent.message.isRead
            adapter.refresh()
            lifecycleScope.launch(Dispatchers.IO) {
                localStore.markPendingSynced(pendingLocal.id, otherUserId, sent.message)
            }
            updateToolbarPresence()
            refreshMessagesSilently(forceFull = true)
        }
    }

    private fun encodeImageAsInlinePayload(uri: Uri): String? {
        val rawBytes = try {
            contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
        if (rawBytes != null && rawBytes.isNotEmpty() && rawBytes.size <= 2_500_000) {
            val direct = Base64.encodeToString(rawBytes, Base64.NO_WRAP)
            return INLINE_IMAGE_PREFIX + direct
        }

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            if (rawBytes != null && rawBytes.isNotEmpty()) {
                val fallback = Base64.encodeToString(rawBytes, Base64.NO_WRAP)
                return INLINE_IMAGE_PREFIX + fallback
            }
            return null
        }

        val maxDimension = 1600
        var sample = 1
        var width = bounds.outWidth
        var height = bounds.outHeight
        while (width > maxDimension || height > maxDimension) {
            width /= 2
            height /= 2
            sample *= 2
        }

        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample.coerceAtLeast(1) }
        val bitmap = contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOpts)
        } ?: return null

        val out = ByteArrayOutputStream()
        var quality = 84
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
        while (out.size() > 2_000_000 && quality > 20) {
            out.reset()
            quality -= 8
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
        }
        bitmap.recycle()
        if (out.size() > 2_500_000) return null

        val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        return INLINE_IMAGE_PREFIX + b64
    }

    private fun buildServerSignature(list: List<ChatMessage>): String {
        if (list.isEmpty()) return "empty"
        val sb = StringBuilder(list.size * 20)
        list.forEach { m ->
            sb.append(m.id)
                .append(':')
                .append(if (m.isRead) '1' else '0')
                .append(if (m.isDelivered) '1' else '0')
                .append(if (m.isEdited) '1' else '0')
                .append(':')
                .append((m.reaction ?: "").hashCode())
                .append(':')
                .append(m.time.hashCode())
                .append(':')
                .append(m.text.hashCode())
                .append('|')
        }
        return sb.toString()
    }

    private fun mergeIncrementalServerMessages(incomingMessages: List<ChatMessage>) {
        if (incomingMessages.isEmpty()) return
        val mergedServer = LinkedHashMap<String, ChatMessage>()
        messages.filter { isServerMessageId(it.id) }.forEach { mergedServer[it.id] = it }
        incomingMessages.forEach { msg ->
            val existing = mergedServer[msg.id]
            if (existing != null && msg.reaction.isNullOrBlank() && !existing.reaction.isNullOrBlank()) {
                msg.reaction = existing.reaction
            }
            mergedServer[msg.id] = msg
        }

        val sortedServer = mergedServer.values.sortedWith(
            compareBy<ChatMessage> { it.id.toIntOrNull() ?: Int.MAX_VALUE }
                .thenBy { it.time }
        )

        messages.clear()
        messages.addAll(sortedServer)
        messages.addAll(pendingMessages)
        messages.forEach { msg ->
            val localReaction = MessageReactionPrefs.getReaction(this, otherUserId, msg.id)
            if (!localReaction.isNullOrBlank()) {
                msg.reaction = localReaction
            }
        }
        adapter.refresh()
    }

    private fun applyServerMessages(serverMessages: List<ChatMessage>) {
        val remainingLocal = mutableListOf<ChatMessage>()
        val unmatchedServerMine = serverMessages.toMutableList()

        pendingMessages.forEach { local ->
            if (local.time == "failed") {
                remainingLocal.add(local)
                return@forEach
            }
            val match = unmatchedServerMine.firstOrNull { it.isMine && it.text == local.text }
            if (match == null) {
                remainingLocal.add(local)
                return@forEach
            }

            // Preserve local UI state (reply/reaction) onto resolved server message.
            if (match.replyPreview.isNullOrBlank() && !local.replyPreview.isNullOrBlank()) {
                match.replyPreview = local.replyPreview
            }
            if (match.reaction.isNullOrBlank() && !local.reaction.isNullOrBlank()) {
                match.reaction = local.reaction
            }
            unmatchedServerMine.remove(match)
        }
        pendingMessages.clear()
        pendingMessages.addAll(remainingLocal)

        messages.clear()
        messages.addAll(serverMessages)
        messages.addAll(remainingLocal)
        messages.forEach { msg ->
            val localReaction = MessageReactionPrefs.getReaction(this, otherUserId, msg.id)
            if (!localReaction.isNullOrBlank()) {
                msg.reaction = localReaction
            }
        }
        Log.d(tag, "applyServerMessages mergedCount=${messages.size} server=${serverMessages.size} local=${remainingLocal.size}")
        adapter.refresh()
    }

    private fun applyRealtimeNewMessage(message: ChatMessage) {
        val idx = messages.indexOfFirst { it.id == message.id }
        if (idx >= 0) {
            messages[idx] = message
        } else {
            messages.add(message)
        }
        val signature = buildServerSignature(messages.filter { isServerMessageId(it.id) })
        lastServerSignature = signature
        adapter.refresh()
        syncListVisibility()
        if (isAtBottom() || !message.isMine) {
            recycler.scrollToPosition((messages.size - 1).coerceAtLeast(0))
        }
        if (!message.isMine && isServerMessageId(message.id)) {
            lifecycleScope.launch(Dispatchers.IO) {
                NativeApi.markMessageRead(message.id)
            }
        }
        updateToolbarPresence()
        lifecycleScope.launch(Dispatchers.IO) { localStore.cacheMessages(otherUserId, messages) }
    }

    private fun applyRealtimeDelivered(messageId: String) {
        val idx = messages.indexOfFirst { it.id == messageId }
        if (idx < 0) return
        val msg = messages[idx]
        if (!msg.isMine) return
        msg.isDelivered = true
        adapter.refresh()
        updateToolbarPresence()
    }

    private fun applyRealtimeRead(messageId: String) {
        val idx = messages.indexOfFirst { it.id == messageId }
        if (idx < 0) return
        val msg = messages[idx]
        if (!msg.isMine) return
        msg.isDelivered = true
        msg.isRead = true
        adapter.refresh()
        updateToolbarPresence()
    }

    private fun applyRealtimeEdited(messageId: String, content: String, isEdited: Boolean, remoteMediaId: String?) {
        val idx = messages.indexOfFirst { it.id == messageId }
        if (idx < 0) return
        val msg = messages[idx]
        msg.text = content
        msg.isEdited = isEdited
        msg.remoteMediaId = remoteMediaId
        if (remoteMediaId != null) {
            msg.remotePreviewBase64 = null
            msg.remoteFullBase64 = null
        }
        adapter.refresh()
        lifecycleScope.launch(Dispatchers.IO) { localStore.cacheMessages(otherUserId, messages) }
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

    private fun isAtBottom(): Boolean {
        val lm = recycler.layoutManager as? LinearLayoutManager ?: return true
        val total = adapter.itemCount
        if (total <= 1) return true
        val lastVisible = lm.findLastCompletelyVisibleItemPosition()
        return lastVisible >= total - 2
    }

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
                        replyText.text = inlineMessagePreview(message.text)
                        replyBox.visibility = View.VISIBLE
                        recycler.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                    } else if (direction == ItemTouchHelper.LEFT) {
                        // Quick reaction shortcut
                        message.reaction = if (message.reaction == "??") null else "??"
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
            R.id.action_toggle_chat_photo -> {
                toggleChatPhotoVisibility()
                true
            }
            R.id.action_refresh_status -> {
                refreshMessagesSilently(forceFull = true)
                true
            }
            R.id.action_presence_info -> {
                showPresenceInfo()
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
                    renderToolbarHeader()
                }
            }
            .setNeutralButton("Reset") { _, _ ->
                ContactAliasPrefs.clearAlias(this, otherUserId)
                currentChatName = intent.getStringExtra(EXTRA_CHAT_NAME) ?: "Chat"
                renderToolbarHeader()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showPresenceInfo() {
        AlertDialog.Builder(this)
            .setTitle("Presence info")
            .setMessage(
                "Presence now comes from the server heartbeat. " +
                    "If the user hides last seen, you will only see online when they are active."
            )
            .setPositiveButton("OK", null)
            .show()
    }

    private fun toggleChatPhotoVisibility() {
        val currentlyHidden = AvatarVisibilityPrefs.isHidden(this, otherUserId)
        AvatarVisibilityPrefs.setHidden(this, otherUserId, !currentlyHidden)
        renderToolbarHeader()
        Toast.makeText(
            this,
            if (currentlyHidden) "Profile photo shown for this contact" else "Profile photo hidden for this contact",
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun updateToolbarPresence() {
        lifecycleScope.launch {
            try {
                val queuedCount = withContext(Dispatchers.IO) {
                    localStore.readPendingMessages(otherUserId).size
                }
                val presence = latestPresence
                val base = when {
                    decoyMode -> "Decoy mode"
                    presence == null || !presence.success -> "Status unavailable"
                    presence.isOnline -> "Online"
                    presence.isLastSeenHidden -> "Last seen hidden"
                    !presence.lastSeenAt.isNullOrBlank() -> "Last seen ${formatPresenceTime(presence.lastSeenAt)}"
                    else -> "Offline"
                }
                val withQueue = if (queuedCount > 0) "$base | Queued: $queuedCount" else base
                toolbar.subtitle = withQueue
                toolbarSubtitleInline.text = base
                updateSyncStatusChip(
                    queuedCount = queuedCount,
                    syncing = false,
                    online = presence?.isOnline == true
                )
                enforceTypingSubtitleTimeout()
            } catch (e: Exception) {
                logChatError("updateToolbarPresence", e)
                toolbar.subtitle = "Status unavailable"
                toolbarSubtitleInline.text = "Status unavailable"
                updateSyncStatusChip(queuedCount = 0, syncing = false, online = false)
            }
        }
    }

    private fun logChatError(stage: String, error: Throwable) {
        Log.e(tag, "$stage failed: ${error.message}", error)
        try {
            val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
            val stamp = sdf.format(Date())
            val logFile = File(filesDir, "chat_crash.log")
            val stack = android.util.Log.getStackTraceString(error)
            logFile.appendText("[$stamp] $stage: ${error.message}\n$stack\n\n")
        } catch (_: Exception) {
        }
    }

    private fun updateSyncStatusChip(queuedCount: Int, syncing: Boolean, online: Boolean) {
        if (decoyMode) {
            syncStatusChip.visibility = View.GONE
            presenceDot.visibility = View.GONE
            return
        }
        // Keep UI calm: show chip only when there is actionable sync state.
        syncStatusChip.visibility = if (queuedCount > 0) View.VISIBLE else View.GONE
        presenceDot.visibility = View.VISIBLE
        syncStatusChip.text = when {
            syncing && queuedCount > 0 -> "Sending $queuedCount queued..."
            queuedCount > 0 -> "Queued: $queuedCount"
            else -> ""
        }
        val colorRes = when {
            online -> R.color.presence_online
            syncing || queuedCount > 0 -> R.color.presence_syncing
            else -> R.color.presence_offline
        }
        presenceDot.backgroundTintList = ColorStateList.valueOf(
            ContextCompat.getColor(this, colorRes)
        )
    }

    private fun enforceTypingSubtitleTimeout() {
        val subtitle = toolbar.subtitle?.toString().orEmpty()
        if (!subtitle.contains("typing", ignoreCase = true)) {
            typingGuardJob?.cancel()
            typingGuardJob = null
            return
        }
        if (typingGuardJob?.isActive == true) return
        typingGuardJob = lifecycleScope.launch {
            delay(8_000)
            val current = toolbar.subtitle?.toString().orEmpty()
            if (current.contains("typing", ignoreCase = true)) {
                updateToolbarPresence()
            }
        }
    }

    private fun formatPresenceTime(iso: String): String {
        return NativeApi.formatTime(iso).ifBlank { "recently" }
    }

    private fun renderToolbarHeader() {
        val title = if (decoyMode) "$currentChatName (Decoy)" else currentChatName
        toolbarName.text = title
        toolbarAvatarFallback.text = currentChatName.take(1).uppercase()
        val photoHidden = AvatarVisibilityPrefs.isHidden(this, otherUserId)
        toolbar.menu?.findItem(R.id.action_toggle_chat_photo)?.title =
            if (photoHidden) "Show profile photo" else "Hide profile photo"
        val avatar = if (photoHidden) null else AvatarUtils.decodeBase64Avatar(currentChatPhotoBase64)
        if (avatar != null) {
            toolbarAvatarImage.setImageBitmap(avatar)
            toolbarAvatarImage.visibility = View.VISIBLE
            toolbarAvatarFallback.visibility = View.GONE
        } else {
            toolbarAvatarImage.setImageDrawable(null)
            toolbarAvatarImage.visibility = View.GONE
            toolbarAvatarFallback.visibility = View.VISIBLE
        }
    }

    companion object {
        const val EXTRA_CHAT_ID = "chat_id"
        const val EXTRA_CHAT_NAME = "chat_name"
        const val EXTRA_CHAT_PHOTO = "chat_photo"
    }
}



