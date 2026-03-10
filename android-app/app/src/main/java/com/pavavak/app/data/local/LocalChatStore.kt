package com.pavavak.app.data.local

import com.pavavak.app.data.local.dao.ConversationDao
import com.pavavak.app.data.local.dao.MessageDao
import com.pavavak.app.data.local.dao.PendingMessageDao
import com.pavavak.app.data.local.entity.ConversationEntity
import com.pavavak.app.data.local.entity.MessageEntity
import com.pavavak.app.data.local.entity.PendingMessageEntity
import com.pavavak.app.data.local.model.LocalMessageSyncStatus
import com.pavavak.app.data.local.model.PendingSyncStatus
import com.pavavak.app.nativechat.ChatMessage
import com.pavavak.app.nativechat.ChatSummary
import com.pavavak.app.security.LocalMessageCipher
import kotlinx.coroutines.flow.Flow

class LocalChatStore(private val db: AppLocalDatabase) {
    data class PendingDraft(
        val localId: String,
        val chatId: Int,
        val content: String,
        val replyPreview: String?,
        val retryCount: Int
    )

    private val conversationDao: ConversationDao = db.conversationDao()
    private val messageDao: MessageDao = db.messageDao()
    private val pendingDao: PendingMessageDao = db.pendingMessageDao()

    fun observeConversations(): Flow<List<ConversationEntity>> = conversationDao.observeAll()

    fun observeMessages(chatId: Int): Flow<List<MessageEntity>> = messageDao.observeByChat(chatId)

    suspend fun upsertConversation(
        chatId: Int,
        displayName: String,
        lastMessagePlain: String?,
        lastMessageTimeRaw: String?,
        lastMessageTimeDisplay: String?,
        unreadCount: Int,
        nowMs: Long
    ) {
        conversationDao.upsert(
            ConversationEntity(
                chatId = chatId,
                displayName = displayName,
                lastMessageCipher = lastMessagePlain?.let { LocalMessageCipher.encrypt(it) },
                lastMessageTimeRaw = lastMessageTimeRaw,
                lastMessageTimeDisplay = lastMessageTimeDisplay,
                unreadCount = unreadCount,
                updatedAt = nowMs
            )
        )
    }

    suspend fun upsertMessage(
        messageId: String,
        chatId: Int,
        isMine: Boolean,
        contentPlain: String,
        replyPreviewPlain: String?,
        sentAtRaw: String?,
        sentAtDisplay: String?,
        sentAtEpochMs: Long?,
        isDelivered: Boolean,
        isRead: Boolean,
        reaction: String?,
        syncStatus: LocalMessageSyncStatus,
        nowMs: Long
    ) {
        messageDao.upsert(
            MessageEntity(
                messageId = messageId,
                chatId = chatId,
                isMine = isMine,
                contentCipher = LocalMessageCipher.encrypt(contentPlain),
                replyPreviewCipher = replyPreviewPlain?.let { LocalMessageCipher.encrypt(it) },
                sentAtRaw = sentAtRaw,
                sentAtDisplay = sentAtDisplay,
                sentAtEpochMs = sentAtEpochMs ?: nowMs,
                isDelivered = isDelivered,
                isRead = isRead,
                reaction = reaction,
                syncStatus = syncStatus,
                updatedAt = nowMs
            )
        )
    }

    suspend fun enqueuePendingMessage(
        localId: String,
        chatId: Int,
        contentPlain: String,
        replyPreviewPlain: String?,
        createdAtMs: Long
    ) {
        pendingDao.upsert(
            PendingMessageEntity(
                localId = localId,
                chatId = chatId,
                contentCipher = LocalMessageCipher.encrypt(contentPlain),
                replyPreviewCipher = replyPreviewPlain?.let { LocalMessageCipher.encrypt(it) },
                createdAt = createdAtMs,
                retryCount = 0,
                nextRetryAt = null,
                status = PendingSyncStatus.QUEUED,
                lastError = null
            )
        )
    }

    suspend fun cacheConversations(chats: List<ChatSummary>) {
        val now = System.currentTimeMillis()
        chats.forEachIndexed { idx, c ->
            val chatId = c.chatId.toIntOrNull() ?: return@forEachIndexed
            val sortEpoch = if (c.lastSentAtEpochMs > 0L) c.lastSentAtEpochMs else now - idx
            upsertConversation(
                chatId = chatId,
                displayName = c.name,
                lastMessagePlain = c.lastMessage,
                lastMessageTimeRaw = null,
                lastMessageTimeDisplay = c.lastTime,
                unreadCount = c.unreadCount,
                nowMs = sortEpoch
            )
        }
    }

    suspend fun readCachedConversations(): List<ChatSummary> {
        return conversationDao.getAll().map { e ->
            ChatSummary(
                chatId = e.chatId.toString(),
                name = e.displayName,
                lastMessage = LocalMessageCipher.decrypt(e.lastMessageCipher).orEmpty(),
                lastTime = e.lastMessageTimeDisplay.orEmpty(),
                unreadCount = e.unreadCount,
                lastSentAtEpochMs = e.updatedAt
            )
        }
    }

    suspend fun cacheMessages(chatId: Int, list: List<ChatMessage>) {
        val now = System.currentTimeMillis()
        list.forEachIndexed { idx, m ->
            upsertMessage(
                messageId = m.id,
                chatId = chatId,
                isMine = m.isMine,
                contentPlain = m.text,
                replyPreviewPlain = m.replyPreview,
                sentAtRaw = null,
                sentAtDisplay = m.time,
                sentAtEpochMs = null,
                isDelivered = m.isDelivered,
                isRead = m.isRead,
                reaction = m.reaction,
                syncStatus = LocalMessageSyncStatus.SYNCED,
                nowMs = now + idx
            )
        }
    }

    suspend fun readCachedMessages(chatId: Int): List<ChatMessage> {
        return messageDao.getByChat(chatId).map { e ->
            ChatMessage(
                id = e.messageId,
                isMine = e.isMine,
                text = LocalMessageCipher.decrypt(e.contentCipher).orEmpty(),
                time = e.sentAtDisplay.orEmpty(),
                isDelivered = e.isDelivered,
                isRead = e.isRead,
                replyPreview = LocalMessageCipher.decrypt(e.replyPreviewCipher),
                reaction = e.reaction
            )
        }
    }

    suspend fun readPendingMessages(chatId: Int): List<PendingDraft> {
        return pendingDao.getByChat(chatId)
            .filter { it.status == PendingSyncStatus.QUEUED || it.status == PendingSyncStatus.RETRYING }
            .map { e ->
                PendingDraft(
                    localId = e.localId,
                    chatId = e.chatId,
                    content = LocalMessageCipher.decrypt(e.contentCipher).orEmpty(),
                    replyPreview = LocalMessageCipher.decrypt(e.replyPreviewCipher),
                    retryCount = e.retryCount
                )
            }
    }

    suspend fun readAllPendingMessages(): List<PendingDraft> {
        return pendingDao.getReadyForSync().map { e ->
            PendingDraft(
                localId = e.localId,
                chatId = e.chatId,
                content = LocalMessageCipher.decrypt(e.contentCipher).orEmpty(),
                replyPreview = LocalMessageCipher.decrypt(e.replyPreviewCipher),
                retryCount = e.retryCount
            )
        }
    }

    suspend fun markPendingRetrying(localId: String) {
        val current = pendingDao.getById(localId)
        val retryCount = (current?.retryCount ?: 0) + 1
        pendingDao.updateState(
            localId = localId,
            status = PendingSyncStatus.RETRYING,
            retryCount = retryCount,
            nextRetryAt = null,
            lastError = null
        )
        messageDao.updateDisplayAndSyncStatus(
            messageId = localId,
            displayTime = "sending...",
            syncStatus = LocalMessageSyncStatus.QUEUED,
            updatedAt = System.currentTimeMillis()
        )
    }

    suspend fun markPendingQueued(localId: String, error: String?) {
        val current = pendingDao.getById(localId)
        val retryCount = current?.retryCount ?: 0
        pendingDao.updateState(
            localId = localId,
            status = PendingSyncStatus.QUEUED,
            retryCount = retryCount,
            nextRetryAt = null,
            lastError = error
        )
        messageDao.updateDisplayAndSyncStatus(
            messageId = localId,
            displayTime = "queued",
            syncStatus = LocalMessageSyncStatus.QUEUED,
            updatedAt = System.currentTimeMillis()
        )
    }

    suspend fun markPendingFailed(localId: String, error: String?) {
        val current = pendingDao.getById(localId)
        val retryCount = current?.retryCount ?: 0
        pendingDao.updateState(
            localId = localId,
            status = PendingSyncStatus.FAILED,
            retryCount = retryCount,
            nextRetryAt = null,
            lastError = error
        )
        messageDao.updateDisplayAndSyncStatus(
            messageId = localId,
            displayTime = "failed",
            syncStatus = LocalMessageSyncStatus.FAILED,
            updatedAt = System.currentTimeMillis()
        )
    }

    suspend fun retryPendingNow(
        localId: String,
        chatId: Int,
        contentPlain: String,
        replyPreviewPlain: String?
    ) {
        val existing = pendingDao.getById(localId)
        if (existing == null) {
            enqueuePendingMessage(
                localId = localId,
                chatId = chatId,
                contentPlain = contentPlain,
                replyPreviewPlain = replyPreviewPlain,
                createdAtMs = System.currentTimeMillis()
            )
        } else {
            pendingDao.updateState(
                localId = localId,
                status = PendingSyncStatus.QUEUED,
                retryCount = existing.retryCount,
                nextRetryAt = null,
                lastError = null
            )
        }
        messageDao.updateDisplayAndSyncStatus(
            messageId = localId,
            displayTime = "queued",
            syncStatus = LocalMessageSyncStatus.QUEUED,
            updatedAt = System.currentTimeMillis()
        )
    }

    suspend fun markPendingSynced(localId: String, chatId: Int, serverMessage: ChatMessage?) {
        pendingDao.delete(localId)
        if (serverMessage == null) {
            messageDao.updateSyncStatus(
                messageId = localId,
                syncStatus = LocalMessageSyncStatus.SYNCED,
                updatedAt = System.currentTimeMillis()
            )
            return
        }

        messageDao.deleteById(localId)
        upsertMessage(
            messageId = serverMessage.id,
            chatId = chatId,
            isMine = serverMessage.isMine,
            contentPlain = serverMessage.text,
            replyPreviewPlain = serverMessage.replyPreview,
            sentAtRaw = null,
            sentAtDisplay = serverMessage.time,
            sentAtEpochMs = null,
            isDelivered = serverMessage.isDelivered,
            isRead = serverMessage.isRead,
            reaction = serverMessage.reaction,
            syncStatus = LocalMessageSyncStatus.SYNCED,
            nowMs = System.currentTimeMillis()
        )
    }
}
