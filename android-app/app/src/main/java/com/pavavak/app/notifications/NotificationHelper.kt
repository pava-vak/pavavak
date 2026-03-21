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
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import com.pavavak.app.MainActivity
import com.pavavak.app.R
import com.pavavak.app.nativechat.ContactAliasPrefs
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class NotificationPayload(
    val chatUserId: Int,
    val senderId: Int,
    val senderName: String,
    val previewText: String?,
    val type: String,
    val unreadCount: Int,
    val messageId: String,
    val sentAtIso: String?
)

object NotificationHelper {
    const val ACTION_REPLY = "com.pavavak.app.notifications.REPLY"
    const val ACTION_MARK_READ = "com.pavavak.app.notifications.MARK_READ"
    const val ACTION_STEALTH_HOUR = "com.pavavak.app.notifications.STEALTH_HOUR"
    const val KEY_REMOTE_REPLY = "pvk_remote_reply"
    const val EXTRA_CHAT_USER_ID = "notif_chat_user_id"
    private const val EXTRA_CHAT_NAME = "notif_chat_name"
    private const val EXTRA_OPEN_FROM_NOTIFICATION = "notif_open"
    private const val EXTRA_NOTIFICATION_TYPE = "notif_type"
    private const val EXTRA_BROADCAST_ID = "notif_broadcast_id"

    private const val CHANNEL_ID_MESSAGES_PRIVATE = "messages_private"
    private const val CHANNEL_ID_MESSAGES_PREVIEW = "messages_preview"
    private const val GROUP_MESSAGES = "pvk_messages"
    private const val NOTIF_ID_SUMMARY = 1001
    private const val CHAT_NOTIF_BASE = 2000

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val privateChannel = NotificationChannel(
            CHANNEL_ID_MESSAGES_PRIVATE,
            "Private Messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alerts without exposing message text"
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            setShowBadge(true)
        }

        val previewChannel = NotificationChannel(
            CHANNEL_ID_MESSAGES_PREVIEW,
            "Message Previews",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alerts with sender and message preview"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(true)
        }

        manager.createNotificationChannel(privateChannel)
        manager.createNotificationChannel(previewChannel)
    }

    fun showIncomingMessageNotification(context: Context, payload: NotificationPayload) {
        if (!NotificationPrefs.notificationsEnabled(context)) {
            cancelAllMessageNotifications(context)
            return
        }

        val previewMode = NotificationPrefs.previewMode(context)
        val resolvedName = ContactAliasPrefs.aliasFor(
            context,
            payload.chatUserId,
            payload.senderName.ifBlank { "User ${payload.chatUserId}" }
        )
        val contentText = when (previewMode) {
            NotificationPrefs.PREVIEW_FULL -> buildPreviewText(payload)
            NotificationPrefs.PREVIEW_NAME_ONLY -> "$resolvedName sent a message"
            else -> "New secure message"
        }
        val titleText = when (previewMode) {
            NotificationPrefs.PREVIEW_HIDDEN -> "PaVa-Vak"
            else -> resolvedName
        }

        val openIntent = buildOpenPendingIntent(context, payload)
        val publicVersion = NotificationCompat.Builder(context, channelIdForMode(NotificationPrefs.PREVIEW_HIDDEN))
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("PaVa-Vak")
            .setContentText("New secure message")
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        val person = Person.Builder()
            .setName(resolvedName)
            .build()

        val builder = NotificationCompat.Builder(context, channelIdForMode(previewMode))
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(titleText)
            .setContentText(contentText)
            .setCategory(if (isChatPayload(payload)) NotificationCompat.CATEGORY_MESSAGE else NotificationCompat.CATEGORY_STATUS)
            .setVisibility(
                if (previewMode == NotificationPrefs.PREVIEW_FULL) {
                    NotificationCompat.VISIBILITY_PRIVATE
                } else {
                    NotificationCompat.VISIBILITY_PRIVATE
                }
            )
            .setPublicVersion(publicVersion)
            .setNumber(payload.unreadCount.coerceAtLeast(1))
            .setAutoCancel(true)
            .setContentIntent(openIntent)
            .setGroup(GROUP_MESSAGES)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOnlyAlertOnce(false)
            .setStyle(
                if (previewMode == NotificationPrefs.PREVIEW_FULL) {
                    NotificationCompat.MessagingStyle(person)
                        .addMessage(contentText, System.currentTimeMillis(), person)
                } else {
                    NotificationCompat.BigTextStyle().bigText(contentText)
                }
            )

        if (isChatPayload(payload) && NotificationPrefs.directReplyEnabled(context)) {
            builder.addAction(buildReplyAction(context, payload.chatUserId, resolvedName))
        }
        if (isChatPayload(payload) && NotificationPrefs.markReadEnabled(context)) {
            builder.addAction(buildMarkReadAction(context, payload.chatUserId))
        }
        builder.addAction(buildStealthAction(context))

        NotificationManagerCompat.from(context).notify(chatNotificationId(payload.chatUserId), builder.build())
        showSummaryNotification(context, payload.unreadCount)
    }

    fun showSummaryNotification(context: Context, unreadCount: Int, hintText: String? = null) {
        if (!NotificationPrefs.notificationsEnabled(context) || unreadCount <= 0) {
            NotificationManagerCompat.from(context).cancel(NOTIF_ID_SUMMARY)
            return
        }
        val previewMode = NotificationPrefs.previewMode(context)
        val contentText = when (previewMode) {
            NotificationPrefs.PREVIEW_FULL -> hintText?.ifBlank { null } ?: "Open PaVa-Vak to view unread messages."
            NotificationPrefs.PREVIEW_NAME_ONLY -> "You have unread chats"
            else -> "You have unread secure messages"
        }
        val publicVersion = NotificationCompat.Builder(context, channelIdForMode(NotificationPrefs.PREVIEW_HIDDEN))
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("PaVa-Vak")
            .setContentText("Unread secure messages")
            .build()
        val openIntent = PendingIntent.getActivity(
            context,
            901,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, channelIdForMode(previewMode))
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("PaVa-Vak")
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setGroup(GROUP_MESSAGES)
            .setGroupSummary(true)
            .setNumber(unreadCount)
            .setAutoCancel(true)
            .setContentIntent(openIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        NotificationManagerCompat.from(context).notify(NOTIF_ID_SUMMARY, builder.build())
    }

    fun cancelChatNotification(context: Context, chatUserId: Int) {
        NotificationManagerCompat.from(context).cancel(chatNotificationId(chatUserId))
    }

    fun cancelAllMessageNotifications(context: Context) {
        NotificationManagerCompat.from(context).cancelAll()
    }

    suspend fun refreshSummaryNotification(context: Context) = withContext(Dispatchers.IO) {
        if (!NotificationPrefs.notificationsEnabled(context)) {
            cancelAllMessageNotifications(context)
            return@withContext
        }
        val unread = NativeApi.getTotalUnreadCount()
        val hint = if (unread > 0 && NotificationPrefs.previewMode(context) == NotificationPrefs.PREVIEW_FULL) {
            NativeApi.getUnreadNotificationHint()
        } else {
            null
        }
        showSummaryNotification(context, unread, hint)
    }

    private fun buildReplyAction(context: Context, chatUserId: Int, chatName: String): NotificationCompat.Action {
        val remoteInput = RemoteInput.Builder(KEY_REMOTE_REPLY)
            .setLabel("Reply")
            .build()
        val intent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = ACTION_REPLY
            putExtra(EXTRA_CHAT_USER_ID, chatUserId)
            putExtra(EXTRA_CHAT_NAME, chatName)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            chatNotificationId(chatUserId) + 11,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        return NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_send,
            "Reply",
            pendingIntent
        ).addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .build()
    }

    private fun buildMarkReadAction(context: Context, chatUserId: Int): NotificationCompat.Action {
        val intent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = ACTION_MARK_READ
            putExtra(EXTRA_CHAT_USER_ID, chatUserId)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            chatNotificationId(chatUserId) + 12,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Action.Builder(
            android.R.drawable.checkbox_on_background,
            "Mark read",
            pendingIntent
        ).build()
    }

    private fun buildStealthAction(context: Context): NotificationCompat.Action {
        val intent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = ACTION_STEALTH_HOUR
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            899,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Action.Builder(
            android.R.drawable.ic_lock_lock,
            "Stealth 1h",
            pendingIntent
        ).build()
    }

    private fun buildOpenPendingIntent(context: Context, payload: NotificationPayload): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_OPEN_FROM_NOTIFICATION, true)
            putExtra(EXTRA_NOTIFICATION_TYPE, if (isChatPayload(payload)) "chat" else "broadcast")
            putExtra(EXTRA_CHAT_USER_ID, payload.chatUserId)
            putExtra(EXTRA_CHAT_NAME, payload.senderName.ifBlank { "Chat" })
            if (payload.type == "broadcast") {
                putExtra(EXTRA_BROADCAST_ID, payload.messageId)
            }
        }
        return PendingIntent.getActivity(
            context,
            chatNotificationId(if (payload.chatUserId > 0) payload.chatUserId else payload.messageId.hashCode()),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildPreviewText(payload: NotificationPayload): String {
        return when (payload.type) {
            "broadcast" -> payload.previewText?.takeIf { it.isNotBlank() } ?: "New announcement"
            "new_message_photo" -> "Photo received"
            else -> payload.previewText?.takeIf { it.isNotBlank() } ?: "New message"
        }
    }

    private fun isChatPayload(payload: NotificationPayload): Boolean {
        return payload.chatUserId > 0 && payload.type != "broadcast"
    }

    private fun channelIdForMode(previewMode: Int): String {
        return if (previewMode == NotificationPrefs.PREVIEW_FULL) {
            CHANNEL_ID_MESSAGES_PREVIEW
        } else {
            CHANNEL_ID_MESSAGES_PRIVATE
        }
    }

    private fun chatNotificationId(chatUserId: Int): Int = CHAT_NOTIF_BASE + chatUserId

    fun notificationIntentWantsChat(intent: Intent?): Boolean =
        intent?.getBooleanExtra(EXTRA_OPEN_FROM_NOTIFICATION, false) == true &&
            intent.getStringExtra(EXTRA_NOTIFICATION_TYPE) != "broadcast"

    fun notificationChatId(intent: Intent?): Int =
        intent?.getIntExtra(EXTRA_CHAT_USER_ID, 0) ?: 0

    fun notificationChatName(intent: Intent?): String =
        intent?.getStringExtra(EXTRA_CHAT_NAME).orEmpty()

    fun notificationIntentWantsBroadcasts(intent: Intent?): Boolean =
        intent?.getBooleanExtra(EXTRA_OPEN_FROM_NOTIFICATION, false) == true &&
            intent.getStringExtra(EXTRA_NOTIFICATION_TYPE) == "broadcast"

    fun notificationBroadcastId(intent: Intent?): Int =
        intent?.getStringExtra(EXTRA_BROADCAST_ID)?.toIntOrNull() ?: 0
}
