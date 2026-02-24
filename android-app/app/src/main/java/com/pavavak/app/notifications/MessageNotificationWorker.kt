package com.pavavak.app.notifications

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.pavavak.app.nativechat.NativeApi

class MessageNotificationWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            NotificationHelper.ensureChannels(applicationContext)

            val session = NativeApi.getSession()
            if (!session.authenticated) {
                saveLastUnread(0)
                NotificationHelper.showHiddenMessageNotification(applicationContext, 0)
                return Result.success()
            }

            val unread = NativeApi.getTotalUnreadCount()
            val last = getLastUnread()

            if (unread <= 0) {
                NotificationHelper.showHiddenMessageNotification(applicationContext, 0)
            } else if (unread != last) {
                NotificationHelper.showHiddenMessageNotification(applicationContext, unread)
            }

            saveLastUnread(unread)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun getLastUnread(): Int {
        return applicationContext
            .getSharedPreferences("notif_state", Context.MODE_PRIVATE)
            .getInt("last_unread_count", 0)
    }

    private fun saveLastUnread(value: Int) {
        applicationContext
            .getSharedPreferences("notif_state", Context.MODE_PRIVATE)
            .edit()
            .putInt("last_unread_count", value)
            .apply()
    }
}

