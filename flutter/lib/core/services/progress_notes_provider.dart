import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/progress_note.dart';

// ═══════════════════════════════════════════════════════════
// ── Progress Notes — Shift Completion Reports ────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Structured shift reports with EVV
// (Electronic Visit Verification) GPS data for NDIS compliance.

/// Recent progress notes for the org
final progressNotesStreamProvider =
    StreamProvider<List<ProgressNote>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ProgressNote>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('progress_notes')
          .select('*, profiles!progress_notes_worker_id_fkey(full_name)')
          .eq('organization_id', orgId)
          .order('created_at', ascending: false)
          .limit(50);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) => ProgressNote.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('progress-notes-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'progress_notes',
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

/// Progress notes for a specific job/shift
final jobProgressNotesProvider =
    Provider.family<List<ProgressNote>, String>((ref, jobId) {
  final all = ref.watch(progressNotesStreamProvider).valueOrNull ?? [];
  return all.where((n) => n.jobId == jobId).toList();
});

/// My progress notes
final myProgressNotesProvider = Provider<List<ProgressNote>>((ref) {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return [];
  final all = ref.watch(progressNotesStreamProvider).valueOrNull ?? [];
  return all.where((n) => n.workerId == userId).toList();
});

// ── Mutations ────────────────────────────────────────────

Future<ProgressNote?> createProgressNote({
  String? jobId,
  String? participantId,
  required String summary,
  String? goalsAddressed,
  String? participantMood,
  String? observations,
  bool? participantPresent,
  String? participantFeedback,
  double? clockInLat,
  double? clockInLng,
  DateTime? clockInTime,
  double? clockOutLat,
  double? clockOutLng,
  DateTime? clockOutTime,
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
      .from('progress_notes')
      .insert({
        'organization_id': orgRow['organization_id'],
        'job_id': jobId,
        'participant_id': participantId,
        'worker_id': user.id,
        'summary': summary,
        'goals_addressed': goalsAddressed,
        'participant_mood': participantMood,
        'observations': observations,
        'participant_present': participantPresent,
        'participant_feedback': participantFeedback,
        'clock_in_lat': clockInLat,
        'clock_in_lng': clockInLng,
        'clock_in_time': clockInTime?.toUtc().toIso8601String(),
        'clock_out_lat': clockOutLat,
        'clock_out_lng': clockOutLng,
        'clock_out_time': clockOutTime?.toUtc().toIso8601String(),
      })
      .select('*, profiles!progress_notes_worker_id_fkey(full_name)')
      .single();

  return ProgressNote.fromJson(data);
}
