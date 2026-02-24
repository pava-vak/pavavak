package com.pavavak.app

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

object ThemeManager {
    private const val PREFS = "pavavak_settings"
    private const val KEY_THEME = "theme_mode"
    const val MODE_LIGHT = "light"
    const val MODE_DARK = "dark"

    fun apply(context: Context) {
        val mode = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_THEME, MODE_LIGHT) ?: MODE_LIGHT
        AppCompatDelegate.setDefaultNightMode(
            if (mode == MODE_DARK) AppCompatDelegate.MODE_NIGHT_YES
            else AppCompatDelegate.MODE_NIGHT_NO
        )
    }

    fun set(context: Context, mode: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_THEME, mode)
            .apply()
        apply(context)
    }

    fun isDark(context: Context): Boolean {
        val mode = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_THEME, MODE_LIGHT) ?: MODE_LIGHT
        return mode == MODE_DARK
    }
}
