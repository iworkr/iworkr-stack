/// Participant medication model — maps to public.participant_medications
/// Project Nightingale: Electronic Medication Administration Records (eMAR)
class ParticipantMedication {
  final String id;
  final String organizationId;
  final String participantId;
  final String medicationName;
  final String? dosage;
  final MedicationRoute route;
  final MedicationFrequency frequency;
  final String? instructions;
  final String? prescriber;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool isActive;
  final bool isPrn; // Pro re nata (as needed)
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? participantName;

  const ParticipantMedication({
    required this.id,
    required this.organizationId,
    required this.participantId,
    required this.medicationName,
    this.dosage,
    required this.route,
    required this.frequency,
    this.instructions,
    this.prescriber,
    this.startDate,
    this.endDate,
    this.isActive = true,
    this.isPrn = false,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.participantName,
  });

  factory ParticipantMedication.fromJson(Map<String, dynamic> json) {
    return ParticipantMedication(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      participantId: json['participant_id'] as String,
      medicationName: json['medication_name'] as String,
      dosage: json['dosage'] as String?,
      route: MedicationRoute.fromString(json['route'] as String? ?? 'oral'),
      frequency: MedicationFrequency.fromString(json['frequency'] as String? ?? 'daily'),
      instructions: json['instructions'] as String?,
      prescriber: json['prescriber'] as String?,
      startDate: json['start_date'] != null ? DateTime.tryParse(json['start_date'] as String) : null,
      endDate: json['end_date'] != null ? DateTime.tryParse(json['end_date'] as String) : null,
      isActive: json['is_active'] as bool? ?? true,
      isPrn: json['is_prn'] as bool? ?? false,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }
}

/// MAR entry — maps to public.medication_administration_records
class MAREntry {
  final String id;
  final String medicationId;
  final String administeredBy;
  final DateTime scheduledTime;
  final DateTime? administeredAt;
  final MAROutcome outcome;
  final String? refusalReason;
  final String? notes;
  final String? witnessedBy;
  final DateTime createdAt;
  // Joined
  final String? administerName;
  final String? witnessName;

  const MAREntry({
    required this.id,
    required this.medicationId,
    required this.administeredBy,
    required this.scheduledTime,
    this.administeredAt,
    required this.outcome,
    this.refusalReason,
    this.notes,
    this.witnessedBy,
    required this.createdAt,
    this.administerName,
    this.witnessName,
  });

  factory MAREntry.fromJson(Map<String, dynamic> json) {
    final adminProfile = json['administered_by_profile'] as Map<String, dynamic>?;
    return MAREntry(
      id: json['id'] as String,
      medicationId: json['medication_id'] as String,
      administeredBy: json['administered_by'] as String,
      scheduledTime: DateTime.parse(json['scheduled_time'] as String),
      administeredAt: json['administered_at'] != null ? DateTime.tryParse(json['administered_at'] as String) : null,
      outcome: MAROutcome.fromString(json['outcome'] as String? ?? 'pending'),
      refusalReason: json['refusal_reason'] as String?,
      notes: json['notes'] as String?,
      witnessedBy: json['witnessed_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      administerName: adminProfile?['full_name'] as String?,
    );
  }
}

enum MedicationRoute {
  oral, topical, injection, inhaled, sublingual, transdermal, rectal, otherRoute;

  static MedicationRoute fromString(String s) {
    switch (s) {
      case 'oral': return oral;
      case 'topical': return topical;
      case 'injection': return injection;
      case 'inhaled': return inhaled;
      case 'sublingual': return sublingual;
      case 'transdermal': return transdermal;
      case 'rectal': return rectal;
      default: return otherRoute;
    }
  }

  String get value => this == otherRoute ? 'other' : name;

  String get label {
    switch (this) {
      case oral: return 'Oral';
      case topical: return 'Topical';
      case injection: return 'Injection';
      case inhaled: return 'Inhaled';
      case sublingual: return 'Sublingual';
      case transdermal: return 'Transdermal';
      case rectal: return 'Rectal';
      case otherRoute: return 'Other';
    }
  }
}

enum MedicationFrequency {
  daily, twiceDaily, thriceDaily, fourTimesDaily, weekly, fortnightly,
  monthly, asNeeded, stat;

  static MedicationFrequency fromString(String s) {
    switch (s) {
      case 'daily': return daily;
      case 'twice_daily': return twiceDaily;
      case 'thrice_daily': return thriceDaily;
      case 'four_times_daily': return fourTimesDaily;
      case 'weekly': return weekly;
      case 'fortnightly': return fortnightly;
      case 'monthly': return monthly;
      case 'as_needed': return asNeeded;
      case 'stat': return stat;
      default: return daily;
    }
  }

  String get value {
    switch (this) {
      case twiceDaily: return 'twice_daily';
      case thriceDaily: return 'thrice_daily';
      case fourTimesDaily: return 'four_times_daily';
      case asNeeded: return 'as_needed';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case daily: return 'Daily';
      case twiceDaily: return 'Twice Daily';
      case thriceDaily: return 'Three Times Daily';
      case fourTimesDaily: return 'Four Times Daily';
      case weekly: return 'Weekly';
      case fortnightly: return 'Fortnightly';
      case monthly: return 'Monthly';
      case asNeeded: return 'As Needed (PRN)';
      case stat: return 'Immediately (STAT)';
    }
  }
}

enum MAROutcome {
  pending, given, refused, withheld, notAvailable;

  static MAROutcome fromString(String s) {
    switch (s) {
      case 'given': return given;
      case 'refused': return refused;
      case 'withheld': return withheld;
      case 'not_available': return notAvailable;
      default: return pending;
    }
  }

  String get value {
    switch (this) {
      case notAvailable: return 'not_available';
      default: return name;
    }
  }

  String get label {
    switch (this) {
      case pending: return 'Pending';
      case given: return 'Given';
      case refused: return 'Refused';
      case withheld: return 'Withheld';
      case notAvailable: return 'Not Available';
    }
  }
}
