import WidgetKit
import SwiftUI

// MARK: - Shared Data Models

private let appGroupId = "group.com.iworkr.app"

struct WidgetData {
    let isLoggedIn: Bool
    let persona: String
    let workspaceName: String
    let timestamp: Date?
    let activeJob: ActiveJobData?
    let nextJob: NextJobData?
    let adminMetrics: AdminMetrics?

    var isStale: Bool {
        guard let ts = timestamp else { return true }
        return Date().timeIntervalSince(ts) > 3600
    }
}

struct ActiveJobData {
    let id: String
    let title: String
    let status: String
    let startTime: Date
    let address: String?
    let clientName: String?
}

struct NextJobData {
    let id: String
    let title: String
    let scheduledTime: Date?
    let address: String?
    let clientName: String?
}

struct AdminMetrics {
    let revenueMTD: Double
    let activeFleetCount: Int
    let urgentAlerts: Int
}

// MARK: - Data Loader

struct WidgetDataLoader {
    static func load() -> WidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            return WidgetData(isLoggedIn: false, persona: "technician", workspaceName: "iWorkr", timestamp: nil, activeJob: nil, nextJob: nil, adminMetrics: nil)
        }

        let isLoggedIn = defaults.string(forKey: "is_logged_in") == "true"
        let persona = defaults.string(forKey: "persona") ?? "technician"
        let workspaceName = defaults.string(forKey: "workspace_name") ?? "iWorkr"

        var timestamp: Date? = nil
        if let ts = defaults.string(forKey: "timestamp") {
            timestamp = ISO8601DateFormatter().date(from: ts)
        }

        let activeJob = parseActiveJob(defaults.string(forKey: "active_job"))
        let nextJob = parseNextJob(defaults.string(forKey: "next_job"))
        let adminMetrics = parseAdminMetrics(defaults.string(forKey: "admin_metrics"))

        return WidgetData(
            isLoggedIn: isLoggedIn,
            persona: persona,
            workspaceName: workspaceName,
            timestamp: timestamp,
            activeJob: activeJob,
            nextJob: nextJob,
            adminMetrics: adminMetrics
        )
    }

    private static func parseActiveJob(_ json: String?) -> ActiveJobData? {
        guard let json = json, let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let id = dict["id"] as? String, let title = dict["title"] as? String,
              let status = dict["status"] as? String, let startStr = dict["start_time"] as? String,
              let startTime = ISO8601DateFormatter().date(from: startStr) else { return nil }
        return ActiveJobData(id: id, title: title, status: status, startTime: startTime,
                             address: dict["address"] as? String, clientName: dict["client_name"] as? String)
    }

    private static func parseNextJob(_ json: String?) -> NextJobData? {
        guard let json = json, let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let id = dict["id"] as? String, let title = dict["title"] as? String else { return nil }
        var scheduledTime: Date? = nil
        if let ts = dict["scheduled_time"] as? String {
            scheduledTime = ISO8601DateFormatter().date(from: ts)
        }
        return NextJobData(id: id, title: title, scheduledTime: scheduledTime,
                           address: dict["address"] as? String, clientName: dict["client_name"] as? String)
    }

    private static func parseAdminMetrics(_ json: String?) -> AdminMetrics? {
        guard let json = json, let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return AdminMetrics(
            revenueMTD: dict["revenue_mtd"] as? Double ?? 0,
            activeFleetCount: dict["active_fleet_count"] as? Int ?? 0,
            urgentAlerts: dict["urgent_alerts"] as? Int ?? 0
        )
    }
}

// MARK: - Obsidian Colors

extension Color {
    static let vantablack = Color(red: 5/255, green: 5/255, blue: 5/255)
    static let zinc950 = Color(red: 9/255, green: 9/255, blue: 11/255)
    static let zinc800 = Color(red: 39/255, green: 39/255, blue: 42/255)
    static let zinc600 = Color(red: 82/255, green: 82/255, blue: 91/255)
    static let zinc500 = Color(red: 113/255, green: 113/255, blue: 122/255)
    static let zinc400 = Color(red: 161/255, green: 161/255, blue: 170/255)
    static let emerald500 = Color(red: 16/255, green: 185/255, blue: 129/255)
    static let emeraldDim = Color(red: 16/255, green: 185/255, blue: 129/255).opacity(0.1)
    static let rose500 = Color(red: 244/255, green: 63/255, blue: 94/255)
    static let hairline = Color.white.opacity(0.05)
}

// MARK: - Timeline Provider

struct iWorkrTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> iWorkrEntry {
        iWorkrEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (iWorkrEntry) -> Void) {
        let data = WidgetDataLoader.load()
        completion(iWorkrEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<iWorkrEntry>) -> Void) {
        let data = WidgetDataLoader.load()
        let entry = iWorkrEntry(date: Date(), data: data)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct iWorkrEntry: TimelineEntry {
    let date: Date
    let data: WidgetData?
}

// MARK: - Widget Views

// ── Next Job Widget (Small) ──────────────────────────────

struct NextJobSmallView: View {
    let entry: iWorkrEntry

    var body: some View {
        if let data = entry.data, data.isLoggedIn, let job = data.nextJob {
            VStack(alignment: .leading, spacing: 4) {
                if let time = job.scheduledTime {
                    Text(time, style: .time)
                        .font(.custom("JetBrainsMono-Bold", size: 22))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
                Text(job.title)
                    .font(.custom("Inter-Medium", size: 13))
                    .foregroundColor(.white)
                    .lineLimit(2)
                Spacer()
                if let addr = job.address {
                    Text(addr)
                        .font(.custom("Inter-Regular", size: 11))
                        .foregroundColor(.zinc500)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(14)
            .background(Color.vantablack)
            .widgetURL(URL(string: "iworkr://job/\(job.id)"))
        } else if let data = entry.data, data.isLoggedIn {
            emptyState("No upcoming jobs")
        } else {
            loggedOutState()
        }
    }
}

// ── Active Timer Widget (Small) ──────────────────────────

struct ActiveTimerSmallView: View {
    let entry: iWorkrEntry

    var body: some View {
        if let data = entry.data, data.isLoggedIn, let job = data.activeJob {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.emerald500)
                        .frame(width: 6, height: 6)
                    Text("LIVE")
                        .font(.custom("JetBrainsMono-Bold", size: 8))
                        .foregroundColor(.emerald500)
                        .tracking(1)
                }

                Text(job.startTime, style: .timer)
                    .font(.custom("JetBrainsMono-Bold", size: 24))
                    .foregroundColor(.emerald500)
                    .monospacedDigit()

                Spacer()

                Text(job.title)
                    .font(.custom("Inter-Medium", size: 12))
                    .foregroundColor(.zinc400)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(14)
            .background(Color.vantablack)
            .widgetURL(URL(string: "iworkr://job/\(job.id)/execute"))
        } else {
            NextJobSmallView(entry: entry)
        }
    }
}

// ── Revenue Widget (Medium) ──────────────────────────────

struct RevenueMediumView: View {
    let entry: iWorkrEntry

    var body: some View {
        if let data = entry.data, data.isLoggedIn, let metrics = data.adminMetrics {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("REVENUE MTD")
                        .font(.custom("JetBrainsMono-Regular", size: 9))
                        .foregroundColor(.zinc500)
                        .tracking(1.5)

                    Text(formatCurrency(metrics.revenueMTD))
                        .font(.custom("JetBrainsMono-Bold", size: 28))
                        .foregroundColor(.white)
                        .privacySensitive()

                    Spacer()

                    if data.isStale {
                        HStack(spacing: 4) {
                            Image(systemName: "icloud.slash")
                                .font(.system(size: 10))
                                .foregroundColor(.zinc600)
                            Text("Data may be stale")
                                .font(.custom("Inter-Regular", size: 10))
                                .foregroundColor(.zinc600)
                        }
                    } else {
                        Text(data.workspaceName)
                            .font(.custom("Inter-Regular", size: 11))
                            .foregroundColor(.zinc600)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.emerald500)
                        Text("+12%")
                            .font(.custom("JetBrainsMono-SemiBold", size: 10))
                            .foregroundColor(.emerald500)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.emeraldDim)
                    .clipShape(RoundedRectangle(cornerRadius: 4))

                    Spacer()

                    if metrics.urgentAlerts > 0 {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.rose500)
                                .frame(width: 6, height: 6)
                            Text("\(metrics.urgentAlerts) alert\(metrics.urgentAlerts > 1 ? "s" : "")")
                                .font(.custom("Inter-Medium", size: 10))
                                .foregroundColor(.rose500)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(16)
            .background(Color.vantablack)
            .widgetURL(URL(string: "iworkr://finance/dashboard"))
        } else if let data = entry.data, data.isLoggedIn {
            emptyState("Revenue data unavailable")
        } else {
            loggedOutState()
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "$"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }
}

// ── Schedule Widget (Medium) ─────────────────────────────

struct ScheduleMediumView: View {
    let entry: iWorkrEntry

    var body: some View {
        if let data = entry.data, data.isLoggedIn {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("TODAY'S SCHEDULE")
                        .font(.custom("JetBrainsMono-Regular", size: 9))
                        .foregroundColor(.zinc500)
                        .tracking(1.5)
                    Spacer()
                    if let active = data.activeJob {
                        HStack(spacing: 3) {
                            Circle().fill(Color.emerald500).frame(width: 5, height: 5)
                            Text("LIVE")
                                .font(.custom("JetBrainsMono-Bold", size: 7))
                                .foregroundColor(.emerald500)
                                .tracking(1)
                        }
                    }
                }

                if let active = data.activeJob {
                    scheduleRow(
                        time: active.startTime,
                        title: active.title,
                        isActive: true
                    )
                }

                if let next = data.nextJob {
                    scheduleRow(
                        time: next.scheduledTime,
                        title: next.title,
                        isActive: false
                    )
                }

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(16)
            .background(Color.vantablack)
            .widgetURL(URL(string: "iworkr://widget/dashboard"))
        } else {
            loggedOutState()
        }
    }

    private func scheduleRow(time: Date?, title: String, isActive: Bool) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(isActive ? Color.emerald500 : Color.zinc600)
                .frame(width: 3, height: 28)

            VStack(alignment: .leading, spacing: 1) {
                if let t = time {
                    Text(t, style: .time)
                        .font(.custom("JetBrainsMono-Medium", size: 11))
                        .foregroundColor(isActive ? .emerald500 : .zinc500)
                        .monospacedDigit()
                }
                Text(title)
                    .font(.custom("Inter-Medium", size: 13))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
            Spacer()
        }
    }
}

// ── Shared States ────────────────────────────────────────

private func emptyState(_ message: String) -> some View {
    VStack {
        Image(systemName: "tray")
            .font(.system(size: 20))
            .foregroundColor(.zinc600)
        Text(message)
            .font(.custom("Inter-Regular", size: 12))
            .foregroundColor(.zinc500)
            .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(14)
    .background(Color.vantablack)
    .widgetURL(URL(string: "iworkr://widget/dashboard"))
}

private func loggedOutState() -> some View {
    VStack(spacing: 6) {
        Image(systemName: "lock.fill")
            .font(.system(size: 20))
            .foregroundColor(.zinc600)
        Text("Open iWorkr\nto get started")
            .font(.custom("Inter-Regular", size: 12))
            .foregroundColor(.zinc500)
            .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(14)
    .background(Color.vantablack)
    .widgetURL(URL(string: "iworkr://auth/login"))
}

// MARK: - Widget Configurations

struct NextJobWidget: Widget {
    let kind = "NextJobWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: iWorkrTimelineProvider()) { entry in
            ActiveTimerSmallView(entry: entry)
                .containerBackground(Color.vantablack, for: .widget)
        }
        .configurationDisplayName("Next Job")
        .description("See your next scheduled job or active timer.")
        .supportedFamilies([.systemSmall])
    }
}

struct RevenueWidget: Widget {
    let kind = "RevenueWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: iWorkrTimelineProvider()) { entry in
            RevenueMediumView(entry: entry)
                .containerBackground(Color.vantablack, for: .widget)
        }
        .configurationDisplayName("Revenue MTD")
        .description("Monthly revenue at a glance.")
        .supportedFamilies([.systemMedium])
    }
}

struct ScheduleWidget: Widget {
    let kind = "ScheduleWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: iWorkrTimelineProvider()) { entry in
            ScheduleMediumView(entry: entry)
                .containerBackground(Color.vantablack, for: .widget)
        }
        .configurationDisplayName("Today's Schedule")
        .description("Your daily job schedule with live status.")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Widget Bundle

@main
struct iWorkrWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextJobWidget()
        RevenueWidget()
        ScheduleWidget()
        iWorkrJobLiveActivity()
    }
}
