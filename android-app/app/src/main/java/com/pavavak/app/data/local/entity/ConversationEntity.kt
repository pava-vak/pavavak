package com.pavavak.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "conversations",
    indices = [Index(value = ["updated_at"])]
)
data class ConversationEntity(
    @PrimaryKey
    @ColumnInfo(name = "chat_id")
    val chatId: Int,

    @ColumnInfo(name = "display_name")
    val displayName: String,

    @ColumnInfo(name = "profile_photo_base64")
    val profilePhotoBase64: String?,

    // Encrypted preview text (AES-GCM payload)
    @ColumnInfo(name = "last_message_cipher")
    val lastMessageCipher: String?,

    @ColumnInfo(name = "last_message_time_raw")
    val lastMessageTimeRaw: String?,

    @ColumnInfo(name = "last_message_time_display")
    val lastMessageTimeDisplay: String?,

    @ColumnInfo(name = "unread_count")
    val unreadCount: Int,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long
)
