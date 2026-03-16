import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

class ShiftRoutineTask {
  final String id;
  final String title;
  final String status;
  final String taskType;
  final bool isMandatory;
  final bool isCritical;
  final String? facilityId;
  final String? participantId;
  final DateTime? scheduledForAt;
  final Map<String, dynamic> evidenceData;

  const ShiftRoutineTask({
    required this.id,
    required this.title,
    required this.status,
    required this.taskType,
    required this.isMandatory,
    required this.isCritical,
    required this.facilityId,
    required this.participantId,
    required this.scheduledForAt,
    required this.evidenceData,
  });

  factory ShiftRoutineTask.fromJson(Map<String, dynamic> json) {
    return ShiftRoutineTask(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? 'Task',
      status: (json['status'] as String?) ?? 'pending',
      taskType: (json['task_type'] as String?) ?? 'checkbox',
      isMandatory: json['is_mandatory'] == true,
      isCritical: json['is_critical'] == true,
      facilityId: json['facility_id'] as String?,
      participantId: json['participant_id'] as String?,
      scheduledForAt: json['scheduled_for_at'] != null
          ? DateTime.tryParse(json['scheduled_for_at'] as String)
          : null,
      evidenceData: (json['evidence_data'] as Map?)?.cast<String, dynamic>() ?? {},
    );
  }
}

class ShiftRoutineBundle {
  final String shiftId;
  final String organizationId;
  final String? participantId;
  final String? facilityId;
  final DateTime shiftStart;
  final List<ShiftRoutineTask> tasks;

  const ShiftRoutineBundle({
    required this.shiftId,
    required this.organizationId,
    required this.participantId,
    required this.facilityId,
    required this.shiftStart,
    required this.tasks,
  });

  int get completedCount =>
      tasks.where((t) => t.status == 'completed' || t.status == 'exempted').length;
  int get pendingCount => tasks.where((t) => t.status == 'pending').length;
  int get pendingMandatoryCount =>
      tasks.where((t) => t.status == 'pending' && t.isMandatory).length;
}

Future<ShiftRoutineBundle> fetchShiftRoutineBundle(String shiftId) async {
  final shift = await SupabaseService.client
      .from('schedule_blocks')
      .select('id, organization_id, participant_id, facility_id, start_time')
      .eq('id', shiftId)
      .single();

  final organizationId = shift['organization_id'] as String;
  final participantId = shift['participant_id'] as String?;
  final facilityId = shift['facility_id'] as String?;
  final shiftStart = DateTime.parse(shift['start_time'] as String);
  final targetDate = shiftStart.toIso8601String().split('T').first;

  final orClauses = <String>['shift_id.eq.$shiftId'];
  if (participantId != null) orClauses.add('participant_id.eq.$participantId');
  if (facilityId != null) orClauses.add('facility_id.eq.$facilityId');

  final rows = await SupabaseService.client
      .from('task_instances')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('target_date', targetDate)
      .or(orClauses.join(','))
      .order('scheduled_for_at', ascending: true);

  final tasks = (rows as List)
      .whereType<Map<String, dynamic>>()
      .map(ShiftRoutineTask.fromJson)
      .toList(growable: false);

  return ShiftRoutineBundle(
    shiftId: shiftId,
    organizationId: organizationId,
    participantId: participantId,
    facilityId: facilityId,
    shiftStart: shiftStart,
    tasks: tasks,
  );
}

final shiftRoutineBundleProvider =
    FutureProvider.family<ShiftRoutineBundle, String>((ref, shiftId) async {
  return fetchShiftRoutineBundle(shiftId);
});

Future<void> completeRoutineTask({
  required String taskInstanceId,
  Map<String, dynamic>? evidenceData,
}) async {
  await SupabaseService.client.rpc('complete_task_instance', params: {
    'p_task_instance_id': taskInstanceId,
    'p_evidence_data': evidenceData ?? <String, dynamic>{},
  });
}

Future<void> exemptRoutineTask({
  required String taskInstanceId,
  required String reason,
  String? note,
}) async {
  await SupabaseService.client.rpc('exempt_task_instance', params: {
    'p_task_instance_id': taskInstanceId,
    'p_reason': reason,
    'p_note': note,
  });
}

Future<void> createAdHocRoutineTask({
  required String organizationId,
  required String shiftId,
  required String title,
  String? facilityId,
  String? participantId,
}) async {
  await SupabaseService.client.rpc('create_ad_hoc_task_instance', params: {
    'p_organization_id': organizationId,
    'p_shift_id': shiftId,
    'p_title': title,
    'p_facility_id': facilityId,
    'p_participant_id': participantId,
    'p_task_type': 'checkbox',
  });
}

Future<Map<String, dynamic>> getShiftMandatoryTaskGateStatus(String shiftId) async {
  final data = await SupabaseService.client
      .rpc('get_shift_mandatory_task_gate', params: {'p_shift_id': shiftId});
  return (data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
}

Future<String?> uploadTaskEvidencePhoto({
  required String organizationId,
  required String taskInstanceId,
  required Uint8List bytes,
}) async {
  final path = '$organizationId/tasks/$taskInstanceId/${DateTime.now().millisecondsSinceEpoch}.jpg';
  await SupabaseService.client.storage
      .from('evidence')
      .uploadBinary(path, bytes, fileOptions: const FileOptions(contentType: 'image/jpeg'));
  return SupabaseService.client.storage.from('evidence').getPublicUrl(path);
}

RealtimeChannel subscribeRoutineRealtime({
  required String channelName,
  required String organizationId,
  required void Function() onAnyChange,
}) {
  return SupabaseService.client
      .channel(channelName)
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'task_instances',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: organizationId,
        ),
        callback: (_) => onAnyChange(),
      )
      .subscribe();
}

final activeShiftTaskGateProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final activeShift = ref.watch(activeShiftProvider);
  if (activeShift == null) return <String, dynamic>{};
  return getShiftMandatoryTaskGateStatus(activeShift.id);
});
