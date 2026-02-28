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

        // Keep notification content hidden regardless of payload.
        val unreadCount = message.data["unreadCount"]?.toIntOrNull() ?: 1
        NotificationHelper.ensureChannels(this)
        NotificationHelper.showHiddenMessageNotification(this, unreadCount)
    }
}
