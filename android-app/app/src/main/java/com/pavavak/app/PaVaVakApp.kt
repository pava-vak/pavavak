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
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PaVaVakApp : Application(), Application.ActivityLifecycleCallbacks {
    private val tag = "PaVaVakLock"
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var startedCount = 0
    private var lockLaunchInProgress = false
    private var quickPollJob: Job? = null
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
                        stopQuickPoll()
                    }
                    Lifecycle.Event.ON_STOP -> {
                        // Reliable app-level background marker (covers minimize/app switch).
                        AppSecurityPrefs.setLastBackgroundAt(this, System.currentTimeMillis())
                        AppSecurityPrefs.setLockRequiredOnResume(this, true)
                        appWasInBackground = true
                        Log.i(tag, "Process ON_STOP -> lock_required_on_resume=true")
                        startQuickPoll()
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
            AppSecurityPrefs.setLastBackgroundAt(this, System.currentTimeMillis())
            AppSecurityPrefs.setLockRequiredOnResume(this, true)
            appWasInBackground = true
            Log.i(tag, "Activity count zero -> lock_required_on_resume=true")
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

    private fun startQuickPoll() {
        if (quickPollJob != null) return
        quickPollJob = appScope.launch(Dispatchers.IO) {
            while (true) {
                try {
                    NotificationHelper.ensureChannels(this@PaVaVakApp)
                    val session = NativeApi.getSession()
                    if (session.authenticated) {
                        val unread = NativeApi.getTotalUnreadCount()
                        val hint = if (unread > 0) NativeApi.getUnreadNotificationHint() else null
                        NotificationHelper.showHiddenMessageNotification(this@PaVaVakApp, unread, hint)
                    }
                } catch (_: Exception) {
                }
                delay(20_000)
            }
        }
    }

    private fun applyRecentsPrivacy(activity: Activity) {
        if (AppSecurityPrefs.hideInRecentsEnabled(activity)) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    private fun stopQuickPoll() {
        quickPollJob?.cancel()
        quickPollJob = null
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: android.os.Bundle?) {
        applyRecentsPrivacy(activity)
    }
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: android.os.Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
}
