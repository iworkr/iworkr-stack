import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/job.dart';

// ═══════════════════════════════════════════════════════════
// ── Reactive Jobs Stream ─────────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Single reactive stream that is the source of truth for ALL
// job data in the app. Uses REST fetch + Supabase Realtime
// Postgres changes so that any mutation (Web Dashboard, another
// device, RPC) is reflected instantly without pull-to-refresh.

final jobsStreamProvider = StreamProvider<List<Job>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<Job>>();

  Future<void> fetchJobs() async {
    try {
      final data = await client
          .from('jobs')
          .select('*, clients(name), profiles!jobs_assignee_id_fkey(full_name)')
          .eq('organization_id', orgId)
          .isFilter('deleted_at', null)
          .order('created_at', ascending: false);

      if (!controller.isClosed) {
        controller.add(
          (data as List).map((j) => Job.fromJson(j as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetchJobs();

  final sub = client
      .channel('jobs-stream-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'jobs',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetchJobs(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Legacy compatibility — bridges old FutureProvider consumers to the
/// new stream. Avoids a massive one-shot migration of every screen.
final jobsProvider = FutureProvider<List<Job>>((ref) async {
  return ref.watch(jobsStreamProvider).when(
    data: (jobs) => jobs,
    loading: () => <Job>[],
    error: (_, __) => <Job>[],
  );
});

// ═══════════════════════════════════════════════════════════
// ── Derived Providers (computed from the single stream) ──
// ═══════════════════════════════════════════════════════════

/// Active jobs count — auto-updates when the jobs stream changes.
final activeJobsCountProvider = Provider<AsyncValue<int>>((ref) {
  return ref.watch(jobsStreamProvider).whenData((jobs) =>
    jobs.where((j) =>
      j.status == JobStatus.inProgress ||
      j.status == JobStatus.todo ||
      j.status == JobStatus.scheduled,
    ).length,
  );
});

/// Revenue stats — auto-updates when the jobs stream changes.
/// Retains the AsyncValue wrapper so consumers can use .when()
final revenueStatsProvider = Provider<AsyncValue<Map<String, double>>>((ref) {
  return ref.watch(jobsStreamProvider).whenData((jobs) {
    final completed = jobs.where((j) => j.status == JobStatus.done);
    final totalRevenue = completed.fold<double>(0, (sum, j) => sum + j.revenue);
    return {
      'totalRevenue': totalRevenue,
      'jobsCompleted': completed.length.toDouble(),
      'activeJobs': jobs.where((j) => j.status == JobStatus.inProgress).length.toDouble(),
    };
  });
});

// ═══════════════════════════════════════════════════════════
// ── Single Job Detail — Realtime ─────────────────────────
// ═══════════════════════════════════════════════════════════

final jobDetailProvider = StreamProvider.family<Job?, String>((ref, jobId) {
  final client = SupabaseService.client;
  final controller = StreamController<Job?>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('jobs')
          .select('*, clients(name), profiles!jobs_assignee_id_fkey(full_name)')
          .eq('id', jobId)
          .maybeSingle();

      if (!controller.isClosed) {
        controller.add(data != null ? Job.fromJson(data) : null);
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('job-detail-$jobId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'jobs',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'id',
          value: jobId,
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

// ═══════════════════════════════════════════════════════════
// ── Job Subtasks — Realtime ──────────────────────────────
// ═══════════════════════════════════════════════════════════

final jobSubtasksProvider = StreamProvider.family<List<Map<String, dynamic>>, String>((ref, jobId) {
  final client = SupabaseService.client;
  final controller = StreamController<List<Map<String, dynamic>>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('job_subtasks')
          .select()
          .eq('job_id', jobId)
          .order('sort_order');
      if (!controller.isClosed) {
        controller.add((data as List).cast<Map<String, dynamic>>());
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('subtasks-$jobId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'job_subtasks',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'job_id',
          value: jobId,
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

// ═══════════════════════════════════════════════════════════
// ── Job Activity — Realtime ──────────────────────────────
// ═══════════════════════════════════════════════════════════

final jobActivityProvider = StreamProvider.family<List<Map<String, dynamic>>, String>((ref, jobId) {
  final client = SupabaseService.client;
  final controller = StreamController<List<Map<String, dynamic>>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('job_activity')
          .select()
          .eq('job_id', jobId)
          .order('created_at', ascending: false)
          .limit(20);
      if (!controller.isClosed) {
        controller.add((data as List).cast<Map<String, dynamic>>());
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('activity-$jobId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'job_activity',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'job_id',
          value: jobId,
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

// ═══════════════════════════════════════════════════════════
// ── Optimistic Mutation Helpers ──────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Every mutation follows the Optimistic Rollback pattern:
//   1. Snapshot state
//   2. Update UI instantly
//   3. Execute Supabase mutation
//   4. On failure → revert + show error
//
// Because we use Supabase Realtime, the stream will automatically
// re-emit after a successful mutation. The optimistic update just
// bridges the latency gap.

class JobMutations {
  static final _client = SupabaseService.client;

  /// Update a job's status with optimistic rollback.
  /// Returns null on success, or the error message on failure.
  static Future<String?> updateStatus({
    required String jobId,
    required String newStatus,
    Map<String, dynamic>? extraFields,
  }) async {
    try {
      await _client.from('jobs').update({
        'status': newStatus,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
        ...?extraFields,
      }).eq('id', jobId);
      return null;
    } on PostgrestException catch (e) {
      if (e.code == '42501') {
        return 'Permission denied. You may not have access to this job.';
      }
      return 'Failed to update job: ${e.message}';
    } catch (e) {
      return 'Connection error. Please try again.';
    }
  }

  /// Toggle a subtask's completion with optimistic rollback.
  static Future<String?> toggleSubtask({
    required String subtaskId,
    required bool completed,
  }) async {
    try {
      await _client.from('job_subtasks').update({
        'completed': completed,
        'completed_at': completed ? DateTime.now().toUtc().toIso8601String() : null,
      }).eq('id', subtaskId);
      return null;
    } catch (e) {
      return 'Failed to update task.';
    }
  }

  /// Update job assignment and schedule.
  static Future<String?> assignJob({
    required String jobId,
    required String assigneeId,
    DateTime? scheduledAt,
  }) async {
    try {
      await _client.from('jobs').update({
        'assignee_id': assigneeId,
        'status': scheduledAt != null ? 'scheduled' : 'todo',
        if (scheduledAt != null) 'due_date': scheduledAt.toIso8601String(),
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', jobId);
      return null;
    } catch (e) {
      return 'Failed to assign job.';
    }
  }

  /// Add a note to a job.
  static Future<String?> addNote({
    required String jobId,
    required String content,
  }) async {
    try {
      final userId = SupabaseService.auth.currentUser?.id;
      await _client.from('job_activity').insert({
        'job_id': jobId,
        'user_id': userId,
        'type': 'note',
        'content': content,
      });
      return null;
    } catch (e) {
      return 'Failed to add note.';
    }
  }
}
