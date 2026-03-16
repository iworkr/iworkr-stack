/// Participant medication model — maps to public.participant_medications
/// Project Nightingale → Project Asclepius: Advanced eMAR & Clinical Pharmacology
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

  // ── Asclepius Extensions ───────────────────────────────────
  final bool isS8Controlled; // Schedule 8 Controlled Drug
  final String packType; // webster_pak, loose_box, bottle
  final String form; // tablet, capsule, liquid, etc.
  final int? prnMinGapHours; // Minimum hours between PRN doses
  final int? prnMaxDoses24h; // Max doses in rolling 24h window

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
    this.isS8Controlled = false,
    this.packType = 'loose_box',
    this.form = 'tablet',
    this.prnMinGapHours,
    this.prnMaxDoses24h,
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
      // Asclepius
      isS8Controlled: json['is_s8_controlled'] as bool? ?? false,
      packType: json['pack_type'] as String? ?? 'loose_box',
      form: json['form'] as String? ?? 'tablet',
      prnMinGapHours: json['prn_min_gap_hours'] as int?,
      prnMaxDoses24h: json['prn_max_doses_24h'] as int?,
    );
  }
}

/// MAR entry — maps to public.medication_administration_records
class MAREntry {
  final String id;
  final String organizationId;
  final String participantId;
  final String medicationId;
  final String administeredBy;
  final DateTime? administeredAt;
  final MAROutcome outcome;
  final String? notes;
  final String? prnEffectiveness;
  final DateTime? prnFollowupAt;
  final bool prnFollowupDone;
  final String? witnessId;
  final DateTime createdAt;
  // Joined
  final String? administerName;
  final String? witnessName;

  const MAREntry({
    required this.id,
    required this.organizationId,
    required this.participantId,
    required this.medicationId,
    required this.administeredBy,
    this.administeredAt,
    required this.outcome,
    this.notes,
    this.prnEffectiveness,
    this.prnFollowupAt,
    this.prnFollowupDone = false,
    this.witnessId,
    required this.createdAt,
    this.administerName,
    this.witnessName,
    this.stockCountBefore,
    this.stockCountAfter,
    this.prnEfficacyStatus,
    this.prnEfficacyLoggedAt,
    this.isS8Administration = false,
  });

  factory MAREntry.fromJson(Map<String, dynamic> json) {
    final workerProfile = (json['worker_profile'] ?? json['profiles']) as Map<String, dynamic>?;
    final witnessProfile = json['witness_profile'] as Map<String, dynamic>?;
    return MAREntry(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String? ?? '',
      participantId: json['participant_id'] as String? ?? '',
      medicationId: json['medication_id'] as String,
      administeredBy: json['worker_id'] as String? ?? '',
      administeredAt: json['administered_at'] != null ? DateTime.tryParse(json['administered_at'] as String) : null,
      outcome: MAROutcome.fromString(json['outcome'] as String? ?? 'not_available'),
      notes: json['notes'] as String?,
      prnEffectiveness: json['prn_effectiveness'] as String?,
      prnFollowupAt: json['prn_followup_at'] != null ? DateTime.tryParse(json['prn_followup_at'] as String) : null,
      prnFollowupDone: json['prn_followup_done'] as bool? ?? false,
      witnessId: json['witness_id'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      administerName: workerProfile?['full_name'] as String?,
      witnessName: witnessProfile?['full_name'] as String?,
      // Asclepius
      stockCountBefore: (json['stock_count_before'] as num?)?.toDouble(),
      stockCountAfter: (json['stock_count_after'] as num?)?.toDouble(),
      prnEfficacyStatus: json['prn_efficacy_status'] as String?,
      prnEfficacyLoggedAt: json['prn_efficacy_logged_at'] != null
          ? DateTime.tryParse(json['prn_efficacy_logged_at'] as String)
          : null,
      isS8Administration: json['is_s8_administration'] as bool? ?? false,
    );
  }

  // Asclepius extensions
  final double? stockCountBefore;
  final double? stockCountAfter;
  final String? prnEfficacyStatus; // pending, no_improvement, partial, complete
  final DateTime? prnEfficacyLoggedAt;
  final bool isS8Administration;

  // Backward compatibility with older MAR UI contracts.
  DateTime get scheduledTime => administeredAt ?? createdAt;
  String? get refusalReason => null;
  String? get witnessedBy => witnessId;
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
  pending, given, refused, withheld, notAvailable,
  // Asclepius additions
  vomited, dropped, selfAdministered;

  static MAROutcome fromString(String s) {
    switch (s) {
      case 'given': return given;
      case 'refused': return refused;
      case 'withheld': return withheld;
      case 'not_available': return notAvailable;
      case 'vomited': return vomited;
      case 'dropped': return dropped;
      case 'self_administered': return selfAdministered;
      default: return pending;
    }
  }

  String get value {
    switch (this) {
      case notAvailable: return 'not_available';
      case selfAdministered: return 'self_administered';
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
      case vomited: return 'Vomited';
      case dropped: return 'Dropped/Destroyed';
      case selfAdministered: return 'Self-Administered';
    }
  }
}
