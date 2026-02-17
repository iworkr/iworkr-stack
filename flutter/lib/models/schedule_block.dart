/// ScheduleBlock model — maps to public.schedule_blocks
class ScheduleBlock {
  final String id;
  final String organizationId;
  final String? jobId;
  final String technicianId;
  final String title;
  final String? clientName;
  final String? location;
  final DateTime startTime;
  final DateTime endTime;
  final ScheduleBlockStatus status;
  final int travelMinutes;
  final bool isConflict;
  final String? notes;

  const ScheduleBlock({
    required this.id,
    required this.organizationId,
    this.jobId,
    required this.technicianId,
    required this.title,
    this.clientName,
    this.location,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.travelMinutes = 0,
    this.isConflict = false,
    this.notes,
  });

  Duration get duration => endTime.difference(startTime);
  String get timeRange {
    final startHour = startTime.hour.toString().padLeft(2, '0');
    final startMin = startTime.minute.toString().padLeft(2, '0');
    final endHour = endTime.hour.toString().padLeft(2, '0');
    final endMin = endTime.minute.toString().padLeft(2, '0');
    return '$startHour:$startMin – $endHour:$endMin';
  }

  factory ScheduleBlock.fromJson(Map<String, dynamic> json) {
    return ScheduleBlock(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      jobId: json['job_id'] as String?,
      technicianId: json['technician_id'] as String,
      title: json['title'] as String,
      clientName: json['client_name'] as String?,
      location: json['location'] as String?,
      startTime: DateTime.parse(json['start_time'] as String),
      endTime: DateTime.parse(json['end_time'] as String),
      status: ScheduleBlockStatus.fromString(json['status'] as String? ?? 'scheduled'),
      travelMinutes: json['travel_minutes'] as int? ?? 0,
      isConflict: json['is_conflict'] as bool? ?? false,
      notes: json['notes'] as String?,
    );
  }
}

enum ScheduleBlockStatus {
  scheduled,
  enRoute,
  inProgress,
  complete,
  cancelled;

  static ScheduleBlockStatus fromString(String s) {
    switch (s) {
      case 'en_route':
        return ScheduleBlockStatus.enRoute;
      case 'in_progress':
        return ScheduleBlockStatus.inProgress;
      case 'complete':
        return ScheduleBlockStatus.complete;
      case 'cancelled':
        return ScheduleBlockStatus.cancelled;
      default:
        return ScheduleBlockStatus.scheduled;
    }
  }

  String get label {
    switch (this) {
      case ScheduleBlockStatus.scheduled:
        return 'Scheduled';
      case ScheduleBlockStatus.enRoute:
        return 'En Route';
      case ScheduleBlockStatus.inProgress:
        return 'In Progress';
      case ScheduleBlockStatus.complete:
        return 'Complete';
      case ScheduleBlockStatus.cancelled:
        return 'Cancelled';
    }
  }
}
