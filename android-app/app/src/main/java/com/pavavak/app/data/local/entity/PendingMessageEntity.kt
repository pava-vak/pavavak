package com.pavavak.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.pavavak.app.data.local.model.PendingSyncStatus

@Entity(
    tableName = "pending_messages",
    indices = [
        Index(value = ["chat_id", "created_at"]),
        Index(value = ["status", "next_retry_at"])
    ]
)
data class PendingMessageEntity(
    @PrimaryKey
    @ColumnInfo(name = "local_id")
    val localId: String,

    @ColumnInfo(name = "chat_id")
    val chatId: Int,

    @ColumnInfo(name = "content_cipher")
    val contentCipher: String,

    @ColumnInfo(name = "reply_preview_cipher")
    val replyPreviewCipher: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "retry_count")
    val retryCount: Int,

    @ColumnInfo(name = "next_retry_at")
    val nextRetryAt: Long?,

    @ColumnInfo(name = "status")
    val status: PendingSyncStatus,

    @ColumnInfo(name = "last_error")
    val lastError: String?
)

