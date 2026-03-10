package com.pavavak.app.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.pavavak.app.PaVaVakApp
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PaVaVakFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("PaVaVakFCM", "FCM token refreshed: $token")
        getSharedPreferences("fcm_state", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
        CoroutineScope(Dispatchers.IO).launch {
            val ok = NativeApi.registerFcmToken(token)
            Log.d("PaVaVakFCM", "FCM token refresh backend sync success=$ok")
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val payload = NotificationPayload(
            chatUserId = message.data["chatUserId"]?.toIntOrNull() ?: 0,
            senderId = message.data["senderId"]?.toIntOrNull() ?: 0,
            senderName = message.data["senderName"].orEmpty(),
            previewText = message.data["previewText"],
            type = message.data["type"].orEmpty().ifBlank { "new_message" },
            unreadCount = message.data["unreadCount"]?.toIntOrNull() ?: 1,
            messageId = message.data["messageId"].orEmpty(),
            sentAtIso = message.data["sentAt"]
        )
        NotificationHelper.ensureChannels(this@PaVaVakFirebaseMessagingService)

        val activeChatId = NotificationPrefs.activeChatId(this)
        val suppressForActiveChat = PaVaVakApp.isProcessInForeground &&
            activeChatId != null &&
            activeChatId == payload.chatUserId

        if (!suppressForActiveChat) {
            NotificationHelper.showIncomingMessageNotification(this@PaVaVakFirebaseMessagingService, payload)
        }

        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                NotificationHelper.refreshSummaryNotification(this@PaVaVakFirebaseMessagingService)
            }
        }
    }
}
