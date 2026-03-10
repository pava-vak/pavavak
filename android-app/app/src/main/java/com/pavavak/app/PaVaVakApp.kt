package com.pavavak.app

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.WindowManager
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import com.pavavak.app.data.local.LocalDatabaseProvider
import com.pavavak.app.nativechat.NativeApi
import com.pavavak.app.notifications.NotificationHelper
import com.pavavak.app.sync.PendingSyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

class PaVaVakApp : Application(), Application.ActivityLifecycleCallbacks {
    private val tag = "PaVaVakLock"
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var startedCount = 0
    private var lockLaunchInProgress = false
    private var appWasInBackground = false

    override fun onCreate() {
        super.onCreate()
        // Ensure notification channels exist even before any activity UI opens.
        NotificationHelper.ensureChannels(this)
        ThemeManager.apply(this)
        LocalDatabaseProvider.get(this)
        PendingSyncScheduler.ensurePeriodic(this)
        registerActivityLifecycleCallbacks(this)

        ProcessLifecycleOwner.get().lifecycle.addObserver(
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> {
                        isProcessInForeground = true
                        appScope.launch {
                            runCatching { NativeApi.sendPresenceHeartbeat() }
                            runCatching { NativeApi.registerFcmTokenFromPrefs(this@PaVaVakApp) }
                        }
                    }
                    Lifecycle.Event.ON_STOP -> {
                        isProcessInForeground = false
                        // Reliable app-level background marker (covers minimize/app switch).
                        AppSecurityPrefs.setLastBackgroundAt(this, System.currentTimeMillis())
                        AppSecurityPrefs.setLockRequiredOnResume(this, true)
                        appWasInBackground = true
                        Log.i(tag, "Process ON_STOP -> lock_required_on_resume=true")
                        appScope.launch {
                            runCatching { NativeApi.markPresenceOffline() }
                        }
                    }
                    else -> Unit
                }
            }
        )
    }

    override fun onTerminate() {
        super.onTerminate()
        appScope.cancel()
    }

    override fun onActivityStarted(activity: Activity) {
        startedCount += 1
        if (!appWasInBackground) return
        if (activity is LockActivity || activity is LoginActivity) return
        if (lockLaunchInProgress) return
        if (!shouldShowLock(activity)) {
            appWasInBackground = false
            return
        }

        lockLaunchInProgress = true
        Log.i(tag, "Launching lock overlay from onActivityStarted for ${activity::class.java.simpleName}")
        val lockIntent = Intent(activity, LockActivity::class.java).apply {
            putExtra(LockActivity.EXTRA_OVERLAY_UNLOCK_ONLY, true)
            putExtra(
                LockActivity.EXTRA_ALLOW_BIOMETRIC,
                AppSecurityPrefs.allowBiometricOnResume(activity)
            )
        }
        activity.startActivity(lockIntent)
    }

    override fun onActivityStopped(activity: Activity) {
        startedCount = (startedCount - 1).coerceAtLeast(0)
        if (startedCount == 0) {
            // Do not mark background here; during Activity-to-Activity navigation
            // startedCount can briefly become 0 and would cause false lock triggers.
            // ProcessLifecycle ON_STOP is the reliable background signal.
            Log.i(tag, "Activity count zero (waiting for process ON_STOP if app actually backgrounded)")
            lockLaunchInProgress = false
        }
    }

    override fun onActivityResumed(activity: Activity) {
        applyRecentsPrivacy(activity)
        Log.i(tag, "onActivityResumed ${activity::class.java.simpleName}")
        if (activity is LockActivity || activity is LoginActivity) {
            lockLaunchInProgress = false
            Log.i(tag, "Skipping lock for ${activity::class.java.simpleName}")
            return
        }
        appWasInBackground = false
        if (!shouldShowLock(activity)) {
            Log.i(tag, "Lock check false on resume for ${activity::class.java.simpleName}")
            return
        }
        if (lockLaunchInProgress) return

        lockLaunchInProgress = true
        Log.i(tag, "Launching lock overlay for ${activity::class.java.simpleName}")
        val lockIntent = Intent(activity, LockActivity::class.java).apply {
            putExtra(LockActivity.EXTRA_OVERLAY_UNLOCK_ONLY, true)
            putExtra(
                LockActivity.EXTRA_ALLOW_BIOMETRIC,
                AppSecurityPrefs.allowBiometricOnResume(activity)
            )
        }
        activity.startActivity(lockIntent)
    }

    private fun shouldShowLock(activity: Activity): Boolean {
        if (!AppSecurityPrefs.isAppLockEnabled(activity)) {
            Log.i(tag, "App lock disabled")
            return false
        }
        val hasRealPin = activity
            .getSharedPreferences("pavavak_lock", Context.MODE_PRIVATE)
            .getString("real_pin_hash", null) != null
        if (!hasRealPin) {
            Log.i(tag, "No real PIN set")
            return false
        }

        if (!AppSecurityPrefs.isLockRequiredOnResume(activity)) {
            Log.i(tag, "Lock not required on resume")
            return false
        }
        val timeoutMs = AppSecurityPrefs.lockTimeoutMs(activity)
        if (timeoutMs <= 0L) {
            Log.i(tag, "Lock timeout immediate -> require lock")
            return true
        }

        val lastBg = AppSecurityPrefs.lastBackgroundAt(activity)
        if (lastBg <= 0L) {
            Log.i(tag, "Missing last background timestamp -> require lock")
            return true
        }

        val elapsed = System.currentTimeMillis() - lastBg
        Log.i(tag, "Lock timeout check elapsed=$elapsed timeout=$timeoutMs")
        return elapsed >= timeoutMs
    }

    private fun applyRecentsPrivacy(activity: Activity) {
        if (AppSecurityPrefs.hideInRecentsEnabled(activity)) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: android.os.Bundle?) {
        applyRecentsPrivacy(activity)
    }
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: android.os.Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit

    companion object {
        @Volatile
        var isProcessInForeground: Boolean = false
    }
}
