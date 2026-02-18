import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/iot_device.dart';

/// All registered IoT devices for the org
final iotDevicesProvider = FutureProvider<List<IoTDevice>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('iot_devices')
      .select()
      .eq('organization_id', orgId)
      .inFilter('status', ['active', 'paired'])
      .order('last_seen_at', ascending: false);

  return (data as List)
      .map((d) => IoTDevice.fromJson(d as Map<String, dynamic>))
      .toList();
});

/// Recent readings for a specific device
final deviceReadingsProvider =
    FutureProvider.family<List<IoTReading>, String>((ref, deviceId) async {
  final data = await SupabaseService.client
      .from('iot_readings')
      .select()
      .eq('device_id', deviceId)
      .order('recorded_at', ascending: false)
      .limit(100);

  return (data as List)
      .map((r) => IoTReading.fromJson(r as Map<String, dynamic>))
      .toList();
});

/// Save a new reading
Future<IoTReading?> saveReading({
  required String deviceId,
  required String readingType,
  required double value,
  required String unit,
  String? jobId,
  double? minThreshold,
  double? maxThreshold,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;
  final orgId = orgRow['organization_id'] as String;

  final alertTriggered =
      (maxThreshold != null && value > maxThreshold) ||
      (minThreshold != null && value < minThreshold);

  final row = await SupabaseService.client.from('iot_readings').insert({
    'organization_id': orgId,
    'device_id': deviceId,
    'job_id': jobId,
    'user_id': user.id,
    'reading_type': readingType,
    'value': value,
    'unit': unit,
    'min_threshold': minThreshold,
    'max_threshold': maxThreshold,
    'alert_triggered': alertTriggered,
  }).select().single();

  // Update device last seen
  await SupabaseService.client
      .from('iot_devices')
      .update({'last_seen_at': DateTime.now().toIso8601String()})
      .eq('id', deviceId);

  return IoTReading.fromJson(row);
}

/// Register a new IoT device
Future<IoTDevice?> registerDevice({
  required String name,
  required String deviceType,
  String? macAddress,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;
  final orgId = orgRow['organization_id'] as String;

  final row = await SupabaseService.client.from('iot_devices').insert({
    'organization_id': orgId,
    'name': name,
    'device_type': deviceType,
    'mac_address': macAddress,
    'status': 'paired',
    'last_seen_at': DateTime.now().toIso8601String(),
  }).select().single();

  return IoTDevice.fromJson(row);
}
