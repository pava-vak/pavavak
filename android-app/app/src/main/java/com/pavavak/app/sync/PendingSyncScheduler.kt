package com.pavavak.app.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object PendingSyncScheduler {
    private const val UNIQUE_NOW_WORK = "pavavak_pending_sync_now"
    private const val UNIQUE_PERIODIC_WORK = "pavavak_pending_sync_periodic"

    private fun connectedConstraint(): Constraints {
        return Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
    }

    fun enqueueNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<PendingMessageSyncWorker>()
            .setConstraints(connectedConstraint())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_NOW_WORK,
            ExistingWorkPolicy.REPLACE,
            request
        )
    }

    fun ensurePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<PendingMessageSyncWorker>(30, TimeUnit.MINUTES)
            .setConstraints(connectedConstraint())
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_PERIODIC_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}
