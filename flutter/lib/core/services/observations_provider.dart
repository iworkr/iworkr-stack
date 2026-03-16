import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/health_observation.dart';

final RegExp _uuidRegex = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
);

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
          .select('*, worker:profiles!health_observations_worker_id_fkey(full_name)')
          .eq('organization_id', orgId)
          .order('observed_at', ascending: false)
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
          o.observedAt.year == today.year &&
          o.observedAt.month == today.month &&
          o.observedAt.day == today.day)
      .toList();
});

// ── Mutations ────────────────────────────────────────────

Future<HealthObservation?> recordObservation({
  required String participantId,
  required ObservationType type,
  required Map<String, dynamic> values,
  String? notes,
}) async {
  try {
    final normalizedParticipantId = participantId.trim();
    if (!_uuidRegex.hasMatch(normalizedParticipantId)) {
      throw ArgumentError('A valid participant must be selected.');
    }

    final user = SupabaseService.auth.currentUser;
    if (user == null) {
      throw StateError('You must be signed in to record observations.');
    }

    final orgRow = await SupabaseService.client
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
    if (orgRow == null) {
      throw StateError('No active organization membership found.');
    }

    final data = await SupabaseService.client
        .from('health_observations')
        .insert({
          'organization_id': orgRow['organization_id'],
          'participant_id': normalizedParticipantId,
          'worker_id': user.id,
          'observation_type': type.value,
          'value_numeric': _extractNumericValue(values, type),
          'value_text': _extractTextValue(values, type),
          'value_systolic': _extractSystolicValue(values, type),
          'value_diastolic': _extractDiastolicValue(values, type),
          'unit': _extractUnit(values, type),
          'is_abnormal': values['is_abnormal'] == true,
          'notes': notes,
          'observed_at': DateTime.now().toUtc().toIso8601String(),
        })
        .select('*, worker:profiles!health_observations_worker_id_fkey(full_name)')
        .single();

    return HealthObservation.fromJson(data);
  } on PostgrestException catch (e, stack) {
    await MobileTelemetryEngine.instance.captureAndReport(
      e,
      stack,
      source: 'observations.recordObservation',
      fatal: false,
      extra: <String, dynamic>{'pgrst_code': e.code},
    );
    rethrow;
  }
}

double? _extractNumericValue(Map<String, dynamic> values, ObservationType type) {
  switch (type) {
    case ObservationType.heartRate:
      return (values['bpm'] as num?)?.toDouble();
    case ObservationType.temperature:
      return (values['celsius'] as num?)?.toDouble();
    case ObservationType.bloodGlucose:
      return (values['mmol'] as num?)?.toDouble();
    case ObservationType.oxygenSaturation:
      return (values['spo2'] as num?)?.toDouble();
    case ObservationType.weight:
      return (values['kg'] as num?)?.toDouble();
    case ObservationType.painLevel:
      return (values['level'] as num?)?.toDouble();
    case ObservationType.moodRating:
      return (values['rating'] as num?)?.toDouble();
    case ObservationType.fluidIntake:
      return (values['ml'] as num?)?.toDouble();
    case ObservationType.sleepQuality:
      return (values['hours'] as num?)?.toDouble();
    case ObservationType.respiration:
      return (values['rate'] as num?)?.toDouble();
    default:
      return null;
  }
}

String? _extractTextValue(Map<String, dynamic> values, ObservationType type) {
  switch (type) {
    case ObservationType.bowelMovement:
      return values['type']?.toString();
    case ObservationType.general:
      return values['summary'] as String?;
    default:
      return null;
  }
}

int? _extractSystolicValue(Map<String, dynamic> values, ObservationType type) {
  if (type != ObservationType.bloodPressure) return null;
  return (values['systolic'] as num?)?.toInt();
}

int? _extractDiastolicValue(Map<String, dynamic> values, ObservationType type) {
  if (type != ObservationType.bloodPressure) return null;
  return (values['diastolic'] as num?)?.toInt();
}

String? _extractUnit(Map<String, dynamic> values, ObservationType type) {
  switch (type) {
    case ObservationType.bloodPressure:
      return 'mmHg';
    case ObservationType.heartRate:
      return 'BPM';
    case ObservationType.temperature:
      return '°C';
    case ObservationType.bloodGlucose:
      return 'mmol/L';
    case ObservationType.oxygenSaturation:
      return '%';
    case ObservationType.weight:
      return 'kg';
    case ObservationType.fluidIntake:
      return 'ml';
    case ObservationType.sleepQuality:
      return 'hrs';
    case ObservationType.respiration:
      return 'breaths/min';
    default:
      return values['unit'] as String?;
  }
}
