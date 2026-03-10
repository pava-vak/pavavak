package com.pavavak.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey
    @ColumnInfo(name = "state_key")
    val key: String,

    @ColumnInfo(name = "state_value")
    val value: String,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long
)

