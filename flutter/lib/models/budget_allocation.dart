/// Budget Allocation model — maps to public.budget_allocations
/// Project Nightingale Phase 3: NDIS budget quarantining & tracking
class BudgetAllocation {
  final String id;
  final String organizationId;
  final String serviceAgreementId;
  final String participantId;
  final String category;
  final double totalBudget;
  final double consumedBudget;
  final double quarantinedBudget;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? participantName;

  const BudgetAllocation({
    required this.id,
    required this.organizationId,
    required this.serviceAgreementId,
    required this.participantId,
    required this.category,
    this.totalBudget = 0,
    this.consumedBudget = 0,
    this.quarantinedBudget = 0,
    required this.createdAt,
    required this.updatedAt,
    this.participantName,
  });

  factory BudgetAllocation.fromJson(Map<String, dynamic> json) {
    final participant = json['participant_profiles'] as Map<String, dynamic>?;
    return BudgetAllocation(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      serviceAgreementId: json['service_agreement_id'] as String,
      participantId: json['participant_id'] as String,
      category: json['category'] as String,
      totalBudget: (json['total_budget'] as num?)?.toDouble() ?? 0,
      consumedBudget: (json['consumed_budget'] as num?)?.toDouble() ?? 0,
      quarantinedBudget: (json['quarantined_budget'] as num?)?.toDouble() ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      participantName: participant?['full_name'] as String? ?? participant?['preferred_name'] as String?,
    );
  }

  double get availableBudget => totalBudget - consumedBudget - quarantinedBudget;
  double get utilizationPercent => totalBudget > 0 ? (consumedBudget / totalBudget * 100) : 0;
  double get committedPercent => totalBudget > 0 ? ((consumedBudget + quarantinedBudget) / totalBudget * 100) : 0;
  bool get isOverCommitted => (consumedBudget + quarantinedBudget) > totalBudget;

  String get categoryLabel {
    switch (category) {
      case 'core': return 'Core Supports';
      case 'capacity_building': return 'Capacity Building';
      case 'capital': return 'Capital';
      default: return category;
    }
  }
}

/// Claim Line Item model — maps to public.claim_line_items
class ClaimLineItem {
  final String id;
  final String organizationId;
  final String? claimBatchId;
  final String? shiftId;
  final String participantId;
  final String? funderId;
  final String? ndisItemNumber;
  final String description;
  final double quantity;
  final double unitRate;
  final double totalAmount;
  final double regionModifier;
  final double gstAmount;
  final String status;
  final String? rejectionCode;
  final String? rejectionReason;
  final DateTime? serviceDate;
  final String? workerId;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? participantName;
  final String? workerName;

  const ClaimLineItem({
    required this.id,
    required this.organizationId,
    this.claimBatchId,
    this.shiftId,
    required this.participantId,
    this.funderId,
    this.ndisItemNumber,
    required this.description,
    this.quantity = 0,
    this.unitRate = 0,
    this.totalAmount = 0,
    this.regionModifier = 0,
    this.gstAmount = 0,
    required this.status,
    this.rejectionCode,
    this.rejectionReason,
    this.serviceDate,
    this.workerId,
    required this.createdAt,
    required this.updatedAt,
    this.participantName,
    this.workerName,
  });

  factory ClaimLineItem.fromJson(Map<String, dynamic> json) {
    final participant = json['participant_profiles'] as Map<String, dynamic>?;
    final worker = json['profiles'] as Map<String, dynamic>?;
    return ClaimLineItem(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      claimBatchId: json['claim_batch_id'] as String?,
      shiftId: json['shift_id'] as String?,
      participantId: json['participant_id'] as String,
      funderId: json['funder_id'] as String?,
      ndisItemNumber: json['ndis_item_number'] as String?,
      description: json['description'] as String,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unitRate: (json['unit_rate'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['total_amount'] as num?)?.toDouble() ?? 0,
      regionModifier: (json['region_modifier'] as num?)?.toDouble() ?? 0,
      gstAmount: (json['gst_amount'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'draft',
      rejectionCode: json['rejection_code'] as String?,
      rejectionReason: json['rejection_reason'] as String?,
      serviceDate: json['service_date'] != null ? DateTime.tryParse(json['service_date'] as String) : null,
      workerId: json['worker_id'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      participantName: participant?['full_name'] as String?,
      workerName: worker?['full_name'] as String?,
    );
  }

  bool get isRejected => status == 'rejected';
  bool get isPaid => status == 'paid';

  String get statusLabel {
    switch (status) {
      case 'draft': return 'Draft';
      case 'approved': return 'Approved';
      case 'submitted': return 'Submitted';
      case 'paid': return 'Paid';
      case 'rejected': return 'Rejected';
      case 'written_off': return 'Written Off';
      default: return status;
    }
  }
}
