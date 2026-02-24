import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Live Activity Attributes

struct iWorkrJobAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status: String
        var elapsedSeconds: Int
    }

    var jobId: String
    var jobTitle: String
    var address: String
    var clientName: String
    var startTime: String
}

// MARK: - Live Activity Widget

struct iWorkrJobLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: iWorkrJobAttributes.self) { context in
            // Lock Screen Banner
            lockScreenBanner(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded View
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Active Job")
                            .font(.custom("JetBrainsMono-Regular", size: 9))
                            .foregroundColor(.zinc500)
                            .tracking(1)
                        Text(context.attributes.jobTitle)
                            .font(.custom("Inter-SemiBold", size: 14))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let startDate = ISO8601DateFormatter().date(from: context.attributes.startTime) {
                        Text(startDate, style: .timer)
                            .font(.custom("JetBrainsMono-Bold", size: 16))
                            .foregroundColor(.emerald500)
                            .monospacedDigit()
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .padding(.trailing, 4)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 12) {
                        HStack(spacing: 6) {
                            Image(systemName: "mappin")
                                .font(.system(size: 10))
                                .foregroundColor(.zinc500)
                            Text(context.attributes.address)
                                .font(.custom("Inter-Regular", size: 12))
                                .foregroundColor(.zinc400)
                                .lineLimit(1)
                        }

                        Spacer()

                        Link(destination: URL(string: "iworkr://job/\(context.attributes.jobId)/execute")!) {
                            Text("Open")
                                .font(.custom("Inter-SemiBold", size: 12))
                                .foregroundColor(.emerald500)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 5)
                                .background(Color.emeraldDim)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                // Compact Leading: W logo
                Image(systemName: "wrench.and.screwdriver.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.emerald500)
            } compactTrailing: {
                // Compact Trailing: Live timer
                if let startDate = ISO8601DateFormatter().date(from: context.attributes.startTime) {
                    Text(startDate, style: .timer)
                        .font(.custom("JetBrainsMono-Bold", size: 12))
                        .foregroundColor(.emerald500)
                        .monospacedDigit()
                }
            } minimal: {
                Image(systemName: "wrench.and.screwdriver.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.emerald500)
            }
        }
    }

    // MARK: - Lock Screen Banner

    @ViewBuilder
    private func lockScreenBanner(context: ActivityViewContext<iWorkrJobAttributes>) -> some View {
        HStack(spacing: 14) {
            // Timer
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.emerald500)
                        .frame(width: 6, height: 6)
                    Text("IN PROGRESS")
                        .font(.custom("JetBrainsMono-Bold", size: 8))
                        .foregroundColor(.emerald500)
                        .tracking(1)
                }

                if let startDate = ISO8601DateFormatter().date(from: context.attributes.startTime) {
                    Text(startDate, style: .timer)
                        .font(.custom("JetBrainsMono-Bold", size: 26))
                        .foregroundColor(.emerald500)
                        .monospacedDigit()
                }
            }

            Spacer()

            // Job info
            VStack(alignment: .trailing, spacing: 2) {
                Text(context.attributes.jobTitle)
                    .font(.custom("Inter-SemiBold", size: 14))
                    .foregroundColor(.white)
                    .lineLimit(1)

                Text(context.attributes.address)
                    .font(.custom("Inter-Regular", size: 12))
                    .foregroundColor(.zinc500)
                    .lineLimit(1)

                if !context.attributes.clientName.isEmpty {
                    Text(context.attributes.clientName)
                        .font(.custom("Inter-Regular", size: 11))
                        .foregroundColor(.zinc600)
                        .lineLimit(1)
                }
            }
        }
        .padding(16)
        .background(Color.zinc950)
    }
}
