import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

// ═══════════════════════════════════════════════════════════
// ── Care Shift Provider — Field Operative Roster ─────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale + Monolith-Execution:
// Manages shift state, clock-in/out, SIL multi-participant
// context, and persists active workspace state for cold starts.

const _kActiveWorkspaceKey = 'active_workspace_state_v1';
const _storage = FlutterSecureStorage();

/// Selected date for the worker's roster view
final rosterSelectedDateProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

enum ActiveShiftStatus { none, active, onBreak }

class ActiveShiftState {
  final String? shiftId;
  final String? participantId;
  final String? timeEntryId;
  final DateTime? clockInTime;
  final ActiveShiftStatus status;
  /// For SIL multi-participant shifts — all participant IDs in this shift
  final List<String> silParticipantIds;
  /// Currently selected participant index in SIL carousel
  final int silActiveIndex;

  const ActiveShiftState({
    this.shiftId,
    this.participantId,
    this.timeEntryId,
    this.clockInTime,
    this.status = ActiveShiftStatus.none,
    this.silParticipantIds = const [],
    this.silActiveIndex = 0,
  });

  bool get hasActiveShift =>
      status == ActiveShiftStatus.active && shiftId != null;
  bool get isSilShift => silParticipantIds.length > 1;

  ActiveShiftState copyWith({
    String? shiftId,
    String? participantId,
    String? timeEntryId,
    DateTime? clockInTime,
    ActiveShiftStatus? status,
    List<String>? silParticipantIds,
    int? silActiveIndex,
  }) =>
      ActiveShiftState(
        shiftId: shiftId ?? this.shiftId,
        participantId: participantId ?? this.participantId,
        timeEntryId: timeEntryId ?? this.timeEntryId,
        clockInTime: clockInTime ?? this.clockInTime,
        status: status ?? this.status,
        silParticipantIds: silParticipantIds ?? this.silParticipantIds,
        silActiveIndex: silActiveIndex ?? this.silActiveIndex,
      );

  Map<String, dynamic> toJson() => {
        'shiftId': shiftId,
        'participantId': participantId,
        'timeEntryId': timeEntryId,
        'clockInTime': clockInTime?.toIso8601String(),
        'status': status.name,
        'silParticipantIds': silParticipantIds,
        'silActiveIndex': silActiveIndex,
      };

  factory ActiveShiftState.fromJson(Map<String, dynamic> j) =>
      ActiveShiftState(
        shiftId: j['shiftId'] as String?,
        participantId: j['participantId'] as String?,
        timeEntryId: j['timeEntryId'] as String?,
        clockInTime: j['clockInTime'] != null
            ? DateTime.tryParse(j['clockInTime'] as String)
            : null,
        status: ActiveShiftStatus.values.firstWhere(
          (s) => s.name == (j['status'] as String?),
          orElse: () => ActiveShiftStatus.none,
        ),
        silParticipantIds:
            (j['silParticipantIds'] as List<dynamic>?)?.cast<String>() ??
                const [],
        silActiveIndex: (j['silActiveIndex'] as int?) ?? 0,
      );
}

/// Persist active workspace state to secure storage for cold-start rehydration
Future<void> persistWorkspaceState(ActiveShiftState state) async {
  if (state.hasActiveShift) {
    await _storage.write(
      key: _kActiveWorkspaceKey,
      value: jsonEncode(state.toJson()),
    );
  } else {
    await _storage.delete(key: _kActiveWorkspaceKey);
  }
}

/// Restore active workspace state from secure storage
Future<ActiveShiftState?> restoreWorkspaceState() async {
  final raw = await _storage.read(key: _kActiveWorkspaceKey);
  if (raw == null) return null;
  try {
    return ActiveShiftState.fromJson(
        jsonDecode(raw) as Map<String, dynamic>);
  } catch (_) {
    return null;
  }
}

/// Clear persisted workspace state (on clock-out)
Future<void> clearWorkspaceState() async {
  await _storage.delete(key: _kActiveWorkspaceKey);
}

/// Active shift state — tracks if the worker is currently on a shift
final activeShiftProvider = StateProvider<CareShift?>((ref) => null);
final activeShiftTimeEntryIdProvider = StateProvider<String?>((ref) => null);
final activeShiftStateProvider =
    StateProvider<ActiveShiftState>((ref) => const ActiveShiftState());

/// SIL participants for the active shift
final silParticipantsProvider =
    FutureProvider.family<List<_SilParticipant>, String>(
        (ref, shiftId) async {
  final rows = await SupabaseService.client
      .from('shift_participants')
      .select('participant_id, is_primary, participant_profiles(preferred_name, critical_alerts)')
      .eq('shift_id', shiftId)
      .order('is_primary', ascending: false);

  return (rows as List).map((r) {
    final profile = r['participant_profiles'] as Map<String, dynamic>?;
    return _SilParticipant(
      id: r['participant_id']?.toString() ?? '',
      name: profile?['preferred_name']?.toString() ?? 'Unnamed',
      isPrimary: r['is_primary'] == true,
      alerts: (profile?['critical_alerts'] as List<dynamic>?)
              ?.cast<String>() ??
          const [],
    );
  }).toList();
});

class _SilParticipant {
  final String id;
  final String name;
  final bool isPrimary;
  final List<String> alerts;
  const _SilParticipant({
    required this.id,
    required this.name,
    this.isPrimary = false,
    this.alerts = const [],
  });
}

/// Shift tasks for a given shift
final shiftTasksProvider =
    StreamProvider.family<List<ShiftTask>, String>((ref, shiftId) async* {
  final initial = await SupabaseService.client
      .from('shift_tasks')
      .select()
      .eq('shift_id', shiftId)
      .order('sort_order');

  yield (initial as List)
      .map((r) => ShiftTask.fromJson(r as Map<String, dynamic>))
      .toList();

  await for (final _ in SupabaseService.client
      .from('shift_tasks')
      .stream(primaryKey: ['id']).eq('shift_id', shiftId)) {
    final rows = await SupabaseService.client
        .from('shift_tasks')
        .select()
        .eq('shift_id', shiftId)
        .order('sort_order');
    yield (rows as List)
        .map((r) => ShiftTask.fromJson(r as Map<String, dynamic>))
        .toList();
  }
});

class ShiftTask {
  final String id;
  final String title;
  final String? description;
  final bool isMandatory;
  final bool isCompleted;
  final DateTime? completedAt;

  const ShiftTask({
    required this.id,
    required this.title,
    this.description,
    this.isMandatory = false,
    this.isCompleted = false,
    this.completedAt,
  });

  factory ShiftTask.fromJson(Map<String, dynamic> j) => ShiftTask(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString(),
        isMandatory: j['is_mandatory'] == true,
        isCompleted: j['is_completed'] == true,
        completedAt: j['completed_at'] != null
            ? DateTime.tryParse(j['completed_at'].toString())
            : null,
      );
}

/// Complete a shift task
Future<void> completeShiftTask(String taskId) async {
  final userId = SupabaseService.auth.currentUser?.id;
  await SupabaseService.client.from('shift_tasks').update({
    'is_completed': true,
    'completed_at': DateTime.now().toUtc().toIso8601String(),
    'completed_by': userId,
  }).eq('id', taskId);
}

/// Uncomplete a shift task
Future<void> uncompleteShiftTask(String taskId) async {
  await SupabaseService.client.from('shift_tasks').update({
    'is_completed': false,
    'completed_at': null,
    'completed_by': null,
  }).eq('id', taskId);
}

/// The worker's shifts over a 6-week window — Realtime-powered
final myCareShiftsProvider = StreamProvider<List<CareShift>>((ref) async* {
  // Properly await the organization ID so we never get a null race
  final orgId = await ref.watch(organizationIdProvider.future);
  final userId = SupabaseService.auth.currentUser?.id;

  if (orgId == null || userId == null) {
    yield [];
    return;
  }

  final client = SupabaseService.client;

  final now = DateTime.now();
  final rangeStart = now.subtract(const Duration(days: 14)).toUtc().toIso8601String();
  final rangeEnd = now.add(const Duration(days: 28)).toUtc().toIso8601String();

  Future<List<CareShift>> fetchShifts() async {
    final List<dynamic> data = await client
        .from('schedule_blocks')
        .select('*, participant_profiles(preferred_name, critical_alerts)')
        .eq('organization_id', orgId)
        .eq('technician_id', userId)
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd)
        .order('start_time');

    final shifts =
        data.map((s) => CareShift.fromJson(s as Map<String, dynamic>)).toList();

    // Sync active shift state
    final inProgress = shifts.where((s) => s.status == CareShiftStatus.inProgress);
    if (inProgress.isNotEmpty) {
      final active = inProgress.first;
      ref.read(activeShiftProvider.notifier).state = active;
      ref.read(activeShiftStateProvider.notifier).state = ActiveShiftState(
        shiftId: active.id,
        participantId: active.participantId,
        clockInTime: active.actualStart ?? active.scheduledStart,
        status: ActiveShiftStatus.active,
      );
    } else {
      ref.read(activeShiftProvider.notifier).state = null;
      ref.read(activeShiftStateProvider.notifier).state =
          const ActiveShiftState();
    }

    return shifts;
  }

  // Emit initial data
  yield await fetchShifts();

  // Listen for realtime changes on schedule_blocks
  final controller = StreamController<List<CareShift>>();

  final sub = client
      .channel('my-care-shifts-$userId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'schedule_blocks',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) async {
          try {
            final shifts = await fetchShifts();
            if (!controller.isClosed) controller.add(shifts);
          } catch (_) {}
        },
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  yield* controller.stream;
});

/// Shifts for a specific date (compares in local timezone)
final shiftsForDateProvider = Provider.family<List<CareShift>, DateTime>((ref, date) {
  final shiftsAsync = ref.watch(myCareShiftsProvider);
  return shiftsAsync.when(
    data: (shifts) => shifts.where((s) {
      final local = s.scheduledStart.toLocal();
      return local.year == date.year &&
          local.month == date.month &&
          local.day == date.day;
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

/// Accept a shift (updates metadata JSON on schedule_blocks)
Future<void> acceptShift(String shiftId) async {
  // Read current metadata, merge acceptance_status
  final response = await SupabaseService.client
      .from('schedule_blocks')
      .select('metadata')
      .eq('id', shiftId)
      .maybeSingle();
  final currentMeta = (response?['metadata'] as Map<String, dynamic>?) ?? {};
  currentMeta['acceptance_status'] = 'accepted';
  await SupabaseService.client.from('schedule_blocks').update({
    'metadata': currentMeta,
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', shiftId);
}

/// Decline a shift with a reason
Future<void> declineShift(String shiftId, String reason) async {
  final response = await SupabaseService.client
      .from('schedule_blocks')
      .select('metadata')
      .eq('id', shiftId)
      .maybeSingle();
  final currentMeta = (response?['metadata'] as Map<String, dynamic>?) ?? {};
  currentMeta['acceptance_status'] = 'declined';
  currentMeta['decline_reason'] = reason;
  await SupabaseService.client.from('schedule_blocks').update({
    'metadata': currentMeta,
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', shiftId);
}

/// Clock in to a shift with EVV data
Future<String?> clockInToShift({
  required String shiftId,
  required String organizationId,
  required double lat,
  required double lng,
  bool isGeofenceOverride = false,
  String? overrideReason,
}) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return null;

  final now = DateTime.now().toUtc().toIso8601String();

  // Update the schedule_block status to in_progress
  await SupabaseService.client.from('schedule_blocks').update({
    'status': 'in_progress',
    'updated_at': now,
  }).eq('id', shiftId);

  // Create a time entry for EVV
  final inserted = await SupabaseService.client.from('time_entries').insert({
    'organization_id': organizationId,
    'user_id': userId,
    'worker_id': userId,
    'shift_id': shiftId,
    'type': 'shift',
    'status': 'active',
    'clock_in': now,
    'clock_in_lat': lat,
    'clock_in_lng': lng,
    'is_geofence_override': isGeofenceOverride,
    'geofence_override_reason': overrideReason,
  }).select('id').single();

  return inserted['id'] as String?;
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

  // Update schedule_block status to complete
  await SupabaseService.client.from('schedule_blocks').update({
    'status': 'complete',
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
    'travel_km': kilometersTravelled,
    'updated_at': now.toUtc().toIso8601String(),
  }).eq('id', timeEntryId);
}
