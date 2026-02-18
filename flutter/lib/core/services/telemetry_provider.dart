import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/telemetry_event.dart';

/// Telemetry events for a specific job (activity stream)
final jobTelemetryProvider =
    FutureProvider.family<List<TelemetryEvent>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('telemetry_events')
      .select()
      .eq('job_id', jobId)
      .order('timestamp', ascending: false)
      .limit(50);

  return (data as List)
      .map((e) => TelemetryEvent.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Log a telemetry event for forensic tracking
Future<void> logTelemetryEvent({
  required String jobId,
  required String eventType,
  Map<String, dynamic> eventData = const {},
  double? lat,
  double? lng,
  double? accuracy,
  double? altitude,
  String? connectionType,
  String? deviceModel,
  String? osVersion,
  double? batteryLevel,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

  if (orgRow == null) return;
  final orgId = orgRow['organization_id'] as String;

  await SupabaseService.client.from('telemetry_events').insert({
    'organization_id': orgId,
    'job_id': jobId,
    'user_id': user.id,
    'event_type': eventType,
    'event_data': eventData,
    'timestamp': DateTime.now().toUtc().toIso8601String(),
    'location_lat': lat,
    'location_lng': lng,
    'location_accuracy': accuracy,
    'location_altitude': altitude,
    'connection_type': connectionType,
    'device_model': deviceModel,
    'os_version': osVersion,
    'battery_level': batteryLevel,
    'session_id': user.id,
  });
}
