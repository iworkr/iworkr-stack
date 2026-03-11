/// Worker credential model — maps to public.worker_credentials
/// Project Nightingale: Workforce compliance tracking
class WorkerCredential {
  final String id;
  final String organizationId;
  final String userId;
  final CredentialType credentialType;
  final String? credentialName;
  final String? documentUrl;
  final DateTime? issuedDate;
  final DateTime? expiryDate;
  final VerificationStatus verificationStatus;
  final String? verifiedBy;
  final DateTime? verifiedAt;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? workerName;
  final String? workerEmail;
  final String? workerAvatar;

  const WorkerCredential({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.credentialType,
    this.credentialName,
    this.documentUrl,
    this.issuedDate,
    this.expiryDate,
    required this.verificationStatus,
    this.verifiedBy,
    this.verifiedAt,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.workerName,
    this.workerEmail,
    this.workerAvatar,
  });

  factory WorkerCredential.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>?;
    return WorkerCredential(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      credentialType: CredentialType.fromString(json['credential_type'] as String? ?? 'OTHER'),
      credentialName: json['credential_name'] as String?,
      documentUrl: json['document_url'] as String?,
      issuedDate: json['issued_date'] != null ? DateTime.tryParse(json['issued_date'] as String) : null,
      expiryDate: json['expiry_date'] != null ? DateTime.tryParse(json['expiry_date'] as String) : null,
      verificationStatus: VerificationStatus.fromString(json['verification_status'] as String? ?? 'pending'),
      verifiedBy: json['verified_by'] as String?,
      verifiedAt: json['verified_at'] != null ? DateTime.tryParse(json['verified_at'] as String) : null,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      workerName: profile?['full_name'] as String?,
      workerEmail: profile?['email'] as String?,
      workerAvatar: profile?['avatar_url'] as String?,
    );
  }

  ExpiryStatus get expiryStatus {
    if (expiryDate == null) return ExpiryStatus.unknown;
    final now = DateTime.now();
    if (expiryDate!.isBefore(now)) return ExpiryStatus.expired;
    if (expiryDate!.isBefore(now.add(const Duration(days: 30)))) return ExpiryStatus.expiring;
    return ExpiryStatus.valid;
  }

  int? get daysUntilExpiry {
    if (expiryDate == null) return null;
    return expiryDate!.difference(DateTime.now()).inDays;
  }
}

enum CredentialType {
  ndisScreening,
  wwcc,
  firstAid,
  manualHandling,
  medicationCompetency,
  cpr,
  driversLicense,
  policeCheck,
  other;

  static CredentialType fromString(String s) {
    switch (s) {
      case 'NDIS_SCREENING': return ndisScreening;
      case 'WWCC': return wwcc;
      case 'FIRST_AID': return firstAid;
      case 'MANUAL_HANDLING': return manualHandling;
      case 'MEDICATION_COMPETENCY': return medicationCompetency;
      case 'CPR': return cpr;
      case 'DRIVERS_LICENSE': return driversLicense;
      case 'POLICE_CHECK': return policeCheck;
      default: return other;
    }
  }

  String get value {
    switch (this) {
      case ndisScreening: return 'NDIS_SCREENING';
      case wwcc: return 'WWCC';
      case firstAid: return 'FIRST_AID';
      case manualHandling: return 'MANUAL_HANDLING';
      case medicationCompetency: return 'MEDICATION_COMPETENCY';
      case cpr: return 'CPR';
      case driversLicense: return 'DRIVERS_LICENSE';
      case policeCheck: return 'POLICE_CHECK';
      case other: return 'OTHER';
    }
  }

  String get label {
    switch (this) {
      case ndisScreening: return 'NDIS Worker Screening';
      case wwcc: return 'Working With Children Check';
      case firstAid: return 'First Aid Certificate';
      case manualHandling: return 'Manual Handling';
      case medicationCompetency: return 'Medication Competency';
      case cpr: return 'CPR Certificate';
      case driversLicense: return "Driver's License";
      case policeCheck: return 'Police Check';
      case other: return 'Other';
    }
  }
}

enum VerificationStatus {
  pending,
  verified,
  rejected,
  expired;

  static VerificationStatus fromString(String s) {
    return VerificationStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => VerificationStatus.pending,
    );
  }
}

enum ExpiryStatus { valid, expiring, expired, unknown }
