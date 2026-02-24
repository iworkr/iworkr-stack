import 'dart:convert';
import 'dart:developer' as developer;

import 'package:drift/drift.dart' show OrderingTerm;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import 'package:live_activities/live_activities.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Native Bridge Service ────────────────────────────────
// ═══════════════════════════════════════════════════════════

const _kAppGroup = 'group.com.iworkr.app';
const _kWidgetName = 'iWorkrWidgetExtension';

void _log(String msg) => developer.log(msg, name: 'NativeBridge');

class NativeBridgeService {
  final Ref _ref;
  final LiveActivities _liveActivities = LiveActivities();
  String? _currentActivityId;
  bool _initialized = false;

  NativeBridgeService(this._ref);

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    try {
      HomeWidget.setAppGroupId(_kAppGroup);
      _log('HomeWidget appGroupId set: $_kAppGroup');
    } on PlatformException catch (e) {
      _log('HomeWidget init failed: ${e.code} — ${e.message}');
    }

    try {
      await _liveActivities.init(appGroupId: _kAppGroup);
      _log('LiveActivities initialized with appGroupId: $_kAppGroup');
    } on PlatformException catch (e) {
      _log('LiveActivities init failed: ${e.code} — ${e.message}');
    } catch (e) {
      _log('LiveActivities init error: $e');
    }

    await syncAll();
  }

  Future<void> syncAll() async {
    await Future.wait([
      _syncActiveJob(),
      _syncNextJob(),
      _syncAdminMetrics(),
      _syncMeta(),
    ]);
    try {
      await HomeWidget.updateWidget(
        name: _kWidgetName,
        iOSName: _kWidgetName,
      );
      _log('HomeWidget.updateWidget succeeded');
    } on PlatformException catch (e) {
      _log('HomeWidget.updateWidget failed: ${e.code} — ${e.message}');
    }
  }

  // ── Active Job ─────────────────────────────────────────

  Future<void> _syncActiveJob() async {
    final userId = SupabaseService.auth.currentUser?.id;
    if (userId == null) {
      await HomeWidget.saveWidgetData('active_job', null);
      return;
    }

    try {
      final db = _ref.read(appDatabaseProvider);
      final sessions = await (db.select(db.localTimerSessions)
            ..where((t) => t.userId.equals(userId))
            ..where((t) => t.status.equals('active'))
            ..orderBy([(t) => OrderingTerm.desc(t.startedAt)])
            ..limit(1))
          .get();

      if (sessions.isEmpty) {
        await HomeWidget.saveWidgetData('active_job', null);
        return;
      }

      final session = sessions.first;
      final job = await (db.select(db.localJobs)
            ..where((j) => j.id.equals(session.jobId)))
          .getSingleOrNull();

      final payload = jsonEncode({
        'id': job?.displayId ?? session.jobId,
        'title': job?.title ?? 'Active Job',
        'status': 'in_progress',
        'start_time': session.startedAt.toIso8601String(),
        'address': job?.location,
        'client_name': job?.clientName,
      });
      await HomeWidget.saveWidgetData('active_job', payload);
    } catch (e) {
      _log('_syncActiveJob error: $e');
      await HomeWidget.saveWidgetData('active_job', null);
    }
  }

  // ── Next Scheduled Job ─────────────────────────────────

  Future<void> _syncNextJob() async {
    try {
      final orgId = _ref.read(activeWorkspaceIdProvider);
      if (orgId == null) return;

      final db = _ref.read(appDatabaseProvider);

      final jobs = await (db.select(db.localJobs)
            ..where((j) => j.organizationId.equals(orgId))
            ..where((j) => j.status.equals('scheduled'))
            ..where((j) => j.dueDate.isNotNull())
            ..orderBy([(j) => OrderingTerm.asc(j.dueDate)])
            ..limit(1))
          .get();

      if (jobs.isEmpty) {
        await HomeWidget.saveWidgetData('next_job', null);
        return;
      }

      final job = jobs.first;
      final payload = jsonEncode({
        'id': job.displayId,
        'title': job.title,
        'scheduled_time': job.dueDate?.toIso8601String(),
        'address': job.location,
        'client_name': job.clientName,
      });
      await HomeWidget.saveWidgetData('next_job', payload);
    } catch (e) {
      _log('_syncNextJob error: $e');
    }
  }

  // ── Admin Metrics ──────────────────────────────────────

  Future<void> _syncAdminMetrics() async {
    try {
      final ws = _ref.read(activeWorkspaceProvider).valueOrNull;
      if (ws == null || !ws.isAdmin) return;

      final db = _ref.read(appDatabaseProvider);
      final orgId = ws.organizationId;
      final allJobs = await (db.select(db.localJobs)
            ..where((j) => j.organizationId.equals(orgId)))
          .get();

      final revenueMtd = allJobs.fold<double>(0, (sum, j) => sum + j.revenue);

      final payload = jsonEncode({
        'revenue_mtd': revenueMtd,
        'active_fleet_count': 0,
        'urgent_alerts': 0,
      });
      await HomeWidget.saveWidgetData('admin_metrics', payload);
    } catch (e) {
      _log('_syncAdminMetrics error: $e');
    }
  }

  // ── Meta ───────────────────────────────────────────────

  Future<void> _syncMeta() async {
    final user = SupabaseService.auth.currentUser;
    final ws = _ref.read(activeWorkspaceProvider).valueOrNull;

    await HomeWidget.saveWidgetData('timestamp', DateTime.now().toUtc().toIso8601String());
    await HomeWidget.saveWidgetData('is_logged_in', user != null ? 'true' : 'false');
    await HomeWidget.saveWidgetData('persona', ws?.isAdmin == true ? 'admin' : 'technician');
    await HomeWidget.saveWidgetData('workspace_name', ws?.name ?? 'iWorkr');
  }

  // ── Live Activities (iOS Dynamic Island) ───────────────

  Future<void> startJobLiveActivity({
    required String jobId,
    required String jobTitle,
    required String address,
    required String status,
    required DateTime startTime,
    String? clientName,
  }) async {
    try {
      final data = <String, String>{
        'jobId': jobId,
        'jobTitle': jobTitle,
        'address': address,
        'status': status,
        'startTime': startTime.toIso8601String(),
        'clientName': clientName ?? '',
      };

      _log('Starting Live Activity — jobId=$jobId, data=$data');
      _currentActivityId = await _liveActivities.createActivity(jobId, data);
      _log('Live Activity created — activityId=$_currentActivityId');
    } on PlatformException catch (e) {
      _log('startJobLiveActivity PlatformException: ${e.code} — ${e.message} — ${e.details}');
    } catch (e) {
      _log('startJobLiveActivity error: $e');
    }
  }

  Future<void> updateJobLiveActivity({
    required String status,
    String? address,
    int? elapsedSeconds,
  }) async {
    if (_currentActivityId == null) return;
    try {
      await _liveActivities.updateActivity(
        _currentActivityId!,
        <String, dynamic>{
          'status': status,
          if (address != null) 'address': address,
          if (elapsedSeconds != null) 'elapsedSeconds': elapsedSeconds,
        },
      );
    } on PlatformException catch (e) {
      _log('updateJobLiveActivity error: ${e.code} — ${e.message}');
    }
  }

  Future<void> endJobLiveActivity() async {
    if (_currentActivityId == null) return;
    try {
      await _liveActivities.endActivity(_currentActivityId!);
      _log('Live Activity ended — activityId=$_currentActivityId');
      _currentActivityId = null;
    } on PlatformException catch (e) {
      _log('endJobLiveActivity error: ${e.code} — ${e.message}');
    }
  }

  // ── Logout Cleanup ─────────────────────────────────────

  Future<void> clearAll() async {
    await HomeWidget.saveWidgetData('active_job', null);
    await HomeWidget.saveWidgetData('next_job', null);
    await HomeWidget.saveWidgetData('admin_metrics', null);
    await HomeWidget.saveWidgetData('is_logged_in', 'false');
    await HomeWidget.saveWidgetData('timestamp', null);
    await HomeWidget.updateWidget(name: _kWidgetName, iOSName: _kWidgetName);
    await endJobLiveActivity();
  }

  void dispose() {}
}

// ═══════════════════════════════════════════════════════════
// ── Provider ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final nativeBridgeProvider = Provider<NativeBridgeService>((ref) {
  final service = NativeBridgeService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});
