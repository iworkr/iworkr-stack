/// Route Run — optimized daily route for a technician.
///
/// Mirrors Supabase `route_runs` table. Contains an ordered sequence
/// of jobs with distance/time estimates.
class RouteRun {
  final String id;
  final String organizationId;
  final String userId;
  final DateTime runDate;
  final String status; // planned, active, completed, cancelled
  final List<RouteStop> jobSequence;
  final double? totalDistanceKm;
  final int? estimatedDriveMinutes;
  final DateTime? estimatedFinishTime;
  final DateTime? actualFinishTime;
  final bool optimized;
  final DateTime createdAt;

  const RouteRun({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.runDate,
    required this.status,
    this.jobSequence = const [],
    this.totalDistanceKm,
    this.estimatedDriveMinutes,
    this.estimatedFinishTime,
    this.actualFinishTime,
    this.optimized = false,
    required this.createdAt,
  });

  bool get isActive => status == 'active';
  bool get isPlanned => status == 'planned';

  String get distanceLabel {
    if (totalDistanceKm == null) return '--';
    return '${totalDistanceKm!.toStringAsFixed(0)}km';
  }

  String get driveTimeLabel {
    if (estimatedDriveMinutes == null) return '--';
    final h = estimatedDriveMinutes! ~/ 60;
    final m = estimatedDriveMinutes! % 60;
    if (h > 0) return '${h}h ${m}m';
    return '${m}m';
  }

  String get finishTimeLabel {
    if (estimatedFinishTime == null) return '--';
    return '${estimatedFinishTime!.hour.toString().padLeft(2, '0')}:${estimatedFinishTime!.minute.toString().padLeft(2, '0')}';
  }

  factory RouteRun.fromJson(Map<String, dynamic> json) {
    final seqRaw = json['job_sequence'] as List<dynamic>? ?? [];
    return RouteRun(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      runDate: DateTime.tryParse(json['run_date'] as String? ?? '') ?? DateTime.now(),
      status: json['status'] as String? ?? 'planned',
      jobSequence: seqRaw.map((s) => RouteStop.fromJson(s as Map<String, dynamic>)).toList(),
      totalDistanceKm: (json['total_distance_km'] as num?)?.toDouble(),
      estimatedDriveMinutes: json['estimated_drive_minutes'] as int?,
      estimatedFinishTime: json['estimated_finish_time'] != null
          ? DateTime.tryParse(json['estimated_finish_time'] as String)
          : null,
      actualFinishTime: json['actual_finish_time'] != null
          ? DateTime.tryParse(json['actual_finish_time'] as String)
          : null,
      optimized: json['optimized'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// A single stop in the route sequence
class RouteStop {
  final String jobId;
  final String title;
  final String? clientName;
  final String? address;
  final double? lat;
  final double? lng;
  final int order;
  final int? estimatedMinutes;
  final String? status; // pending, en_route, arrived, completed

  const RouteStop({
    required this.jobId,
    required this.title,
    this.clientName,
    this.address,
    this.lat,
    this.lng,
    required this.order,
    this.estimatedMinutes,
    this.status,
  });

  bool get isCompleted => status == 'completed';

  factory RouteStop.fromJson(Map<String, dynamic> json) {
    return RouteStop(
      jobId: json['job_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      clientName: json['client_name'] as String?,
      address: json['address'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      order: json['order'] as int? ?? 0,
      estimatedMinutes: json['estimated_minutes'] as int?,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'job_id': jobId,
        'title': title,
        'client_name': clientName,
        'address': address,
        'lat': lat,
        'lng': lng,
        'order': order,
        'estimated_minutes': estimatedMinutes,
        'status': status,
      };
}
