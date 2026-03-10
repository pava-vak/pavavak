package com.pavavak.app.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                when (intent.action) {
                    NotificationHelper.ACTION_REPLY -> handleReply(context, intent)
                    NotificationHelper.ACTION_MARK_READ -> handleMarkRead(context, intent)
                    NotificationHelper.ACTION_STEALTH_HOUR -> handleStealthHour(context)
                }
            } catch (e: Exception) {
                Log.e("PaVaVakNotif", "Notification action failed: ${e.message}", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun handleReply(context: Context, intent: Intent) {
        val chatUserId = intent.getIntExtra(NotificationHelper.EXTRA_CHAT_USER_ID, 0)
        if (chatUserId <= 0) return
        val input = RemoteInput.getResultsFromIntent(intent)
        val replyText = input?.getCharSequence(NotificationHelper.KEY_REMOTE_REPLY)
            ?.toString()
            ?.trim()
            .orEmpty()
        if (replyText.isBlank()) return

        val result = NativeApi.sendMessage(chatUserId, replyText)
        if (result.success) {
            NotificationHelper.cancelChatNotification(context, chatUserId)
        }
        NotificationHelper.refreshSummaryNotification(context)
    }

    private suspend fun handleMarkRead(context: Context, intent: Intent) {
        val chatUserId = intent.getIntExtra(NotificationHelper.EXTRA_CHAT_USER_ID, 0)
        if (chatUserId <= 0) return
        if (NativeApi.markConversationRead(chatUserId)) {
            NotificationHelper.cancelChatNotification(context, chatUserId)
        }
        NotificationHelper.refreshSummaryNotification(context)
    }

    private suspend fun handleStealthHour(context: Context) {
        NotificationPrefs.enableStealthFor(context, 60L * 60L * 1000L)
        NotificationHelper.refreshSummaryNotification(context)
    }
}
