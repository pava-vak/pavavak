package com.pavavak.app.data.local

import androidx.room.TypeConverter
import com.pavavak.app.data.local.model.LocalMessageSyncStatus
import com.pavavak.app.data.local.model.PendingSyncStatus

class LocalDbConverters {
    @TypeConverter
    fun fromLocalMessageSyncStatus(value: LocalMessageSyncStatus): String = value.name

    @TypeConverter
    fun toLocalMessageSyncStatus(value: String): LocalMessageSyncStatus =
        runCatching { LocalMessageSyncStatus.valueOf(value) }.getOrElse { LocalMessageSyncStatus.SYNCED }

    @TypeConverter
    fun fromPendingSyncStatus(value: PendingSyncStatus): String = value.name

    @TypeConverter
    fun toPendingSyncStatus(value: String): PendingSyncStatus =
        runCatching { PendingSyncStatus.valueOf(value) }.getOrElse { PendingSyncStatus.QUEUED }
}

