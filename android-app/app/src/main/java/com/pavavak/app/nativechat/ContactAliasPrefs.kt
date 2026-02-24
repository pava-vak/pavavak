package com.pavavak.app.nativechat

import android.content.Context

object ContactAliasPrefs {
    private const val FILE = "pavavak_contact_aliases"

    fun aliasFor(context: Context, userId: Int, fallback: String): String {
        val key = key(userId)
        val alias = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(key, null)
        return alias?.takeIf { it.isNotBlank() } ?: fallback
    }

    fun setAlias(context: Context, userId: Int, alias: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(key(userId), alias.trim())
            .apply()
    }

    fun clearAlias(context: Context, userId: Int) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .remove(key(userId))
            .apply()
    }

    private fun key(userId: Int): String = "alias_$userId"
}

