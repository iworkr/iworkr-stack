import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/incident.dart';

// ═══════════════════════════════════════════════════════════
// ── Incident Reporting — Clinical Safety ─────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Incident reporting, tracking, and
// governance with realtime updates for care organizations.

/// All incidents for the organization (Realtime)
final incidentsStreamProvider = StreamProvider<List<Incident>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<Incident>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('incidents')
          .select('*, profiles!incidents_worker_id_fkey(full_name)')
          .eq('organization_id', orgId)
          .order('occurred_at', ascending: false)
          .limit(100);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) => Incident.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('incidents-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'incidents',
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

/// Open incidents only
final openIncidentsProvider = Provider<List<Incident>>((ref) {
  final all = ref.watch(incidentsStreamProvider).valueOrNull ?? [];
  return all.where((i) => i.isOpen).toList();
});

/// Incident stats
final incidentStatsProvider = Provider<IncidentStats>((ref) {
  final all = ref.watch(incidentsStreamProvider).valueOrNull ?? [];
  return IncidentStats(
    total: all.length,
    open: all.where((i) => i.isOpen).length,
    critical: all.where((i) => i.severity == IncidentSeverity.critical && i.isOpen).length,
    reported: all.where((i) => i.status == IncidentStatus.reported).length,
    underReview: all.where((i) => i.status == IncidentStatus.underReview).length,
    resolved: all.where((i) => i.status == IncidentStatus.resolved).length,
  );
});

class IncidentStats {
  final int total;
  final int open;
  final int critical;
  final int reported;
  final int underReview;
  final int resolved;
  const IncidentStats({
    this.total = 0,
    this.open = 0,
    this.critical = 0,
    this.reported = 0,
    this.underReview = 0,
    this.resolved = 0,
  });
}

// ── Mutations ────────────────────────────────────────────

Future<Incident?> createIncident({
  required String title,
  required String description,
  required IncidentCategory category,
  required IncidentSeverity severity,
  String? participantId,
  String? shiftId,
  String? location,
  DateTime? occurredAt,
  String? immediateActions,
  // Aegis SIRS fields
  bool isEmergencyServicesInvolved = false,
  bool isReportable = false,
  Map<String, dynamic>? incidentPayload,
  String? witnessDetails,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;

  final insertData = <String, dynamic>{
    'organization_id': orgRow['organization_id'],
    'worker_id': user.id,
    'title': title,
    'description': description,
    'category': category.value,
    'severity': severity.name,
    'status': 'reported',
    'participant_id': participantId,
    'shift_id': shiftId,
    'location': location,
    'occurred_at': (occurredAt ?? DateTime.now()).toUtc().toIso8601String(),
    'reported_at': DateTime.now().toUtc().toIso8601String(),
    'immediate_actions': immediateActions,
    'is_emergency_services_involved': isEmergencyServicesInvolved,
    'is_reportable': isReportable,
    'incident_payload': incidentPayload ?? <String, dynamic>{},
  };

  if (witnessDetails != null && witnessDetails.isNotEmpty) {
    insertData['witnesses'] = [{'details': witnessDetails}];
  }

  final data = await SupabaseService.client
      .from('incidents')
      .insert(insertData)
      .select('*, profiles!incidents_worker_id_fkey(full_name)')
      .single();

  final incident = Incident.fromJson(data);

  // Trigger Aegis SIRS Triage Router (fire-and-forget)
  try {
    await SupabaseService.client.functions.invoke(
      'aegis-triage-router',
      body: {
        'id': incident.id,
        'organization_id': orgRow['organization_id'],
        'category': category.value,
        'severity': severity.name,
        'is_emergency_services_involved': isEmergencyServicesInvolved,
        'is_reportable': isReportable,
        'occurred_at': insertData['occurred_at'],
        'reported_at': insertData['reported_at'],
        'incident_payload': incidentPayload ?? <String, dynamic>{},
      },
    );
  } catch (_) {
    // Non-fatal — incident is already saved, triage can be retried
  }

  return incident;
}

Future<void> updateIncidentStatus({
  required String incidentId,
  required IncidentStatus status,
  String? resolutionNotes,
}) async {
  await SupabaseService.client.from('incidents').update({
    'status': status.value,
    if (status == IncidentStatus.resolved) ...{
      'resolved_at': DateTime.now().toUtc().toIso8601String(),
      'resolution_notes': resolutionNotes,
    },
    if (status == IncidentStatus.underReview ||
        status == IncidentStatus.investigation)
      ...{
        'reviewed_by': SupabaseService.auth.currentUser?.id,
        'reviewed_at': DateTime.now().toUtc().toIso8601String(),
      },
  }).eq('id', incidentId);
}
