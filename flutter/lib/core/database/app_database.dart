import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

// ═══════════════════════════════════════════════════════════
// ── Table Definitions ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Local mirror of Supabase `jobs` table. The UI reads exclusively from this.
class LocalJobs extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get displayId => text().withDefault(const Constant(''))();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  TextColumn get status => text().withDefault(const Constant('backlog'))();
  TextColumn get priority => text().withDefault(const Constant('none'))();
  TextColumn get clientId => text().nullable()();
  TextColumn get clientName => text().nullable()();
  TextColumn get assigneeId => text().nullable()();
  TextColumn get assigneeName => text().nullable()();
  DateTimeColumn get dueDate => dateTime().nullable()();
  TextColumn get location => text().nullable()();
  RealColumn get locationLat => real().nullable()();
  RealColumn get locationLng => real().nullable()();
  TextColumn get labels => text().withDefault(const Constant('[]'))();
  RealColumn get revenue => real().withDefault(const Constant(0))();
  RealColumn get cost => real().withDefault(const Constant(0))();
  RealColumn get estimatedHours => real().withDefault(const Constant(0))();
  RealColumn get actualHours => real().withDefault(const Constant(0))();
  IntColumn get estimatedDurationMinutes => integer().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `job_subtasks` table.
class LocalTasks extends Table {
  TextColumn get id => text()();
  TextColumn get jobId => text()();
  TextColumn get title => text()();
  BoolColumn get completed => boolean().withDefault(const Constant(false))();
  BoolColumn get isCritical => boolean().withDefault(const Constant(false))();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `job_timer_sessions` table.
class LocalTimerSessions extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get jobId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get startedAt => dateTime()();
  DateTimeColumn get endedAt => dateTime().nullable()();
  IntColumn get durationSeconds => integer().nullable()();
  RealColumn get startLat => real().nullable()();
  RealColumn get startLng => real().nullable()();
  RealColumn get endLat => real().nullable()();
  RealColumn get endLng => real().nullable()();
  TextColumn get status => text().withDefault(const Constant('active'))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Offline mutation queue — write-ahead log for all Supabase mutations.
class SyncQueue extends Table {
  TextColumn get id => text()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  TextColumn get action => text()();
  TextColumn get payload => text()();
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  TextColumn get errorMessage => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Binary asset upload queue (photos, signatures).
class UploadQueue extends Table {
  TextColumn get id => text()();
  TextColumn get jobId => text()();
  TextColumn get localPath => text()();
  TextColumn get remotePath => text().nullable()();
  TextColumn get mimeType => text().withDefault(const Constant('image/jpeg'))();
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get status => text().withDefault(const Constant('pending'))();

  @override
  Set<Column> get primaryKey => {id};
}

/// GPS telemetry logs — batched and synced to Supabase.
class TelemetryLogs extends Table {
  TextColumn get id => text()();
  DateTimeColumn get timestampUtc => dateTime()();
  RealColumn get latitude => real()();
  RealColumn get longitude => real()();
  RealColumn get speedKmh => real().nullable()();
  RealColumn get heading => real().nullable()();
  RealColumn get accuracyMeters => real().nullable()();
  IntColumn get batteryLevel => integer().nullable()();
  BoolColumn get isMockLocation => boolean().withDefault(const Constant(false))();
  BoolColumn get synced => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Last sync timestamp per entity type for delta fetching.
class SyncMeta extends Table {
  TextColumn get entityType => text()();
  DateTimeColumn get lastSyncAt => dateTime()();

  @override
  Set<Column> get primaryKey => {entityType};
}

// ═══════════════════════════════════════════════════════════
// ── Database Class ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

@DriftDatabase(tables: [
  LocalJobs,
  LocalTasks,
  LocalTimerSessions,
  SyncQueue,
  UploadQueue,
  TelemetryLogs,
  SyncMeta,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  // ── Jobs ─────────────────────────────────────────────

  Stream<List<LocalJob>> watchAllJobs(String orgId) {
    return (select(localJobs)
          ..where((j) => j.organizationId.equals(orgId))
          ..orderBy([(j) => OrderingTerm.desc(j.updatedAt)]))
        .watch();
  }

  Stream<LocalJob?> watchJob(String jobId) {
    return (select(localJobs)..where((j) => j.id.equals(jobId)))
        .watchSingleOrNull();
  }

  Future<void> upsertJob(LocalJobsCompanion job) {
    return into(localJobs).insertOnConflictUpdate(job);
  }

  Future<void> upsertJobs(List<LocalJobsCompanion> jobs) async {
    await batch((b) {
      for (final j in jobs) {
        b.insert(localJobs, j, onConflict: DoUpdate((_) => j));
      }
    });
  }

  Future<void> updateJobStatus(String jobId, String status) {
    return (update(localJobs)..where((j) => j.id.equals(jobId)))
        .write(LocalJobsCompanion(
      status: Value(status),
      updatedAt: Value(DateTime.now().toUtc()),
    ));
  }

  // ── Tasks ────────────────────────────────────────────

  Stream<List<LocalTask>> watchTasks(String jobId) {
    return (select(localTasks)
          ..where((t) => t.jobId.equals(jobId))
          ..orderBy([(t) => OrderingTerm.asc(t.sortOrder)]))
        .watch();
  }

  Future<void> upsertTask(LocalTasksCompanion task) {
    return into(localTasks).insertOnConflictUpdate(task);
  }

  Future<void> toggleTaskCompletion(String taskId, bool completed) {
    return (update(localTasks)..where((t) => t.id.equals(taskId)))
        .write(LocalTasksCompanion(
      completed: Value(completed),
      updatedAt: Value(DateTime.now().toUtc()),
    ));
  }

  Future<List<LocalTask>> getCriticalIncompleteTasks(String jobId) {
    return (select(localTasks)
          ..where((t) =>
              t.jobId.equals(jobId) &
              t.isCritical.equals(true) &
              t.completed.equals(false)))
        .get();
  }

  // ── Timer Sessions ───────────────────────────────────

  Stream<LocalTimerSession?> watchActiveTimer(String jobId, String userId) {
    return (select(localTimerSessions)
          ..where((t) =>
              t.jobId.equals(jobId) &
              t.userId.equals(userId) &
              t.status.equals('active'))
          ..orderBy([(t) => OrderingTerm.desc(t.startedAt)])
          ..limit(1))
        .watchSingleOrNull();
  }

  Future<void> upsertTimerSession(LocalTimerSessionsCompanion session) {
    return into(localTimerSessions).insertOnConflictUpdate(session);
  }

  // ── Sync Queue ───────────────────────────────────────

  Future<void> enqueue(SyncQueueCompanion item) {
    return into(syncQueue).insertOnConflictUpdate(item);
  }

  Future<List<SyncQueueData>> pendingMutations() {
    return (select(syncQueue)
          ..where((q) => q.status.equals('pending'))
          ..orderBy([(q) => OrderingTerm.asc(q.createdAt)])
          ..limit(50))
        .get();
  }

  Future<int> pendingCount() async {
    final count = countAll();
    final query = selectOnly(syncQueue)
      ..where(syncQueue.status.equals('pending'))
      ..addColumns([count]);
    final row = await query.getSingle();
    return row.read(count) ?? 0;
  }

  Future<void> markSynced(String id) {
    return (delete(syncQueue)..where((q) => q.id.equals(id))).go();
  }

  Future<void> markFailed(String id, String error) {
    return (update(syncQueue)..where((q) => q.id.equals(id))).write(
      SyncQueueCompanion(
        retryCount: const Value.absent(),
        status: const Value('failed'),
        errorMessage: Value(error),
      ),
    );
  }

  Future<void> incrementRetry(String id) async {
    await customStatement(
      'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [id],
    );
  }

  Future<int> failedCount() async {
    final count = countAll();
    final query = selectOnly(syncQueue)
      ..where(syncQueue.status.equals('failed'))
      ..addColumns([count]);
    final row = await query.getSingle();
    return row.read(count) ?? 0;
  }

  // ── Upload Queue ─────────────────────────────────────

  Future<void> enqueueUpload(UploadQueueCompanion item) {
    return into(uploadQueue).insertOnConflictUpdate(item);
  }

  Future<List<UploadQueueData>> pendingUploads() {
    return (select(uploadQueue)
          ..where((q) => q.status.equals('pending'))
          ..orderBy([(q) => OrderingTerm.asc(q.createdAt)])
          ..limit(10))
        .get();
  }

  Future<void> markUploaded(String id, String remotePath) {
    return (update(uploadQueue)..where((q) => q.id.equals(id))).write(
      UploadQueueCompanion(
        remotePath: Value(remotePath),
        status: const Value('uploaded'),
      ),
    );
  }

  // ── Telemetry ────────────────────────────────────────

  Future<void> insertTelemetry(TelemetryLogsCompanion log) {
    return into(telemetryLogs).insert(log);
  }

  Future<List<TelemetryLog>> unsyncedTelemetry({int limit = 50}) {
    return (select(telemetryLogs)
          ..where((t) => t.synced.equals(false))
          ..orderBy([(t) => OrderingTerm.asc(t.timestampUtc)])
          ..limit(limit))
        .get();
  }

  Future<void> markTelemetrySynced(List<String> ids) {
    return (update(telemetryLogs)..where((t) => t.id.isIn(ids)))
        .write(const TelemetryLogsCompanion(synced: Value(true)));
  }

  // ── Sync Meta ────────────────────────────────────────

  Future<DateTime?> lastSyncTime(String entityType) async {
    final row = await (select(syncMeta)
          ..where((m) => m.entityType.equals(entityType)))
        .getSingleOrNull();
    return row?.lastSyncAt;
  }

  Future<void> setLastSyncTime(String entityType, DateTime time) {
    return into(syncMeta).insertOnConflictUpdate(
      SyncMetaCompanion(
        entityType: Value(entityType),
        lastSyncAt: Value(time),
      ),
    );
  }

  // ── Nuke ─────────────────────────────────────────────

  Future<void> clearAll() async {
    await delete(localJobs).go();
    await delete(localTasks).go();
    await delete(localTimerSessions).go();
    await delete(syncQueue).go();
    await delete(uploadQueue).go();
    await delete(telemetryLogs).go();
    await delete(syncMeta).go();
  }
}

// ═══════════════════════════════════════════════════════════
// ── Connection ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/iworkr_vanguard.sqlite');
    return NativeDatabase.createInBackground(file);
  });
}

// ═══════════════════════════════════════════════════════════
// ── Riverpod Provider ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(() => db.close());
  return db;
});
