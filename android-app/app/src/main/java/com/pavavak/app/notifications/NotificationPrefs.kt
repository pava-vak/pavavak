package com.pavavak.app.notifications

import android.content.Context

object NotificationPrefs {
    private const val FILE = "pavavak_notifications"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_PREVIEW_MODE = "preview_mode"
    private const val KEY_DIRECT_REPLY = "direct_reply"
    private const val KEY_MARK_READ = "mark_read"
    private const val KEY_STEALTH_UNTIL_MS = "stealth_until_ms"
    private const val KEY_ACTIVE_CHAT_ID = "active_chat_id"

    const val PREVIEW_HIDDEN = 0
    const val PREVIEW_NAME_ONLY = 1
    const val PREVIEW_FULL = 2

    private fun prefs(context: Context) =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun notificationsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, true)

    fun setNotificationsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun previewMode(context: Context): Int {
        if (isStealthActive(context)) return PREVIEW_HIDDEN
        return prefs(context).getInt(KEY_PREVIEW_MODE, PREVIEW_NAME_ONLY)
    }

    fun rawPreviewMode(context: Context): Int =
        prefs(context).getInt(KEY_PREVIEW_MODE, PREVIEW_NAME_ONLY)

    fun setPreviewMode(context: Context, mode: Int) {
        prefs(context).edit().putInt(KEY_PREVIEW_MODE, mode.coerceIn(PREVIEW_HIDDEN, PREVIEW_FULL)).apply()
    }

    fun directReplyEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_DIRECT_REPLY, true)

    fun setDirectReplyEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_DIRECT_REPLY, enabled).apply()
    }

    fun markReadEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_MARK_READ, true)

    fun setMarkReadEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_MARK_READ, enabled).apply()
    }

    fun enableStealthFor(context: Context, durationMs: Long) {
        prefs(context).edit()
            .putLong(KEY_STEALTH_UNTIL_MS, System.currentTimeMillis() + durationMs.coerceAtLeast(0L))
            .apply()
    }

    fun clearStealth(context: Context) {
        prefs(context).edit().putLong(KEY_STEALTH_UNTIL_MS, 0L).apply()
    }

    fun stealthUntilMs(context: Context): Long =
        prefs(context).getLong(KEY_STEALTH_UNTIL_MS, 0L)

    fun isStealthActive(context: Context): Boolean =
        stealthUntilMs(context) > System.currentTimeMillis()

    fun setActiveChatId(context: Context, chatUserId: Int?) {
        prefs(context).edit()
            .putInt(KEY_ACTIVE_CHAT_ID, chatUserId ?: 0)
            .apply()
    }

    fun activeChatId(context: Context): Int? {
        val value = prefs(context).getInt(KEY_ACTIVE_CHAT_ID, 0)
        return value.takeIf { it > 0 }
    }
}
