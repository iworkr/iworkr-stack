package com.iworkr.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import com.iworkr.app.R
import es.antonborri.home_widget.HomeWidgetPlugin

/**
 * iWorkr Home Screen Widget — Android AppWidget
 *
 * Reads from SharedPreferences populated by the Flutter NativeBridgeService
 * via the home_widget package. Renders the "Next Job" card matching the
 * Obsidian design system (Vantablack background, white/zinc/emerald text).
 */
class iWorkrWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_next_job)

            val prefs = HomeWidgetPlugin.getData(context)

            val nextTitle = prefs.getString("nextJobTitle", "No upcoming jobs") ?: "No upcoming jobs"
            val nextTime = prefs.getString("nextJobTime", "") ?: ""
            val nextAddress = prefs.getString("nextJobAddress", "") ?: ""
            val hasActiveJob = prefs.getBoolean("hasActiveJob", false)

            views.setTextViewText(R.id.widget_next_job_time, formatTime(nextTime))
            views.setTextViewText(R.id.widget_next_job_title, nextTitle)
            views.setTextViewText(R.id.widget_next_job_address, nextAddress)
            views.setViewVisibility(
                R.id.widget_active_indicator,
                if (hasActiveJob) android.view.View.VISIBLE else android.view.View.GONE
            )

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    private fun formatTime(iso: String): String {
        if (iso.isEmpty()) return "--:--"
        return try {
            val instant = java.time.Instant.parse(iso)
            val local = java.time.LocalTime.ofInstant(instant, java.time.ZoneId.systemDefault())
            String.format("%02d:%02d", local.hour, local.minute)
        } catch (_: Exception) {
            if (iso.length <= 5) iso else "--:--"
        }
    }
}
