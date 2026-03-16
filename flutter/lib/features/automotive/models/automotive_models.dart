// ============================================================================
// Project Outrider — Data Models
// ============================================================================

/// Connection state for CarPlay/Android Auto
class AutomotiveConnectionState {
  const AutomotiveConnectionState({
    this.isConnected = false,
    this.connectionType,
    this.connectedAt,
  });

  final bool isConnected;
  final String? connectionType; // 'carplay', 'android_auto', 'wireless_carplay', 'wireless_aa'
  final DateTime? connectedAt;

  static const disconnected = AutomotiveConnectionState();
}

/// User's automotive preferences (from Supabase)
class AutomotivePreferences {
  const AutomotivePreferences({
    this.autoStartNavigation = false,
    this.playAudioBriefings = true,
    this.privacyMaskingEnabled = true,
    this.safeDrivingLockEnabled = true,
    this.allowPassengerOverride = true,
    this.fleetSpeedMonitoring = false,
    this.speedThresholdKmh = 15,
    this.sendEtaSmsToClient = true,
    this.etaSmsTemplate,
    this.preferredMapsApp = 'system',
    this.ttsSpeed = 1.0,
  });

  final bool autoStartNavigation;
  final bool playAudioBriefings;
  final bool privacyMaskingEnabled;
  final bool safeDrivingLockEnabled;
  final bool allowPassengerOverride;
  final bool fleetSpeedMonitoring;
  final int speedThresholdKmh;
  final bool sendEtaSmsToClient;
  final String? etaSmsTemplate;
  final String preferredMapsApp;
  final double ttsSpeed;

  factory AutomotivePreferences.fromJson(Map<String, dynamic> json) {
    return AutomotivePreferences(
      autoStartNavigation: json['auto_start_navigation'] as bool? ?? false,
      playAudioBriefings: json['play_audio_briefings'] as bool? ?? true,
      privacyMaskingEnabled: json['privacy_masking_enabled'] as bool? ?? true,
      safeDrivingLockEnabled: json['safe_driving_lock_enabled'] as bool? ?? true,
      allowPassengerOverride: json['allow_passenger_override'] as bool? ?? true,
      fleetSpeedMonitoring: json['fleet_speed_monitoring'] as bool? ?? false,
      speedThresholdKmh: json['speed_threshold_kmh'] as int? ?? 15,
      sendEtaSmsToClient: json['send_eta_sms_to_client'] as bool? ?? true,
      etaSmsTemplate: json['eta_sms_template'] as String?,
      preferredMapsApp: json['preferred_maps_app'] as String? ?? 'system',
      ttsSpeed: (json['tts_speed'] as num?)?.toDouble() ?? 1.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'auto_start_navigation': autoStartNavigation,
        'play_audio_briefings': playAudioBriefings,
        'privacy_masking_enabled': privacyMaskingEnabled,
        'safe_driving_lock_enabled': safeDrivingLockEnabled,
        'allow_passenger_override': allowPassengerOverride,
        'fleet_speed_monitoring': fleetSpeedMonitoring,
        'speed_threshold_kmh': speedThresholdKmh,
        'send_eta_sms_to_client': sendEtaSmsToClient,
        'eta_sms_template': etaSmsTemplate,
        'preferred_maps_app': preferredMapsApp,
        'tts_speed': ttsSpeed,
      };
}

/// A single GPS telemetry data point (buffered locally)
class TelemetryPoint {
  const TelemetryPoint({
    required this.lat,
    required this.lng,
    required this.speedKmh,
    required this.timestamp,
  });

  final double lat;
  final double lng;
  final double speedKmh;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => {
        'lat': lat,
        'lng': lng,
        'speed_kmh': speedKmh,
        'timestamp': timestamp.toIso8601String(),
      };
}
