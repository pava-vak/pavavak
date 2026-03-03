package com.pavavak.app.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.pavavak.app.MainActivity
import com.pavavak.app.R

object NotificationHelper {
    private const val CHANNEL_ID_MESSAGES = "messages_secure"
    private const val NOTIF_ID_MESSAGES = 1001

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID_MESSAGES,
            "Secure Messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Message alerts with hidden content"
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    fun showHiddenMessageNotification(context: Context, unreadCount: Int, hintText: String? = null) {
        if (unreadCount <= 0) {
            NotificationManagerCompat.from(context).cancel(NOTIF_ID_MESSAGES)
            return
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val privateText = hintText?.takeIf { it.isNotBlank() } ?: "You have new messages"
        val publicText = hintText?.takeIf { it.isNotBlank() } ?: "New message"

        val publicVersion = NotificationCompat.Builder(context, CHANNEL_ID_MESSAGES)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("PaVaVak")
            .setContentText(publicText)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        val notif = NotificationCompat.Builder(context, CHANNEL_ID_MESSAGES)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("PaVaVak")
            .setContentText(privateText)
            .setStyle(NotificationCompat.BigTextStyle().bigText("Open app to view new messages."))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setNumber(unreadCount)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(NOTIF_ID_MESSAGES, notif)
    }
}
