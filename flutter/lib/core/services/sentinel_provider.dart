import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/sentinel_alert.dart';

// ═══════════════════════════════════════════════════════════
// ── Sentinel Alerts — Automated Risk Detection ───────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale Phase 4: Realtime risk alerts from
// NLP keyword scanning, health trends, medication compliance,
// and care plan review deadlines.

/// All sentinel alerts for the organization (Realtime)
final sentinelAlertsStreamProvider =
    StreamProvider<List<SentinelAlert>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<SentinelAlert>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('sentinel_alerts')
          .select('*, participant_profiles(full_name, preferred_name), profiles(full_name)')
          .eq('organization_id', orgId)
          .order('created_at', ascending: false)
          .limit(200);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) =>
                  SentinelAlert.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('sentinel-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'sentinel_alerts',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
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

/// Active alerts only
final activeSentinelAlertsProvider = Provider<List<SentinelAlert>>((ref) {
  final all = ref.watch(sentinelAlertsStreamProvider).valueOrNull ?? [];
  return all.where((a) => a.isActive).toList();
});

/// Critical alerts only
final criticalSentinelAlertsProvider = Provider<List<SentinelAlert>>((ref) {
  final active = ref.watch(activeSentinelAlertsProvider);
  return active.where((a) => a.isCritical).toList();
});

/// Sentinel stats
final sentinelStatsProvider = Provider<SentinelStats>((ref) {
  final all = ref.watch(sentinelAlertsStreamProvider).valueOrNull ?? [];
  final active = all.where((a) => a.isActive).toList();
  return SentinelStats(
    total: all.length,
    active: active.length,
    critical: active.where((a) => a.severity == SentinelSeverity.critical).length,
    warnings: active.where((a) => a.severity == SentinelSeverity.warning).length,
    info: active.where((a) => a.severity == SentinelSeverity.info).length,
    escalated: all.where((a) => a.status == SentinelStatus.escalated).length,
  );
});

class SentinelStats {
  final int total;
  final int active;
  final int critical;
  final int warnings;
  final int info;
  final int escalated;
  const SentinelStats({
    this.total = 0,
    this.active = 0,
    this.critical = 0,
    this.warnings = 0,
    this.info = 0,
    this.escalated = 0,
  });
}

// ── Mutations ────────────────────────────────────────────

/// Acknowledge a sentinel alert
Future<void> acknowledgeSentinelAlert({
  required String alertId,
  String? notes,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;

  await SupabaseService.client
      .from('sentinel_alerts')
      .update({
        'status': 'acknowledged',
        'acknowledged_by': user.id,
        'acknowledged_at': DateTime.now().toUtc().toIso8601String(),
        if (notes != null) 'resolution_notes': notes,
      })
      .eq('id', alertId);
}

/// Dismiss a sentinel alert (false positive)
Future<void> dismissSentinelAlert({
  required String alertId,
  required String reason,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;

  await SupabaseService.client
      .from('sentinel_alerts')
      .update({
        'status': 'dismissed',
        'acknowledged_by': user.id,
        'acknowledged_at': DateTime.now().toUtc().toIso8601String(),
        'resolution_action': 'dismissed_false_positive',
        'resolution_notes': reason,
        'resolved_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('id', alertId);
}

/// Escalate a sentinel alert
Future<void> escalateSentinelAlert({
  required String alertId,
  String? notes,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;

  await SupabaseService.client
      .from('sentinel_alerts')
      .update({
        'status': 'escalated',
        'acknowledged_by': user.id,
        'acknowledged_at': DateTime.now().toUtc().toIso8601String(),
        'resolution_action': 'escalated_to_clinical',
        if (notes != null) 'resolution_notes': notes,
      })
      .eq('id', alertId);
}

/// Resolve a sentinel alert (after incident created)
Future<void> resolveSentinelAlert({
  required String alertId,
  required String action,
  String? notes,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;

  await SupabaseService.client
      .from('sentinel_alerts')
      .update({
        'status': 'resolved',
        'acknowledged_by': user.id,
        'acknowledged_at': DateTime.now().toUtc().toIso8601String(),
        'resolution_action': action,
        if (notes != null) 'resolution_notes': notes,
        'resolved_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('id', alertId);
}
