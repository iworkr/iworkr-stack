/// Health observation model — maps to public.health_observations
/// Project Nightingale: Health telemetry and vital sign tracking
class HealthObservation {
  final String id;
  final String organizationId;
  final String participantId;
  final String workerId;
  final String? shiftId;
  final ObservationType observationType;
  final double? valueNumeric;
  final String? valueText;
  final int? valueSystolic;
  final int? valueDiastolic;
  final String? unit;
  final bool isAbnormal;
  final String? notes;
  final DateTime observedAt;
  final DateTime createdAt;
  // Joined
  final String? recorderName;
  final String? participantName;

  const HealthObservation({
    required this.id,
    required this.organizationId,
    required this.participantId,
    required this.workerId,
    this.shiftId,
    required this.observationType,
    this.valueNumeric,
    this.valueText,
    this.valueSystolic,
    this.valueDiastolic,
    this.unit,
    this.isAbnormal = false,
    this.notes,
    required this.observedAt,
    required this.createdAt,
    this.recorderName,
    this.participantName,
  });

  // Null-safe: organizationId, participantId, workerId use toString() ?? '' fallback
  factory HealthObservation.fromJson(Map<String, dynamic> json) {
    final profile = (json['worker'] ?? json['profiles']) as Map<String, dynamic>?;
    return HealthObservation(
      id: json['id'] as String,
      organizationId: json['organization_id']?.toString() ?? '',
      participantId: json['participant_id']?.toString() ?? '',
      workerId: json['worker_id']?.toString() ?? '',
      shiftId: json['shift_id'] as String?,
      observationType: ObservationType.fromString(json['observation_type'] as String? ?? 'general'),
      valueNumeric: (json['value_numeric'] as num?)?.toDouble(),
      valueText: json['value_text'] as String?,
      valueSystolic: json['value_systolic'] as int?,
      valueDiastolic: json['value_diastolic'] as int?,
      unit: json['unit'] as String?,
      isAbnormal: json['is_abnormal'] as bool? ?? false,
      notes: json['notes'] as String?,
      observedAt: DateTime.parse(json['observed_at'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
      recorderName: profile?['full_name'] as String?,
    );
  }

  // Backward compatibility aliases for existing UI code paths.
  String get recordedBy => workerId;
  DateTime get recordedAt => observedAt;
  Map<String, dynamic> get values => <String, dynamic>{
        if (valueNumeric != null) 'numeric': valueNumeric,
        if (valueText != null) 'text': valueText,
        if (valueSystolic != null) 'systolic': valueSystolic,
        if (valueDiastolic != null) 'diastolic': valueDiastolic,
        if (unit != null) 'unit': unit,
      };

  /// Extract a formatted value string for display
  String get displayValue {
    switch (observationType) {
      case ObservationType.bloodPressure:
        return '${valueSystolic ?? '--'}/${valueDiastolic ?? '--'} ${unit ?? 'mmHg'}';
      case ObservationType.heartRate:
        return '${valueNumeric?.toStringAsFixed(0) ?? '--'} ${unit ?? 'BPM'}';
      case ObservationType.temperature:
        return '${valueNumeric?.toStringAsFixed(1) ?? '--'}${unit ?? '°C'}';
      case ObservationType.bloodGlucose:
        return '${valueNumeric?.toStringAsFixed(1) ?? '--'} ${unit ?? 'mmol/L'}';
      case ObservationType.oxygenSaturation:
        return '${valueNumeric?.toStringAsFixed(0) ?? '--'}${unit ?? '%'}';
      case ObservationType.weight:
        return '${valueNumeric?.toStringAsFixed(1) ?? '--'} ${unit ?? 'kg'}';
      case ObservationType.painLevel:
        return '${valueNumeric?.toStringAsFixed(0) ?? '--'}/10';
      case ObservationType.moodRating:
        return '${valueNumeric?.toStringAsFixed(0) ?? '--'}/5';
      case ObservationType.fluidIntake:
        return '${valueNumeric?.toStringAsFixed(0) ?? '--'} ${unit ?? 'ml'}';
      case ObservationType.bowelMovement:
        return valueText ?? '--';
      case ObservationType.sleepQuality:
        return '${valueNumeric?.toStringAsFixed(1) ?? '--'} ${unit ?? 'hrs'}';
      case ObservationType.respiration:
        return '${valueNumeric?.toStringAsFixed(0) ?? '--'} ${unit ?? 'breaths/min'}';
      case ObservationType.general:
        return valueText ?? '--';
    }
  }
}

enum ObservationType {
  bloodPressure, heartRate, temperature, bloodGlucose,
  oxygenSaturation, weight, painLevel, moodRating,
  fluidIntake, bowelMovement, sleepQuality, respiration, general;

  static ObservationType fromString(String s) {
    switch (s) {
      case 'blood_pressure': return bloodPressure;
      case 'heart_rate': return heartRate;
      case 'temperature': return temperature;
      case 'blood_glucose': return bloodGlucose;
      case 'oxygen_saturation': return oxygenSaturation;
      case 'weight': return weight;
      case 'pain_level': return painLevel;
      case 'mood_rating': return moodRating;
      case 'fluid_intake': return fluidIntake;
      case 'bowel_movement': return bowelMovement;
      case 'sleep_quality': return sleepQuality;
      case 'respiration': return respiration;
      default: return general;
    }
  }

  String get value {
    switch (this) {
      case bloodPressure: return 'blood_pressure';
      case heartRate: return 'heart_rate';
      case bloodGlucose: return 'blood_glucose';
      case oxygenSaturation: return 'oxygen_saturation';
      case painLevel: return 'pain_level';
      case moodRating: return 'mood_rating';
      case fluidIntake: return 'fluid_intake';
      case bowelMovement: return 'bowel_movement';
      case sleepQuality: return 'sleep_quality';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case bloodPressure: return 'Blood Pressure';
      case heartRate: return 'Heart Rate';
      case temperature: return 'Temperature';
      case bloodGlucose: return 'Blood Glucose';
      case oxygenSaturation: return 'Oxygen Saturation';
      case weight: return 'Weight';
      case painLevel: return 'Pain Level';
      case moodRating: return 'Mood Rating';
      case fluidIntake: return 'Fluid Intake';
      case bowelMovement: return 'Bowel Movement';
      case sleepQuality: return 'Sleep Quality';
      case respiration: return 'Respiration Rate';
      case general: return 'General';
    }
  }

  String get icon {
    switch (this) {
      case bloodPressure: return '🫀';
      case heartRate: return '💓';
      case temperature: return '🌡️';
      case bloodGlucose: return '🩸';
      case oxygenSaturation: return '🫁';
      case weight: return '⚖️';
      case painLevel: return '😣';
      case moodRating: return '🧠';
      case fluidIntake: return '💧';
      case bowelMovement: return '🚽';
      case sleepQuality: return '😴';
      case respiration: return '🌬️';
      case general: return '📋';
    }
  }
}
