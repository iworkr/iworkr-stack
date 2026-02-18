/// Telemetry Event — forensic audit record for every job interaction.
///
/// Mirrors Supabase `telemetry_events` table. Each interaction (start job,
/// check task, take photo, add note) creates a timestamped record with
/// full device + location context.
class TelemetryEvent {
  final String id;
  final String organizationId;
  final String jobId;
  final String userId;
  final String eventType;
  final Map<String, dynamic> eventData;
  final DateTime timestamp;
  final double? locationLat;
  final double? locationLng;
  final double? locationAccuracy;
  final double? locationAltitude;
  final String? ipAddress;
  final String? connectionType;
  final String? deviceModel;
  final String? osVersion;
  final double? batteryLevel;
  final String? sessionId;
  final bool flagged;
  final String? flagReason;

  const TelemetryEvent({
    required this.id,
    required this.organizationId,
    required this.jobId,
    required this.userId,
    required this.eventType,
    this.eventData = const {},
    required this.timestamp,
    this.locationLat,
    this.locationLng,
    this.locationAccuracy,
    this.locationAltitude,
    this.ipAddress,
    this.connectionType,
    this.deviceModel,
    this.osVersion,
    this.batteryLevel,
    this.sessionId,
    this.flagged = false,
    this.flagReason,
  });

  factory TelemetryEvent.fromJson(Map<String, dynamic> json) {
    return TelemetryEvent(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      jobId: json['job_id'] as String,
      userId: json['user_id'] as String,
      eventType: json['event_type'] as String,
      eventData: json['event_data'] as Map<String, dynamic>? ?? {},
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ?? DateTime.now(),
      locationLat: (json['location_lat'] as num?)?.toDouble(),
      locationLng: (json['location_lng'] as num?)?.toDouble(),
      locationAccuracy: (json['location_accuracy'] as num?)?.toDouble(),
      locationAltitude: (json['location_altitude'] as num?)?.toDouble(),
      ipAddress: json['ip_address'] as String?,
      connectionType: json['connection_type'] as String?,
      deviceModel: json['device_model'] as String?,
      osVersion: json['os_version'] as String?,
      batteryLevel: (json['battery_level'] as num?)?.toDouble(),
      sessionId: json['session_id'] as String?,
      flagged: json['flagged'] as bool? ?? false,
      flagReason: json['flag_reason'] as String?,
    );
  }

  /// Human-readable summary for the activity stream
  String get displayText {
    switch (eventType) {
      case 'job_started':
        return 'Job started';
      case 'job_completed':
        return 'Job completed';
      case 'task_completed':
        return 'Completed: ${eventData['task_title'] ?? 'subtask'}';
      case 'task_unchecked':
        return 'Unchecked: ${eventData['task_title'] ?? 'subtask'}';
      case 'photo_taken':
        return 'Photo captured';
      case 'note_added':
        return 'Note added';
      case 'timer_paused':
        return 'Timer paused';
      case 'timer_resumed':
        return 'Timer resumed';
      case 'location_check':
        return 'Location verified';
      case 'form_submitted':
        return 'Form submitted: ${eventData['form_title'] ?? 'form'}';
      default:
        return eventType.replaceAll('_', ' ');
    }
  }

  /// Accuracy label for location
  String get accuracyLabel {
    if (locationAccuracy == null) return '';
    return '±${locationAccuracy!.toStringAsFixed(0)}m';
  }
}

/// Standard telemetry event types
abstract class TelemetryEventType {
  static const String jobStarted = 'job_started';
  static const String jobCompleted = 'job_completed';
  static const String jobPaused = 'timer_paused';
  static const String jobResumed = 'timer_resumed';
  static const String taskCompleted = 'task_completed';
  static const String taskUnchecked = 'task_unchecked';
  static const String photoTaken = 'photo_taken';
  static const String noteAdded = 'note_added';
  static const String locationCheck = 'location_check';
  static const String signatureCollected = 'signature_collected';
  static const String formSubmitted = 'form_submitted';
}
