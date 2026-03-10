package com.pavavak.app.nativechat

import android.util.Base64
import org.json.JSONObject

const val INLINE_IMAGE_PREFIX = "__img__:data:image/jpeg;base64,"
const val REMOTE_IMAGE_PREFIX = "__img_remote__:"
private const val WIRE_PREFIX = "__pvk_v1__:"

fun isInlineImagePayload(text: String?): Boolean {
    return !text.isNullOrBlank() && text.startsWith(INLINE_IMAGE_PREFIX)
}

fun extractInlineImageBase64(text: String?): String? {
    if (!isInlineImagePayload(text)) return null
    return text!!.removePrefix(INLINE_IMAGE_PREFIX)
}

fun inlineMessagePreview(text: String?): String {
    return if (isInlineImagePayload(text)) "Photo" else text.orEmpty()
}

fun isRemoteImagePayload(text: String?): Boolean {
    return !text.isNullOrBlank() && text.startsWith(REMOTE_IMAGE_PREFIX)
}

fun extractRemoteMediaId(text: String?): String? {
    if (!isRemoteImagePayload(text)) return null
    return text!!.removePrefix(REMOTE_IMAGE_PREFIX).ifBlank { null }
}

data class WirePayload(
    val type: String,
    val text: String? = null,
    val replyPreview: String? = null,
    val imageBase64: String? = null,
    val mediaId: String? = null,
    val mediaMime: String? = null,
    val reactionTargetId: String? = null,
    val reactionEmoji: String? = null
)

fun encodeChatWirePayload(
    text: String?,
    replyPreview: String?,
    imageBase64: String?
): String {
    val obj = JSONObject()
        .put("t", "chat")
    if (!text.isNullOrBlank()) obj.put("text", text)
    if (!replyPreview.isNullOrBlank()) obj.put("replyPreview", replyPreview)
    if (!imageBase64.isNullOrBlank()) obj.put("imageBase64", imageBase64)
    val raw = obj.toString().toByteArray(Charsets.UTF_8)
    return WIRE_PREFIX + Base64.encodeToString(raw, Base64.NO_WRAP)
}

fun encodeReactionWirePayload(targetMessageId: String, emoji: String?): String {
    val obj = JSONObject()
        .put("t", "reaction")
        .put("target", targetMessageId)
        .put("emoji", emoji ?: "")
    val raw = obj.toString().toByteArray(Charsets.UTF_8)
    return WIRE_PREFIX + Base64.encodeToString(raw, Base64.NO_WRAP)
}

fun decodeWirePayload(content: String?): WirePayload? {
    if (content.isNullOrBlank() || !content.startsWith(WIRE_PREFIX)) return null
    return try {
        val jsonBytes = Base64.decode(content.removePrefix(WIRE_PREFIX), Base64.NO_WRAP)
        val obj = JSONObject(String(jsonBytes, Charsets.UTF_8))
        WirePayload(
            type = obj.optString("t", ""),
            text = obj.optString("text", "").ifBlank { null },
            replyPreview = obj.optString("replyPreview", "").ifBlank { null },
            imageBase64 = obj.optString("imageBase64", "").ifBlank { null },
            mediaId = obj.opt("mediaId")?.toString()?.ifBlank { null },
            mediaMime = obj.optString("mediaMime", "").ifBlank { null },
            reactionTargetId = obj.optString("target", "").ifBlank { null },
            reactionEmoji = obj.optString("emoji", "")
        )
    } catch (_: Exception) {
        null
    }
}
