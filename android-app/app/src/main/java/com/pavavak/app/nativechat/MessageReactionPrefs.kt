package com.pavavak.app.nativechat

import android.content.Context

object MessageReactionPrefs {
    private const val FILE = "pavavak_message_reactions"

    fun setReaction(context: Context, chatUserId: Int, messageId: String, reaction: String?) {
        val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
        val key = key(chatUserId, messageId)
        if (reaction.isNullOrBlank()) {
            prefs.remove(key)
        } else {
            prefs.putString(key, reaction)
        }
        prefs.apply()
    }

    fun getReaction(context: Context, chatUserId: Int, messageId: String): String? {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(key(chatUserId, messageId), null)
    }

    fun clearReactionsForMessages(context: Context, chatUserId: Int, messageIds: Collection<String>) {
        val editor = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
        messageIds.forEach { editor.remove(key(chatUserId, it)) }
        editor.apply()
    }

    private fun key(chatUserId: Int, messageId: String): String = "${chatUserId}_$messageId"
}

