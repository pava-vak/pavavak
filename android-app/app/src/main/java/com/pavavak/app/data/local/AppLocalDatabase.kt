package com.pavavak.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.pavavak.app.data.local.dao.ConversationDao
import com.pavavak.app.data.local.dao.MessageDao
import com.pavavak.app.data.local.dao.PendingMessageDao
import com.pavavak.app.data.local.dao.SyncStateDao
import com.pavavak.app.data.local.entity.ConversationEntity
import com.pavavak.app.data.local.entity.MessageEntity
import com.pavavak.app.data.local.entity.PendingMessageEntity
import com.pavavak.app.data.local.entity.SyncStateEntity

@Database(
    entities = [
        ConversationEntity::class,
        MessageEntity::class,
        PendingMessageEntity::class,
        SyncStateEntity::class
    ],
    version = 2,
    exportSchema = true
)
@TypeConverters(LocalDbConverters::class)
abstract class AppLocalDatabase : RoomDatabase() {
    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao
    abstract fun pendingMessageDao(): PendingMessageDao
    abstract fun syncStateDao(): SyncStateDao
}
