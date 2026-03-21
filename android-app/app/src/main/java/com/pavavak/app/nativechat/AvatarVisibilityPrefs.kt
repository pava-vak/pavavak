package com.pavavak.app.nativechat

import android.content.Context

object AvatarVisibilityPrefs {
    private const val FILE = "pavavak_avatar_visibility"

    fun isHidden(context: Context, userId: Int): Boolean {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getBoolean(key(userId), false)
    }

    fun setHidden(context: Context, userId: Int, hidden: Boolean) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(key(userId), hidden)
            .apply()
    }

    private fun key(userId: Int): String = "hidden_$userId"
}
