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
  TextColumn get broadcastStatus => text().nullable()();
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

/// Local mirror of `clients` table.
class LocalClients extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get name => text()();
  TextColumn get email => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get address => text().nullable()();
  RealColumn get addressLat => real().nullable()();
  RealColumn get addressLng => real().nullable()();
  TextColumn get status => text().withDefault(const Constant('active'))();
  TextColumn get type => text().withDefault(const Constant('residential'))();
  TextColumn get notes => text().nullable()();
  TextColumn get tags => text().withDefault(const Constant('[]'))();
  TextColumn get metadata => text().withDefault(const Constant('{}'))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `schedule_blocks` / shifts.
class LocalShifts extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get workerId => text().nullable()();
  TextColumn get workerName => text().nullable()();
  TextColumn get clientId => text().nullable()();
  TextColumn get clientName => text().nullable()();
  TextColumn get participantId => text().nullable()();
  TextColumn get participantName => text().nullable()();
  TextColumn get title => text().nullable()();
  DateTimeColumn get startTime => dateTime()();
  DateTimeColumn get endTime => dateTime()();
  TextColumn get status => text().withDefault(const Constant('scheduled'))();
  TextColumn get shiftType => text().withDefault(const Constant('standard'))();
  TextColumn get location => text().nullable()();
  RealColumn get locationLat => real().nullable()();
  RealColumn get locationLng => real().nullable()();
  TextColumn get notes => text().nullable()();
  TextColumn get metadata => text().withDefault(const Constant('{}'))();
  DateTimeColumn get clockedInAt => dateTime().nullable()();
  DateTimeColumn get clockedOutAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `participant_profiles`.
class LocalParticipants extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get clientId => text().nullable()();
  TextColumn get firstName => text()();
  TextColumn get lastName => text()();
  TextColumn get ndisNumber => text().nullable()();
  DateTimeColumn get dateOfBirth => dateTime().nullable()();
  TextColumn get primaryDisability => text().nullable()();
  TextColumn get fundingType => text().nullable()();
  TextColumn get address => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get emergencyContactName => text().nullable()();
  TextColumn get emergencyContactPhone => text().nullable()();
  TextColumn get notes => text().nullable()();
  TextColumn get metadata => text().withDefault(const Constant('{}'))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `care_plans`.
class LocalCarePlans extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get participantId => text()();
  TextColumn get title => text()();
  TextColumn get status => text().withDefault(const Constant('active'))();
  DateTimeColumn get startDate => dateTime().nullable()();
  DateTimeColumn get endDate => dateTime().nullable()();
  RealColumn get totalBudget => real().withDefault(const Constant(0))();
  RealColumn get usedBudget => real().withDefault(const Constant(0))();
  TextColumn get goals => text().withDefault(const Constant('[]'))();
  TextColumn get metadata => text().withDefault(const Constant('{}'))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `inventory_items` for offline barcode scanning.
class LocalInventoryItems extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get name => text()();
  TextColumn get sku => text().nullable()();
  TextColumn get barcode => text().nullable()();
  TextColumn get category => text().nullable()();
  TextColumn get unit => text().withDefault(const Constant('each'))();
  RealColumn get unitCost => real().withDefault(const Constant(0))();
  RealColumn get unitPrice => real().withDefault(const Constant(0))();
  IntColumn get quantityOnHand => integer().withDefault(const Constant(0))();
  IntColumn get reorderPoint => integer().withDefault(const Constant(0))();
  TextColumn get imageUrl => text().nullable()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  TextColumn get metadata => text().withDefault(const Constant('{}'))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local shift notes — clinical progress notes written offline.
class LocalShiftNotes extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get shiftId => text()();
  TextColumn get workerId => text()();
  TextColumn get participantId => text().nullable()();
  TextColumn get content => text()();
  TextColumn get noteType => text().withDefault(const Constant('general'))();
  TextColumn get mediaUrls => text().withDefault(const Constant('[]'))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local medication administration records for offline eMAR.
class LocalMedicationRecords extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get participantId => text()();
  TextColumn get medicationId => text()();
  TextColumn get medicationName => text()();
  TextColumn get dosage => text()();
  TextColumn get administeredBy => text()();
  DateTimeColumn get scheduledAt => dateTime()();
  DateTimeColumn get administeredAt => dateTime().nullable()();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  TextColumn get signaturePath => text().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local mirror of `compliance_rules` for Cerberus-Gate offline evaluation.
class LocalComplianceRules extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  TextColumn get triggerState => text()();
  TextColumn get ruleType => text()();
  TextColumn get configJsonb => text().withDefault(const Constant('{}'))();
  TextColumn get targetEntityType => text().withDefault(const Constant('GLOBAL'))();
  TextColumn get targetEntityId => text().nullable()();
  TextColumn get targetLabel => text().nullable()();
  BoolColumn get isHardBlock => boolean().withDefault(const Constant(true))();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  IntColumn get priority => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

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
  LocalClients,
  LocalShifts,
  LocalParticipants,
  LocalCarePlans,
  LocalInventoryItems,
  LocalShiftNotes,
  LocalMedicationRecords,
  LocalComplianceRules,
  SyncQueue,
  UploadQueue,
  TelemetryLogs,
  SyncMeta,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onUpgrade: (migrator, from, to) async {
      if (from < 2) {
        await migrator.addColumn(localJobs, localJobs.broadcastStatus);
      }
      if (from < 3) {
        await migrator.createTable(localClients);
        await migrator.createTable(localShifts);
        await migrator.createTable(localParticipants);
        await migrator.createTable(localCarePlans);
        await migrator.createTable(localInventoryItems);
        await migrator.createTable(localShiftNotes);
        await migrator.createTable(localMedicationRecords);
      }
      if (from < 4) {
        await migrator.createTable(localComplianceRules);
      }
    },
  );

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

  // ── Clients ────────────────────────────────────────

  Stream<List<LocalClient>> watchAllClients(String orgId) {
    return (select(localClients)
          ..where((c) => c.organizationId.equals(orgId))
          ..orderBy([(c) => OrderingTerm.asc(c.name)]))
        .watch();
  }

  Future<LocalClient?> getClient(String clientId) {
    return (select(localClients)..where((c) => c.id.equals(clientId)))
        .getSingleOrNull();
  }

  Future<void> upsertClients(List<LocalClientsCompanion> clients) async {
    await batch((b) {
      for (final c in clients) {
        b.insert(localClients, c, onConflict: DoUpdate((_) => c));
      }
    });
  }

  // ── Shifts ────────────────────────────────────────

  Stream<List<LocalShift>> watchShifts(String orgId, {DateTime? from, DateTime? to}) {
    return (select(localShifts)
          ..where((s) {
            var expr = s.organizationId.equals(orgId);
            if (from != null) expr = expr & s.startTime.isBiggerOrEqualValue(from);
            if (to != null) expr = expr & s.startTime.isSmallerOrEqualValue(to);
            return expr;
          })
          ..orderBy([(s) => OrderingTerm.asc(s.startTime)]))
        .watch();
  }

  Stream<List<LocalShift>> watchWorkerShifts(String orgId, String workerId, {DateTime? from, DateTime? to}) {
    return (select(localShifts)
          ..where((s) {
            var expr = s.organizationId.equals(orgId) & s.workerId.equals(workerId);
            if (from != null) expr = expr & s.startTime.isBiggerOrEqualValue(from);
            if (to != null) expr = expr & s.startTime.isSmallerOrEqualValue(to);
            return expr;
          })
          ..orderBy([(s) => OrderingTerm.asc(s.startTime)]))
        .watch();
  }

  Future<void> upsertShifts(List<LocalShiftsCompanion> shifts) async {
    await batch((b) {
      for (final s in shifts) {
        b.insert(localShifts, s, onConflict: DoUpdate((_) => s));
      }
    });
  }

  Future<void> updateShiftClock(String shiftId, {DateTime? clockIn, DateTime? clockOut, String? status}) {
    final companion = LocalShiftsCompanion(
      clockedInAt: clockIn != null ? Value(clockIn) : const Value.absent(),
      clockedOutAt: clockOut != null ? Value(clockOut) : const Value.absent(),
      status: status != null ? Value(status) : const Value.absent(),
      updatedAt: Value(DateTime.now().toUtc()),
    );
    return (update(localShifts)..where((s) => s.id.equals(shiftId)))
        .write(companion);
  }

  // ── Participants ──────────────────────────────────

  Stream<List<LocalParticipant>> watchParticipants(String orgId) {
    return (select(localParticipants)
          ..where((p) => p.organizationId.equals(orgId))
          ..orderBy([(p) => OrderingTerm.asc(p.lastName)]))
        .watch();
  }

  Future<void> upsertParticipants(List<LocalParticipantsCompanion> participants) async {
    await batch((b) {
      for (final p in participants) {
        b.insert(localParticipants, p, onConflict: DoUpdate((_) => p));
      }
    });
  }

  // ── Care Plans ────────────────────────────────────

  Stream<List<LocalCarePlan>> watchCarePlans(String orgId, String participantId) {
    return (select(localCarePlans)
          ..where((c) => c.organizationId.equals(orgId) & c.participantId.equals(participantId))
          ..orderBy([(c) => OrderingTerm.desc(c.startDate)]))
        .watch();
  }

  Future<void> upsertCarePlans(List<LocalCarePlansCompanion> plans) async {
    await batch((b) {
      for (final p in plans) {
        b.insert(localCarePlans, p, onConflict: DoUpdate((_) => p));
      }
    });
  }

  // ── Inventory Items ───────────────────────────────

  Stream<List<LocalInventoryItem>> watchInventory(String orgId) {
    return (select(localInventoryItems)
          ..where((i) => i.organizationId.equals(orgId) & i.isActive.equals(true))
          ..orderBy([(i) => OrderingTerm.asc(i.name)]))
        .watch();
  }

  Future<LocalInventoryItem?> findByBarcode(String orgId, String barcode) {
    return (select(localInventoryItems)
          ..where((i) => i.organizationId.equals(orgId) & i.barcode.equals(barcode)))
        .getSingleOrNull();
  }

  Future<void> upsertInventoryItems(List<LocalInventoryItemsCompanion> items) async {
    await batch((b) {
      for (final i in items) {
        b.insert(localInventoryItems, i, onConflict: DoUpdate((_) => i));
      }
    });
  }

  Future<void> decrementInventory(String itemId, int qty) async {
    await customStatement(
      'UPDATE local_inventory_items SET quantity_on_hand = MAX(0, quantity_on_hand - ?) WHERE id = ?',
      [qty, itemId],
    );
  }

  // ── Shift Notes ───────────────────────────────────

  Stream<List<LocalShiftNote>> watchShiftNotes(String shiftId) {
    return (select(localShiftNotes)
          ..where((n) => n.shiftId.equals(shiftId))
          ..orderBy([(n) => OrderingTerm.desc(n.createdAt)]))
        .watch();
  }

  Future<void> upsertShiftNote(LocalShiftNotesCompanion note) {
    return into(localShiftNotes).insertOnConflictUpdate(note);
  }

  // ── Medication Records ────────────────────────────

  Stream<List<LocalMedicationRecord>> watchMedicationRecords(String participantId, {DateTime? date}) {
    return (select(localMedicationRecords)
          ..where((m) {
            var expr = m.participantId.equals(participantId);
            if (date != null) {
              final start = DateTime(date.year, date.month, date.day);
              final end = start.add(const Duration(days: 1));
              expr = expr & m.scheduledAt.isBiggerOrEqualValue(start) & m.scheduledAt.isSmallerThanValue(end);
            }
            return expr;
          })
          ..orderBy([(m) => OrderingTerm.asc(m.scheduledAt)]))
        .watch();
  }

  Future<void> upsertMedicationRecord(LocalMedicationRecordsCompanion record) {
    return into(localMedicationRecords).insertOnConflictUpdate(record);
  }

  Future<void> upsertMedicationRecords(List<LocalMedicationRecordsCompanion> records) async {
    await batch((b) {
      for (final r in records) {
        b.insert(localMedicationRecords, r, onConflict: DoUpdate((_) => r));
      }
    });
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

  Future<List<SyncQueueData>> failedMutations({int limit = 20}) {
    return (select(syncQueue)
          ..where((q) => q.status.equals('failed') & q.retryCount.isSmallerThanValue(5))
          ..orderBy([(q) => OrderingTerm.asc(q.createdAt)])
          ..limit(limit))
        .get();
  }

  Future<void> resetToPending(List<String> ids) async {
    if (ids.isEmpty) return;
    await (update(syncQueue)..where((q) => q.id.isIn(ids))).write(
      const SyncQueueCompanion(
        status: Value('pending'),
        errorMessage: Value.absent(),
      ),
    );
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

  Future<void> incrementUploadRetry(String id) async {
    await customStatement(
      'UPDATE upload_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [id],
    );
  }

  Future<void> markUploadFailed(String id) {
    return (update(uploadQueue)..where((q) => q.id.equals(id))).write(
      const UploadQueueCompanion(status: Value('failed')),
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

  // ── Compliance Rules (Cerberus-Gate) ─────────────────

  Future<List<LocalComplianceRuleData>> getComplianceRulesForTrigger(
    String orgId, String triggerState,
  ) {
    return (select(localComplianceRules)
          ..where((r) => r.organizationId.equals(orgId))
          ..where((r) => r.isActive.equals(true))
          ..where((r) => r.triggerState.equals(triggerState))
          ..orderBy([(r) => OrderingTerm.desc(r.priority)]))
        .get();
  }

  Future<void> upsertComplianceRules(
    List<LocalComplianceRulesCompanion> rules,
  ) async {
    await batch((b) => b.insertAllOnConflictUpdate(localComplianceRules, rules));
  }

  Future<bool> hasFormResponseForJob(String jobId, String formTemplateId) async {
    // Check local form_responses — the mobile app uses SyncQueue for these
    final pending = await (select(syncQueue)
          ..where((s) => s.entityType.equals('form_response'))
          ..where((s) => s.payload.like('%$jobId%'))
          ..where((s) => s.payload.like('%$formTemplateId%')))
        .get();
    return pending.isNotEmpty;
  }

  Future<int> getJobMediaCount(String jobId, {String? mediaType}) async {
    final rows = await (select(syncQueue)
          ..where((s) => s.entityType.equals('job_media'))
          ..where((s) => s.payload.like('%$jobId%'))
          ..where((s) => s.action.equals('INSERT')))
        .get();
    return rows.length;
  }

  Future<String?> getShiftNoteContent(String shiftId) async {
    final note = await (select(localShiftNotes)
          ..where((n) => n.shiftId.equals(shiftId))
          ..orderBy([(n) => OrderingTerm.desc(n.updatedAt)])
          ..limit(1))
        .getSingleOrNull();
    return note?.content;
  }

  Future<List<LocalMedicationRecord>> getPendingMedicationsForShift(
    String shiftId,
  ) async {
    // Medications linked by shift time window — query by status
    return (select(localMedicationRecords)
          ..where((m) => m.status.equals('pending')))
        .get();
  }

  Future<bool> hasClientSignatureForJob(String jobId) async {
    final rows = await (select(syncQueue)
          ..where((s) => s.entityType.equals('form_response'))
          ..where((s) => s.payload.like('%$jobId%'))
          ..where((s) => s.payload.like('%signature%')))
        .get();
    return rows.isNotEmpty;
  }

  Future<bool> hasSwmsForJob(String jobId) async {
    final rows = await (select(syncQueue)
          ..where((s) => s.entityType.isIn(['job_swms_record', 'form_response']))
          ..where((s) => s.payload.like('%$jobId%'))
          ..where((s) => s.payload.like('%swms%')))
        .get();
    return rows.isNotEmpty;
  }

  Future<List<LocalTask>> getIncompleteTasks(String jobId) {
    return (select(localTasks)
          ..where((t) => t.jobId.equals(jobId))
          ..where((t) => t.completed.equals(false)))
        .get();
  }

  Future<LocalJob?> getJob(String jobId) {
    return (select(localJobs)..where((j) => j.id.equals(jobId)))
        .getSingleOrNull();
  }

  // ── Nuke ─────────────────────────────────────────────

  Future<void> clearAll() async {
    await delete(localJobs).go();
    await delete(localTasks).go();
    await delete(localTimerSessions).go();
    await delete(localClients).go();
    await delete(localShifts).go();
    await delete(localParticipants).go();
    await delete(localCarePlans).go();
    await delete(localInventoryItems).go();
    await delete(localShiftNotes).go();
    await delete(localMedicationRecords).go();
    await delete(localComplianceRules).go();
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
