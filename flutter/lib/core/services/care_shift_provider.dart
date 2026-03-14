import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

// ═══════════════════════════════════════════════════════════
// ── Care Shift Provider — Field Operative Roster ─────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Fetches the current worker's shifts
// within a 6-week window (past 14 days → future 28 days).
// Powered by Supabase Realtime for instant schedule updates.

/// Selected date for the worker's roster view
final rosterSelectedDateProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

/// Active shift state — tracks if the worker is currently on a shift
final activeShiftProvider = StateProvider<CareShift?>((ref) => null);

/// The worker's shifts over a 6-week window — Realtime-powered
final myCareShiftsProvider = StreamProvider<List<CareShift>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final userId = SupabaseService.auth.currentUser?.id;

  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null || userId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<CareShift>>();

  final now = DateTime.now();
  final rangeStart = now.subtract(const Duration(days: 14)).toUtc().toIso8601String();
  final rangeEnd = now.add(const Duration(days: 28)).toUtc().toIso8601String();

  Future<void> fetchShifts() async {
    try {
      // Try shifts table first (care mode), fall back to schedule_blocks
      List<dynamic> data;
      try {
        data = await client
            .from('shifts')
            .select('*, participant_profiles(preferred_name, avatar_url, critical_alerts), clients(name)')
            .eq('organization_id', orgId)
            .or('worker_id.eq.$userId,assignee_id.eq.$userId')
            .gte('scheduled_start', rangeStart)
            .lte('scheduled_start', rangeEnd)
            .order('scheduled_start');
      } catch (_) {
        // Fallback to schedule_blocks for trades-mode orgs
        data = await client
            .from('schedule_blocks')
            .select()
            .eq('organization_id', orgId)
            .eq('technician_id', userId)
            .gte('start_time', rangeStart)
            .lte('start_time', rangeEnd)
            .order('start_time');
      }

      if (!controller.isClosed) {
        controller.add(
          data.map((s) => CareShift.fromJson(s as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) {
        controller.addError(e);
      }
    }
  }

  fetchShifts();

  // Listen for realtime changes
  final sub = client
      .channel('my-care-shifts-$userId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'shifts',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetchShifts(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Shifts for a specific date
final shiftsForDateProvider = Provider.family<List<CareShift>, DateTime>((ref, date) {
  final shiftsAsync = ref.watch(myCareShiftsProvider);
  return shiftsAsync.when(
    data: (shifts) => shifts.where((s) {
      return s.scheduledStart.year == date.year &&
          s.scheduledStart.month == date.month &&
          s.scheduledStart.day == date.day;
    }).toList()
      ..sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart)),
    loading: () => [],
    error: (_, __) => [],
  );
});

/// Today's shifts for the current worker
final myTodayShiftsProvider = Provider<List<CareShift>>((ref) {
  final now = DateTime.now();
  return ref.watch(shiftsForDateProvider(DateTime(now.year, now.month, now.day)));
});

/// Upcoming shifts (next 7 days, excluding today)
final upcomingShiftsProvider = Provider<List<CareShift>>((ref) {
  final shiftsAsync = ref.watch(myCareShiftsProvider);
  return shiftsAsync.when(
    data: (shifts) {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final weekLater = today.add(const Duration(days: 7));
      return shifts.where((s) =>
        s.scheduledStart.isAfter(today.add(const Duration(days: 1))) &&
        s.scheduledStart.isBefore(weekLater)
      ).toList()
        ..sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));
    },
    loading: () => [],
    error: (_, __) => [],
  );
});

/// Shifts requiring action (acceptance pending or missing reports)
final actionRequiredShiftsProvider = Provider<List<CareShift>>((ref) {
  final shiftsAsync = ref.watch(myCareShiftsProvider);
  return shiftsAsync.when(
    data: (shifts) => shifts.where((s) => s.needsAction).toList(),
    loading: () => [],
    error: (_, __) => [],
  );
});

/// Accept a shift
Future<void> acceptShift(String shiftId) async {
  await SupabaseService.client.from('shifts').update({
    'acceptance_status': 'accepted',
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', shiftId);
}

/// Decline a shift with a reason
Future<void> declineShift(String shiftId, String reason) async {
  await SupabaseService.client.from('shifts').update({
    'acceptance_status': 'declined',
    'decline_reason': reason,
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', shiftId);
}

/// Clock in to a shift with EVV data
Future<void> clockInToShift({
  required String shiftId,
  required String organizationId,
  required double lat,
  required double lng,
  bool isGeofenceOverride = false,
  String? overrideReason,
}) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return;

  final now = DateTime.now().toUtc().toIso8601String();

  // Update the shift status
  await SupabaseService.client.from('shifts').update({
    'status': 'in_progress',
    'actual_start': now,
    'updated_at': now,
  }).eq('id', shiftId);

  // Create a time entry for EVV
  await SupabaseService.client.from('time_entries').insert({
    'organization_id': organizationId,
    'user_id': userId,
    'type': 'shift',
    'status': 'active',
    'clock_in': now,
    'clock_in_lat': lat,
    'clock_in_lng': lng,
    'job_id': shiftId,
    'is_geofence_override': isGeofenceOverride,
    'geofence_override_reason': overrideReason,
  });
}

/// Clock out of a shift with EVV data
Future<void> clockOutOfShift({
  required String shiftId,
  required String timeEntryId,
  required DateTime clockInTime,
  required double lat,
  required double lng,
  int breakMinutes = 0,
  double? kilometersTravelled,
}) async {
  final now = DateTime.now();
  final totalMinutes = now.difference(clockInTime).inMinutes - breakMinutes;

  // Update shift status
  await SupabaseService.client.from('shifts').update({
    'status': 'completed',
    'actual_end': now.toUtc().toIso8601String(),
    'updated_at': now.toUtc().toIso8601String(),
  }).eq('id', shiftId);

  // Finalize time entry
  await SupabaseService.client.from('time_entries').update({
    'status': 'completed',
    'clock_out': now.toUtc().toIso8601String(),
    'clock_out_lat': lat,
    'clock_out_lng': lng,
    'total_minutes': totalMinutes,
    'break_duration_minutes': breakMinutes,
    if (kilometersTravelled != null) 'kilometers_travelled': kilometersTravelled,
    'updated_at': now.toUtc().toIso8601String(),
  }).eq('id', timeEntryId);
}
