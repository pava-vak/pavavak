package com.pavavak.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.pavavak.app.data.local.entity.MessageEntity
import com.pavavak.app.data.local.model.LocalMessageSyncStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE chat_id = :chatId ORDER BY sent_at_epoch_ms ASC, updated_at ASC")
    fun observeByChat(chatId: Int): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE chat_id = :chatId ORDER BY sent_at_epoch_ms ASC, updated_at ASC")
    suspend fun getByChat(chatId: Int): List<MessageEntity>

    @Query("SELECT MAX(CAST(message_id AS INTEGER)) FROM messages WHERE chat_id = :chatId AND message_id GLOB '[0-9]*'")
    suspend fun getLatestServerMessageId(chatId: Int): Int?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<MessageEntity>)

    @Query("UPDATE messages SET sync_status = :syncStatus, updated_at = :updatedAt WHERE message_id = :messageId")
    suspend fun updateSyncStatus(messageId: String, syncStatus: LocalMessageSyncStatus, updatedAt: Long)

    @Query("UPDATE messages SET is_read = 1, updated_at = :updatedAt WHERE message_id = :messageId")
    suspend fun markRead(messageId: String, updatedAt: Long)

    @Query(
        "UPDATE messages SET sent_at_display = :displayTime, sync_status = :syncStatus, updated_at = :updatedAt WHERE message_id = :messageId"
    )
    suspend fun updateDisplayAndSyncStatus(
        messageId: String,
        displayTime: String,
        syncStatus: LocalMessageSyncStatus,
        updatedAt: Long
    )

    @Query("DELETE FROM messages WHERE message_id = :messageId")
    suspend fun deleteById(messageId: String)

    @Query("DELETE FROM messages WHERE chat_id = :chatId")
    suspend fun clearChat(chatId: Int)
}
