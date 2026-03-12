/// Sentinel Alert model — maps to public.sentinel_alerts
/// Project Nightingale Phase 4: Automated risk detection
class SentinelAlert {
  final String id;
  final String organizationId;
  final String alertType;
  final SentinelSeverity severity;
  final SentinelStatus status;
  final String title;
  final String description;
  final String? participantId;
  final String? workerId;
  final String? shiftId;
  final String? sourceTable;
  final String? sourceId;
  final List<String> triggeredKeywords;
  final String? acknowledgedBy;
  final DateTime? acknowledgedAt;
  final String? resolutionAction;
  final String? resolutionNotes;
  final DateTime? resolvedAt;
  final DateTime createdAt;
  // Joined
  final String? participantName;
  final String? workerName;

  const SentinelAlert({
    required this.id,
    required this.organizationId,
    required this.alertType,
    required this.severity,
    required this.status,
    required this.title,
    required this.description,
    this.participantId,
    this.workerId,
    this.shiftId,
    this.sourceTable,
    this.sourceId,
    this.triggeredKeywords = const [],
    this.acknowledgedBy,
    this.acknowledgedAt,
    this.resolutionAction,
    this.resolutionNotes,
    this.resolvedAt,
    required this.createdAt,
    this.participantName,
    this.workerName,
  });

  factory SentinelAlert.fromJson(Map<String, dynamic> json) {
    final participant = json['participant_profiles'] as Map<String, dynamic>?;
    final worker = json['profiles'] as Map<String, dynamic>?;

    return SentinelAlert(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      alertType: json['alert_type'] as String,
      severity: SentinelSeverity.fromString(json['severity'] as String? ?? 'warning'),
      status: SentinelStatus.fromString(json['status'] as String? ?? 'active'),
      title: json['title'] as String,
      description: json['description'] as String,
      participantId: json['participant_id'] as String?,
      workerId: json['worker_id'] as String?,
      shiftId: json['shift_id'] as String?,
      sourceTable: json['source_table'] as String?,
      sourceId: json['source_id'] as String?,
      triggeredKeywords: (json['triggered_keywords'] as List<dynamic>?)?.cast<String>() ?? [],
      acknowledgedBy: json['acknowledged_by'] as String?,
      acknowledgedAt: json['acknowledged_at'] != null ? DateTime.tryParse(json['acknowledged_at'] as String) : null,
      resolutionAction: json['resolution_action'] as String?,
      resolutionNotes: json['resolution_notes'] as String?,
      resolvedAt: json['resolved_at'] != null ? DateTime.tryParse(json['resolved_at'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      participantName: participant?['full_name'] as String? ?? participant?['preferred_name'] as String?,
      workerName: worker?['full_name'] as String?,
    );
  }

  bool get isActive => status == SentinelStatus.active;
  bool get isCritical => severity == SentinelSeverity.critical;
  bool get hasKeywords => triggeredKeywords.isNotEmpty;

  String get alertTypeLabel {
    switch (alertType) {
      case 'progress_note_keywords': return 'Keyword Detection';
      case 'health_baseline_deviation': return 'Health Trend';
      case 'medication_non_compliance': return 'Medication Alert';
      case 'credential_expiry_escalation': return 'Credential Expiry';
      case 'budget_overrun': return 'Budget Overrun';
      case 'care_plan_review_due': return 'Plan Review Due';
      case 'restrictive_practice_debrief_overdue': return 'RP Debrief Overdue';
      default: return alertType;
    }
  }
}

enum SentinelSeverity {
  info, warning, critical;

  static SentinelSeverity fromString(String s) {
    return SentinelSeverity.values.firstWhere(
      (e) => e.name == s,
      orElse: () => warning,
    );
  }

  String get label {
    switch (this) {
      case info: return 'Info';
      case warning: return 'Warning';
      case critical: return 'Critical';
    }
  }
}

enum SentinelStatus {
  active, acknowledged, escalated, dismissed, resolved;

  static SentinelStatus fromString(String s) {
    return SentinelStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => active,
    );
  }

  String get value => name;

  String get label {
    switch (this) {
      case active: return 'Active';
      case acknowledged: return 'Acknowledged';
      case escalated: return 'Escalated';
      case dismissed: return 'Dismissed';
      case resolved: return 'Resolved';
    }
  }
}
