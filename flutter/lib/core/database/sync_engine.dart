import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/job.dart';

const _uuid = Uuid();

// ═══════════════════════════════════════════════════════════
// ── Sync Engine — Offline-First Repository ───────────────
// ═══════════════════════════════════════════════════════════
//
// All UI reads from Drift (local SQLite). All writes go through
// this engine: local DB is updated optimistically, then a mutation
// is queued for background sync to Supabase.

enum SyncStatus { synced, syncing, offline, failed }

class SyncEngine {
  final AppDatabase _db;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _syncTimer;
  bool _syncing = false;

  /// Callback for sync status updates (for UI toasts).
  void Function(SyncStatus status)? onStatusChange;

  SyncEngine(this._db, Ref ref) {
    _startListening();
  }

  void dispose() {
    _connectivitySub?.cancel();
    _syncTimer?.cancel();
  }

  // ── Connectivity Listener ──────────────────────────────

  void _startListening() {
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final hasNetwork = results.any((r) => r != ConnectivityResult.none);
      if (hasNetwork) drainQueue();
    });
    _syncTimer = Timer.periodic(const Duration(seconds: 30), (_) => drainQueue());
  }

  // ── Hydration (Pull from Supabase → Local) ─────────────

  Future<void> hydrate(String orgId) async {
    await Future.wait([
      _hydrateJobs(orgId),
      _hydrateTasks(orgId),
      _hydrateTimerSessions(orgId),
    ]);
  }

  Future<void> _hydrateJobs(String orgId) async {
    try {
      final lastSync = await _db.lastSyncTime('jobs');
      var query = SupabaseService.client
          .from('jobs')
          .select('*, clients(name), assignee:profiles!assignee_id(full_name)')
          .eq('organization_id', orgId)
          .isFilter('deleted_at', null);

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.order('updated_at', ascending: false).limit(500);
      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((json) {
        final job = Job.fromJson(json);
        return LocalJobsCompanion(
          id: Value(job.id),
          organizationId: Value(job.organizationId),
          displayId: Value(job.displayId),
          title: Value(job.title),
          description: Value(job.description),
          status: Value(job.status.value),
          priority: Value(job.priority.name),
          clientId: Value(job.clientId),
          clientName: Value(job.clientName),
          assigneeId: Value(job.assigneeId),
          assigneeName: Value(job.assigneeName),
          dueDate: Value(job.dueDate),
          location: Value(job.location),
          locationLat: Value(job.locationLat),
          locationLng: Value(job.locationLng),
          labels: Value(jsonEncode(job.labels)),
          revenue: Value(job.revenue),
          cost: Value(job.cost),
          estimatedHours: Value(job.estimatedHours),
          actualHours: Value(job.actualHours),
          estimatedDurationMinutes: Value(job.estimatedDurationMinutes),
          createdAt: Value(job.createdAt),
          updatedAt: Value(job.updatedAt),
        );
      }).toList();

      await _db.upsertJobs(companions);
      await _db.setLastSyncTime('jobs', DateTime.now().toUtc());
    } catch (_) {}
  }

  Future<void> _hydrateTasks(String orgId) async {
    try {
      final lastSync = await _db.lastSyncTime('tasks');
      var query = SupabaseService.client
          .from('job_subtasks')
          .select()
          .eq('organization_id', orgId);

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.limit(1000);
      final rows = (data as List).cast<Map<String, dynamic>>();

      await _db.batch((b) {
        for (final r in rows) {
          b.insert(
            _db.localTasks,
            LocalTasksCompanion(
              id: Value(r['id'] as String),
              jobId: Value(r['job_id'] as String),
              title: Value(r['title'] as String? ?? ''),
              completed: Value(r['completed'] as bool? ?? false),
              isCritical: Value(r['is_critical'] as bool? ?? false),
              sortOrder: Value(r['sort_order'] as int? ?? 0),
              updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
            ),
            onConflict: DoUpdate((_) => LocalTasksCompanion(
              jobId: Value(r['job_id'] as String),
              title: Value(r['title'] as String? ?? ''),
              completed: Value(r['completed'] as bool? ?? false),
              isCritical: Value(r['is_critical'] as bool? ?? false),
              sortOrder: Value(r['sort_order'] as int? ?? 0),
              updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
            )),
          );
        }
      });
      await _db.setLastSyncTime('tasks', DateTime.now().toUtc());
    } catch (_) {}
  }

  Future<void> _hydrateTimerSessions(String orgId) async {
    try {
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) return;

      final data = await SupabaseService.client
          .from('job_timer_sessions')
          .select()
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .order('started_at', ascending: false)
          .limit(50);

      final rows = (data as List).cast<Map<String, dynamic>>();
      await _db.batch((b) {
        for (final r in rows) {
          final companion = LocalTimerSessionsCompanion(
            id: Value(r['id'] as String),
            organizationId: Value(r['organization_id'] as String),
            jobId: Value(r['job_id'] as String),
            userId: Value(r['user_id'] as String),
            startedAt: Value(DateTime.parse(r['started_at'] as String)),
            endedAt: Value(r['ended_at'] != null ? DateTime.parse(r['ended_at'] as String) : null),
            durationSeconds: Value(r['duration_seconds'] as int?),
            startLat: Value((r['start_lat'] as num?)?.toDouble()),
            startLng: Value((r['start_lng'] as num?)?.toDouble()),
            endLat: Value((r['end_lat'] as num?)?.toDouble()),
            endLng: Value((r['end_lng'] as num?)?.toDouble()),
            status: Value(r['status'] as String? ?? 'active'),
          );
          b.insert(_db.localTimerSessions, companion,
              onConflict: DoUpdate((_) => companion));
        }
      });
    } catch (_) {}
  }

  // ── Mutation Queueing (Local Write + Queue for Sync) ───

  Future<void> updateJobStatus(String jobId, String orgId, String newStatus) async {
    await _db.updateJobStatus(jobId, newStatus);
    await _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: const Value('job'),
      entityId: Value(jobId),
      action: const Value('UPDATE'),
      payload: Value(jsonEncode({
        'status': newStatus,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      })),
      createdAt: Value(DateTime.now().toUtc()),
    ));
    drainQueue();
  }

  Future<void> toggleTask(String taskId, bool completed) async {
    await _db.toggleTaskCompletion(taskId, completed);
    await _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: const Value('job_subtask'),
      entityId: Value(taskId),
      action: const Value('UPDATE'),
      payload: Value(jsonEncode({
        'completed': completed,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      })),
      createdAt: Value(DateTime.now().toUtc()),
    ));
    drainQueue();
  }

  Future<void> startTimer({
    required String jobId,
    required String orgId,
    required String userId,
    double? lat,
    double? lng,
  }) async {
    final sessionId = _uuid.v4();
    final now = DateTime.now().toUtc();

    await _db.upsertTimerSession(LocalTimerSessionsCompanion(
      id: Value(sessionId),
      organizationId: Value(orgId),
      jobId: Value(jobId),
      userId: Value(userId),
      startedAt: Value(now),
      startLat: Value(lat),
      startLng: Value(lng),
      status: const Value('active'),
    ));

    await _db.updateJobStatus(jobId, 'in_progress');

    await _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: const Value('job_timer_session'),
      entityId: Value(sessionId),
      action: const Value('INSERT'),
      payload: Value(jsonEncode({
        'id': sessionId,
        'organization_id': orgId,
        'job_id': jobId,
        'user_id': userId,
        'started_at': now.toIso8601String(),
        'start_lat': lat,
        'start_lng': lng,
        'status': 'active',
      })),
      createdAt: Value(now),
    ));

    await _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: const Value('job'),
      entityId: Value(jobId),
      action: const Value('UPDATE'),
      payload: Value(jsonEncode({
        'status': 'in_progress',
        'updated_at': now.toIso8601String(),
      })),
      createdAt: Value(now),
    ));

    drainQueue();
  }

  Future<void> completeTimer({
    required String sessionId,
    required String jobId,
    double? lat,
    double? lng,
  }) async {
    final now = DateTime.now().toUtc();

    await _db.upsertTimerSession(LocalTimerSessionsCompanion(
      id: Value(sessionId),
      endedAt: Value(now),
      endLat: Value(lat),
      endLng: Value(lng),
      status: const Value('completed'),
    ));

    await _db.updateJobStatus(jobId, 'done');

    await _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: const Value('job_timer_session'),
      entityId: Value(sessionId),
      action: const Value('UPDATE'),
      payload: Value(jsonEncode({
        'ended_at': now.toIso8601String(),
        'end_lat': lat,
        'end_lng': lng,
        'status': 'completed',
      })),
      createdAt: Value(now),
    ));

    await _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: const Value('job'),
      entityId: Value(jobId),
      action: const Value('UPDATE'),
      payload: Value(jsonEncode({
        'status': 'done',
        'updated_at': now.toIso8601String(),
      })),
      createdAt: Value(now),
    ));

    drainQueue();
  }

  // ── Queue Drainer ──────────────────────────────────────

  Future<void> drainQueue() async {
    if (_syncing) return;

    // Pre-flight connectivity check
    final connectivity = await Connectivity().checkConnectivity();
    final isOffline = connectivity.every((r) => r == ConnectivityResult.none);
    if (isOffline) {
      onStatusChange?.call(SyncStatus.offline);
      return;
    }

    _syncing = true;
    onStatusChange?.call(SyncStatus.syncing);

    try {
      final pending = await _db.pendingMutations();
      if (pending.isEmpty) {
        onStatusChange?.call(SyncStatus.synced);
        return;
      }

      for (final item in pending) {
        try {
          await _processMutation(item);
          await _db.markSynced(item.id);
        } on SocketException {
          // Network dropped mid-sync — stop draining, don't increment retry
          onStatusChange?.call(SyncStatus.offline);
          return;
        } catch (e) {
          await _db.incrementRetry(item.id);
          if (item.retryCount >= 4) {
            await _db.markFailed(item.id, e.toString());
          }
        }
      }
      onStatusChange?.call(SyncStatus.synced);
    } finally {
      _syncing = false;
    }
  }

  Future<void> _processMutation(SyncQueueData item) async {
    final payload = jsonDecode(item.payload) as Map<String, dynamic>;
    final table = _resolveTable(item.entityType);

    switch (item.action) {
      case 'INSERT':
        await SupabaseService.client.from(table).insert(payload);
      case 'UPDATE':
        await SupabaseService.client.from(table).update(payload).eq('id', item.entityId);
      case 'DELETE':
        await SupabaseService.client.from(table).delete().eq('id', item.entityId);
    }
  }

  String _resolveTable(String entityType) {
    switch (entityType) {
      case 'job': return 'jobs';
      case 'job_subtask': return 'job_subtasks';
      case 'job_timer_session': return 'job_timer_sessions';
      case 'job_media': return 'job_media';
      default: return entityType;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final db = ref.watch(appDatabaseProvider);
  final engine = SyncEngine(db, ref);
  ref.onDispose(() => engine.dispose());
  return engine;
});

/// Reactive stream of all jobs for the active workspace.
final localJobsStreamProvider = StreamProvider.family<List<LocalJob>, String>((ref, orgId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchAllJobs(orgId);
});

/// Reactive stream of a single job.
final localJobStreamProvider = StreamProvider.family<LocalJob?, String>((ref, jobId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchJob(jobId);
});

/// Reactive stream of tasks for a job.
final localTasksStreamProvider = StreamProvider.family<List<LocalTask>, String>((ref, jobId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchTasks(jobId);
});

/// Reactive stream of the active timer for a job.
final localActiveTimerProvider = StreamProvider.family<LocalTimerSession?, ({String jobId, String userId})>((ref, args) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchActiveTimer(args.jobId, args.userId);
});

/// Pending sync count for UI badge.
final pendingSyncCountProvider = FutureProvider<int>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return db.pendingCount();
});

/// Failed sync count for UI alert.
final failedSyncCountProvider = FutureProvider<int>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return db.failedCount();
});

/// Reactive sync status for the cloud indicator in the app bar.
final syncStatusProvider = StateProvider<SyncStatus>((ref) => SyncStatus.synced);
