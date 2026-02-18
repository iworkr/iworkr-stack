/// IoT Device — registered BLE sensor/probe.
///
/// Mirrors Supabase `iot_devices` table.
class IoTDevice {
  final String id;
  final String organizationId;
  final String name;
  final String deviceType; // sensor, manifold, probe, vibration, gauge, other
  final String? macAddress;
  final String? firmwareVersion;
  final String? linkedAssetId;
  final DateTime? lastSeenAt;
  final int? batteryLevel;
  final String status; // active, paired, offline, retired
  final Map<String, dynamic> config;
  final DateTime createdAt;

  const IoTDevice({
    required this.id,
    required this.organizationId,
    required this.name,
    required this.deviceType,
    this.macAddress,
    this.firmwareVersion,
    this.linkedAssetId,
    this.lastSeenAt,
    this.batteryLevel,
    this.status = 'active',
    this.config = const {},
    required this.createdAt,
  });

  bool get isOnline => status == 'paired' || status == 'active';
  bool get lowBattery => batteryLevel != null && batteryLevel! < 20;

  String get typeLabel {
    switch (deviceType) {
      case 'manifold':
        return 'Smart Manifold';
      case 'probe':
        return 'Temperature Probe';
      case 'vibration':
        return 'Vibration Sensor';
      case 'gauge':
        return 'Pressure Gauge';
      default:
        return 'Sensor';
    }
  }

  factory IoTDevice.fromJson(Map<String, dynamic> json) {
    return IoTDevice(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      name: json['name'] as String? ?? '',
      deviceType: json['device_type'] as String? ?? 'sensor',
      macAddress: json['mac_address'] as String?,
      firmwareVersion: json['firmware_version'] as String?,
      linkedAssetId: json['linked_asset_id'] as String?,
      lastSeenAt: json['last_seen_at'] != null ? DateTime.tryParse(json['last_seen_at'] as String) : null,
      batteryLevel: json['battery_level'] as int?,
      status: json['status'] as String? ?? 'active',
      config: json['config'] as Map<String, dynamic>? ?? {},
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// IoT Reading — a single telemetry data point.
///
/// Mirrors Supabase `iot_readings`.
class IoTReading {
  final String id;
  final String organizationId;
  final String deviceId;
  final String? jobId;
  final String? userId;
  final String readingType; // pressure, temperature, vibration, humidity, voltage, current
  final double value;
  final String unit;
  final double? minThreshold;
  final double? maxThreshold;
  final bool alertTriggered;
  final DateTime recordedAt;

  const IoTReading({
    required this.id,
    required this.organizationId,
    required this.deviceId,
    this.jobId,
    this.userId,
    required this.readingType,
    required this.value,
    required this.unit,
    this.minThreshold,
    this.maxThreshold,
    this.alertTriggered = false,
    required this.recordedAt,
  });

  bool get isOverMax => maxThreshold != null && value > maxThreshold!;
  bool get isUnderMin => minThreshold != null && value < minThreshold!;
  bool get isOutOfRange => isOverMax || isUnderMin;

  String get valueLabel => '${value.toStringAsFixed(1)} $unit';

  String get typeLabel {
    switch (readingType) {
      case 'pressure':
        return 'Pressure';
      case 'temperature':
        return 'Temperature';
      case 'vibration':
        return 'Vibration';
      case 'humidity':
        return 'Humidity';
      case 'voltage':
        return 'Voltage';
      case 'current':
        return 'Current';
      default:
        return readingType;
    }
  }

  factory IoTReading.fromJson(Map<String, dynamic> json) {
    return IoTReading(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      deviceId: json['device_id'] as String,
      jobId: json['job_id'] as String?,
      userId: json['user_id'] as String?,
      readingType: json['reading_type'] as String? ?? 'other',
      value: (json['value'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      minThreshold: (json['min_threshold'] as num?)?.toDouble(),
      maxThreshold: (json['max_threshold'] as num?)?.toDouble(),
      alertTriggered: json['alert_triggered'] as bool? ?? false,
      recordedAt: DateTime.tryParse(json['recorded_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
