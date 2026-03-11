import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/health_observation.dart';

// ═══════════════════════════════════════════════════════════
// ── Health Observations — Vital Signs Telemetry ──────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Record, view, and track health
// observations / vital signs for care participants.

/// All recent observations for the org (Realtime)
final observationsStreamProvider =
    StreamProvider<List<HealthObservation>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<HealthObservation>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('health_observations')
          .select('*, profiles!health_observations_recorded_by_fkey(full_name)')
          .eq('organization_id', orgId)
          .order('recorded_at', ascending: false)
          .limit(100);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) =>
                  HealthObservation.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('observations-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'health_observations',
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

/// Observations for a specific participant
final participantObservationsProvider =
    Provider.family<List<HealthObservation>, String>(
        (ref, participantId) {
  final all = ref.watch(observationsStreamProvider).valueOrNull ?? [];
  return all.where((o) => o.participantId == participantId).toList();
});

/// Today's observations
final todaysObservationsProvider = Provider<List<HealthObservation>>((ref) {
  final all = ref.watch(observationsStreamProvider).valueOrNull ?? [];
  final today = DateTime.now();
  return all
      .where((o) =>
          o.recordedAt.year == today.year &&
          o.recordedAt.month == today.month &&
          o.recordedAt.day == today.day)
      .toList();
});

// ── Mutations ────────────────────────────────────────────

Future<HealthObservation?> recordObservation({
  required String participantId,
  required ObservationType type,
  required Map<String, dynamic> values,
  String? notes,
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
      .from('health_observations')
      .insert({
        'organization_id': orgRow['organization_id'],
        'participant_id': participantId,
        'recorded_by': user.id,
        'observation_type': type.value,
        'values': values,
        'notes': notes,
        'recorded_at': DateTime.now().toUtc().toIso8601String(),
      })
      .select('*, profiles!health_observations_recorded_by_fkey(full_name)')
      .single();

  return HealthObservation.fromJson(data);
}
