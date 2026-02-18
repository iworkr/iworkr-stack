/// Live fleet position — maps to `fleet_positions` table.
class FleetPosition {
  final String id;
  final String organizationId;
  final String userId;
  final double lat;
  final double lng;
  final double heading;
  final double speed;
  final double battery;
  final String status;
  final String? currentJobId;
  final double? accuracy;
  final DateTime updatedAt;

  // Joined profile data
  final String? fullName;
  final String? avatarUrl;

  // Joined job data
  final String? jobTitle;
  final int? jobTasksTotal;
  final int? jobTasksCompleted;

  const FleetPosition({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.lat,
    required this.lng,
    this.heading = 0,
    this.speed = 0,
    this.battery = 1.0,
    this.status = 'idle',
    this.currentJobId,
    this.accuracy,
    required this.updatedAt,
    this.fullName,
    this.avatarUrl,
    this.jobTitle,
    this.jobTasksTotal,
    this.jobTasksCompleted,
  });

  bool get isOnline => status != 'offline';
  bool get isDriving => status == 'driving';
  bool get isWorking => status == 'working';

  String get initials {
    if (fullName == null || fullName!.isEmpty) return '??';
    final parts = fullName!.split(' ');
    if (parts.length >= 2) return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    return fullName!.substring(0, fullName!.length.clamp(0, 2)).toUpperCase();
  }

  String get displayName => fullName ?? 'Unknown';

  String get statusLabel {
    switch (status) {
      case 'driving':
        return 'Driving';
      case 'working':
        return 'On Site';
      case 'break':
        return 'On Break';
      case 'idle':
        return 'Idle';
      case 'offline':
        return 'Offline';
      default:
        return status;
    }
  }

  String get speedLabel => '${speed.toInt()} km/h';
  String get batteryLabel => '${(battery * 100).toInt()}%';

  double get taskProgress {
    if (jobTasksTotal == null || jobTasksTotal == 0) return 0;
    return (jobTasksCompleted ?? 0) / jobTasksTotal!;
  }

  factory FleetPosition.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>?;
    final job = json['jobs'] as Map<String, dynamic>?;

    return FleetPosition(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      heading: (json['heading'] as num?)?.toDouble() ?? 0,
      speed: (json['speed'] as num?)?.toDouble() ?? 0,
      battery: (json['battery'] as num?)?.toDouble() ?? 1.0,
      status: json['status'] as String? ?? 'idle',
      currentJobId: json['current_job_id'] as String?,
      accuracy: (json['accuracy'] as num?)?.toDouble(),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.now(),
      fullName: profile?['full_name'] as String?,
      avatarUrl: profile?['avatar_url'] as String?,
      jobTitle: job?['title'] as String?,
      jobTasksTotal: null,
      jobTasksCompleted: null,
    );
  }
}

/// Breadcrumb point for route replay.
class BreadcrumbPoint {
  final double lat;
  final double lng;
  final double heading;
  final double speed;
  final String status;
  final DateTime recordedAt;

  const BreadcrumbPoint({
    required this.lat,
    required this.lng,
    this.heading = 0,
    this.speed = 0,
    this.status = 'idle',
    required this.recordedAt,
  });

  bool get isDriving => speed > 5;
  bool get isStop => speed <= 2;

  factory BreadcrumbPoint.fromJson(Map<String, dynamic> json) {
    return BreadcrumbPoint(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      heading: (json['heading'] as num?)?.toDouble() ?? 0,
      speed: (json['speed'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'idle',
      recordedAt: DateTime.tryParse(json['recorded_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
