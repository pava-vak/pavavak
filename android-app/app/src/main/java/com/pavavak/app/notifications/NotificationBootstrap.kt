package com.pavavak.app.notifications

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.messaging.FirebaseMessaging
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

object NotificationBootstrap {
    private const val PERIODIC_WORK_NAME = "secure_message_notif_periodic"
    private const val ONE_SHOT_WORK_NAME = "secure_message_notif_oneshot"
    private const val REQ_POST_NOTIF = 1201
    private const val PREFS = "notif_bootstrap"
    private const val KEY_LAST_ONESHOT_MS = "last_oneshot_ms"
    private const val ONE_SHOT_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000L

    private const val TAG = "PaVaVakFCM"

    fun initialize(activity: AppCompatActivity) {
        Log.d(TAG, "NotificationBootstrap.initialize called")
        NotificationHelper.ensureChannels(activity)
        ensureNotificationPermission(activity)
        fetchFcmToken(activity)
        scheduleWorkers(activity)
    }

    private fun fetchFcmToken(activity: AppCompatActivity) {
        Log.d(TAG, "Fetching FCM token...")
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                Log.d(TAG, "FCM token fetch success: $token")
                activity.getSharedPreferences("fcm_state", AppCompatActivity.MODE_PRIVATE)
                    .edit()
                    .putString("fcm_token", token)
                    .apply()
                activity.lifecycleScope.launch {
                    val ok = NativeApi.registerFcmToken(token)
                    Log.d(TAG, "FCM token backend sync success=$ok")
                }
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "FCM token fetch failed: ${error.message}", error)
            }
    }

    private fun ensureNotificationPermission(activity: AppCompatActivity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQ_POST_NOTIF
            )
        }
    }

    private fun scheduleWorkers(activity: AppCompatActivity) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodic = PeriodicWorkRequestBuilder<MessageNotificationWorker>(30, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(activity).enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodic
        )

        val prefs = activity.getSharedPreferences(PREFS, AppCompatActivity.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val last = prefs.getLong(KEY_LAST_ONESHOT_MS, 0L)
        if (now - last >= ONE_SHOT_MIN_INTERVAL_MS) {
            val oneShot = OneTimeWorkRequestBuilder<MessageNotificationWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(activity).enqueueUniqueWork(
                ONE_SHOT_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                oneShot
            )
            prefs.edit().putLong(KEY_LAST_ONESHOT_MS, now).apply()
        }
    }
}
