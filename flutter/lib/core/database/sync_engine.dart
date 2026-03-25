import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/job.dart';

const _uuid = Uuid();

enum SyncStatus { synced, syncing, offline, failed }

class SyncEngine {
  final AppDatabase _db;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _syncTimer;
  bool _syncing = false;
  bool _hydrating = false;

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

  // ═════════════════════════════════════════════════════════
  // ── HYDRATION: Pull from Supabase → Local SQLite ────────
  // ═════════════════════════════════════════════════════════

  Future<void> hydrate(String orgId) async {
    if (_hydrating) return;
    _hydrating = true;
    try {
      await Future.wait([
        _hydrateJobs(orgId),
        _hydrateTasks(orgId),
        _hydrateTimerSessions(orgId),
        _hydrateClients(orgId),
        _hydrateShifts(orgId),
        _hydrateParticipants(orgId),
        _hydrateCarePlans(orgId),
        _hydrateInventoryItems(orgId),
        _hydrateComplianceRules(orgId),
      ]);
    } finally {
      _hydrating = false;
    }
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
    } catch (e) {
      _logHydrationError('jobs', e);
    }
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
      if (rows.isEmpty) return;

      await _db.batch((b) {
        for (final r in rows) {
          final companion = LocalTasksCompanion(
            id: Value(r['id'] as String),
            jobId: Value(r['job_id'] as String),
            title: Value(r['title'] as String? ?? ''),
            completed: Value(r['completed'] as bool? ?? false),
            isCritical: Value(r['is_critical'] as bool? ?? false),
            sortOrder: Value(r['sort_order'] as int? ?? 0),
            updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
          );
          b.insert(_db.localTasks, companion, onConflict: DoUpdate((_) => companion));
        }
      });
      await _db.setLastSyncTime('tasks', DateTime.now().toUtc());
    } catch (e) {
      _logHydrationError('tasks', e);
    }
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
          b.insert(_db.localTimerSessions, companion, onConflict: DoUpdate((_) => companion));
        }
      });
    } catch (e) {
      _logHydrationError('timer_sessions', e);
    }
  }

  Future<void> _hydrateClients(String orgId) async {
    try {
      final lastSync = await _db.lastSyncTime('clients');
      var query = SupabaseService.client
          .from('clients')
          .select()
          .eq('organization_id', orgId)
          .isFilter('deleted_at', null);

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.order('updated_at', ascending: false).limit(500);
      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((r) => LocalClientsCompanion(
        id: Value(r['id'] as String),
        organizationId: Value(r['organization_id'] as String),
        name: Value(r['name'] as String? ?? ''),
        email: Value(r['email'] as String?),
        phone: Value(r['phone'] as String?),
        address: Value(r['address'] as String?),
        addressLat: Value((r['address_lat'] as num?)?.toDouble()),
        addressLng: Value((r['address_lng'] as num?)?.toDouble()),
        status: Value(r['status'] as String? ?? 'active'),
        type: Value(r['type'] as String? ?? 'residential'),
        notes: Value(r['notes'] as String?),
        tags: Value(jsonEncode(r['tags'] ?? [])),
        metadata: Value(jsonEncode(r['metadata'] ?? {})),
        createdAt: Value(DateTime.parse(r['created_at'] as String)),
        updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
      )).toList();

      await _db.upsertClients(companions);
      await _db.setLastSyncTime('clients', DateTime.now().toUtc());
    } catch (e) {
      _logHydrationError('clients', e);
    }
  }

  Future<void> _hydrateShifts(String orgId) async {
    try {
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) return;
      final lastSync = await _db.lastSyncTime('shifts');

      final now = DateTime.now().toUtc();
      final weekAgo = now.subtract(const Duration(days: 1));
      final weekAhead = now.add(const Duration(days: 7));

      var query = SupabaseService.client
          .from('schedule_blocks')
          .select('*, clients(name), participant:participant_profiles(first_name, last_name)')
          .eq('organization_id', orgId)
          .eq('worker_id', userId)
          .gte('start_time', weekAgo.toIso8601String())
          .lte('start_time', weekAhead.toIso8601String());

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.order('start_time').limit(200);
      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((r) {
        final clientMap = r['clients'] as Map<String, dynamic>?;
        final participantMap = r['participant'] as Map<String, dynamic>?;
        return LocalShiftsCompanion(
          id: Value(r['id'] as String),
          organizationId: Value(r['organization_id'] as String),
          workerId: Value(r['worker_id'] as String?),
          workerName: Value(null),
          clientId: Value(r['client_id'] as String?),
          clientName: Value(clientMap?['name'] as String?),
          participantId: Value(r['participant_id'] as String?),
          participantName: Value(participantMap != null
              ? '${participantMap['first_name'] ?? ''} ${participantMap['last_name'] ?? ''}'.trim()
              : null),
          title: Value(r['title'] as String?),
          startTime: Value(DateTime.parse(r['start_time'] as String)),
          endTime: Value(DateTime.parse(r['end_time'] as String)),
          status: Value(r['status'] as String? ?? 'scheduled'),
          shiftType: Value(r['shift_type'] as String? ?? 'standard'),
          location: Value(r['location'] as String?),
          locationLat: Value((r['location_lat'] as num?)?.toDouble()),
          locationLng: Value((r['location_lng'] as num?)?.toDouble()),
          notes: Value(r['notes'] as String?),
          metadata: Value(jsonEncode(r['metadata'] ?? {})),
          clockedInAt: Value(r['clocked_in_at'] != null ? DateTime.parse(r['clocked_in_at'] as String) : null),
          clockedOutAt: Value(r['clocked_out_at'] != null ? DateTime.parse(r['clocked_out_at'] as String) : null),
          createdAt: Value(DateTime.parse(r['created_at'] as String)),
          updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
        );
      }).toList();

      await _db.upsertShifts(companions);
      await _db.setLastSyncTime('shifts', DateTime.now().toUtc());
    } catch (e) {
      _logHydrationError('shifts', e);
    }
  }

  Future<void> _hydrateParticipants(String orgId) async {
    try {
      final lastSync = await _db.lastSyncTime('participants');
      var query = SupabaseService.client
          .from('participant_profiles')
          .select()
          .eq('organization_id', orgId);

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.limit(500);
      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((r) => LocalParticipantsCompanion(
        id: Value(r['id'] as String),
        organizationId: Value(r['organization_id'] as String),
        clientId: Value(r['client_id'] as String?),
        firstName: Value(r['first_name'] as String? ?? ''),
        lastName: Value(r['last_name'] as String? ?? ''),
        ndisNumber: Value(r['ndis_number'] as String?),
        dateOfBirth: Value(r['date_of_birth'] != null ? DateTime.parse(r['date_of_birth'] as String) : null),
        primaryDisability: Value(r['primary_disability'] as String?),
        fundingType: Value(r['funding_type'] as String?),
        address: Value(r['address'] as String?),
        phone: Value(r['phone'] as String?),
        email: Value(r['email'] as String?),
        emergencyContactName: Value(r['emergency_contact_name'] as String?),
        emergencyContactPhone: Value(r['emergency_contact_phone'] as String?),
        notes: Value(r['notes'] as String?),
        metadata: Value(jsonEncode(r['metadata'] ?? {})),
        createdAt: Value(DateTime.parse(r['created_at'] as String)),
        updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
      )).toList();

      await _db.upsertParticipants(companions);
      await _db.setLastSyncTime('participants', DateTime.now().toUtc());
    } catch (e) {
      _logHydrationError('participants', e);
    }
  }

  Future<void> _hydrateCarePlans(String orgId) async {
    try {
      final lastSync = await _db.lastSyncTime('care_plans');
      var query = SupabaseService.client
          .from('care_plans')
          .select()
          .eq('organization_id', orgId)
          .eq('status', 'active');

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.limit(200);
      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((r) => LocalCarePlansCompanion(
        id: Value(r['id'] as String),
        organizationId: Value(r['organization_id'] as String),
        participantId: Value(r['participant_id'] as String),
        title: Value(r['title'] as String? ?? 'Care Plan'),
        status: Value(r['status'] as String? ?? 'active'),
        startDate: Value(r['start_date'] != null ? DateTime.parse(r['start_date'] as String) : null),
        endDate: Value(r['end_date'] != null ? DateTime.parse(r['end_date'] as String) : null),
        totalBudget: Value((r['total_budget'] as num?)?.toDouble() ?? 0),
        usedBudget: Value((r['used_budget'] as num?)?.toDouble() ?? 0),
        goals: Value(jsonEncode(r['goals'] ?? [])),
        metadata: Value(jsonEncode(r['metadata'] ?? {})),
        createdAt: Value(DateTime.parse(r['created_at'] as String)),
        updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
      )).toList();

      await _db.upsertCarePlans(companions);
      await _db.setLastSyncTime('care_plans', DateTime.now().toUtc());
    } catch (e) {
      _logHydrationError('care_plans', e);
    }
  }

  Future<void> _hydrateInventoryItems(String orgId) async {
    try {
      final lastSync = await _db.lastSyncTime('inventory');
      var query = SupabaseService.client
          .from('inventory_items')
          .select()
          .eq('organization_id', orgId)
          .eq('is_active', true);

      if (lastSync != null) {
        query = query.gt('updated_at', lastSync.toUtc().toIso8601String());
      }

      final data = await query.limit(1000);
      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((r) => LocalInventoryItemsCompanion(
        id: Value(r['id'] as String),
        organizationId: Value(r['organization_id'] as String),
        name: Value(r['name'] as String? ?? ''),
        sku: Value(r['sku'] as String?),
        barcode: Value(r['barcode'] as String?),
        category: Value(r['category'] as String?),
        unit: Value(r['unit'] as String? ?? 'each'),
        unitCost: Value((r['unit_cost'] as num?)?.toDouble() ?? 0),
        unitPrice: Value((r['unit_price'] as num?)?.toDouble() ?? 0),
        quantityOnHand: Value(r['quantity_on_hand'] as int? ?? 0),
        reorderPoint: Value(r['reorder_point'] as int? ?? 0),
        imageUrl: Value(r['image_url'] as String?),
        isActive: Value(r['is_active'] as bool? ?? true),
        metadata: Value(jsonEncode(r['metadata'] ?? {})),
        updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
      )).toList();

      await _db.upsertInventoryItems(companions);
      await _db.setLastSyncTime('inventory', DateTime.now().toUtc());
    } catch (e) {
      _logHydrationError('inventory', e);
    }
  }

  Future<void> _hydrateComplianceRules(String orgId) async {
    try {
      final data = await SupabaseService.client
          .from('compliance_rules')
          .select()
          .eq('organization_id', orgId)
          .eq('is_active', true);

      final rows = (data as List).cast<Map<String, dynamic>>();
      if (rows.isEmpty) return;

      final companions = rows.map((r) => LocalComplianceRulesCompanion(
        id: Value(r['id'] as String),
        organizationId: Value(r['organization_id'] as String),
        name: Value(r['name'] as String? ?? ''),
        description: Value(r['description'] as String?),
        triggerState: Value(r['trigger_state'] as String),
        ruleType: Value(r['rule_type'] as String),
        configJsonb: Value(jsonEncode(r['config_jsonb'] ?? {})),
        targetEntityType: Value(r['target_entity_type'] as String? ?? 'GLOBAL'),
        targetEntityId: Value(r['target_entity_id'] as String?),
        targetLabel: Value(r['target_label'] as String?),
        isHardBlock: Value(r['is_hard_block'] as bool? ?? true),
        isActive: Value(r['is_active'] as bool? ?? true),
        priority: Value(r['priority'] as int? ?? 0),
        createdAt: Value(DateTime.parse(r['created_at'] as String)),
        updatedAt: Value(DateTime.parse(r['updated_at'] as String)),
      )).toList();

      await _db.upsertComplianceRules(companions);
    } catch (e) {
      _logHydrationError('compliance_rules', e);
    }
  }

  void _logHydrationError(String entity, Object e) {
    unawaited(MobileTelemetryEngine.instance.captureAndReport(
      e is Exception ? e : Exception(e.toString()),
      StackTrace.current,
      source: 'sync_engine_hydrate',
      fatal: false,
      extra: <String, dynamic>{'entity': entity},
    ));
  }

  // ═════════════════════════════════════════════════════════
  // ── MUTATION QUEUEING: Local Write + Queue for Sync ─────
  // ═════════════════════════════════════════════════════════

  Future<void> updateJobStatus(String jobId, String orgId, String newStatus) async {
    await _db.updateJobStatus(jobId, newStatus);
    await _enqueue('job', jobId, 'UPDATE', {
      'status': newStatus,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
    drainQueue();
  }

  Future<void> toggleTask(String taskId, bool completed) async {
    await _db.toggleTaskCompletion(taskId, completed);
    await _enqueue('job_subtask', taskId, 'UPDATE', {
      'completed': completed,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
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

    await _enqueue('job_timer_session', sessionId, 'INSERT', {
      'id': sessionId,
      'organization_id': orgId,
      'job_id': jobId,
      'user_id': userId,
      'started_at': now.toIso8601String(),
      'start_lat': lat,
      'start_lng': lng,
      'status': 'active',
    });
    await _enqueue('job', jobId, 'UPDATE', {
      'status': 'in_progress',
      'updated_at': now.toIso8601String(),
    });
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

    await _enqueue('job_timer_session', sessionId, 'UPDATE', {
      'ended_at': now.toIso8601String(),
      'end_lat': lat,
      'end_lng': lng,
      'status': 'completed',
    });
    await _enqueue('job', jobId, 'UPDATE', {
      'status': 'done',
      'updated_at': now.toIso8601String(),
    });
    drainQueue();
  }

  /// Clock in to a shift — local-first, queued for sync.
  Future<void> clockInShift(String shiftId) async {
    final now = DateTime.now().toUtc();
    await _db.updateShiftClock(shiftId, clockIn: now, status: 'in_progress');
    await _enqueue('schedule_block', shiftId, 'UPDATE', {
      'clocked_in_at': now.toIso8601String(),
      'status': 'in_progress',
      'updated_at': now.toIso8601String(),
    });
    drainQueue();
  }

  /// Clock out of a shift — local-first, queued for sync.
  Future<void> clockOutShift(String shiftId) async {
    final now = DateTime.now().toUtc();
    await _db.updateShiftClock(shiftId, clockOut: now, status: 'completed');
    await _enqueue('schedule_block', shiftId, 'UPDATE', {
      'clocked_out_at': now.toIso8601String(),
      'status': 'completed',
      'updated_at': now.toIso8601String(),
    });
    drainQueue();
  }

  /// Add a shift note — local-first with client-side UUID.
  Future<void> addShiftNote({
    required String shiftId,
    required String orgId,
    required String workerId,
    String? participantId,
    required String content,
    String noteType = 'general',
  }) async {
    final noteId = _uuid.v4();
    final now = DateTime.now().toUtc();

    await _db.upsertShiftNote(LocalShiftNotesCompanion(
      id: Value(noteId),
      organizationId: Value(orgId),
      shiftId: Value(shiftId),
      workerId: Value(workerId),
      participantId: Value(participantId),
      content: Value(content),
      noteType: Value(noteType),
      createdAt: Value(now),
      updatedAt: Value(now),
    ));

    await _enqueue('shift_notes', noteId, 'INSERT', {
      'id': noteId,
      'organization_id': orgId,
      'shift_id': shiftId,
      'worker_id': workerId,
      'participant_id': participantId,
      'content': content,
      'note_type': noteType,
      'created_at': now.toIso8601String(),
      'updated_at': now.toIso8601String(),
    });
    drainQueue();
  }

  /// Record medication administration — local-first for offline eMAR.
  Future<void> administerMedication({
    required String recordId,
    required String orgId,
    required String administeredBy,
    String? signaturePath,
    String? notes,
  }) async {
    final now = DateTime.now().toUtc();

    await _db.upsertMedicationRecord(LocalMedicationRecordsCompanion(
      id: Value(recordId),
      administeredAt: Value(now),
      administeredBy: Value(administeredBy),
      status: const Value('administered'),
      signaturePath: Value(signaturePath),
      notes: Value(notes),
      updatedAt: Value(now),
    ));

    await _enqueue('medication_records', recordId, 'UPDATE', {
      'administered_at': now.toIso8601String(),
      'administered_by': administeredBy,
      'status': 'administered',
      'signature_path': signaturePath,
      'notes': notes,
      'updated_at': now.toIso8601String(),
    });

    if (signaturePath != null) {
      await _db.enqueueUpload(UploadQueueCompanion(
        id: Value(_uuid.v4()),
        jobId: Value(recordId),
        localPath: Value(signaturePath),
        remotePath: Value('medication-signatures/$orgId/${recordId}_signature.png'),
        mimeType: const Value('image/png'),
        createdAt: Value(now),
      ));
    }
    drainQueue();
  }

  /// Consume inventory item locally — decrements stock, queues sync.
  Future<void> consumeInventory({
    required String itemId,
    required String orgId,
    required String jobId,
    required int quantity,
  }) async {
    await _db.decrementInventory(itemId, quantity);
    final consumptionId = _uuid.v4();
    await _enqueue('inventory_consumption', consumptionId, 'INSERT', {
      'id': consumptionId,
      'organization_id': orgId,
      'item_id': itemId,
      'job_id': jobId,
      'quantity': quantity,
      'consumed_at': DateTime.now().toUtc().toIso8601String(),
    });
    drainQueue();
  }

  // ═════════════════════════════════════════════════════════
  // ── CHRONOS-LOCK: Geofenced Time Entry with Spatial Gate
  // ═════════════════════════════════════════════════════════

  /// Clock in with full spatial metadata — local-first, queued for sync.
  Future<void> clockInTimeEntry({
    required String entryId,
    required String organizationId,
    required String userId,
    String? jobId,
    String? shiftId,
    required DateTime trueTime,
    required double lat,
    required double lng,
    required double accuracy,
    int? distanceMeters,
    required bool isSpatialViolation,
    required int clockOffsetMs,
  }) async {
    await _enqueue('time_entry', entryId, 'INSERT', {
      'id': entryId,
      'organization_id': organizationId,
      'user_id': userId,
      'worker_id': userId,
      'type': 'shift',
      'status': 'active',
      'clock_in': trueTime.toIso8601String(),
      'clock_in_location': jsonEncode({
        'lat': lat,
        'lng': lng,
        'accuracy_m': accuracy,
        'is_verified': !isSpatialViolation,
      }),
      if (jobId != null) 'job_id': jobId,
      if (shiftId != null) 'shift_id': shiftId,
      'clock_in_distance_meters': distanceMeters,
      'is_spatial_violation': isSpatialViolation,
      'is_geofence_override': isSpatialViolation,
      'device_clock_offset_ms': clockOffsetMs,
      'created_at': trueTime.toIso8601String(),
      'updated_at': trueTime.toIso8601String(),
    });
    drainQueue();
  }

  /// Clock out with full spatial metadata.
  Future<void> clockOutTimeEntry({
    required String entryId,
    required DateTime trueTime,
    required double lat,
    required double lng,
    required double accuracy,
    int? distanceMeters,
    required bool isSpatialViolation,
    required int clockOffsetMs,
    int breakMinutes = 0,
  }) async {
    await _enqueue('time_entry', entryId, 'UPDATE', {
      'status': 'completed',
      'clock_out': trueTime.toIso8601String(),
      'clock_out_location': jsonEncode({
        'lat': lat,
        'lng': lng,
        'accuracy_m': accuracy,
        'is_verified': !isSpatialViolation,
      }),
      'clock_out_distance_meters': distanceMeters,
      'break_minutes': breakMinutes,
      'updated_at': trueTime.toIso8601String(),
    });
    drainQueue();
  }

  /// Create a geofence anomaly — queued for sync to dispatcher review.
  Future<void> createAnomaly({
    required String anomalyId,
    required String organizationId,
    String? timeEntryId,
    required String workerId,
    String? jobId,
    required String anomalyType,
    required int distanceMeters,
    required double workerLat,
    required double workerLng,
    required double jobLat,
    required double jobLng,
    required double accuracy,
    required String justification,
  }) async {
    await _enqueue('timesheet_anomaly', anomalyId, 'INSERT', {
      'id': anomalyId,
      'organization_id': organizationId,
      'time_entry_id': timeEntryId,
      'worker_id': workerId,
      'job_id': jobId,
      'anomaly_type': anomalyType,
      'recorded_distance_meters': distanceMeters,
      'device_accuracy_meters': accuracy,
      'worker_justification': justification,
      'status': 'PENDING',
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
    drainQueue();
  }

  /// Record a compliance override — queued for sync to audit trail.
  Future<void> createComplianceOverride({
    required String overrideId,
    required String organizationId,
    required String ruleId,
    required String workerId,
    required String jobId,
    required String justification,
    required String overrideType,
    String? adminId,
    String? pinId,
  }) async {
    await _enqueue('compliance_override', overrideId, 'INSERT', {
      'id': overrideId,
      'organization_id': organizationId,
      'rule_id': ruleId,
      'worker_id': workerId,
      'job_id': jobId,
      'justification': justification,
      'override_type': overrideType,
      'authorized_by_admin_id': adminId,
      'pin_id': pinId,
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
    drainQueue();
  }

  Future<void> _enqueue(String entityType, String entityId, String action, Map<String, dynamic> payload) {
    return _db.enqueue(SyncQueueCompanion(
      id: Value(_uuid.v4()),
      entityType: Value(entityType),
      entityId: Value(entityId),
      action: Value(action),
      payload: Value(jsonEncode(payload)),
      createdAt: Value(DateTime.now().toUtc()),
    ));
  }

  // ═════════════════════════════════════════════════════════
  // ── QUEUE DRAINER: Batch sync via Edge Function ─────────
  // ═════════════════════════════════════════════════════════

  Future<void> drainQueue() async {
    if (_syncing) return;

    final connectivity = await Connectivity().checkConnectivity();
    final isOffline = connectivity.every((r) => r == ConnectivityResult.none);
    if (isOffline) {
      onStatusChange?.call(SyncStatus.offline);
      return;
    }

    _syncing = true;
    onStatusChange?.call(SyncStatus.syncing);

    try {
      var pending = await _db.pendingMutations();
      if (pending.isEmpty) {
        final retryableFailed = await _db.failedMutations(limit: 10);
        if (retryableFailed.isNotEmpty) {
          await _db.resetToPending(retryableFailed.map((e) => e.id).toList());
          pending = await _db.pendingMutations();
        }
      }
      if (pending.isEmpty) {
        onStatusChange?.call(SyncStatus.synced);
        return;
      }

      // Try batch sync via Edge Function first
      final batchSuccess = await _tryBatchSync(pending);
      if (batchSuccess) {
        onStatusChange?.call(SyncStatus.synced);
        return;
      }

      // Fallback: process mutations individually
      for (final item in pending) {
        try {
          await _processMutation(item);
          await _db.markSynced(item.id);
        } on SocketException {
          onStatusChange?.call(SyncStatus.offline);
          return;
        } catch (e) {
          if (e is PostgrestException && (e.code ?? '').startsWith('PGRST')) {
            unawaited(MobileTelemetryEngine.instance.captureAndReport(
              e,
              StackTrace.current,
              source: 'sync_engine',
              fatal: false,
              extra: <String, dynamic>{
                'entity_type': item.entityType,
                'entity_id': item.entityId,
                'pgrst_code': e.code,
              },
            ));
          }
          await _db.incrementRetry(item.id);
          if (item.retryCount >= 4) {
            await _db.markFailed(item.id, e.toString());
            onStatusChange?.call(SyncStatus.failed);
          }
        }
      }
      onStatusChange?.call(SyncStatus.synced);
    } finally {
      _syncing = false;
    }
  }

  /// Batch sync via the process-sync-queue Edge Function.
  Future<bool> _tryBatchSync(List<SyncQueueData> mutations) async {
    try {
      final supabaseUrl = SupabaseService.client.rest.url.replaceAll('/rest/v1', '');
      final session = SupabaseService.auth.currentSession;
      if (session == null) return false;

      final batch = mutations.map((m) => {
        'id': m.id,
        'entity_type': m.entityType,
        'entity_id': m.entityId,
        'action': m.action,
        'payload': jsonDecode(m.payload),
        'timestamp': m.createdAt.toUtc().millisecondsSinceEpoch,
      }).toList();

      final response = await http.post(
        Uri.parse('$supabaseUrl/functions/v1/process-sync-queue'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${session.accessToken}',
        },
        body: jsonEncode({
          'device_id': _uuid.v5(Uuid.NAMESPACE_URL, 'iworkr-mobile'),
          'mutations': batch,
        }),
      );

      if (response.statusCode != 200) return false;

      final result = jsonDecode(response.body) as Map<String, dynamic>;
      final successIds = List<String>.from(result['success_ids'] ?? []);
      final failedIds = Map<String, String>.from(result['failed_ids'] ?? {});

      for (final id in successIds) {
        await _db.markSynced(id);
      }
      for (final entry in failedIds.entries) {
        await _db.incrementRetry(entry.key);
        final item = mutations.firstWhere((m) => m.id == entry.key, orElse: () => mutations.first);
        if (item.retryCount >= 4) {
          await _db.markFailed(entry.key, entry.value);
        }
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _processMutation(SyncQueueData item) async {
    final payload = jsonDecode(item.payload) as Map<String, dynamic>;
    if (item.entityType == 'telemetry_event') {
      await SupabaseService.client.functions.invoke(
        'ingest-telemetry',
        body: payload,
      );
      return;
    }
    final table = _resolveTable(item.entityType);

    switch (item.action) {
      case 'INSERT':
        payload['id'] ??= item.entityId;
        await SupabaseService.client.from(table).upsert(payload);
        break;
      case 'UPDATE':
        final updated = await SupabaseService.client
            .from(table)
            .update(payload)
            .eq('id', item.entityId)
            .select('id')
            .maybeSingle();
        if (updated == null) {
          throw StateError('No rows updated for ${item.entityType}/${item.entityId}');
        }
        break;
      case 'DELETE':
        final deleted = await SupabaseService.client
            .from(table)
            .delete()
            .eq('id', item.entityId)
            .select('id')
            .maybeSingle();
        if (deleted == null) {
          throw StateError('No rows deleted for ${item.entityType}/${item.entityId}');
        }
        break;
    }
  }

  String _resolveTable(String entityType) {
    return switch (entityType) {
      'job' => 'jobs',
      'job_subtask' => 'job_subtasks',
      'job_timer_session' => 'job_timer_sessions',
      'job_media' => 'job_media',
      'schedule_block' => 'schedule_blocks',
      'shift_notes' => 'shift_notes',
      'medication_records' => 'medication_records',
      'inventory_consumption' => 'inventory_consumptions',
      'client' => 'clients',
      'participant' => 'participant_profiles',
      'care_plan' => 'care_plans',
      'time_entry' => 'time_entries',
      'timesheet_anomaly' => 'timesheet_anomalies',
      'compliance_override' => 'compliance_overrides',
      _ => entityType,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final db = ref.watch(appDatabaseProvider);
  final engine = SyncEngine(db, ref);
  engine.onStatusChange = (status) {
    ref.read(syncStatusProvider.notifier).state = status;
  };
  ref.onDispose(() => engine.dispose());
  return engine;
});

final localJobsStreamProvider = StreamProvider.family<List<LocalJob>, String>((ref, orgId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchAllJobs(orgId);
});

final localJobStreamProvider = StreamProvider.family<LocalJob?, String>((ref, jobId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchJob(jobId);
});

final localTasksStreamProvider = StreamProvider.family<List<LocalTask>, String>((ref, jobId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchTasks(jobId);
});

final localActiveTimerProvider = StreamProvider.family<LocalTimerSession?, ({String jobId, String userId})>((ref, args) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchActiveTimer(args.jobId, args.userId);
});

final localClientsStreamProvider = StreamProvider.family<List<LocalClient>, String>((ref, orgId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchAllClients(orgId);
});

final localShiftsStreamProvider = StreamProvider.family<List<LocalShift>, ({String orgId, DateTime? from, DateTime? to})>((ref, args) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchShifts(args.orgId, from: args.from, to: args.to);
});

final localWorkerShiftsProvider = StreamProvider.family<List<LocalShift>, ({String orgId, String workerId, DateTime? from, DateTime? to})>((ref, args) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchWorkerShifts(args.orgId, args.workerId, from: args.from, to: args.to);
});

final localParticipantsStreamProvider = StreamProvider.family<List<LocalParticipant>, String>((ref, orgId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchParticipants(orgId);
});

final localCarePlansStreamProvider = StreamProvider.family<List<LocalCarePlan>, ({String orgId, String participantId})>((ref, args) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchCarePlans(args.orgId, args.participantId);
});

final localInventoryStreamProvider = StreamProvider.family<List<LocalInventoryItem>, String>((ref, orgId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchInventory(orgId);
});

final localShiftNotesProvider = StreamProvider.family<List<LocalShiftNote>, String>((ref, shiftId) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchShiftNotes(shiftId);
});

final localMedicationRecordsProvider = StreamProvider.family<List<LocalMedicationRecord>, ({String participantId, DateTime? date})>((ref, args) {
  final db = ref.watch(appDatabaseProvider);
  return db.watchMedicationRecords(args.participantId, date: args.date);
});

final pendingSyncCountProvider = FutureProvider<int>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return db.pendingCount();
});

final failedSyncCountProvider = FutureProvider<int>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return db.failedCount();
});

final syncStatusProvider = StateProvider<SyncStatus>((ref) => SyncStatus.synced);
