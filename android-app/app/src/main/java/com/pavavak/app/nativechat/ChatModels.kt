package com.pavavak.app.nativechat

data class ChatSummary(
    val chatId: String,
    val name: String,
    var lastMessage: String,
    var lastTime: String,
    var unreadCount: Int = 0
)

data class ChatMessage(
    val id: String,
    val isMine: Boolean,
    var text: String,
    var time: String,
    var isDelivered: Boolean = false,
    var isRead: Boolean = false,
    var replyPreview: String? = null,
    var reaction: String? = null
)

data class SessionInfo(
    val authenticated: Boolean,
    val userId: Int,
    val isAdmin: Boolean
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
