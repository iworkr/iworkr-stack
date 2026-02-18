import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/models/job.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

/// Selected date for schedule view
final selectedDateProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

/// Selected technician ID for dispatch view (null = "My Schedule")
final selectedTechnicianProvider = StateProvider<String?>((ref) => null);

/// Effective technician ID — either the selected one or current user
final effectiveTechnicianIdProvider = Provider<String?>((ref) {
  final selected = ref.watch(selectedTechnicianProvider);
  return selected ?? SupabaseService.auth.currentUser?.id;
});

/// Team members for the dispatch switcher
final dispatchTeamProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('organization_members')
      .select('user_id, profiles(id, full_name, avatar_url)')
      .eq('organization_id', orgId)
      .eq('status', 'active');

  return (data as List).cast<Map<String, dynamic>>();
});

/// Schedule blocks for the selected technician + date — Realtime
final technicianScheduleProvider = StreamProvider<List<ScheduleBlock>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final date = ref.watch(selectedDateProvider);
  final techId = ref.watch(effectiveTechnicianIdProvider);

  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null || techId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ScheduleBlock>>();

  final startOfDay = DateTime(date.year, date.month, date.day).toUtc().toIso8601String();
  final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59).toUtc().toIso8601String();

  Future<void> fetchBlocks() async {
    try {
      final data = await client
          .from('schedule_blocks')
          .select()
          .eq('organization_id', orgId)
          .eq('technician_id', techId)
          .gte('start_time', startOfDay)
          .lte('start_time', endOfDay)
          .order('start_time');

      if (!controller.isClosed) {
        controller.add(
          (data as List).map((b) => ScheduleBlock.fromJson(b as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) {
        controller.addError(e);
      }
    }
  }

  fetchBlocks();

  final channelName = 'dispatch-$techId-${date.millisecondsSinceEpoch}';
  final sub = client
      .channel(channelName)
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'schedule_blocks',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'technician_id',
          value: techId,
        ),
        callback: (_) => fetchBlocks(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Provides schedule blocks for the selected date — Realtime-powered
final scheduleBlocksProvider = StreamProvider<List<ScheduleBlock>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final date = ref.watch(selectedDateProvider);

  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ScheduleBlock>>();

  final startOfDay = DateTime(date.year, date.month, date.day).toUtc().toIso8601String();
  final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59).toUtc().toIso8601String();

  Future<void> fetchBlocks() async {
    try {
      final data = await client
          .from('schedule_blocks')
          .select()
          .eq('organization_id', orgId)
          .gte('start_time', startOfDay)
          .lte('start_time', endOfDay)
          .order('start_time');

      if (!controller.isClosed) {
        controller.add(
          (data as List).map((b) => ScheduleBlock.fromJson(b as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) {
        controller.addError(e);
      }
    }
  }

  fetchBlocks();

  final sub = client
      .channel('schedule-blocks-realtime')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'schedule_blocks',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetchBlocks(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Today's blocks for the current user — Realtime-powered
final myTodayBlocksProvider = StreamProvider<List<ScheduleBlock>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final userId = SupabaseService.auth.currentUser?.id;

  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null || userId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ScheduleBlock>>();

  final now = DateTime.now();
  final startOfDay = DateTime(now.year, now.month, now.day).toUtc().toIso8601String();
  final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59).toUtc().toIso8601String();

  Future<void> fetchBlocks() async {
    try {
      final data = await client
          .from('schedule_blocks')
          .select()
          .eq('organization_id', orgId)
          .eq('technician_id', userId)
          .gte('start_time', startOfDay)
          .lte('start_time', endOfDay)
          .order('start_time');

      if (!controller.isClosed) {
        controller.add(
          (data as List).map((b) => ScheduleBlock.fromJson(b as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) {
        controller.addError(e);
      }
    }
  }

  fetchBlocks();

  final sub = client
      .channel('my-schedule-realtime')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'schedule_blocks',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'technician_id',
          value: userId,
        ),
        callback: (_) => fetchBlocks(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Backlog jobs — Realtime-powered, updates when job status changes
final backlogJobsProvider = StreamProvider<List<Job>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);

  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<Job>>();

  Future<void> fetchBacklog() async {
    try {
      final data = await client
          .from('jobs')
          .select('*, clients(name), profiles!jobs_assignee_id_fkey(full_name)')
          .eq('organization_id', orgId)
          .isFilter('deleted_at', null)
          .eq('status', 'backlog')
          .order('created_at', ascending: false)
          .limit(30);

      if (!controller.isClosed) {
        controller.add(
          (data as List).map((j) => Job.fromJson(j as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) {
        controller.addError(e);
      }
    }
  }

  fetchBacklog();

  final sub = client
      .channel('backlog-jobs-realtime')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'jobs',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetchBacklog(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Dispatch a job to a specific technician at a specific time.
/// Creates a schedule_block and updates the job assignment.
Future<void> dispatchJob({
  required String jobId,
  required String jobTitle,
  required String organizationId,
  required String technicianId,
  required DateTime startTime,
  int durationMinutes = 60,
  String? clientName,
  String? location,
}) async {
  final endTime = startTime.add(Duration(minutes: durationMinutes));
  final client = SupabaseService.client;

  await client.from('schedule_blocks').insert({
    'organization_id': organizationId,
    'job_id': jobId,
    'technician_id': technicianId,
    'title': jobTitle,
    'client_name': clientName,
    'location': location,
    'start_time': startTime.toUtc().toIso8601String(),
    'end_time': endTime.toUtc().toIso8601String(),
    'status': 'scheduled',
  });

  await client.from('jobs').update({
    'status': 'scheduled',
    'due_date': startTime.toIso8601String(),
    'assignee_id': technicianId,
    'updated_at': DateTime.now().toIso8601String(),
  }).eq('id', jobId);
}

/// Snap a DateTime to the nearest 15-minute increment.
DateTime snapTo15Min(DateTime dt) {
  final minutes = dt.minute;
  final snapped = (minutes / 15).round() * 15;
  return DateTime(dt.year, dt.month, dt.day, dt.hour, snapped);
}
