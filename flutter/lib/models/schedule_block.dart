/// ScheduleBlock model — maps to public.schedule_blocks
/// Updated for Project Outrider-Route: route_sequence, pinning, travel metadata
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
  final int routeSequence;
  final bool isTimePinned;
  final int plannedTravelDurationSeconds;
  final int plannedTravelDistanceMeters;
  final bool isSupplierWaypoint;
  final String? waypointName;

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
    this.routeSequence = 0,
    this.isTimePinned = false,
    this.plannedTravelDurationSeconds = 0,
    this.plannedTravelDistanceMeters = 0,
    this.isSupplierWaypoint = false,
    this.waypointName,
  });

  Duration get duration => endTime.difference(startTime);
  String get timeRange {
    final startHour = startTime.hour.toString().padLeft(2, '0');
    final startMin = startTime.minute.toString().padLeft(2, '0');
    final endHour = endTime.hour.toString().padLeft(2, '0');
    final endMin = endTime.minute.toString().padLeft(2, '0');
    return '$startHour:$startMin – $endHour:$endMin';
  }

  /// Travel distance formatted as km
  String get travelDistanceKm {
    if (plannedTravelDistanceMeters <= 0) return '';
    return '${(plannedTravelDistanceMeters / 1000).toStringAsFixed(1)} km';
  }

  /// Travel duration formatted for display
  String get travelDurationFormatted {
    if (plannedTravelDurationSeconds <= 0) return '';
    final mins = (plannedTravelDurationSeconds / 60).round();
    if (mins < 60) return '$mins min';
    return '${mins ~/ 60}h ${mins % 60}m';
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
      routeSequence: json['route_sequence'] as int? ?? 0,
      isTimePinned: json['is_time_pinned'] as bool? ?? false,
      plannedTravelDurationSeconds: json['planned_travel_duration_seconds'] as int? ?? 0,
      plannedTravelDistanceMeters: json['planned_travel_distance_meters'] as int? ?? 0,
      isSupplierWaypoint: json['is_supplier_waypoint'] as bool? ?? false,
      waypointName: json['waypoint_name'] as String?,
    );
  }
}

enum ScheduleBlockStatus {
  scheduled,
  enRoute,
  onSite,
  inProgress,
  complete,
  cancelled;

  static ScheduleBlockStatus fromString(String s) {
    switch (s) {
      case 'en_route':
        return ScheduleBlockStatus.enRoute;
      case 'on_site':
        return ScheduleBlockStatus.onSite;
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

  String get value {
    switch (this) {
      case ScheduleBlockStatus.enRoute: return 'en_route';
      case ScheduleBlockStatus.onSite: return 'on_site';
      case ScheduleBlockStatus.inProgress: return 'in_progress';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case ScheduleBlockStatus.scheduled:
        return 'Scheduled';
      case ScheduleBlockStatus.enRoute:
        return 'En Route';
      case ScheduleBlockStatus.onSite:
        return 'On Site';
      case ScheduleBlockStatus.inProgress:
        return 'In Progress';
      case ScheduleBlockStatus.complete:
        return 'Complete';
      case ScheduleBlockStatus.cancelled:
        return 'Cancelled';
    }
  }

  bool get isActive => this == enRoute || this == onSite || this == inProgress;
}
