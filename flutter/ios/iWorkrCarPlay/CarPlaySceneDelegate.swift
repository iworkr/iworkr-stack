import CarPlay
import Foundation

// MARK: - CarPlay Scene Delegate

/// iWorkr CarPlay — Projects the daily job schedule onto the vehicle's head unit.
///
/// Uses Apple's predefined templates (CPListTemplate, CPInformationTemplate,
/// CPPointOfInterestTemplate) as CarPlay does not allow custom drawn UI.
///
/// Data is read from the App Group (group.com.iworkr.app) shared with the
/// Flutter app and WidgetKit extensions.
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    private let appGroupId = "group.com.iworkr.app"
    private var interfaceController: CPInterfaceController?

    // MARK: - Lifecycle

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        let rootTemplate = buildScheduleList()
        interfaceController.setRootTemplate(rootTemplate, animated: true, completion: nil)
    }

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        self.interfaceController = nil
    }

    // MARK: - Schedule List Template

    private func buildScheduleList() -> CPListTemplate {
        let jobs = loadScheduleFromAppGroup()

        let items: [CPListItem] = jobs.map { job in
            let item = CPListItem(
                text: job.title,
                detailText: job.address ?? "No address",
                image: UIImage(systemName: job.isActive ? "timer" : "calendar")
            )
            item.handler = { [weak self] _, completion in
                self?.showJobDetail(job)
                completion()
            }
            return item
        }

        let section = CPListSection(items: items, header: "Today's Schedule", sectionIndexTitle: nil)
        let template = CPListTemplate(title: "iWorkr", sections: [section])
        template.emptyViewTitleVariants = ["No Jobs Scheduled"]
        template.emptyViewSubtitleVariants = ["Your schedule is clear today"]
        return template
    }

    // MARK: - Job Detail Template

    private func showJobDetail(_ job: CarPlayJob) {
        var infoItems: [CPInformationItem] = []

        if let client = job.clientName {
            infoItems.append(CPInformationItem(title: "Client", detail: client))
        }
        if let address = job.address {
            infoItems.append(CPInformationItem(title: "Address", detail: address))
        }
        infoItems.append(CPInformationItem(title: "Status", detail: job.status.capitalized))

        var actions: [CPTextButton] = []

        if let address = job.address, let url = buildMapsURL(for: address) {
            actions.append(CPTextButton(title: "Navigate", textStyle: .normal, handler: { _ in
                UIApplication.shared.open(url)
            }))
        }

        actions.append(CPTextButton(title: "Mark Arrived", textStyle: .confirm, handler: { [weak self] _ in
            self?.markArrived(jobId: job.id)
        }))

        let template = CPInformationTemplate(
            title: job.title,
            layout: .leading,
            items: infoItems,
            actions: actions
        )

        interfaceController?.pushTemplate(template, animated: true, completion: nil)
    }

    // MARK: - Actions

    private func markArrived(jobId: String) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        defaults.set(jobId, forKey: "carplay_arrive_job_id")
        defaults.set(ISO8601DateFormatter().string(from: Date()), forKey: "carplay_arrive_timestamp")
    }

    private func buildMapsURL(for address: String) -> URL? {
        let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "http://maps.apple.com/?daddr=\(encoded)")
    }

    // MARK: - Data Loading

    private func loadScheduleFromAppGroup() -> [CarPlayJob] {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return [] }
        var jobs: [CarPlayJob] = []

        if let activeJson = defaults.string(forKey: "active_job"),
           let data = activeJson.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            jobs.append(CarPlayJob(
                id: dict["id"] as? String ?? "",
                title: dict["title"] as? String ?? "Active Job",
                address: dict["address"] as? String,
                clientName: dict["client_name"] as? String,
                status: "in_progress",
                isActive: true
            ))
        }

        if let nextJson = defaults.string(forKey: "next_job"),
           let data = nextJson.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            jobs.append(CarPlayJob(
                id: dict["id"] as? String ?? "",
                title: dict["title"] as? String ?? "Next Job",
                address: dict["address"] as? String,
                clientName: dict["client_name"] as? String,
                status: "scheduled",
                isActive: false
            ))
        }

        return jobs
    }
}

// MARK: - CarPlay Job Model

struct CarPlayJob {
    let id: String
    let title: String
    let address: String?
    let clientName: String?
    let status: String
    let isActive: Bool
}
