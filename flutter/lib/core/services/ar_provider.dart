import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/ar_measurement.dart';

/// Recent AR measurements for the current user
final arMeasurementsProvider = FutureProvider<List<ARMeasurement>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('ar_measurements')
      .select()
      .eq('user_id', user.id)
      .order('created_at', ascending: false)
      .limit(30);

  return (data as List)
      .map((m) => ARMeasurement.fromJson(m as Map<String, dynamic>))
      .toList();
});

/// Measurements for a specific job
final jobMeasurementsProvider =
    FutureProvider.family<List<ARMeasurement>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('ar_measurements')
      .select()
      .eq('job_id', jobId)
      .order('created_at', ascending: false);

  return (data as List)
      .map((m) => ARMeasurement.fromJson(m as Map<String, dynamic>))
      .toList();
});

/// Save an AR measurement
Future<ARMeasurement?> saveMeasurement({
  required String measurementType,
  required double value,
  String unit = 'm',
  List<Map<String, dynamic>> points = const [],
  String? jobId,
  String? notes,
  double? accuracyCm,
  bool usedLidar = false,
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

  final row = await SupabaseService.client.from('ar_measurements').insert({
    'organization_id': orgId,
    'user_id': user.id,
    'job_id': jobId,
    'measurement_type': measurementType,
    'value': value,
    'unit': unit,
    'points': points,
    'notes': notes,
    'accuracy_cm': accuracyCm,
    'used_lidar': usedLidar,
  }).select().single();

  return ARMeasurement.fromJson(row);
}
