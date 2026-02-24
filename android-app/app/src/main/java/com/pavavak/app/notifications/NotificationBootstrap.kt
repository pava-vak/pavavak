package com.pavavak.app.notifications

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.messaging.FirebaseMessaging
import java.util.concurrent.TimeUnit

object NotificationBootstrap {
    private const val PERIODIC_WORK_NAME = "secure_message_notif_periodic"
    private const val ONE_SHOT_WORK_NAME = "secure_message_notif_oneshot"
    private const val REQ_POST_NOTIF = 1201

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

        val periodic = PeriodicWorkRequestBuilder<MessageNotificationWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(activity).enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodic
        )

        val oneShot = OneTimeWorkRequestBuilder<MessageNotificationWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(activity).enqueueUniqueWork(
            ONE_SHOT_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            oneShot
        )
    }
}
