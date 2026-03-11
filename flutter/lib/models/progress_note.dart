/// Progress note model — maps to public.progress_notes
/// Project Nightingale: Shift completion reports with EVV data
class ProgressNote {
  final String id;
  final String organizationId;
  final String? jobId;
  final String? participantId;
  final String workerId;
  final String? summary;
  final String? goalsAddressed;
  final String? participantMood;
  final String? observations;
  final bool? participantPresent;
  final String? participantFeedback;
  final double? clockInLat;
  final double? clockInLng;
  final DateTime? clockInTime;
  final double? clockOutLat;
  final double? clockOutLng;
  final DateTime? clockOutTime;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? workerName;
  final String? participantName;

  const ProgressNote({
    required this.id,
    required this.organizationId,
    this.jobId,
    this.participantId,
    required this.workerId,
    this.summary,
    this.goalsAddressed,
    this.participantMood,
    this.observations,
    this.participantPresent,
    this.participantFeedback,
    this.clockInLat,
    this.clockInLng,
    this.clockInTime,
    this.clockOutLat,
    this.clockOutLng,
    this.clockOutTime,
    required this.createdAt,
    required this.updatedAt,
    this.workerName,
    this.participantName,
  });

  factory ProgressNote.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>?;
    return ProgressNote(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      jobId: json['job_id'] as String?,
      participantId: json['participant_id'] as String?,
      workerId: json['worker_id'] as String,
      summary: json['summary'] as String?,
      goalsAddressed: json['goals_addressed'] as String?,
      participantMood: json['participant_mood'] as String?,
      observations: json['observations'] as String?,
      participantPresent: json['participant_present'] as bool?,
      participantFeedback: json['participant_feedback'] as String?,
      clockInLat: (json['clock_in_lat'] as num?)?.toDouble(),
      clockInLng: (json['clock_in_lng'] as num?)?.toDouble(),
      clockInTime: json['clock_in_time'] != null ? DateTime.tryParse(json['clock_in_time'] as String) : null,
      clockOutLat: (json['clock_out_lat'] as num?)?.toDouble(),
      clockOutLng: (json['clock_out_lng'] as num?)?.toDouble(),
      clockOutTime: json['clock_out_time'] != null ? DateTime.tryParse(json['clock_out_time'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      workerName: profile?['full_name'] as String?,
    );
  }

  bool get hasEVV => clockInLat != null && clockInLng != null && clockOutLat != null && clockOutLng != null;

  Duration? get shiftDuration {
    if (clockInTime == null || clockOutTime == null) return null;
    return clockOutTime!.difference(clockInTime!);
  }

  String get formattedDuration {
    final d = shiftDuration;
    if (d == null) return '--';
    final hours = d.inHours;
    final minutes = d.inMinutes.remainder(60);
    return '${hours}h ${minutes}m';
  }
}
