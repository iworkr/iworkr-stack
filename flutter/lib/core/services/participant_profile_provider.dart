import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

// ─── Models ──────────────────────────────────────────────────────
class ParticipantDossier {
  // Identity
  final String id;
  final String? preferredName;
  final String? pronouns;
  final String? ndisNumber;
  final DateTime? dateOfBirth;
  final String? gender;
  final String? primaryLanguage;
  final String? culturalBackground;
  final String? profileSummary;
  final String? address;
  final String? accessInstructions;
  final String? keySafeCode;

  // Clinical
  final String? primaryDiagnosis;
  final List<String> secondaryDiagnoses;
  final String? mobilityRequirements;
  final String? mobilityLevel;
  final String? transferRequirement;
  final String? communicationPreferences;
  final String? communicationType;
  final List<String> dietaryRequirements;
  final List<String> criticalAlerts;
  final String? triggersAndRisks;

  // Relational (fetched separately)
  final List<DossierEmergencyContact> emergencyContacts;
  final List<DossierMedicalAlert> medicalAlerts;
  final List<DossierBehavior> behaviors;
  final List<DossierGoal> goals;

  const ParticipantDossier({
    required this.id,
    this.preferredName,
    this.pronouns,
    this.ndisNumber,
    this.dateOfBirth,
    this.gender,
    this.primaryLanguage,
    this.culturalBackground,
    this.profileSummary,
    this.address,
    this.accessInstructions,
    this.keySafeCode,
    this.primaryDiagnosis,
    this.secondaryDiagnoses = const [],
    this.mobilityRequirements,
    this.mobilityLevel,
    this.transferRequirement,
    this.communicationPreferences,
    this.communicationType,
    this.dietaryRequirements = const [],
    this.criticalAlerts = const [],
    this.triggersAndRisks,
    this.emergencyContacts = const [],
    this.medicalAlerts = const [],
    this.behaviors = const [],
    this.goals = const [],
  });

  int? get age {
    if (dateOfBirth == null) return null;
    final now = DateTime.now();
    int years = now.year - dateOfBirth!.year;
    if (now.month < dateOfBirth!.month ||
        (now.month == dateOfBirth!.month && now.day < dateOfBirth!.day)) {
      years--;
    }
    return years;
  }

  String get displayName =>
      (preferredName?.isNotEmpty == true ? preferredName! : 'Unnamed');

  factory ParticipantDossier.fromProfile(
    Map<String, dynamic> p, {
    List<DossierEmergencyContact> contacts = const [],
    List<DossierMedicalAlert> alerts = const [],
    List<DossierBehavior> behaviors = const [],
    List<DossierGoal> goals = const [],
  }) {
    return ParticipantDossier(
      id: p['id']?.toString() ?? '',
      preferredName: p['preferred_name'] as String?,
      pronouns: p['pronouns'] as String?,
      ndisNumber: p['ndis_number'] as String?,
      dateOfBirth: p['date_of_birth'] != null
          ? DateTime.tryParse(p['date_of_birth'].toString())
          : null,
      gender: p['gender'] as String?,
      primaryLanguage: p['primary_language'] as String?,
      culturalBackground: p['cultural_background'] as String?,
      profileSummary: p['profile_summary'] as String?,
      address: p['address'] as String?,
      accessInstructions: p['access_instructions'] as String?,
      keySafeCode: p['key_safe_code'] as String?,
      primaryDiagnosis: p['primary_diagnosis'] as String?,
      secondaryDiagnoses:
          (p['secondary_diagnoses'] as List<dynamic>?)?.cast<String>() ??
              const [],
      mobilityRequirements: p['mobility_requirements'] as String?,
      mobilityLevel: p['mobility_level'] as String?,
      transferRequirement: p['transfer_requirement'] as String?,
      communicationPreferences: p['communication_preferences'] as String?,
      communicationType: p['communication_type'] as String?,
      dietaryRequirements:
          (p['dietary_requirements'] as List<dynamic>?)?.cast<String>() ??
              const [],
      criticalAlerts:
          (p['critical_alerts'] as List<dynamic>?)?.cast<String>() ?? const [],
      triggersAndRisks: p['triggers_and_risks'] as String?,
      emergencyContacts: contacts,
      medicalAlerts: alerts,
      behaviors: behaviors,
      goals: goals,
    );
  }
}

class DossierEmergencyContact {
  final String id;
  final String name;
  final String relationship;
  final String phoneNumber;
  final bool isPrimary;

  const DossierEmergencyContact({
    required this.id,
    required this.name,
    required this.relationship,
    required this.phoneNumber,
    this.isPrimary = false,
  });

  factory DossierEmergencyContact.fromJson(Map<String, dynamic> j) =>
      DossierEmergencyContact(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        relationship: j['relationship']?.toString() ?? '',
        phoneNumber: j['phone_number']?.toString() ?? j['phone']?.toString() ?? '',
        isPrimary: j['is_primary'] == true,
      );
}

class DossierMedicalAlert {
  final String id;
  final String alertType;
  final String description;
  final String severity;
  final bool isActive;

  const DossierMedicalAlert({
    required this.id,
    required this.alertType,
    required this.description,
    required this.severity,
    this.isActive = true,
  });

  factory DossierMedicalAlert.fromJson(Map<String, dynamic> j) =>
      DossierMedicalAlert(
        id: j['id']?.toString() ?? '',
        alertType: j['alert_type']?.toString() ?? 'condition',
        description:
            j['description']?.toString() ?? j['title']?.toString() ?? '',
        severity: j['severity']?.toString() ?? 'medium',
        isActive: j['is_active'] != false,
      );

  bool get isCritical =>
      severity == 'critical' || severity == 'critical_fatal';
}

class DossierBehavior {
  final String id;
  final String? behaviorName;
  final String? triggerDescription;
  final List<String> earlyWarningSigns;
  final List<String> deEscalationSteps;
  final bool requiresBsp;

  const DossierBehavior({
    required this.id,
    this.behaviorName,
    this.triggerDescription,
    this.earlyWarningSigns = const [],
    this.deEscalationSteps = const [],
    this.requiresBsp = false,
  });

  factory DossierBehavior.fromJson(Map<String, dynamic> j) => DossierBehavior(
        id: j['id']?.toString() ?? '',
        behaviorName:
            j['behavior_name']?.toString() ?? j['trigger_description']?.toString(),
        triggerDescription: j['trigger_description']?.toString() ??
            j['known_triggers']?.toString(),
        earlyWarningSigns:
            (j['early_warning_signs'] as List<dynamic>?)?.cast<String>() ??
                const [],
        deEscalationSteps:
            (j['de_escalation_steps'] as List<dynamic>?)?.cast<String>() ??
                (j['de_escalation_strategies'] as List<dynamic>?)
                    ?.cast<String>() ??
                const [],
        requiresBsp: j['requires_bsp'] == true ||
            j['requires_restrictive_practice'] == true,
      );
}

class DossierGoal {
  final String id;
  final String title;
  final String? description;
  final String status;

  const DossierGoal({
    required this.id,
    required this.title,
    this.description,
    this.status = 'active',
  });

  factory DossierGoal.fromJson(Map<String, dynamic> j) => DossierGoal(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? j['goal_statement']?.toString() ?? '',
        description: j['description']?.toString(),
        status: j['status']?.toString() ?? 'active',
      );
}

class TimelineEvent {
  final String id;
  final String eventType; // 'note', 'medication', 'observation'
  final DateTime createdAt;
  final String summary;
  final String? authorName;
  final Map<String, dynamic> metadata;

  const TimelineEvent({
    required this.id,
    required this.eventType,
    required this.createdAt,
    required this.summary,
    this.authorName,
    this.metadata = const {},
  });

  factory TimelineEvent.fromJson(Map<String, dynamic> j) => TimelineEvent(
        id: j['id']?.toString() ?? '',
        eventType: j['event_type']?.toString() ?? 'note',
        createdAt: DateTime.tryParse(j['created_at']?.toString() ?? '') ??
            DateTime.now(),
        summary: j['summary']?.toString() ?? '',
        authorName: j['author_name']?.toString(),
        metadata: (j['metadata'] as Map<String, dynamic>?) ?? const {},
      );
}

class HandoverMessage {
  final String id;
  final String authorId;
  final String? authorName;
  final String message;
  final bool isPinned;
  final DateTime createdAt;

  const HandoverMessage({
    required this.id,
    required this.authorId,
    this.authorName,
    required this.message,
    this.isPinned = false,
    required this.createdAt,
  });

  factory HandoverMessage.fromJson(Map<String, dynamic> j) => HandoverMessage(
        id: j['id']?.toString() ?? '',
        authorId: j['author_id']?.toString() ?? '',
        authorName:
            (j['author'] as Map<String, dynamic>?)?['full_name']?.toString() ??
                (j['profiles'] as Map<String, dynamic>?)?['full_name']
                    ?.toString(),
        message: j['message']?.toString() ?? '',
        isPinned: j['is_pinned'] == true,
        createdAt: DateTime.tryParse(j['created_at']?.toString() ?? '') ??
            DateTime.now(),
      );
}

// ─── Providers ───────────────────────────────────────────────────

/// Full participant dossier (profile + related tables)
final participantDossierProvider =
    FutureProvider.family<ParticipantDossier, String>((ref, participantId) async {
  final sb = SupabaseService.client;

  // Fetch profile
  final profileRow = await sb
      .from('participant_profiles')
      .select('''
        id, preferred_name, pronouns, ndis_number, date_of_birth, gender,
        primary_language, cultural_background, profile_summary, address,
        access_instructions, key_safe_code,
        primary_diagnosis, secondary_diagnoses,
        mobility_requirements, mobility_level, transfer_requirement,
        communication_preferences, communication_type,
        dietary_requirements, critical_alerts, triggers_and_risks
      ''')
      .eq('id', participantId)
      .maybeSingle();

  if (profileRow == null) {
    throw Exception('Participant not found');
  }

  // Fetch related tables in parallel
  final contactsFuture = sb
      .from('participant_emergency_contacts')
      .select()
      .eq('participant_id', participantId)
      .order('is_primary', ascending: false);

  final alertsFuture = sb
      .from('participant_medical_alerts')
      .select()
      .eq('participant_id', participantId)
      .eq('is_active', true)
      .order('severity');

  final behaviorsFuture = sb
      .from('participant_behaviors')
      .select()
      .eq('participant_id', participantId)
      .order('created_at');

  final goalsFuture = sb
      .from('participant_goals')
      .select()
      .eq('participant_id', participantId)
      .eq('status', 'active')
      .order('created_at');

  final results = await Future.wait([
    contactsFuture,
    alertsFuture,
    behaviorsFuture,
    goalsFuture,
  ]);

  final contacts = (results[0] as List)
      .map((r) => DossierEmergencyContact.fromJson(r as Map<String, dynamic>))
      .toList();
  final alerts = (results[1] as List)
      .map((r) => DossierMedicalAlert.fromJson(r as Map<String, dynamic>))
      .toList();
  final behaviors = (results[2] as List)
      .map((r) => DossierBehavior.fromJson(r as Map<String, dynamic>))
      .toList();
  final goals = (results[3] as List)
      .map((r) => DossierGoal.fromJson(r as Map<String, dynamic>))
      .toList();

  // Also check legacy emergency_contacts jsonb column on profile
  final legacyContacts =
      (profileRow['emergency_contacts'] as List<dynamic>?) ?? [];
  final allContacts = [
    ...contacts,
    ...legacyContacts.map((e) =>
        DossierEmergencyContact.fromJson(e as Map<String, dynamic>)),
  ];

  return ParticipantDossier.fromProfile(
    profileRow,
    contacts: allContacts,
    alerts: alerts,
    behaviors: behaviors,
    goals: goals,
  );
});

/// Unified timeline (calls edge function)
final participantTimelineProvider =
    FutureProvider.family<List<TimelineEvent>, ({String participantId, String? filter})>(
        (ref, params) async {
  final session = SupabaseService.client.auth.currentSession;
  if (session == null) return const [];

  try {
    final response = await SupabaseService.client.functions.invoke(
      'get-participant-timeline',
      body: {
        'participant_id': params.participantId,
        'limit': 100,
        if (params.filter != null) 'filter': params.filter,
      },
    );

    final data = response.data;
    if (data is List) {
      return data
          .map((e) => TimelineEvent.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return const [];
  } catch (_) {
    // Fallback: fetch directly if edge function not deployed yet
    return _fetchTimelineDirect(params.participantId, params.filter);
  }
});

Future<List<TimelineEvent>> _fetchTimelineDirect(
    String participantId, String? filter) async {
  final sb = SupabaseService.client;
  final events = <TimelineEvent>[];

  if (filter == null || filter == 'note') {
    // Shift note submissions (debrief forms)
    try {
      final shiftNotes = await sb
          .from('shift_note_submissions')
          .select('id, created_at, submission_data, worker_id, shift_id, status, profiles!shift_note_submissions_worker_id_fkey(full_name), schedule_blocks!shift_note_submissions_shift_id_fkey(start_time, end_time, title)')
          .eq('participant_id', participantId)
          .order('created_at', ascending: false)
          .limit(50);
      for (final n in shiftNotes) {
        final data = (n['submission_data'] as Map<String, dynamic>?) ?? {};
        final summary = data['shift_summary']?.toString() ??
            data['context_of_support']?.toString() ??
            data.values.whereType<String>().firstOrNull ??
            'Shift note submitted';
        final workerName = (n['profiles'] as Map?)?['full_name']?.toString();
        final shiftTitle = (n['schedule_blocks'] as Map?)?['title']?.toString();
        events.add(TimelineEvent(
          id: n['id']?.toString() ?? '',
          eventType: 'note',
          createdAt:
              DateTime.tryParse(n['created_at']?.toString() ?? '') ?? DateTime.now(),
          summary: shiftTitle != null ? '$shiftTitle — $summary' : summary,
          authorName: workerName,
          metadata: {
            'source': 'shift_note_submissions',
            'shift_id': n['shift_id'],
            'status': n['status'],
            'submission_data': data,
          },
        ));
      }
    } catch (_) {}

    // Legacy progress_notes
    try {
      final notes = await sb
          .from('progress_notes')
          .select('id, created_at, content, worker_id, summary')
          .eq('participant_id', participantId)
          .order('created_at', ascending: false)
          .limit(50);
      for (final n in notes) {
        events.add(TimelineEvent(
          id: n['id']?.toString() ?? '',
          eventType: 'note',
          createdAt:
              DateTime.tryParse(n['created_at']?.toString() ?? '') ?? DateTime.now(),
          summary: (n['summary']?.toString() ?? n['content']?.toString() ?? '').length > 280
              ? '${(n['summary'] ?? n['content']).toString().substring(0, 280)}…'
              : n['summary']?.toString() ?? n['content']?.toString() ?? '',
          metadata: {'source': 'progress_notes'},
        ));
      }
    } catch (_) {}
  }

  // Completed shifts for this participant
  if (filter == null || filter == 'shift') {
    try {
      final shifts = await sb
          .from('schedule_blocks')
          .select('id, start_time, end_time, title, status, technician_id, profiles!schedule_blocks_technician_id_fkey(full_name)')
          .eq('participant_id', participantId)
          .eq('status', 'complete')
          .order('start_time', ascending: false)
          .limit(50);
      for (final s in shifts) {
        final workerName = (s['profiles'] as Map?)?['full_name']?.toString();
        final startTime = DateTime.tryParse(s['start_time']?.toString() ?? '');
        final endTime = DateTime.tryParse(s['end_time']?.toString() ?? '');
        final title = s['title']?.toString() ?? 'Shift';
        String timeSummary = title;
        if (startTime != null && endTime != null) {
          timeSummary = '$title · ${DateFormat('HH:mm').format(startTime.toLocal())} – ${DateFormat('HH:mm').format(endTime.toLocal())}';
        }
        events.add(TimelineEvent(
          id: s['id']?.toString() ?? '',
          eventType: 'shift',
          createdAt: startTime ?? DateTime.now(),
          summary: timeSummary,
          authorName: workerName,
          metadata: {
            'source': 'schedule_blocks',
            'shift_id': s['id'],
            'status': s['status'],
          },
        ));
      }
    } catch (_) {}
  }

  if (filter == null || filter == 'medication' || filter == 'prn') {
    var query = sb
        .from('medication_administration_records')
        .select('id, administered_at, medication_name, status, is_prn')
        .eq('participant_id', participantId)
        .order('administered_at', ascending: false)
        .limit(50);
    if (filter == 'prn') {
      query = sb
          .from('medication_administration_records')
          .select('id, administered_at, medication_name, status, is_prn')
          .eq('participant_id', participantId)
          .eq('is_prn', true)
          .order('administered_at', ascending: false)
          .limit(50);
    }
    final meds = await query;
    for (final m in meds) {
      events.add(TimelineEvent(
        id: m['id']?.toString() ?? '',
        eventType: 'medication',
        createdAt: DateTime.tryParse(m['administered_at']?.toString() ?? '') ??
            DateTime.now(),
        summary:
            '${m['medication_name'] ?? 'Unknown'} — ${m['status'] ?? 'recorded'}',
        metadata: {'is_prn': m['is_prn'] == true},
      ));
    }
  }

  if (filter == null || filter == 'observation') {
    final obs = await sb
        .from('health_observations')
        .select(
            'id, recorded_at, observation_type, notes, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature')
        .eq('participant_id', participantId)
        .order('recorded_at', ascending: false)
        .limit(50);
    for (final o in obs) {
      final parts = <String>[];
      if (o['observation_type'] != null) parts.add(o['observation_type'].toString());
      if (o['blood_pressure_systolic'] != null) {
        parts.add('BP: ${o['blood_pressure_systolic']}/${o['blood_pressure_diastolic']}');
      }
      if (o['heart_rate'] != null) parts.add('HR: ${o['heart_rate']}');
      if (o['temperature'] != null) parts.add('Temp: ${o['temperature']}°C');

      events.add(TimelineEvent(
        id: o['id']?.toString() ?? '',
        eventType: 'observation',
        createdAt: DateTime.tryParse(o['recorded_at']?.toString() ?? '') ??
            DateTime.now(),
        summary: parts.isNotEmpty
            ? parts.join(' · ')
            : o['notes']?.toString() ?? 'Observation logged',
      ));
    }
  }

  events.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return events;
}

/// Handover communication log (real-time)
final handoverMessagesProvider =
    StreamProvider.family<List<HandoverMessage>, String>(
        (ref, participantId) async* {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) {
    yield const [];
    return;
  }

  // Initial fetch
  final initial = await SupabaseService.client
      .from('participant_communication_logs')
      .select('*, profiles!participant_communication_logs_author_id_fkey(full_name)')
      .eq('participant_id', participantId)
      .eq('organization_id', orgId)
      .order('is_pinned', ascending: false)
      .order('created_at', ascending: false)
      .limit(100);

  yield (initial as List)
      .map((r) => HandoverMessage.fromJson(r as Map<String, dynamic>))
      .toList();

  // Real-time updates
  await for (final _ in SupabaseService.client
      .from('participant_communication_logs')
      .stream(primaryKey: ['id']).eq('participant_id', participantId)) {
    final rows = await SupabaseService.client
        .from('participant_communication_logs')
        .select(
            '*, profiles!participant_communication_logs_author_id_fkey(full_name)')
        .eq('participant_id', participantId)
        .eq('organization_id', orgId)
        .order('is_pinned', ascending: false)
        .order('created_at', ascending: false)
        .limit(100);

    yield (rows as List)
        .map((r) => HandoverMessage.fromJson(r as Map<String, dynamic>))
        .toList();
  }
});

/// Send a handover message
Future<void> sendHandoverMessage({
  required String participantId,
  required String message,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

  final orgId = orgRow?['organization_id'] as String?;
  if (orgId == null) throw StateError('No active organization');

  await SupabaseService.client.from('participant_communication_logs').insert({
    'participant_id': participantId,
    'organization_id': orgId,
    'author_id': user.id,
    'message': message,
  });
}

/// Pin/unpin a handover message (managers only)
Future<void> togglePinMessage(String messageId, bool pinned) async {
  final user = SupabaseService.client.auth.currentUser;
  await SupabaseService.client
      .from('participant_communication_logs')
      .update({
        'is_pinned': pinned,
        'pinned_by': pinned ? user?.id : null,
        'pinned_at': pinned ? DateTime.now().toIso8601String() : null,
      })
      .eq('id', messageId);
}
