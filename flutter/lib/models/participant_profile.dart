/// Participant profile model — maps to public.participant_profiles
/// Project Nightingale: Care sector extension of client data
class ParticipantProfile {
  final String id;
  final String clientId;
  final String organizationId;
  final String? ndisNumber;
  final DateTime? dateOfBirth;
  final String? primaryDiagnosis;
  final String? mobilityRequirements;
  final String? communicationPreferences;
  final String? triggersAndRisks;
  final List<String> supportCategories;
  final List<EmergencyContact> emergencyContacts;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
  // Joined
  final String? clientName;

  const ParticipantProfile({
    required this.id,
    required this.clientId,
    required this.organizationId,
    this.ndisNumber,
    this.dateOfBirth,
    this.primaryDiagnosis,
    this.mobilityRequirements,
    this.communicationPreferences,
    this.triggersAndRisks,
    this.supportCategories = const [],
    this.emergencyContacts = const [],
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.clientName,
  });

  factory ParticipantProfile.fromJson(Map<String, dynamic> json) {
    final client = json['clients'] as Map<String, dynamic>?;
    return ParticipantProfile(
      id: json['id'] as String,
      clientId: json['client_id'] as String,
      organizationId: json['organization_id'] as String,
      ndisNumber: json['ndis_number'] as String?,
      dateOfBirth: json['date_of_birth'] != null ? DateTime.tryParse(json['date_of_birth'] as String) : null,
      primaryDiagnosis: json['primary_diagnosis'] as String?,
      mobilityRequirements: json['mobility_requirements'] as String?,
      communicationPreferences: json['communication_preferences'] as String?,
      triggersAndRisks: json['triggers_and_risks'] as String?,
      supportCategories: (json['support_categories'] as List<dynamic>?)?.cast<String>() ?? [],
      emergencyContacts: (json['emergency_contacts'] as List<dynamic>?)
              ?.map((e) => EmergencyContact.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      clientName: client?['name'] as String?,
    );
  }

  int? get age {
    if (dateOfBirth == null) return null;
    final now = DateTime.now();
    int years = now.year - dateOfBirth!.year;
    if (now.month < dateOfBirth!.month || (now.month == dateOfBirth!.month && now.day < dateOfBirth!.day)) {
      years--;
    }
    return years;
  }
}

class EmergencyContact {
  final String name;
  final String relationship;
  final String phone;
  final String? email;

  const EmergencyContact({
    required this.name,
    required this.relationship,
    required this.phone,
    this.email,
  });

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      name: json['name'] as String? ?? '',
      relationship: json['relationship'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'relationship': relationship,
    'phone': phone,
    if (email != null) 'email': email,
  };
}
