/// Incident model — maps to public.incidents
/// Project Nightingale: Clinical safety incident reporting
class Incident {
  final String id;
  final String organizationId;
  final String? participantId;
  final String workerId;
  final String? shiftId;
  final IncidentCategory category;
  final IncidentSeverity severity;
  final IncidentStatus status;
  final String title;
  final String description;
  final String? location;
  final DateTime occurredAt;
  final DateTime reportedAt;
  final List<dynamic> witnesses;
  final String? immediateActions;
  final List<String> photos;
  final String? reviewedBy;
  final DateTime? reviewedAt;
  final String? resolutionNotes;
  final DateTime? resolvedAt;
  final bool isReportable;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? workerName;
  final String? participantName;

  const Incident({
    required this.id,
    required this.organizationId,
    this.participantId,
    required this.workerId,
    this.shiftId,
    required this.category,
    required this.severity,
    required this.status,
    required this.title,
    required this.description,
    this.location,
    required this.occurredAt,
    required this.reportedAt,
    this.witnesses = const [],
    this.immediateActions,
    this.photos = const [],
    this.reviewedBy,
    this.reviewedAt,
    this.resolutionNotes,
    this.resolvedAt,
    this.isReportable = false,
    required this.createdAt,
    required this.updatedAt,
    this.workerName,
    this.participantName,
  });

  factory Incident.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>?;
    return Incident(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String?,
      workerId: json['worker_id'] as String,
      shiftId: json['shift_id'] as String?,
      category: IncidentCategory.fromString(json['category'] as String? ?? 'other'),
      severity: IncidentSeverity.fromString(json['severity'] as String? ?? 'medium'),
      status: IncidentStatus.fromString(json['status'] as String? ?? 'reported'),
      title: json['title'] as String,
      description: json['description'] as String,
      location: json['location'] as String?,
      occurredAt: DateTime.parse(json['occurred_at'] as String),
      reportedAt: DateTime.parse(json['reported_at'] as String),
      witnesses: json['witnesses'] as List<dynamic>? ?? [],
      immediateActions: json['immediate_actions'] as String?,
      photos: (json['photos'] as List<dynamic>?)?.cast<String>() ?? [],
      reviewedBy: json['reviewed_by'] as String?,
      reviewedAt: json['reviewed_at'] != null ? DateTime.tryParse(json['reviewed_at'] as String) : null,
      resolutionNotes: json['resolution_notes'] as String?,
      resolvedAt: json['resolved_at'] != null ? DateTime.tryParse(json['resolved_at'] as String) : null,
      isReportable: json['is_reportable'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      workerName: profile?['full_name'] as String?,
    );
  }

  bool get isOpen => status != IncidentStatus.resolved && status != IncidentStatus.closed;
}

enum IncidentCategory {
  fall, medicationError, behavioral, environmental, injury,
  nearMiss, propertyDamage, abuseAllegation, restrictivePractice, other;

  static IncidentCategory fromString(String s) {
    switch (s) {
      case 'fall': return fall;
      case 'medication_error': return medicationError;
      case 'behavioral': return behavioral;
      case 'environmental': return environmental;
      case 'injury': return injury;
      case 'near_miss': return nearMiss;
      case 'property_damage': return propertyDamage;
      case 'abuse_allegation': return abuseAllegation;
      case 'restrictive_practice': return restrictivePractice;
      default: return other;
    }
  }

  String get value {
    switch (this) {
      case medicationError: return 'medication_error';
      case nearMiss: return 'near_miss';
      case propertyDamage: return 'property_damage';
      case abuseAllegation: return 'abuse_allegation';
      case restrictivePractice: return 'restrictive_practice';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case fall: return 'Fall';
      case medicationError: return 'Medication Error';
      case behavioral: return 'Behavioral';
      case environmental: return 'Environmental';
      case injury: return 'Injury';
      case nearMiss: return 'Near Miss';
      case propertyDamage: return 'Property Damage';
      case abuseAllegation: return 'Abuse Allegation';
      case restrictivePractice: return 'Restrictive Practice';
      case other: return 'Other';
    }
  }
}

enum IncidentSeverity {
  low, medium, high, critical;

  static IncidentSeverity fromString(String s) {
    return IncidentSeverity.values.firstWhere((e) => e.name == s, orElse: () => medium);
  }

  String get label {
    switch (this) {
      case low: return 'Low';
      case medium: return 'Medium';
      case high: return 'High';
      case critical: return 'Critical';
    }
  }
}

enum IncidentStatus {
  reported, underReview, investigation, resolved, closed;

  static IncidentStatus fromString(String s) {
    switch (s) {
      case 'under_review': return underReview;
      case 'investigation': return investigation;
      case 'resolved': return resolved;
      case 'closed': return closed;
      default: return reported;
    }
  }

  String get value {
    switch (this) {
      case underReview: return 'under_review';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case reported: return 'Reported';
      case underReview: return 'Under Review';
      case investigation: return 'Investigation';
      case resolved: return 'Resolved';
      case closed: return 'Closed';
    }
  }
}
