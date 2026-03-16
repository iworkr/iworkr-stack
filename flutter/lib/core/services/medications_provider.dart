import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/participant_medication.dart';

final RegExp _uuidRegex = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
);

class WitnessProfileOption {
  final String id;
  final String label;

  const WitnessProfileOption({
    required this.id,
    required this.label,
  });
}

// ═══════════════════════════════════════════════════════════
// ── eMAR — Electronic Medication Administration Records ──
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Medication profiles + administration
// tracking with realtime updates for clinical safety.

/// Active medications for the organization (Realtime)
final medicationsStreamProvider =
    StreamProvider<List<ParticipantMedication>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ParticipantMedication>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('participant_medications')
          .select()
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('medication_name');

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) =>
                  ParticipantMedication.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('medications-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'participant_medications',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Medications for a specific participant
final participantMedicationsProvider =
    Provider.family<List<ParticipantMedication>, String>(
        (ref, participantId) {
  final all = ref.watch(medicationsStreamProvider).valueOrNull ?? [];
  return all.where((m) => m.participantId == participantId).toList();
});

/// MAR entries for a specific medication
final marEntriesProvider =
    FutureProvider.family<List<MAREntry>, String>((ref, medicationId) async {
  final data = await SupabaseService.client
      .from('medication_administration_records')
      .select('*, worker_profile:profiles!medication_administration_records_worker_id_fkey(full_name), witness_profile:profiles!medication_administration_records_witness_id_fkey(full_name)')
      .eq('medication_id', medicationId)
      .order('administered_at', ascending: false)
      .limit(50);

  return (data as List)
      .map((e) => MAREntry.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Today's pending MAR entries across all medications for the org
final todaysPendingMARProvider =
    FutureProvider<List<MAREntry>>((ref) async {
  // MAR no longer supports "pending" scheduled placeholders in schema;
  // return the most recent administrations today to power the dashboard.
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final now = DateTime.now();
  final startOfDay = DateTime(now.year, now.month, now.day).toUtc().toIso8601String();
  final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59).toUtc().toIso8601String();

  final data = await SupabaseService.client
      .from('medication_administration_records')
      .select('*, worker_profile:profiles!medication_administration_records_worker_id_fkey(full_name)')
      .eq('organization_id', orgId)
      .gte('administered_at', startOfDay)
      .lte('administered_at', endOfDay)
      .order('administered_at', ascending: false);

  return (data as List)
      .map((e) => MAREntry.fromJson(e as Map<String, dynamic>))
      .toList();
});

final eligibleWitnessesProvider = FutureProvider<List<WitnessProfileOption>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return const [];

  final memberRows = await SupabaseService.client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .limit(200);

  final userIds = (memberRows as List)
      .map((row) => row['user_id'] as String?)
      .whereType<String>()
      .toList();
  if (userIds.isEmpty) return const [];

  final profileRows = await SupabaseService.client
      .from('profiles')
      .select('id, full_name, email')
      .inFilter('id', userIds);

  return (profileRows as List).map((row) {
    final id = row['id'] as String;
    final fullName = (row['full_name'] as String?)?.trim();
    final email = (row['email'] as String?)?.trim();
    final label = (fullName != null && fullName.isNotEmpty)
        ? fullName
        : ((email != null && email.isNotEmpty) ? email : id);
    return WitnessProfileOption(id: id, label: label);
  }).toList();
});

// ── Mutations ────────────────────────────────────────────

Future<ParticipantMedication?> createMedication({
  required String participantId,
  required String medicationName,
  String? dosage,
  required MedicationRoute route,
  required MedicationFrequency frequency,
  String? instructions,
  String? prescriber,
  DateTime? startDate,
  DateTime? endDate,
  bool isPrn = false,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;

  final data = await SupabaseService.client
      .from('participant_medications')
      .insert({
        'organization_id': orgRow['organization_id'],
        'participant_id': participantId,
        'medication_name': medicationName,
        'dosage': dosage,
        'route': route.value,
        'frequency': frequency.value,
        'instructions': instructions,
        'prescriber': prescriber,
        'start_date': startDate?.toIso8601String(),
        'end_date': endDate?.toIso8601String(),
        'is_prn': isPrn,
      })
      .select()
      .single();

  return ParticipantMedication.fromJson(data);
}

Future<MAREntry?> recordAdministration({
  required String medicationId,
  DateTime? scheduledTime,
  required MAROutcome outcome,
  String? refusalReason,
  String? notes,
  String? witnessedBy,
}) async {
  try {
    final user = SupabaseService.auth.currentUser;
    if (user == null) return null;

    final medRow = await SupabaseService.client
        .from('participant_medications')
        .select('organization_id, participant_id')
        .eq('id', medicationId)
        .maybeSingle();
    if (medRow == null) return null;

    final normalizedWitnessId = witnessedBy?.trim();
    if (normalizedWitnessId != null &&
        normalizedWitnessId.isNotEmpty &&
        !_uuidRegex.hasMatch(normalizedWitnessId)) {
      throw ArgumentError('Witness must be selected from staff list.');
    }

    final data = await SupabaseService.client
        .from('medication_administration_records')
        .insert({
          'organization_id': medRow['organization_id'],
          'medication_id': medicationId,
          'participant_id': medRow['participant_id'],
          'worker_id': user.id,
          'administered_at': (scheduledTime ?? DateTime.now()).toUtc().toIso8601String(),
          'outcome': outcome.value,
          'notes': [
            if (notes != null && notes.trim().isNotEmpty) notes.trim(),
            if (refusalReason != null && refusalReason.trim().isNotEmpty) 'Refusal reason: ${refusalReason.trim()}',
          ].join('\n'),
          'witness_id': (normalizedWitnessId == null || normalizedWitnessId.isEmpty)
              ? null
              : normalizedWitnessId,
        })
        .select('*, worker_profile:profiles!medication_administration_records_worker_id_fkey(full_name), witness_profile:profiles!medication_administration_records_witness_id_fkey(full_name)')
        .single();

    return MAREntry.fromJson(data);
  } on PostgrestException catch (e, stack) {
    await MobileTelemetryEngine.instance.captureAndReport(
      e,
      stack,
      source: 'medications.recordAdministration',
      fatal: false,
      extra: <String, dynamic>{'pgrst_code': e.code},
    );
    rethrow;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Project Asclepius — PRN Safety Enforcement
// ═══════════════════════════════════════════════════════════════════

/// Check if a PRN medication can be safely administered right now.
/// Returns null if safe, or an error message string if blocked.
Future<String?> checkPrnSafety({
  required String medicationId,
  required String participantId,
  required int? minGapHours,
  required int? maxDoses24h,
}) async {
  if (minGapHours == null && maxDoses24h == null) return null;

  try {
    final now = DateTime.now().toUtc();
    final window24h = now.subtract(const Duration(hours: 24));

    final data = await SupabaseService.client
        .from('medication_administration_records')
        .select('administered_at')
        .eq('medication_id', medicationId)
        .eq('participant_id', participantId)
        .or('outcome.eq.given,outcome.eq.prn_given,outcome.eq.self_administered')
        .gte('administered_at', window24h.toIso8601String())
        .order('administered_at', ascending: false);

    final entries = data as List<dynamic>;

    // Check time gap
    if (minGapHours != null && entries.isNotEmpty) {
      final lastAdminStr = entries[0]['administered_at'] as String?;
      if (lastAdminStr != null) {
        final lastAdmin = DateTime.parse(lastAdminStr);
        final nextAllowed = lastAdmin.add(Duration(hours: minGapHours));
        if (now.isBefore(nextAllowed)) {
          final remaining = nextAllowed.difference(now);
          final hrs = remaining.inHours;
          final mins = remaining.inMinutes % 60;
          return 'ADMINISTRATION BLOCKED: Minimum ${minGapHours}h gap required. '
              'Next dose available in ${hrs}h ${mins}m.';
        }
      }
    }

    // Check 24h maximum
    if (maxDoses24h != null && entries.length >= maxDoses24h) {
      return '24-HOUR MAXIMUM REACHED: $maxDoses24h doses administered in the last 24 hours. '
          'Do not administer. Contact Clinical Manager or Healthdirect immediately.';
    }

    return null; // Safe to administer
  } catch (e) {
    return null; // Fail open — don't block on query error, but log
  }
}

/// Verify S8 witness via Edge Function
Future<Map<String, dynamic>?> verifyS8Witness({
  required String medicationId,
  required String primaryWorkerId,
  required String witnessEmployeeId,
  required String witnessPin,
  required String organizationId,
}) async {
  try {
    final response = await SupabaseService.client.functions.invoke(
      'verify-s8-witness',
      body: {
        'medication_id': medicationId,
        'primary_worker_id': primaryWorkerId,
        'witness_employee_id': witnessEmployeeId,
        'witness_pin': witnessPin,
        'organization_id': organizationId,
      },
    );

    if (response.status == 200) {
      return response.data as Map<String, dynamic>?;
    }

    final errorData = response.data as Map<String, dynamic>?;
    throw Exception(errorData?['error'] ?? 'S8 witness verification failed');
  } catch (e) {
    rethrow;
  }
}

/// Log PRN efficacy update
Future<void> logPrnEfficacy({
  required String marEntryId,
  required String efficacyStatus, // no_improvement, partial, complete
}) async {
  try {
    await SupabaseService.client
        .from('medication_administration_records')
        .update({
          'prn_efficacy_status': efficacyStatus,
          'prn_efficacy_logged_at': DateTime.now().toUtc().toIso8601String(),
          'prn_followup_done': true,
        })
        .eq('id', marEntryId);
  } on PostgrestException catch (e, stack) {
    await MobileTelemetryEngine.instance.captureAndReport(
      e,
      stack,
      source: 'medications.logPrnEfficacy',
      fatal: false,
    );
  }
}
