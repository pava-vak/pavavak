package com.pavavak.app.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.pavavak.app.data.local.LocalChatStore
import com.pavavak.app.data.local.LocalDatabaseProvider
import com.pavavak.app.nativechat.NativeApi

class PendingMessageSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
    private val maxRetryAttempts = 5

    override suspend fun doWork(): Result {
        val session = NativeApi.getSession()
        if (!session.authenticated) return Result.success()

        val localStore = LocalChatStore(LocalDatabaseProvider.get(applicationContext))
        val pending = localStore.readAllPendingMessages()
        if (pending.isEmpty()) return Result.success()

        var shouldRetry = false
        pending.forEach { draft ->
            if (draft.retryCount >= maxRetryAttempts) {
                localStore.markPendingFailed(draft.localId, "Retry limit reached")
                return@forEach
            }
            localStore.markPendingRetrying(draft.localId)
            val sent = NativeApi.sendMessage(draft.chatId, draft.content, draft.replyPreview)
            if (!sent.success || sent.message == null) {
                val latestAttempts = draft.retryCount + 1
                if (latestAttempts >= maxRetryAttempts) {
                    localStore.markPendingFailed(draft.localId, sent.error.ifBlank { "Send failed" })
                } else {
                    localStore.markPendingQueued(draft.localId, sent.error.ifBlank { "Send failed" })
                    shouldRetry = true
                }
            } else {
                localStore.markPendingSynced(draft.localId, draft.chatId, sent.message)
            }
        }
        return if (shouldRetry) Result.retry() else Result.success()
    }
}
