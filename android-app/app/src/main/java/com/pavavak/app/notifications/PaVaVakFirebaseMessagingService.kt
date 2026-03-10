package com.pavavak.app.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
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

        // Show immediately from payload so background alerts never depend on API/session.
        val unreadCount = message.data["unreadCount"]?.toIntOrNull() ?: 1
        val hintFromPayload = when (message.data["type"]) {
            "new_message_photo" -> "Photo received"
            "new_message" -> "You have new messages"
            else -> null
        }
        NotificationHelper.ensureChannels(this@PaVaVakFirebaseMessagingService)
        NotificationHelper.showHiddenMessageNotification(
            this@PaVaVakFirebaseMessagingService,
            unreadCount,
            hintFromPayload
        )

        // Best-effort refinement from backend (do not block initial alert).
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                val hint = if (unreadCount > 0) NativeApi.getUnreadNotificationHint() else null
                if (!hint.isNullOrBlank()) {
                    NotificationHelper.showHiddenMessageNotification(
                        this@PaVaVakFirebaseMessagingService,
                        unreadCount,
                        hint
                    )
                }
            }
        }
    }
}
