package com.iworkr.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import com.iworkr.app.R
import org.json.JSONObject

/**
 * iWorkr Home Screen Widget — Reads from SharedPreferences (App Group mirror)
 * and renders the next job or active timer in the Obsidian theme.
 *
 * The Flutter NativeBridgeService writes JSON payloads to SharedPreferences
 * via the home_widget package, and this provider reads them.
 */
class iWorkrWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "HomeWidgetPreferences"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        for (appWidgetId in appWidgetIds) {
            val views = buildRemoteViews(context, prefs)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun buildRemoteViews(context: Context, prefs: SharedPreferences): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_job)
        val isLoggedIn = prefs.getString("is_logged_in", "false") == "true"

        if (!isLoggedIn) {
            views.setTextViewText(R.id.widget_title, "Open iWorkr")
            views.setTextViewText(R.id.widget_subtitle, "to get started")
            views.setTextViewText(R.id.widget_time, "")
            return views
        }

        // Try active job first
        val activeJson = prefs.getString("active_job", null)
        if (activeJson != null) {
            try {
                val job = JSONObject(activeJson)
                views.setTextViewText(R.id.widget_title, job.optString("title", "Active Job"))
                views.setTextViewText(R.id.widget_subtitle, job.optString("address", ""))
                views.setTextViewText(R.id.widget_time, "● LIVE")
                return views
            } catch (_: Exception) {}
        }

        // Fall back to next job
        val nextJson = prefs.getString("next_job", null)
        if (nextJson != null) {
            try {
                val job = JSONObject(nextJson)
                views.setTextViewText(R.id.widget_title, job.optString("title", "Next Job"))
                views.setTextViewText(R.id.widget_subtitle, job.optString("address", ""))
                val time = job.optString("scheduled_time", "")
                views.setTextViewText(R.id.widget_time, if (time.isNotEmpty()) time.substring(11, 16) else "")
                return views
            } catch (_: Exception) {}
        }

        views.setTextViewText(R.id.widget_title, "No upcoming jobs")
        views.setTextViewText(R.id.widget_subtitle, "")
        views.setTextViewText(R.id.widget_time, "")
        return views
    }
}
