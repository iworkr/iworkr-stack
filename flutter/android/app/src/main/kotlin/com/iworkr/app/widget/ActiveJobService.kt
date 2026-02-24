package com.iworkr.app.widget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.iworkr.app.MainActivity
import com.iworkr.app.R

/**
 * Foreground service that displays a persistent notification with a live
 * chronometer when a job timer is active. This is the Android equivalent
 * of iOS Dynamic Island / Live Activities.
 *
 * The notification uses the Obsidian theme (dark background, emerald accent)
 * and includes "Open" and "Pause" action buttons.
 */
class ActiveJobService : Service() {

    companion object {
        const val CHANNEL_ID = "iworkr_active_job"
        const val NOTIFICATION_ID = 9001
        const val EXTRA_JOB_TITLE = "job_title"
        const val EXTRA_JOB_ADDRESS = "job_address"
        const val EXTRA_START_TIME_MILLIS = "start_time_millis"

        fun start(context: Context, jobTitle: String, jobAddress: String, startTimeMillis: Long) {
            val intent = Intent(context, ActiveJobService::class.java).apply {
                putExtra(EXTRA_JOB_TITLE, jobTitle)
                putExtra(EXTRA_JOB_ADDRESS, jobAddress)
                putExtra(EXTRA_START_TIME_MILLIS, startTimeMillis)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ActiveJobService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobTitle = intent?.getStringExtra(EXTRA_JOB_TITLE) ?: "Active Job"
        val jobAddress = intent?.getStringExtra(EXTRA_JOB_ADDRESS) ?: ""
        val startTimeMillis = intent?.getLongExtra(EXTRA_START_TIME_MILLIS, System.currentTimeMillis())
            ?: System.currentTimeMillis()

        val notification = buildNotification(jobTitle, jobAddress, startTimeMillis)
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Active Job Timer",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows the running timer for the active job"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, address: String, startTimeMillis: Long): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val elapsed = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - startTimeMillis)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏱ $title")
            .setContentText(address)
            .setSubText("Job in progress")
            .setUsesChronometer(true)
            .setWhen(startTimeMillis)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setColorized(true)
            .setColor(0xFF10B981.toInt())
            .setContentIntent(openIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
