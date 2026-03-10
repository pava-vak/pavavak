package com.pavavak.app.nativechat

import android.content.Context
import android.util.Base64
import android.webkit.CookieManager
import android.util.Log
import com.pavavak.app.BuildConfig
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class LoginResult(
    val success: Boolean,
    val isAdmin: Boolean = false,
    val requiresPasswordReset: Boolean = false,
    val error: String = ""
)

data class SendResult(
    val success: Boolean,
    val message: ChatMessage? = null,
    val error: String = ""
)

data class ProfileResult(
    val success: Boolean,
    val username: String = "",
    val fullName: String = "",
    val hideLastSeen: Boolean = false,
    val profilePhotoBase64: String? = null,
    val error: String = ""
)

data class BasicResult(
    val success: Boolean,
    val error: String = ""
)

data class PresenceResult(
    val success: Boolean,
    val isOnline: Boolean = false,
    val lastSeenAt: String? = null,
    val isLastSeenHidden: Boolean = false,
    val error: String = ""
)

object NativeApi {

    private val baseUrl: String = BuildConfig.BASE_URL.trimEnd('/')
    private const val TAG = "PaVaVakApi"
    private val IST_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")
    private val IST_TIME_FORMAT: DateTimeFormatter =
        DateTimeFormatter.ofPattern("h:mm a", Locale("en", "IN"))
    @Volatile private var realtimeSocket: Socket? = null
    @Volatile private var realtimeChatUserId: Int? = null
    @Volatile private var cachedSession: SessionInfo? = null

    interface RealtimeListener {
        fun onNewMessage(message: ChatMessage)
        fun onMessageDelivered(messageId: String)
        fun onMessageRead(messageId: String)
        fun onMessageEdited(messageId: String, content: String, isEdited: Boolean, remoteMediaId: String?)
    }

    fun baseUrl(): String = baseUrl

    suspend fun login(username: String, password: String): LoginResult = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            conn = (URL("$baseUrl/api/auth/login").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10000
                readTimeout = 10000
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")
            }

            val body = JSONObject()
                .put("username", username)
                .put("password", password)

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }

            val setCookies = conn.headerFields["Set-Cookie"] ?: emptyList()
            val cm = CookieManager.getInstance()
            setCookies.forEach { c -> cm.setCookie(baseUrl, c) }
            cm.flush()

            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
            val text = BufferedReader(stream.reader(Charsets.UTF_8)).use { it.readText() }
            val json = if (text.isBlank()) JSONObject() else JSONObject(text)

            val ok = json.optBoolean("success", false)
            val isAdmin = json.optJSONObject("user")?.optBoolean("isAdmin", false) ?: false
            val requiresPasswordReset = json.optBoolean("requiresPasswordReset", false) ||
                (json.optJSONObject("user")?.optBoolean("forcePasswordReset", false) ?: false)
            val error = json.optString("error", if (ok) "" else "Login failed")
            if (ok) {
                cachedSession = SessionInfo(
                    authenticated = true,
                    userId = json.optJSONObject("user")?.optInt("userId", 0) ?: 0,
                    isAdmin = isAdmin,
                    forcePasswordReset = requiresPasswordReset
                )
            } else {
                cachedSession = null
            }
            LoginResult(ok, isAdmin, requiresPasswordReset, error)
        } catch (e: Exception) {
            LoginResult(false, false, false, e.message ?: "Login failed")
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        cachedSession = null
        request("POST", "/api/auth/logout")
    }

    suspend fun requestPasswordReset(usernameOrEmail: String): BasicResult = withContext(Dispatchers.IO) {
        val body = JSONObject().put("usernameOrEmail", usernameOrEmail.trim())
        val json = request("POST", "/api/auth/request-password-reset", body)
            ?: return@withContext BasicResult(false, "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext BasicResult(false, json.optString("error", "Failed"))
        }
        BasicResult(true)
    }

    suspend fun completePasswordReset(newPassword: String): BasicResult = withContext(Dispatchers.IO) {
        val body = JSONObject().put("newPassword", newPassword)
        val json = request("POST", "/api/auth/complete-password-reset", body)
            ?: return@withContext BasicResult(false, "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext BasicResult(false, json.optString("error", "Failed"))
        }
        BasicResult(true)
    }

    suspend fun registerFcmToken(
        token: String,
        platform: String = "android",
        deviceId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        if (token.isBlank()) return@withContext false
        val body = JSONObject()
            .put("token", token)
            .put("platform", platform)
        if (!deviceId.isNullOrBlank()) {
            body.put("deviceId", deviceId)
        }
        val json = request("POST", "/api/mobile/register-token", body) ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun registerFcmTokenFromPrefs(context: Context): Boolean = withContext(Dispatchers.IO) {
        val token = context.getSharedPreferences("fcm_state", Context.MODE_PRIVATE)
            .getString("fcm_token", null)
            ?.trim()
            .orEmpty()
        if (token.isBlank()) return@withContext false
        registerFcmToken(token)
    }

    suspend fun getSession(): SessionInfo = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/auth/session") ?: return@withContext SessionInfo(false, 0, false)
        val authenticated = json.optBoolean("authenticated", false)
        val user = json.optJSONObject("user")
        val userId = user?.optInt("userId", 0) ?: 0
        val isAdmin = user?.optBoolean("isAdmin", false) ?: false
        val forcePasswordReset = user?.optBoolean("forcePasswordReset", false) ?: false
        return@withContext SessionInfo(authenticated, userId, isAdmin, forcePasswordReset).also {
            cachedSession = if (it.authenticated) it else null
        }
    }

    suspend fun getProfile(): ProfileResult = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/users/profile")
            ?: return@withContext ProfileResult(false, error = "No response")
        if (!json.optBoolean("success", false)) {
            return@withContext ProfileResult(false, error = json.optString("error", "Failed"))
        }
        val user = json.optJSONObject("user") ?: JSONObject()
        ProfileResult(
            success = true,
            username = user.optString("username", ""),
            fullName = user.optString("fullName", ""),
            hideLastSeen = user.optBoolean("hideLastSeen", false),
            profilePhotoBase64 = user.optString("profilePhotoBase64", "").ifBlank { null }
        )
    }

    suspend fun updateProfileName(fullName: String): Boolean = withContext(Dispatchers.IO) {
        val body = JSONObject().put("fullName", fullName.trim())
        val json = request("PUT", "/api/users/profile", body) ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun updateProfile(
        fullName: String? = null,
        hideLastSeen: Boolean? = null,
        profilePhotoBase64: String? = null,
        clearProfilePhoto: Boolean = false
    ): BasicResult = withContext(Dispatchers.IO) {
        val body = JSONObject()
        if (fullName != null) body.put("fullName", fullName.trim())
        if (hideLastSeen != null) body.put("hideLastSeen", hideLastSeen)
        if (clearProfilePhoto) {
            body.put("clearProfilePhoto", true)
        } else if (profilePhotoBase64 != null) {
            body.put("profilePhotoBase64", profilePhotoBase64)
        }
        val json = request("PUT", "/api/users/profile", body)
            ?: return@withContext BasicResult(false, "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext BasicResult(false, json.optString("error", "Failed to update profile"))
        }
        BasicResult(true)
    }

    suspend fun getPresence(otherUserId: Int): PresenceResult = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/presence/$otherUserId")
            ?: return@withContext PresenceResult(false, error = "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext PresenceResult(false, error = json.optString("error", "Failed to fetch presence"))
        }
        val presence = json.optJSONObject("presence") ?: JSONObject()
        PresenceResult(
            success = true,
            isOnline = presence.optBoolean("isOnline", false),
            lastSeenAt = presence.optString("lastSeenAt", "").ifBlank { null },
            isLastSeenHidden = presence.optBoolean("isLastSeenHidden", false)
        )
    }

    suspend fun sendPresenceHeartbeat(): Boolean = withContext(Dispatchers.IO) {
        val json = request("POST", "/api/presence/heartbeat") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun markPresenceOffline(): Boolean = withContext(Dispatchers.IO) {
        val json = request("POST", "/api/presence/offline") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): BasicResult = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("currentPassword", currentPassword)
            .put("newPassword", newPassword)
        val json = request("POST", "/api/users/change-password", body)
            ?: return@withContext BasicResult(false, "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext BasicResult(false, json.optString("error", "Failed to change password"))
        }
        BasicResult(true)
    }

    suspend fun deleteMyAccount(password: String): BasicResult = withContext(Dispatchers.IO) {
        val body = JSONObject().put("password", password)
        val json = request("DELETE", "/api/users/delete-account", body)
            ?: return@withContext BasicResult(false, "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext BasicResult(false, json.optString("error", "Failed to delete account"))
        }
        BasicResult(true)
    }

    suspend fun getConversations(): List<ChatSummary> = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/messages/conversations/list") ?: return@withContext emptyList()
        if (!json.optBoolean("success", false)) return@withContext emptyList()

        val arr = json.optJSONArray("conversations") ?: JSONArray()
        val list = mutableListOf<ChatSummary>()
        for (i in 0 until arr.length()) {
            val c = arr.optJSONObject(i) ?: continue
            val user = c.optJSONObject("user") ?: continue
            val userId = user.optInt("userId", 0)
            val fullName = user.optString("fullName", "")
            val username = user.optString("username", "User")
            val displayName = if (fullName.isNotBlank() && fullName != "null") fullName else username
            val profilePhotoBase64 = user.optString("profilePhotoBase64", "").ifBlank { null }

            val last = c.optJSONObject("lastMessage")
            val contentRaw = last?.optString("content", "") ?: ""
            val wire = decodeWirePayload(contentRaw)
            val content = when {
                wire?.type == "reaction" -> {
                    val emoji = wire.reactionEmoji?.ifBlank { "removed reaction" } ?: "reacted"
                    "Reaction: $emoji"
                }
                wire?.type == "chat" && (!wire.imageBase64.isNullOrBlank() || !wire.mediaId.isNullOrBlank()) -> "Photo"
                wire?.type == "chat" && !wire.text.isNullOrBlank() -> wire.text
                else -> inlineMessagePreview(contentRaw)
            }
            val sentAt = last?.optString("sentAt", "") ?: ""
            val isFromMe = last?.optBoolean("isFromMe", false) ?: false
            val isRead = last?.optBoolean("isRead", false) ?: false
            val isDelivered = last?.optBoolean("isDelivered", false) ?: false
            val unreadCount = c.optInt("unreadCount", 0)

            list.add(
                ChatSummary(
                    chatId = userId.toString(),
                    name = displayName,
                    lastMessage = content,
                    lastTime = formatTime(sentAt),
                    unreadCount = unreadCount,
                    lastIsFromMe = isFromMe,
                    lastIsDelivered = isDelivered,
                    lastIsRead = isRead,
                    lastSentAtEpochMs = parseEpochMillis(sentAt),
                    profilePhotoBase64 = profilePhotoBase64
                )
            )
        }
        list.sortedByDescending { it.lastSentAtEpochMs }
    }

    suspend fun getTotalUnreadCount(): Int = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/messages/conversations/list") ?: return@withContext 0
        if (!json.optBoolean("success", false)) return@withContext 0
        val arr = json.optJSONArray("conversations") ?: JSONArray()
        var total = 0
        for (i in 0 until arr.length()) {
            val c = arr.optJSONObject(i) ?: continue
            total += c.optInt("unreadCount", 0)
        }
        total
    }

    suspend fun getUnreadNotificationHint(): String? = withContext(Dispatchers.IO) {
        val conversations = getConversations()
        val hasUnreadPhoto = conversations.any { it.unreadCount > 0 && it.lastMessage.equals("Photo", ignoreCase = true) }
        if (hasUnreadPhoto) "File sent" else null
    }

    suspend fun getMessages(otherUserId: Int, afterMessageId: Int? = null): List<ChatMessage> = withContext(Dispatchers.IO) {
        val session = cachedSession ?: getSession()
        if (!session.authenticated) {
            Log.w(TAG, "getMessages aborted: session not authenticated")
            return@withContext emptyList()
        }

        val path = buildString {
            append("/api/messages/")
            append(otherUserId)
            if (afterMessageId != null && afterMessageId > 0) {
                append("?afterMessageId=")
                append(afterMessageId)
            }
        }
        val json = request("GET", path)
        if (json == null) {
            Log.w(TAG, "getMessages null response for otherUserId=$otherUserId")
            return@withContext emptyList()
        }
        if (!json.optBoolean("success", false)) {
            Log.w(TAG, "getMessages non-success response for otherUserId=$otherUserId body=$json")
            return@withContext emptyList()
        }

        val arr = json.optJSONArray("messages") ?: JSONArray()
        val list = mutableListOf<ChatMessage>()
        val byId = linkedMapOf<String, ChatMessage>()
        for (i in 0 until arr.length()) {
            val m = arr.optJSONObject(i) ?: continue
            val messageId = m.optInt("messageId", m.optInt("message_id", 0))
            val senderId = m.optInt("senderId", m.optInt("sender_id", 0))
            val contentRaw = m.optString("content", m.optString("message", ""))
            val sentAt = m.optString("sentAt", m.optString("sent_at", ""))
            val wire = decodeWirePayload(contentRaw)

            if (wire?.type == "reaction") {
                val targetId = wire.reactionTargetId
                if (!targetId.isNullOrBlank()) {
                    val target = byId[targetId] ?: list.firstOrNull { it.id == targetId }
                    if (target != null) {
                        target.reaction = wire.reactionEmoji?.ifBlank { null }
                    }
                }
                continue
            }

            val displayText = when {
                wire?.type == "chat" && !wire.imageBase64.isNullOrBlank() ->
                    INLINE_IMAGE_PREFIX + wire.imageBase64
                wire?.type == "chat" && !wire.mediaId.isNullOrBlank() ->
                    REMOTE_IMAGE_PREFIX + wire.mediaId
                wire?.type == "chat" && !wire.text.isNullOrBlank() ->
                    wire.text
                else -> contentRaw
            }

            list.add(
                ChatMessage(
                    id = messageId.toString(),
                    isMine = senderId == session.userId,
                    text = displayText,
                    time = formatTime(sentAt),
                    isDelivered = m.optBoolean("isDelivered", m.optBoolean("is_delivered", false)),
                    isRead = m.optBoolean("isRead", m.optBoolean("is_read", false)),
                    replyPreview = wire?.replyPreview?.let(::inlineMessagePreview)
                        ?: extractReplyPreview(m)?.let(::inlineMessagePreview)
                    ,
                    isEdited = m.optBoolean("isEdited", false),
                    remoteMediaId = wire?.mediaId
                )
            )
            byId[messageId.toString()] = list.last()
        }
        list
    }

    suspend fun sendMessage(otherUserId: Int, content: String, replyPreview: String? = null): SendResult = withContext(Dispatchers.IO) {
        Log.d(TAG, "sendMessage receiverId=$otherUserId len=${content.length}")
        val imageBase64 = extractInlineImageBase64(content)
        val wireContent = when {
            decodeWirePayload(content) != null -> content
            !imageBase64.isNullOrBlank() -> encodeChatWirePayload(
                text = null,
                replyPreview = replyPreview,
                imageBase64 = imageBase64
            )
            !replyPreview.isNullOrBlank() -> encodeChatWirePayload(
                text = content,
                replyPreview = replyPreview,
                imageBase64 = null
            )
            else -> content
        }
        val body = JSONObject()
            .put("receiverId", otherUserId)
            .put("content", wireContent)
        if (!replyPreview.isNullOrBlank()) {
            body.put("replyPreview", replyPreview)
            body.put("replyToPreview", replyPreview)
            body.put("reply_to_preview", replyPreview)
        }

        val json = request("POST", "/api/messages/send", body) ?: return@withContext SendResult(
            success = false,
            error = "Network error"
        )
        if (!json.optBoolean("success", false)) {
            Log.w(TAG, "sendMessage failed response=$json")
            return@withContext SendResult(
                success = false,
                error = json.optString("error", "Send failed")
            )
        }

        val msg = json.optJSONObject("message") ?: return@withContext SendResult(
            success = false,
            error = "Invalid server response"
        )
        SendResult(
            success = true,
            message = ChatMessage(
            id = msg.optInt("messageId", 0).toString(),
            isMine = true,
            text = run {
                val serverContent = msg.optString("content", "")
                val wire = decodeWirePayload(serverContent)
                when {
                    wire?.type == "chat" && !wire.imageBase64.isNullOrBlank() ->
                        INLINE_IMAGE_PREFIX + wire.imageBase64
                    wire?.type == "chat" && !wire.mediaId.isNullOrBlank() ->
                        REMOTE_IMAGE_PREFIX + wire.mediaId
                    wire?.type == "chat" && !wire.text.isNullOrBlank() ->
                        wire.text
                    else -> serverContent
                }
            },
            time = formatTime(msg.optString("sentAt", "")),
            isDelivered = false,
            isRead = false,
            replyPreview = run {
                val serverContent = msg.optString("content", "")
                val wire = decodeWirePayload(serverContent)
                wire?.replyPreview?.let(::inlineMessagePreview)
                    ?: extractReplyPreview(msg)?.let(::inlineMessagePreview)
                    ?: replyPreview?.let(::inlineMessagePreview)
            },
            isEdited = msg.optBoolean("isEdited", false),
            remoteMediaId = run {
                val serverContent = msg.optString("content", "")
                decodeWirePayload(serverContent)?.mediaId
            }
            )
        )
    }

    suspend fun sendReaction(otherUserId: Int, targetMessageId: String, emoji: String?): Boolean = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("receiverId", otherUserId)
            .put("content", encodeReactionWirePayload(targetMessageId, emoji))
        val json = request("POST", "/api/messages/send", body) ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun deleteMessage(messageId: String, scope: String = "all"): Boolean = withContext(Dispatchers.IO) {
        val normalizedScope = if (scope.equals("me", ignoreCase = true)) "me" else "all"
        val json = request("DELETE", "/api/messages/$messageId?scope=$normalizedScope") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun editMessage(messageId: String, content: String): SendResult = withContext(Dispatchers.IO) {
        val body = JSONObject().put("content", content.trim())
        val json = request("PUT", "/api/messages/$messageId/edit", body)
            ?: return@withContext SendResult(false, error = "Network error")
        if (!json.optBoolean("success", false)) {
            return@withContext SendResult(false, error = json.optString("error", "Edit failed"))
        }
        val msg = json.optJSONObject("message") ?: return@withContext SendResult(false, error = "Invalid response")
        SendResult(
            success = true,
            message = ChatMessage(
                id = msg.optInt("messageId", 0).toString(),
                isMine = true,
                text = msg.optString("content", ""),
                time = "",
                isEdited = msg.optBoolean("isEdited", true)
            )
        )
    }

    suspend fun fetchMediaBase64(mediaId: String, variant: String = "preview"): String? = withContext(Dispatchers.IO) {
        val id = mediaId.trim()
        if (id.isBlank()) return@withContext null
        val normalized = if (variant.equals("full", ignoreCase = true)) "full" else "preview"
        val bytes = requestBytes("/api/messages/media/$id?variant=$normalized") ?: return@withContext null
        Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    suspend fun clearChat(otherUserId: Int): Boolean = withContext(Dispatchers.IO) {
        val json = request("DELETE", "/api/messages/conversation/$otherUserId/clear") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun markMessageRead(messageId: String): Boolean = withContext(Dispatchers.IO) {
        val json = request("PUT", "/api/messages/$messageId/read") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun markConversationRead(otherUserId: Int): Boolean = withContext(Dispatchers.IO) {
        val json = request("PUT", "/api/messages/$otherUserId/read-all") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun getAdminStats(): AdminStats? = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/admin/dashboard/stats") ?: return@withContext null
        if (!json.optBoolean("success", false)) return@withContext null
        val s = json.optJSONObject("stats") ?: return@withContext null
        AdminStats(
            totalUsers = s.optInt("totalUsers", 0),
            pendingUsers = s.optInt("pendingUsers", 0),
            activeConnections = s.optInt("activeConnections", 0),
            totalMessages = s.optInt("totalMessages", 0),
            pendingResets = s.optInt("pendingResets", 0)
        )
    }

    suspend fun getPendingPasswordResets(): List<PasswordResetRequest> = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/admin/password-resets/pending") ?: return@withContext emptyList()
        if (!json.optBoolean("success", false)) return@withContext emptyList()
        val arr = json.optJSONArray("requests") ?: JSONArray()
        val out = mutableListOf<PasswordResetRequest>()
        for (i in 0 until arr.length()) {
            val r = arr.optJSONObject(i) ?: continue
            out.add(
                PasswordResetRequest(
                    requestId = r.optInt("request_id", 0),
                    userId = r.optInt("userId", 0),
                    username = r.optString("username", ""),
                    email = r.optString("email", ""),
                    status = r.optString("status", "pending"),
                    createdAt = r.optString("created_at", "")
                )
            )
        }
        out
    }

    suspend fun generateResetOtp(requestId: Int): Pair<String, String>? = withContext(Dispatchers.IO) {
        val json = request("POST", "/api/admin/password-resets/$requestId/generate-otp")
            ?: return@withContext null
        if (!json.optBoolean("success", false)) return@withContext null
        val otp = json.optString("otp", "")
        val expiresAt = json.optString("expiresAt", "")
        if (otp.isBlank()) return@withContext null
        otp to expiresAt
    }

    suspend fun dismissResetRequest(requestId: Int): Boolean = withContext(Dispatchers.IO) {
        val json = request("POST", "/api/admin/password-resets/$requestId/dismiss") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun getAdminRecentMessages(limit: Int = 50): List<AdminMessage> = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/admin/messages/recent?limit=$limit") ?: return@withContext emptyList()
        if (!json.optBoolean("success", false)) return@withContext emptyList()
        val arr = json.optJSONArray("messages") ?: JSONArray()
        val out = mutableListOf<AdminMessage>()
        for (i in 0 until arr.length()) {
            val m = arr.optJSONObject(i) ?: continue
            val sender = m.optJSONObject("sender")
            val receiver = m.optJSONObject("receiver")
            out.add(
                AdminMessage(
                    messageId = m.optInt("message_id", 0),
                    from = sender?.optString("username", "unknown") ?: "unknown",
                    to = receiver?.optString("username", "unknown") ?: "unknown",
                    content = m.optString("content", ""),
                    sentAt = formatTime(m.optString("sent_at", ""))
                )
            )
        }
        out
    }

    suspend fun adminDeleteMessage(messageId: Int, scope: String = "all"): Boolean = withContext(Dispatchers.IO) {
        val normalized = when (scope.lowercase(Locale.ROOT)) {
            "sender" -> "sender"
            "receiver" -> "receiver"
            else -> "all"
        }
        val json = request("DELETE", "/api/messages/admin/$messageId?scope=$normalized") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun getAdminConnections(): List<AdminConnection> = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/messages/admin/connections/all") ?: return@withContext emptyList()
        if (!json.optBoolean("success", false)) return@withContext emptyList()
        val arr = json.optJSONArray("connections") ?: JSONArray()
        val out = mutableListOf<AdminConnection>()
        for (i in 0 until arr.length()) {
            val c = arr.optJSONObject(i) ?: continue
            out.add(
                AdminConnection(
                    user1Id = c.optInt("user1Id", 0),
                    user2Id = c.optInt("user2Id", 0),
                    user1Name = c.optString("user1Name", "User 1"),
                    user2Name = c.optString("user2Name", "User 2")
                )
            )
        }
        out
    }

    suspend fun getAdminConversation(user1Id: Int, user2Id: Int): List<AdminConversationMessage> = withContext(Dispatchers.IO) {
        val json = request("GET", "/api/messages/admin/conversation/$user1Id/$user2Id") ?: return@withContext emptyList()
        if (!json.optBoolean("success", false)) return@withContext emptyList()
        val arr = json.optJSONArray("messages") ?: JSONArray()
        val out = mutableListOf<AdminConversationMessage>()
        for (i in 0 until arr.length()) {
            val m = arr.optJSONObject(i) ?: continue
            out.add(
                AdminConversationMessage(
                    messageId = m.optInt("messageId", 0),
                    senderId = m.optInt("senderId", 0),
                    receiverId = m.optInt("receiverId", 0),
                    senderName = m.optString("senderName", "Unknown"),
                    content = m.optString("content", ""),
                    sentAt = formatTime(m.optString("sentAt", ""))
                )
            )
        }
        out
    }

    suspend fun adminClearConversation(user1Id: Int, user2Id: Int): Boolean = withContext(Dispatchers.IO) {
        val json = request("DELETE", "/api/messages/admin/conversation/$user1Id/$user2Id") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun connectRealtime(chatUserId: Int, listener: RealtimeListener): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnectRealtime()
            val session = cachedSession ?: getSession()
            if (!session.authenticated || session.userId <= 0) return@withContext false
            val cookie = CookieManager.getInstance().getCookie(baseUrl).orEmpty()
            if (cookie.isBlank()) return@withContext false

            val opts = IO.Options.builder()
                .setForceNew(true)
                .setReconnection(true)
                .setPath("/socket.io/")
                .setTransports(arrayOf("websocket", "polling"))
                .setExtraHeaders(mapOf("Cookie" to listOf(cookie)))
                .build()

            val socket = IO.socket(baseUrl, opts)

            socket.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "realtime connected chatUserId=$chatUserId")
            }
            socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.w(TAG, "realtime connect error=${args.firstOrNull()}")
            }

            socket.on("new_message") { args ->
                val obj = args.firstOrNull() as? JSONObject ?: return@on
                val senderId = obj.optInt("senderId", 0)
                val receiverId = obj.optInt("receiverId", 0)
                val isRelevant =
                    (senderId == chatUserId && receiverId == session.userId) ||
                    (senderId == session.userId && receiverId == chatUserId)
                if (!isRelevant) return@on

                val contentRaw = obj.optString("content", "")
                val wire = decodeWirePayload(contentRaw)
                val displayText = when {
                    wire?.type == "chat" && !wire.imageBase64.isNullOrBlank() ->
                        INLINE_IMAGE_PREFIX + wire.imageBase64
                    wire?.type == "chat" && !wire.mediaId.isNullOrBlank() ->
                        REMOTE_IMAGE_PREFIX + wire.mediaId
                    wire?.type == "chat" && !wire.text.isNullOrBlank() ->
                        wire.text
                    else -> contentRaw
                }
                listener.onNewMessage(
                    ChatMessage(
                        id = obj.optInt("messageId", 0).toString(),
                        isMine = senderId == session.userId,
                        text = displayText,
                        time = formatTime(obj.optString("sentAt", "")),
                        isDelivered = obj.optBoolean("isDelivered", false),
                        isRead = obj.optBoolean("isRead", false),
                        replyPreview = wire?.replyPreview?.let(::inlineMessagePreview),
                        isEdited = obj.optBoolean("isEdited", false),
                        remoteMediaId = wire?.mediaId
                    )
                )
            }

            socket.on("message_delivered") { args ->
                val obj = args.firstOrNull() as? JSONObject ?: return@on
                listener.onMessageDelivered(obj.opt("messageId")?.toString() ?: return@on)
            }

            socket.on("message_read") { args ->
                val obj = args.firstOrNull() as? JSONObject ?: return@on
                listener.onMessageRead(obj.opt("messageId")?.toString() ?: return@on)
            }

            socket.on("message_edited") { args ->
                val obj = args.firstOrNull() as? JSONObject ?: return@on
                val messageId = obj.opt("messageId")?.toString() ?: return@on
                val contentRaw = obj.optString("content", "")
                val wire = decodeWirePayload(contentRaw)
                val displayText = when {
                    wire?.type == "chat" && !wire.imageBase64.isNullOrBlank() ->
                        INLINE_IMAGE_PREFIX + wire.imageBase64
                    wire?.type == "chat" && !wire.mediaId.isNullOrBlank() ->
                        REMOTE_IMAGE_PREFIX + wire.mediaId
                    wire?.type == "chat" && !wire.text.isNullOrBlank() ->
                        wire.text
                    else -> contentRaw
                }
                listener.onMessageEdited(
                    messageId = messageId,
                    content = displayText,
                    isEdited = obj.optBoolean("isEdited", true),
                    remoteMediaId = wire?.mediaId
                )
            }

            realtimeSocket = socket
            realtimeChatUserId = chatUserId
            socket.connect()
            true
        } catch (e: Exception) {
            Log.e(TAG, "connectRealtime failed: ${e.message}")
            false
        }
    }

    fun disconnectRealtime() {
        try {
            realtimeSocket?.off()
            realtimeSocket?.disconnect()
            realtimeSocket?.close()
        } catch (_: Exception) {
        } finally {
            realtimeSocket = null
            realtimeChatUserId = null
        }
    }

    fun formatTime(iso: String): String {
        if (iso.isBlank()) return ""
        return try {
            val odt = OffsetDateTime.parse(iso)
            odt.atZoneSameInstant(IST_ZONE).format(IST_TIME_FORMAT)
        } catch (_: Exception) {
            iso
        }
    }

    private fun parseEpochMillis(iso: String): Long {
        if (iso.isBlank()) return 0L
        return try {
            OffsetDateTime.parse(iso).toInstant().toEpochMilli()
        } catch (_: Exception) {
            0L
        }
    }

    private fun extractReplyPreview(messageJson: JSONObject): String? {
        val direct = listOf(
            "replyPreview",
            "replyToPreview",
            "reply_to_preview",
            "replyText",
            "reply_to_text",
            "replyContent",
            "reply_content"
        ).firstNotNullOfOrNull { key ->
            messageJson.optString(key, "").takeIf { it.isNotBlank() }
        }
        if (!direct.isNullOrBlank()) return direct

        val nested = messageJson.optJSONObject("replyTo")
            ?: messageJson.optJSONObject("reply_to")
        if (nested != null) {
            return nested.optString("content", "").takeIf { it.isNotBlank() }
                ?: nested.optString("text", "").takeIf { it.isNotBlank() }
        }
        return null
    }

    private fun request(method: String, path: String, body: JSONObject? = null): JSONObject? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10000
                readTimeout = 10000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")

                val cookie = CookieManager.getInstance().getCookie(baseUrl)
                if (!cookie.isNullOrBlank()) {
                    setRequestProperty("Cookie", cookie)
                }

                if (body != null) {
                    doOutput = true
                    OutputStreamWriter(outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
                }
            }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = BufferedReader(stream.reader(Charsets.UTF_8)).use { it.readText() }
            if (code !in 200..299) {
                Log.w(TAG, "HTTP $method $path failed code=$code body=$text")
            }
            if (text.isBlank()) return null
            JSONObject(text)
        } catch (e: Exception) {
            Log.e(TAG, "request failed method=$method path=$path message=${e.message}")
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun requestBytes(path: String): ByteArray? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10000
                readTimeout = 10000
                val cookie = CookieManager.getInstance().getCookie(baseUrl)
                if (!cookie.isNullOrBlank()) {
                    setRequestProperty("Cookie", cookie)
                }
            }
            if (conn.responseCode !in 200..299) return null
            conn.inputStream.use { it.readBytes() }
        } catch (e: Exception) {
            Log.e(TAG, "requestBytes failed path=$path message=${e.message}")
            null
        } finally {
            conn?.disconnect()
        }
    }
}
