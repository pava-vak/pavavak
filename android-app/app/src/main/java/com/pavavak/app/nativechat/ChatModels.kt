package com.pavavak.app.nativechat

data class ChatSummary(
    val chatId: String,
    val name: String,
    var lastMessage: String,
    var lastTime: String,
    var unreadCount: Int = 0,
    var lastIsFromMe: Boolean = false,
    var lastIsDelivered: Boolean = false,
    var lastIsRead: Boolean = false,
    var lastSentAtEpochMs: Long = 0L,
    var profilePhotoBase64: String? = null
)

data class ChatMessage(
    val id: String,
    val isMine: Boolean,
    var text: String,
    var time: String,
    var isDelivered: Boolean = false,
    var isRead: Boolean = false,
    var replyPreview: String? = null,
    var reaction: String? = null,
    var isEdited: Boolean = false,
    var remoteMediaId: String? = null,
    var remotePreviewBase64: String? = null,
    var remoteFullBase64: String? = null
)

data class SessionInfo(
    val authenticated: Boolean,
    val userId: Int,
    val isAdmin: Boolean,
    val forcePasswordReset: Boolean = false
)

data class PasswordResetRequest(
    val requestId: Int,
    val userId: Int,
    val username: String,
    val email: String,
    val status: String,
    val createdAt: String
)

data class AdminStats(
    val totalUsers: Int,
    val pendingUsers: Int,
    val activeConnections: Int,
    val totalMessages: Int,
    val pendingResets: Int
)

data class AdminMessage(
    val messageId: Int,
    val from: String,
    val to: String,
    val content: String,
    val sentAt: String
)

data class AdminConnection(
    val connectionId: Int = 0,
    val user1Id: Int,
    val user2Id: Int,
    val user1Name: String,
    val user2Name: String
)

data class AdminConversationMessage(
    val messageId: Int,
    val senderId: Int,
    val receiverId: Int,
    val senderName: String,
    val content: String,
    val sentAt: String
)

data class AdminUser(
    val userId: Int,
    val username: String,
    val fullName: String,
    val email: String,
    val isAdmin: Boolean,
    val isApproved: Boolean,
    val createdAt: String
)

data class AdminInvite(
    val code: String,
    val used: Boolean,
    val createdAt: String,
    val usedByUsername: String?
)

data class AdminBroadcastRecipient(
    val userId: Int,
    val username: String,
    val fullName: String,
    val isAdmin: Boolean,
    val activeTokenCount: Int
)

data class AdminBroadcastSummary(
    val targetedCount: Int,
    val usersWithActiveTokens: Int,
    val sentUsers: Int,
    val sentNotifications: Int,
    val skippedNoTokenCount: Int,
    val failedCount: Int
)

data class AdminBroadcastResult(
    val summary: AdminBroadcastSummary,
    val failedUsers: List<String>,
    val skippedUsers: List<String>
)

data class UserBroadcast(
    val broadcastId: Int,
    val title: String,
    val body: String,
    val createdAt: String,
    val createdByUsername: String,
    val isRead: Boolean,
    val readAt: String? = null,
    val deliveryStatus: String = ""
)
