/// CareShift model — maps to public.shifts (Care mode) / schedule_blocks
/// Project Nightingale: Field Operative — shift representation for support workers
class CareShift {
  final String id;
  final String organizationId;
  final String? participantId;
  final String? workerId;
  final DateTime scheduledStart;
  final DateTime scheduledEnd;
  final DateTime? actualStart;
  final DateTime? actualEnd;
  final String? ndisLineItem;
  final String? serviceType;
  final CareShiftStatus status;
  final String? participantName;
  final String? participantAvatar;
  final String? location;
  final double? locationLat;
  final double? locationLng;
  final bool requiresAcceptance;
  final String? acceptanceStatus; // accepted, declined, pending
  final String? declineReason;
  final List<String> criticalAlerts;
  final String? handoverNotes;
  final String? backupWorkerId;
  final String? generatedFromTemplateId;
  final bool isShortNoticeCancellation;
  final String? cancellationReason;
  final bool isShadowShift;
  final String? parentShiftId;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CareShift({
    required this.id,
    required this.organizationId,
    this.participantId,
    this.workerId,
    required this.scheduledStart,
    required this.scheduledEnd,
    this.actualStart,
    this.actualEnd,
    this.ndisLineItem,
    this.serviceType,
    required this.status,
    this.participantName,
    this.participantAvatar,
    this.location,
    this.locationLat,
    this.locationLng,
    this.requiresAcceptance = false,
    this.acceptanceStatus,
    this.declineReason,
    this.criticalAlerts = const [],
    this.handoverNotes,
    this.backupWorkerId,
    this.generatedFromTemplateId,
    this.isShortNoticeCancellation = false,
    this.cancellationReason,
    this.isShadowShift = false,
    this.parentShiftId,
    required this.createdAt,
    required this.updatedAt,
  });

  // FIXME: MEDIUM — scheduledStart/scheduledEnd fallback chain is fragile. If both 'scheduled_start' AND 'start_time' are null, 'as String' throws.
  factory CareShift.fromJson(Map<String, dynamic> json) {
    // Handle joined participant data
    final participant = json['participant_profiles'] as Map<String, dynamic>?;
    final client = json['clients'] as Map<String, dynamic>?;

    // Extract care-specific fields from metadata JSONB (schedule_blocks stores
    // handover_notes, requires_acceptance, service_type, ndis_line_item, etc.)
    final metadata = json['metadata'] as Map<String, dynamic>? ?? {};

    // Critical alerts: prefer participant_profiles join, then metadata, then top-level
    final criticalAlerts = (participant?['critical_alerts'] as List<dynamic>?)?.cast<String>() ??
        (metadata['critical_alerts'] as List<dynamic>?)?.cast<String>() ??
        (json['critical_alerts'] as List<dynamic>?)?.cast<String>() ??
        [];

    return CareShift(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String?,
      workerId: json['worker_id'] as String? ?? json['assignee_id'] as String? ?? json['technician_id'] as String?,
      scheduledStart: DateTime.parse(json['scheduled_start'] as String? ?? json['start_time'] as String),
      scheduledEnd: DateTime.parse(json['scheduled_end'] as String? ?? json['end_time'] as String),
      actualStart: json['actual_start'] != null ? DateTime.tryParse(json['actual_start'] as String) : null,
      actualEnd: json['actual_end'] != null ? DateTime.tryParse(json['actual_end'] as String) : null,
      ndisLineItem: json['ndis_line_item'] as String? ?? metadata['ndis_line_item'] as String?,
      serviceType: json['service_type'] as String? ?? metadata['service_type'] as String? ?? json['title'] as String?,
      status: CareShiftStatus.fromString(json['status'] as String? ?? 'published'),
      participantName: participant?['preferred_name'] as String? ??
          client?['name'] as String? ??
          json['client_name'] as String?,
      participantAvatar: participant?['avatar_url'] as String?,
      location: json['location'] as String?,
      locationLat: (json['location_lat'] as num?)?.toDouble(),
      locationLng: (json['location_lng'] as num?)?.toDouble(),
      requiresAcceptance: json['requires_acceptance'] as bool? ?? metadata['requires_acceptance'] as bool? ?? false,
      acceptanceStatus: json['acceptance_status'] as String? ?? metadata['acceptance_status'] as String?,
      declineReason: json['decline_reason'] as String? ?? metadata['decline_reason'] as String?,
      criticalAlerts: criticalAlerts,
      handoverNotes: json['handover_notes'] as String? ?? metadata['handover_notes'] as String?,
      backupWorkerId: json['backup_worker_id'] as String?,
      generatedFromTemplateId: json['generated_from_template_id'] as String?,
      isShortNoticeCancellation: json['is_short_notice_cancellation'] as bool? ?? false,
      cancellationReason: json['cancellation_reason'] as String?,
      isShadowShift: json['is_shadow_shift'] as bool? ?? metadata['is_shadow_shift'] as bool? ?? false,
      parentShiftId: json['parent_shift_id'] as String? ?? metadata['parent_shift_id'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String? ?? json['created_at'] as String),
    );
  }

  Duration get scheduledDuration => scheduledEnd.difference(scheduledStart);

  String get formattedDuration {
    final d = scheduledDuration;
    final hours = d.inHours;
    final minutes = d.inMinutes.remainder(60);
    if (minutes == 0) return '${hours}h';
    return '${hours}h ${minutes}m';
  }

  bool get isToday {
    final now = DateTime.now();
    final local = scheduledStart.toLocal();
    return local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
  }

  bool get isPast => scheduledEnd.isBefore(DateTime.now());

  bool get isActive => status == CareShiftStatus.inProgress;

  bool get needsAction =>
      status == CareShiftStatus.actionRequired ||
      (requiresAcceptance && acceptanceStatus == 'pending');

  String get participantInitials {
    if (participantName == null || participantName!.isEmpty) return '?';
    final parts = participantName!.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return parts[0][0].toUpperCase();
  }
}

enum CareShiftStatus {
  published,
  inProgress,
  completed,
  cancelled,
  actionRequired,
  unassignedCritical,
  cancelledBillable;

  static CareShiftStatus fromString(String s) {
    switch (s) {
      case 'published':
      case 'scheduled':
        return published;
      case 'in_progress':
      case 'active':
        return inProgress;
      case 'completed':
      case 'done':
        return completed;
      case 'cancelled':
        return cancelled;
      case 'action_required':
        return actionRequired;
      case 'unassigned_critical':
        return unassignedCritical;
      case 'cancelled_billable':
        return cancelledBillable;
      default:
        return published;
    }
  }

  String get value {
    switch (this) {
      case inProgress:
        return 'in_progress';
      case actionRequired:
        return 'action_required';
      case unassignedCritical:
        return 'unassigned_critical';
      case cancelledBillable:
        return 'cancelled_billable';
      default:
        return name;
    }
  }

  String get label {
    switch (this) {
      case published:
        return 'Published';
      case inProgress:
        return 'In Progress';
      case completed:
        return 'Completed';
      case cancelled:
        return 'Cancelled';
      case actionRequired:
        return 'Action Required';
      case unassignedCritical:
        return 'Unassigned (Critical)';
      case cancelledBillable:
        return 'Cancelled (Billable)';
    }
  }
}
