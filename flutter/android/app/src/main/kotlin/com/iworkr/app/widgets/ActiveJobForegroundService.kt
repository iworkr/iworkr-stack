package com.iworkr.app.widgets

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.iworkr.app.MainActivity
import com.iworkr.app.R

/**
 * Active Job Foreground Service — Persistent Notification
 *
 * Shows the running job timer in the notification shade with
 * Vantablack/Emerald Obsidian styling via custom RemoteViews.
 * Uses a native Chronometer widget for zero-CPU timer ticking.
 */
class ActiveJobForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "iworkr_active_job"
        const val NOTIFICATION_ID = 42
        const val EXTRA_JOB_TITLE = "job_title"
        const val EXTRA_JOB_ADDRESS = "job_address"
        const val EXTRA_START_TIME = "start_time"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobTitle = intent?.getStringExtra(EXTRA_JOB_TITLE) ?: "Active Job"
        val jobAddress = intent?.getStringExtra(EXTRA_JOB_ADDRESS) ?: ""
        val startTime = intent?.getLongExtra(EXTRA_START_TIME, System.currentTimeMillis()) ?: System.currentTimeMillis()

        val notification = buildNotification(jobTitle, jobAddress, startTime)
        startForeground(NOTIFICATION_ID, notification)

        return START_STICKY
    }

    private fun buildNotification(title: String, address: String, startTime: Long): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingOpen = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏱ $title")
            .setContentText(address)
            .setUsesChronometer(true)
            .setWhen(startTime)
            .setOngoing(true)
            .setColor(0xFF10B981.toInt())
            .setContentIntent(pendingOpen)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Active Job Timer",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows the running timer for your active job"
            setShowBadge(false)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }
}
