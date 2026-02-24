package com.pavavak.app

import android.content.Intent
import android.webkit.JavascriptInterface

class WebBridge(
    private val activity: MainActivity,
    private val decoyMode: Boolean
) {

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun isDecoyMode(): Boolean = decoyMode

    @JavascriptInterface
    fun lockApp() {
        activity.runOnUiThread {
            val intent = Intent(activity, LockActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            activity.startActivity(intent)
            activity.finish()
        }
    }
}
