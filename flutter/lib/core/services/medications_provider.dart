import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/participant_medication.dart';

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
      .select()
      .eq('medication_id', medicationId)
      .order('scheduled_time', ascending: false)
      .limit(50);

  return (data as List)
      .map((e) => MAREntry.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Today's pending MAR entries across all medications for the org
final todaysPendingMARProvider =
    FutureProvider<List<MAREntry>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final now = DateTime.now();
  final startOfDay = DateTime(now.year, now.month, now.day).toUtc().toIso8601String();
  final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59).toUtc().toIso8601String();

  final data = await SupabaseService.client
      .from('medication_administration_records')
      .select('*, participant_medications!inner(organization_id)')
      .eq('participant_medications.organization_id', orgId)
      .gte('scheduled_time', startOfDay)
      .lte('scheduled_time', endOfDay)
      .eq('outcome', 'pending')
      .order('scheduled_time');

  return (data as List)
      .map((e) => MAREntry.fromJson(e as Map<String, dynamic>))
      .toList();
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
  required DateTime scheduledTime,
  required MAROutcome outcome,
  String? refusalReason,
  String? notes,
  String? witnessedBy,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return null;

  final data = await SupabaseService.client
      .from('medication_administration_records')
      .insert({
        'medication_id': medicationId,
        'administered_by': user.id,
        'scheduled_time': scheduledTime.toUtc().toIso8601String(),
        'administered_at': outcome == MAROutcome.given
            ? DateTime.now().toUtc().toIso8601String()
            : null,
        'outcome': outcome.value,
        'refusal_reason': refusalReason,
        'notes': notes,
        'witnessed_by': witnessedBy,
      })
      .select()
      .single();

  return MAREntry.fromJson(data);
}
