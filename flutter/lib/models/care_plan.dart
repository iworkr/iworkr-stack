/// Care Plan model — maps to public.care_plans
/// Project Nightingale Phase 4: Structured care planning with review cycles
class CarePlan {
  final String id;
  final String organizationId;
  final String participantId;
  final String title;
  final CarePlanStatus status;
  final DateTime? startDate;
  final DateTime? reviewDate;
  final DateTime? nextReviewDate;
  final Map<String, dynamic> domains;
  final String? assessorName;
  final String? assessorRole;
  final String? notes;
  final String? approvedBy;
  final DateTime? approvedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? participantName;
  final List<CareGoal> goals;

  const CarePlan({
    required this.id,
    required this.organizationId,
    required this.participantId,
    required this.title,
    required this.status,
    this.startDate,
    this.reviewDate,
    this.nextReviewDate,
    this.domains = const {},
    this.assessorName,
    this.assessorRole,
    this.notes,
    this.approvedBy,
    this.approvedAt,
    required this.createdAt,
    required this.updatedAt,
    this.participantName,
    this.goals = const [],
  });

  factory CarePlan.fromJson(Map<String, dynamic> json) {
    final participant = json['participant_profiles'] as Map<String, dynamic>?;
    final goalsRaw = json['care_goals'] as List<dynamic>?;

    return CarePlan(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String,
      title: json['title'] as String,
      status: CarePlanStatus.fromString(json['status'] as String? ?? 'draft'),
      startDate: json['start_date'] != null ? DateTime.tryParse(json['start_date'] as String) : null,
      reviewDate: json['review_date'] != null ? DateTime.tryParse(json['review_date'] as String) : null,
      nextReviewDate: json['next_review_date'] != null ? DateTime.tryParse(json['next_review_date'] as String) : null,
      domains: (json['domains'] as Map<String, dynamic>?) ?? {},
      assessorName: json['assessor_name'] as String?,
      assessorRole: json['assessor_role'] as String?,
      notes: json['notes'] as String?,
      approvedBy: json['approved_by'] as String?,
      approvedAt: json['approved_at'] != null ? DateTime.tryParse(json['approved_at'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      participantName: participant?['full_name'] as String? ?? participant?['preferred_name'] as String?,
      goals: goalsRaw?.map((e) => CareGoal.fromJson(e as Map<String, dynamic>)).toList() ?? [],
    );
  }

  bool get isActive => status == CarePlanStatus.active;
  bool get needsReview => nextReviewDate != null && nextReviewDate!.isBefore(DateTime.now().add(const Duration(days: 30)));
  bool get isOverdueReview => nextReviewDate != null && nextReviewDate!.isBefore(DateTime.now());
  int get activeGoalCount => goals.where((g) => g.status == GoalStatus.inProgress).length;
  int get achievedGoalCount => goals.where((g) => g.status == GoalStatus.achieved).length;
}

/// Care Goal model — maps to public.care_goals
class CareGoal {
  final String id;
  final String carePlanId;
  final String organizationId;
  final String participantId;
  final String? ndisGoalReference;
  final String? supportCategory;
  final String title;
  final String? description;
  final String? targetOutcome;
  final GoalStatus status;
  final int priority;
  final List<GoalMilestone> milestones;
  final String? evidenceNotes;
  final DateTime? startedAt;
  final DateTime? achievedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CareGoal({
    required this.id,
    required this.carePlanId,
    required this.organizationId,
    required this.participantId,
    this.ndisGoalReference,
    this.supportCategory,
    required this.title,
    this.description,
    this.targetOutcome,
    required this.status,
    this.priority = 0,
    this.milestones = const [],
    this.evidenceNotes,
    this.startedAt,
    this.achievedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CareGoal.fromJson(Map<String, dynamic> json) {
    final milestonesRaw = json['milestones'] as List<dynamic>?;
    return CareGoal(
      id: json['id'] as String,
      carePlanId: json['care_plan_id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String,
      ndisGoalReference: json['ndis_goal_reference'] as String?,
      supportCategory: json['support_category'] as String?,
      title: json['title'] as String,
      description: json['description'] as String?,
      targetOutcome: json['target_outcome'] as String?,
      status: GoalStatus.fromString(json['status'] as String? ?? 'not_started'),
      priority: json['priority'] as int? ?? 0,
      milestones: milestonesRaw?.map((e) => GoalMilestone.fromJson(e as Map<String, dynamic>)).toList() ?? [],
      evidenceNotes: json['evidence_notes'] as String?,
      startedAt: json['started_at'] != null ? DateTime.tryParse(json['started_at'] as String) : null,
      achievedAt: json['achieved_at'] != null ? DateTime.tryParse(json['achieved_at'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
    'care_plan_id': carePlanId,
    'organization_id': organizationId,
    'participant_id': participantId,
    if (ndisGoalReference != null) 'ndis_goal_reference': ndisGoalReference,
    if (supportCategory != null) 'support_category': supportCategory,
    'title': title,
    if (description != null) 'description': description,
    if (targetOutcome != null) 'target_outcome': targetOutcome,
    'status': status.value,
    'priority': priority,
    'milestones': milestones.map((m) => m.toJson()).toList(),
    if (evidenceNotes != null) 'evidence_notes': evidenceNotes,
  };

  bool get isActive => status == GoalStatus.inProgress;

  double get milestoneProgress {
    if (milestones.isEmpty) return 0;
    final achieved = milestones.where((m) => m.achieved).length;
    return achieved / milestones.length;
  }
}

class GoalMilestone {
  final String title;
  final String? targetDate;
  final bool achieved;

  const GoalMilestone({required this.title, this.targetDate, this.achieved = false});

  factory GoalMilestone.fromJson(Map<String, dynamic> json) => GoalMilestone(
    title: json['title'] as String? ?? '',
    targetDate: json['target_date'] as String?,
    achieved: json['achieved'] as bool? ?? false,
  );

  Map<String, dynamic> toJson() => {
    'title': title,
    if (targetDate != null) 'target_date': targetDate,
    'achieved': achieved,
  };
}

enum CarePlanStatus {
  draft, active, underReview, archived;

  static CarePlanStatus fromString(String s) {
    switch (s) {
      case 'active': return active;
      case 'under_review': return underReview;
      case 'archived': return archived;
      default: return draft;
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
      case draft: return 'Draft';
      case active: return 'Active';
      case underReview: return 'Under Review';
      case archived: return 'Archived';
    }
  }
}

enum GoalStatus {
  notStarted, inProgress, achieved, onHold, abandoned;

  static GoalStatus fromString(String s) {
    switch (s) {
      case 'not_started': return notStarted;
      case 'in_progress': return inProgress;
      case 'achieved': return achieved;
      case 'on_hold': return onHold;
      case 'abandoned': return abandoned;
      default: return notStarted;
    }
  }

  String get value {
    switch (this) {
      case notStarted: return 'not_started';
      case inProgress: return 'in_progress';
      case onHold: return 'on_hold';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case notStarted: return 'Not Started';
      case inProgress: return 'In Progress';
      case achieved: return 'Achieved';
      case onHold: return 'On Hold';
      case abandoned: return 'Abandoned';
    }
  }
}
