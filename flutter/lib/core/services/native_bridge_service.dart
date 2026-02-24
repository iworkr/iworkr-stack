import 'dart:convert';

import 'package:drift/drift.dart' show OrderingTerm;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import 'package:live_activities/live_activities.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Native Bridge Service ────────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Serializes critical app state to native OS storage (App Groups)
// so that WidgetKit, Live Activities, and CarPlay can read it.
// Also manages iOS Live Activities via ActivityKit.

const _kAppGroup = 'group.com.iworkr.app';
const _kWidgetName = 'iWorkrWidget';

class NativeBridgeService {
  final Ref _ref;
  final LiveActivities _liveActivities = LiveActivities();
  String? _currentActivityId;

  NativeBridgeService(this._ref);

  /// Initialize the bridge — call once at app boot.
  Future<void> initialize() async {
    HomeWidget.setAppGroupId(_kAppGroup);
    await syncAll();
  }

  /// Push all current state to native storage.
  Future<void> syncAll() async {
    await Future.wait([
      _syncActiveJob(),
      _syncNextJob(),
      _syncAdminMetrics(),
      _syncMeta(),
    ]);
    await HomeWidget.updateWidget(name: _kWidgetName);
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
    } catch (_) {
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
    } catch (_) {}
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
    } catch (_) {}
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
      final data = <String, dynamic>{
        'jobId': jobId,
        'jobTitle': jobTitle,
        'address': address,
        'status': status,
        'startTime': startTime.toIso8601String(),
        'clientName': clientName ?? '',
      };

      _currentActivityId = await _liveActivities.createActivity(jobId, data);
    } catch (_) {}
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
    } catch (_) {}
  }

  Future<void> endJobLiveActivity() async {
    if (_currentActivityId == null) return;
    try {
      await _liveActivities.endActivity(_currentActivityId!);
      _currentActivityId = null;
    } catch (_) {}
  }

  // ── Logout Cleanup ─────────────────────────────────────

  Future<void> clearAll() async {
    await HomeWidget.saveWidgetData('active_job', null);
    await HomeWidget.saveWidgetData('next_job', null);
    await HomeWidget.saveWidgetData('admin_metrics', null);
    await HomeWidget.saveWidgetData('is_logged_in', 'false');
    await HomeWidget.saveWidgetData('timestamp', null);
    await HomeWidget.updateWidget(name: _kWidgetName);
    await endJobLiveActivity();
  }

  void dispose() {
    // No persistent subscriptions to clean up
  }
}

// ═══════════════════════════════════════════════════════════
// ── Provider ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final nativeBridgeProvider = Provider<NativeBridgeService>((ref) {
  final service = NativeBridgeService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});
