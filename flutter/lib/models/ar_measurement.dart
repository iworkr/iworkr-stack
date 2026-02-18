/// AR Measurement — saved spatial measurement.
///
/// Mirrors Supabase `ar_measurements` table.
class ARMeasurement {
  final String id;
  final String organizationId;
  final String userId;
  final String? jobId;
  final String measurementType; // distance, area, volume
  final double value;
  final String unit;
  final List<Map<String, dynamic>> points;
  final String? photoUrl;
  final String? notes;
  final double? accuracyCm;
  final bool usedLidar;
  final DateTime createdAt;

  const ARMeasurement({
    required this.id,
    required this.organizationId,
    required this.userId,
    this.jobId,
    required this.measurementType,
    required this.value,
    this.unit = 'm',
    this.points = const [],
    this.photoUrl,
    this.notes,
    this.accuracyCm,
    this.usedLidar = false,
    required this.createdAt,
  });

  String get valueLabel {
    if (measurementType == 'area') return '${value.toStringAsFixed(2)} m\u00B2';
    if (measurementType == 'volume') return '${value.toStringAsFixed(2)} m\u00B3';
    return '${value.toStringAsFixed(2)} $unit';
  }

  String get typeLabel {
    switch (measurementType) {
      case 'area':
        return 'Area';
      case 'volume':
        return 'Volume';
      default:
        return 'Distance';
    }
  }

  String get accuracyLabel {
    if (accuracyCm == null) return '--';
    return '\u00B1${accuracyCm!.toStringAsFixed(0)}cm';
  }

  factory ARMeasurement.fromJson(Map<String, dynamic> json) {
    final pts = json['points'] as List<dynamic>? ?? [];
    return ARMeasurement(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      jobId: json['job_id'] as String?,
      measurementType: json['measurement_type'] as String? ?? 'distance',
      value: (json['value'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? 'm',
      points: pts.map((p) => p as Map<String, dynamic>).toList(),
      photoUrl: json['photo_url'] as String?,
      notes: json['notes'] as String?,
      accuracyCm: (json['accuracy_cm'] as num?)?.toDouble(),
      usedLidar: json['used_lidar'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
