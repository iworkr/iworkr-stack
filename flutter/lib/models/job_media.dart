/// Job Media — evidence locker record for photos/attachments.
///
/// Mirrors Supabase `job_media` table. Photos are watermarked with
/// timestamp + coordinates before upload.
class JobMedia {
  final String id;
  final String organizationId;
  final String jobId;
  final String uploadedBy;
  final String fileUrl;
  final String? thumbnailUrl;
  final String fileType;
  final int? fileSizeBytes;
  final String? caption;
  final List<dynamic> annotations;
  final Map<String, dynamic> watermarkData;
  final double? locationLat;
  final double? locationLng;
  final DateTime takenAt;
  final DateTime createdAt;

  const JobMedia({
    required this.id,
    required this.organizationId,
    required this.jobId,
    required this.uploadedBy,
    required this.fileUrl,
    this.thumbnailUrl,
    this.fileType = 'image',
    this.fileSizeBytes,
    this.caption,
    this.annotations = const [],
    this.watermarkData = const {},
    this.locationLat,
    this.locationLng,
    required this.takenAt,
    required this.createdAt,
  });

  factory JobMedia.fromJson(Map<String, dynamic> json) {
    return JobMedia(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      jobId: json['job_id'] as String,
      uploadedBy: json['uploaded_by'] as String,
      fileUrl: json['file_url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String?,
      fileType: json['file_type'] as String? ?? 'image',
      fileSizeBytes: json['file_size_bytes'] as int?,
      caption: json['caption'] as String?,
      annotations: json['annotations'] as List<dynamic>? ?? [],
      watermarkData: json['watermark_data'] as Map<String, dynamic>? ?? {},
      locationLat: (json['location_lat'] as num?)?.toDouble(),
      locationLng: (json['location_lng'] as num?)?.toDouble(),
      takenAt: DateTime.tryParse(json['taken_at'] as String? ?? '') ?? DateTime.now(),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  String get fileSizeLabel {
    if (fileSizeBytes == null) return '';
    final mb = fileSizeBytes! / (1024 * 1024);
    if (mb >= 1) return '${mb.toStringAsFixed(1)} MB';
    final kb = fileSizeBytes! / 1024;
    return '${kb.toStringAsFixed(0)} KB';
  }
}

/// Timer session for job execution tracking.
///
/// Mirrors Supabase `job_timer_sessions` table.
class JobTimerSession {
  final String id;
  final String organizationId;
  final String jobId;
  final String userId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int? durationSeconds;
  final double? startLat;
  final double? startLng;
  final double? endLat;
  final double? endLng;
  final String status; // active, paused, completed

  const JobTimerSession({
    required this.id,
    required this.organizationId,
    required this.jobId,
    required this.userId,
    required this.startedAt,
    this.endedAt,
    this.durationSeconds,
    this.startLat,
    this.startLng,
    this.endLat,
    this.endLng,
    required this.status,
  });

  bool get isActive => status == 'active';
  bool get isCompleted => status == 'completed';

  Duration get elapsed {
    if (durationSeconds != null) return Duration(seconds: durationSeconds!);
    final end = endedAt ?? DateTime.now();
    return end.difference(startedAt);
  }

  factory JobTimerSession.fromJson(Map<String, dynamic> json) {
    return JobTimerSession(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      jobId: json['job_id'] as String,
      userId: json['user_id'] as String,
      startedAt: DateTime.tryParse(json['started_at'] as String? ?? '') ?? DateTime.now(),
      endedAt: json['ended_at'] != null ? DateTime.tryParse(json['ended_at'] as String) : null,
      durationSeconds: json['duration_seconds'] as int?,
      startLat: (json['start_lat'] as num?)?.toDouble(),
      startLng: (json['start_lng'] as num?)?.toDouble(),
      endLat: (json['end_lat'] as num?)?.toDouble(),
      endLng: (json['end_lng'] as num?)?.toDouble(),
      status: json['status'] as String? ?? 'active',
    );
  }
}
