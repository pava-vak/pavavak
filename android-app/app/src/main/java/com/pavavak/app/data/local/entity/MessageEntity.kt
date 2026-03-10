package com.pavavak.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.pavavak.app.data.local.model.LocalMessageSyncStatus

@Entity(
    tableName = "messages",
    indices = [
        Index(value = ["chat_id", "sent_at_epoch_ms"]),
        Index(value = ["chat_id", "updated_at"])
    ]
)
data class MessageEntity(
    @PrimaryKey
    @ColumnInfo(name = "message_id")
    val messageId: String,

    @ColumnInfo(name = "chat_id")
    val chatId: Int,

    @ColumnInfo(name = "is_mine")
    val isMine: Boolean,

    // Encrypted content (AES-GCM payload).
    @ColumnInfo(name = "content_cipher")
    val contentCipher: String,

    // Optional encrypted reply preview (AES-GCM payload).
    @ColumnInfo(name = "reply_preview_cipher")
    val replyPreviewCipher: String?,

    @ColumnInfo(name = "sent_at_raw")
    val sentAtRaw: String?,

    @ColumnInfo(name = "sent_at_display")
    val sentAtDisplay: String?,

    @ColumnInfo(name = "sent_at_epoch_ms")
    val sentAtEpochMs: Long?,

    @ColumnInfo(name = "is_delivered")
    val isDelivered: Boolean,

    @ColumnInfo(name = "is_read")
    val isRead: Boolean,

    @ColumnInfo(name = "reaction")
    val reaction: String?,

    @ColumnInfo(name = "sync_status")
    val syncStatus: LocalMessageSyncStatus,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long
)

