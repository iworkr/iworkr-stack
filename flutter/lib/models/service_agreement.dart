/// Service agreement model — maps to public.service_agreements
/// Project Nightingale: NDIS plan/budget management
class ServiceAgreement {
  final String id;
  final String organizationId;
  final String participantId;
  final String? planNumber;
  final DateTime startDate;
  final DateTime endDate;
  final double totalBudget;
  final double usedBudget;
  final AgreementStatus status;
  final List<ServiceLineItem> lineItems;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? participantName;

  const ServiceAgreement({
    required this.id,
    required this.organizationId,
    required this.participantId,
    this.planNumber,
    required this.startDate,
    required this.endDate,
    this.totalBudget = 0,
    this.usedBudget = 0,
    required this.status,
    this.lineItems = const [],
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.participantName,
  });

  factory ServiceAgreement.fromJson(Map<String, dynamic> json) {
    return ServiceAgreement(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String,
      planNumber: json['plan_number'] as String?,
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: DateTime.parse(json['end_date'] as String),
      totalBudget: (json['total_budget'] as num?)?.toDouble() ?? 0,
      usedBudget: (json['used_budget'] as num?)?.toDouble() ?? 0,
      status: AgreementStatus.fromString(json['status'] as String? ?? 'draft'),
      lineItems: (json['line_items'] as List<dynamic>?)
              ?.map((e) => ServiceLineItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  double get remainingBudget => totalBudget - usedBudget;
  double get utilizationPercent => totalBudget > 0 ? (usedBudget / totalBudget * 100) : 0;
  bool get isExpired => endDate.isBefore(DateTime.now());
  int get daysRemaining => endDate.difference(DateTime.now()).inDays;
}

class ServiceLineItem {
  final String supportCategory;
  final String? description;
  final double allocatedBudget;
  final double usedBudget;
  final double hourlyRate;

  const ServiceLineItem({
    required this.supportCategory,
    this.description,
    this.allocatedBudget = 0,
    this.usedBudget = 0,
    this.hourlyRate = 0,
  });

  factory ServiceLineItem.fromJson(Map<String, dynamic> json) {
    return ServiceLineItem(
      supportCategory: json['support_category'] as String? ?? '',
      description: json['description'] as String?,
      allocatedBudget: (json['allocated_budget'] as num?)?.toDouble() ?? 0,
      usedBudget: (json['used_budget'] as num?)?.toDouble() ?? 0,
      hourlyRate: (json['hourly_rate'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'support_category': supportCategory,
    if (description != null) 'description': description,
    'allocated_budget': allocatedBudget,
    'used_budget': usedBudget,
    'hourly_rate': hourlyRate,
  };

  double get remainingBudget => allocatedBudget - usedBudget;
}

enum AgreementStatus {
  draft, active, suspended, expired, terminated;

  static AgreementStatus fromString(String s) {
    return AgreementStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => AgreementStatus.draft,
    );
  }

  String get label {
    switch (this) {
      case draft: return 'Draft';
      case active: return 'Active';
      case suspended: return 'Suspended';
      case expired: return 'Expired';
      case terminated: return 'Terminated';
    }
  }
}
