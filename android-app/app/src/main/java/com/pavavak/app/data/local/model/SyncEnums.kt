package com.pavavak.app.data.local.model

enum class LocalMessageSyncStatus {
    SYNCED,
    QUEUED,
    FAILED
}

enum class PendingSyncStatus {
    QUEUED,
    RETRYING,
    FAILED
}

