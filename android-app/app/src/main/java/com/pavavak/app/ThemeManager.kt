package com.pavavak.app

import android.content.Context
import android.graphics.Color
import androidx.appcompat.app.AppCompatDelegate

object ThemeManager {
    private const val PREFS = "pavavak_settings"
    private const val KEY_THEME = "theme_mode"
    private const val KEY_COLOR_COMBO = "color_combo"
    const val MODE_LIGHT = "light"
    const val MODE_DARK = "dark"
    const val COMBO_OCEAN = "ocean"
    const val COMBO_FOREST = "forest"
    const val COMBO_SUNSET = "sunset"

    data class ChatColors(
        val mineBubble: Int,
        val otherBubble: Int,
        val reactionBg: Int
    )

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

    fun setColorCombo(context: Context, combo: String) {
        val safeCombo = when (combo) {
            COMBO_FOREST, COMBO_SUNSET -> combo
            else -> COMBO_OCEAN
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_COLOR_COMBO, safeCombo)
            .apply()
    }

    fun getColorCombo(context: Context): String {
        val combo = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_COLOR_COMBO, COMBO_OCEAN) ?: COMBO_OCEAN
        return when (combo) {
            COMBO_FOREST, COMBO_SUNSET -> combo
            else -> COMBO_OCEAN
        }
    }

    fun getChatColors(context: Context): ChatColors {
        return when (getColorCombo(context)) {
            COMBO_FOREST -> ChatColors(
                mineBubble = Color.parseColor("#2E7D32"),
                otherBubble = Color.parseColor("#E8F3E9"),
                reactionBg = Color.parseColor("#CDE8D0")
            )
            COMBO_SUNSET -> ChatColors(
                mineBubble = Color.parseColor("#D3542A"),
                otherBubble = Color.parseColor("#FCEEE7"),
                reactionBg = Color.parseColor("#F9D7C8")
            )
            else -> ChatColors(
                mineBubble = Color.parseColor("#2A6DE2"),
                otherBubble = Color.parseColor("#E4EBF7"),
                reactionBg = Color.parseColor("#D3DDF0")
            )
        }
    }
}
