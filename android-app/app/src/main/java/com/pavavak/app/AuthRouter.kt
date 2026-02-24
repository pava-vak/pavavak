package com.pavavak.app

import android.webkit.CookieManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object AuthRouter {
    suspend fun startUrl(baseUrl: String, cookieManager: CookieManager): String {
        val session = fetchSession(baseUrl, cookieManager)
        return if (!session.authenticated) {
            "$baseUrl/index.html"
        } else if (session.isAdmin) {
            "$baseUrl/admin.html"
        } else {
            "$baseUrl/chat.html"
        }
    }

    private suspend fun fetchSession(baseUrl: String, cookieManager: CookieManager): SessionState {
        return withContext(Dispatchers.IO) {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$baseUrl/api/auth/session")
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Accept", "application/json")
                    val cookie = cookieManager.getCookie(baseUrl)
                    if (!cookie.isNullOrBlank()) {
                        setRequestProperty("Cookie", cookie)
                    }
                }

                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val authenticated = json.optBoolean("authenticated", false)
                val isAdmin = json.optJSONObject("user")?.optBoolean("isAdmin", false) ?: false
                SessionState(authenticated = authenticated, isAdmin = isAdmin)
            } catch (_: Exception) {
                SessionState(authenticated = false, isAdmin = false)
            } finally {
                conn?.disconnect()
            }
        }
    }

    private data class SessionState(
        val authenticated: Boolean,
        val isAdmin: Boolean
    )
}
