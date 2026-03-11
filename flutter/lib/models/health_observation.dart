/// Health observation model — maps to public.health_observations
/// Project Nightingale: Health telemetry and vital sign tracking
class HealthObservation {
  final String id;
  final String organizationId;
  final String participantId;
  final String recordedBy;
  final ObservationType observationType;
  final Map<String, dynamic> values;
  final String? notes;
  final DateTime recordedAt;
  final DateTime createdAt;
  // Joined
  final String? recorderName;
  final String? participantName;

  const HealthObservation({
    required this.id,
    required this.organizationId,
    required this.participantId,
    required this.recordedBy,
    required this.observationType,
    required this.values,
    this.notes,
    required this.recordedAt,
    required this.createdAt,
    this.recorderName,
    this.participantName,
  });

  factory HealthObservation.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>?;
    return HealthObservation(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String,
      recordedBy: json['recorded_by'] as String,
      observationType: ObservationType.fromString(json['observation_type'] as String? ?? 'general'),
      values: (json['values'] as Map<String, dynamic>?) ?? {},
      notes: json['notes'] as String?,
      recordedAt: DateTime.parse(json['recorded_at'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
      recorderName: profile?['full_name'] as String?,
    );
  }

  /// Extract a formatted value string for display
  String get displayValue {
    switch (observationType) {
      case ObservationType.bloodPressure:
        return '${values['systolic'] ?? '--'}/${values['diastolic'] ?? '--'} mmHg';
      case ObservationType.heartRate:
        return '${values['bpm'] ?? '--'} BPM';
      case ObservationType.temperature:
        return '${values['celsius'] ?? '--'}°C';
      case ObservationType.bloodGlucose:
        return '${values['mmol'] ?? '--'} mmol/L';
      case ObservationType.oxygenSaturation:
        return '${values['spo2'] ?? '--'}%';
      case ObservationType.weight:
        return '${values['kg'] ?? '--'} kg';
      case ObservationType.painLevel:
        return '${values['level'] ?? '--'}/10';
      case ObservationType.moodRating:
        return '${values['rating'] ?? '--'}/5';
      case ObservationType.fluidIntake:
        return '${values['ml'] ?? '--'} ml';
      case ObservationType.bowelMovement:
        return '${values['type'] ?? '--'} (Bristol Scale)';
      case ObservationType.sleepQuality:
        return '${values['hours'] ?? '--'} hrs';
      case ObservationType.respiration:
        return '${values['rate'] ?? '--'} breaths/min';
      case ObservationType.general:
        return values['summary'] as String? ?? '--';
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
