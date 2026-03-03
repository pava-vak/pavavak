package com.pavavak.app.nativechat

import android.content.Context
import android.webkit.CookieManager
import android.util.Log
import com.pavavak.app.BuildConfig
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
    val error: String = ""
)

object NativeApi {

    private val baseUrl: String = BuildConfig.BASE_URL.trimEnd('/')
    private const val TAG = "PaVaVakApi"
    private val IST_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")
    private val IST_TIME_FORMAT: DateTimeFormatter =
        DateTimeFormatter.ofPattern("h:mm a", Locale("en", "IN"))

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
            val error = json.optString("error", if (ok) "" else "Login failed")
            LoginResult(ok, isAdmin, error)
        } catch (e: Exception) {
            LoginResult(false, false, e.message ?: "Login failed")
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        request("POST", "/api/auth/logout")
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
        SessionInfo(authenticated, userId, isAdmin)
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
            fullName = user.optString("fullName", "")
        )
    }

    suspend fun updateProfileName(fullName: String): Boolean = withContext(Dispatchers.IO) {
        val body = JSONObject().put("fullName", fullName.trim())
        val json = request("PUT", "/api/users/profile", body) ?: return@withContext false
        json.optBoolean("success", false)
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

            val last = c.optJSONObject("lastMessage")
            val contentRaw = last?.optString("content", "") ?: ""
            val wire = decodeWirePayload(contentRaw)
            val content = when {
                wire?.type == "reaction" -> {
                    val emoji = wire.reactionEmoji?.ifBlank { "removed reaction" } ?: "reacted"
                    "Reaction: $emoji"
                }
                wire?.type == "chat" && !wire.imageBase64.isNullOrBlank() -> "Photo"
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
                    lastSentAtEpochMs = parseEpochMillis(sentAt)
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

    suspend fun getMessages(otherUserId: Int): List<ChatMessage> = withContext(Dispatchers.IO) {
        val session = getSession()
        if (!session.authenticated) {
            Log.w(TAG, "getMessages aborted: session not authenticated")
            return@withContext emptyList()
        }

        val json = request("GET", "/api/messages/$otherUserId")
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

    suspend fun deleteMessage(messageId: String): Boolean = withContext(Dispatchers.IO) {
        val json = request("DELETE", "/api/messages/$messageId") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun clearChat(otherUserId: Int): Boolean = withContext(Dispatchers.IO) {
        val json = request("DELETE", "/api/messages/conversation/$otherUserId/clear") ?: return@withContext false
        json.optBoolean("success", false)
    }

    suspend fun markMessageRead(messageId: String): Boolean = withContext(Dispatchers.IO) {
        val json = request("PUT", "/api/messages/$messageId/read") ?: return@withContext false
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

    suspend fun adminDeleteMessage(messageId: Int): Boolean = withContext(Dispatchers.IO) {
        val json = request("DELETE", "/api/admin/messages/$messageId") ?: return@withContext false
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

    private fun formatTime(iso: String): String {
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
}
