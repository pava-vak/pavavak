package com.pavavak.app

import android.content.Context

object AppSecurityPrefs {
    private const val FILE = "pavavak_security"
    private const val KEY_APP_LOCK_ENABLED = "app_lock_enabled"
    private const val KEY_LOCK_TIMEOUT_MS = "lock_timeout_ms"
    private const val KEY_ALLOW_BIOMETRIC_RESUME = "allow_biometric_resume"
    private const val KEY_LAST_BACKGROUND_AT = "last_background_at"
    private const val KEY_LAST_UNLOCK_AT = "last_unlock_at"
    private const val KEY_LOCK_REQUIRED_ON_RESUME = "lock_required_on_resume"
    private const val KEY_HIDE_IN_RECENTS = "hide_in_recents"
    private const val KEY_DECOY_MODE_ACTIVE = "decoy_mode_active"

    fun isAppLockEnabled(context: Context): Boolean =
        context.prefs().getBoolean(KEY_APP_LOCK_ENABLED, true)

    fun setAppLockEnabled(context: Context, enabled: Boolean) {
        context.prefs().edit().putBoolean(KEY_APP_LOCK_ENABLED, enabled).apply()
    }

    fun lockTimeoutMs(context: Context): Long =
        context.prefs().getLong(KEY_LOCK_TIMEOUT_MS, 0L)

    fun setLockTimeoutMs(context: Context, value: Long) {
        context.prefs().edit().putLong(KEY_LOCK_TIMEOUT_MS, value).apply()
    }

    fun allowBiometricOnResume(context: Context): Boolean =
        context.prefs().getBoolean(KEY_ALLOW_BIOMETRIC_RESUME, true)

    fun setAllowBiometricOnResume(context: Context, enabled: Boolean) {
        context.prefs().edit().putBoolean(KEY_ALLOW_BIOMETRIC_RESUME, enabled).apply()
    }

    fun setLastBackgroundAt(context: Context, timeMs: Long) {
        context.prefs().edit().putLong(KEY_LAST_BACKGROUND_AT, timeMs).apply()
    }

    fun lastBackgroundAt(context: Context): Long =
        context.prefs().getLong(KEY_LAST_BACKGROUND_AT, 0L)

    fun setLastUnlockAt(context: Context, timeMs: Long) {
        context.prefs().edit().putLong(KEY_LAST_UNLOCK_AT, timeMs).apply()
    }

    fun lastUnlockAt(context: Context): Long =
        context.prefs().getLong(KEY_LAST_UNLOCK_AT, 0L)

    fun setLockRequiredOnResume(context: Context, required: Boolean) {
        context.prefs().edit().putBoolean(KEY_LOCK_REQUIRED_ON_RESUME, required).apply()
    }

    fun isLockRequiredOnResume(context: Context): Boolean =
        context.prefs().getBoolean(KEY_LOCK_REQUIRED_ON_RESUME, false)

    fun hideInRecentsEnabled(context: Context): Boolean =
        context.prefs().getBoolean(KEY_HIDE_IN_RECENTS, false)

    fun setHideInRecentsEnabled(context: Context, enabled: Boolean) {
        context.prefs().edit().putBoolean(KEY_HIDE_IN_RECENTS, enabled).apply()
    }

    fun isDecoyModeActive(context: Context): Boolean =
        context.prefs().getBoolean(KEY_DECOY_MODE_ACTIVE, false)

    fun setDecoyModeActive(context: Context, active: Boolean) {
        context.prefs().edit().putBoolean(KEY_DECOY_MODE_ACTIVE, active).apply()
    }

    private fun Context.prefs() = getSharedPreferences(FILE, Context.MODE_PRIVATE)
}
