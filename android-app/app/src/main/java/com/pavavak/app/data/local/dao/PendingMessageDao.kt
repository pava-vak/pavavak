package com.pavavak.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.pavavak.app.data.local.entity.PendingMessageEntity
import com.pavavak.app.data.local.model.PendingSyncStatus

@Dao
interface PendingMessageDao {
    @Query("SELECT * FROM pending_messages WHERE status IN ('QUEUED', 'RETRYING') ORDER BY created_at ASC")
    suspend fun getReadyForSync(): List<PendingMessageEntity>

    @Query("SELECT * FROM pending_messages WHERE chat_id = :chatId ORDER BY created_at ASC")
    suspend fun getByChat(chatId: Int): List<PendingMessageEntity>

    @Query("SELECT * FROM pending_messages WHERE local_id = :localId LIMIT 1")
    suspend fun getById(localId: String): PendingMessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: PendingMessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<PendingMessageEntity>)

    @Query(
        "UPDATE pending_messages SET status = :status, retry_count = :retryCount, next_retry_at = :nextRetryAt, last_error = :lastError WHERE local_id = :localId"
    )
    suspend fun updateState(
        localId: String,
        status: PendingSyncStatus,
        retryCount: Int,
        nextRetryAt: Long?,
        lastError: String?
    )

    @Query("DELETE FROM pending_messages WHERE local_id = :localId")
    suspend fun delete(localId: String)
}
