import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/vehicle.dart';

/// Vehicle assigned to the current user
final myVehicleProvider = FutureProvider<Vehicle?>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final data = await SupabaseService.client
      .from('vehicles')
      .select()
      .eq('assigned_to', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

  if (data == null) return null;
  return Vehicle.fromJson(data);
});

/// Today's pre-start check for the current user
final todayCheckProvider = FutureProvider<VehicleCheck?>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final today = DateTime.now().toIso8601String().split('T').first;
  final data = await SupabaseService.client
      .from('vehicle_checks')
      .select()
      .eq('user_id', user.id)
      .eq('check_date', today)
      .order('created_at', ascending: false)
      .limit(1)
      .maybeSingle();

  if (data == null) return null;
  return VehicleCheck.fromJson(data);
});

/// Whether the pre-start check is required (not completed today)
final preStartRequiredProvider = FutureProvider<bool>((ref) async {
  final check = await ref.watch(todayCheckProvider.future);
  return check == null;
});

/// Recent fuel logs for the user's vehicle
final fuelLogsProvider = FutureProvider<List<FuelLog>>((ref) async {
  final vehicle = await ref.watch(myVehicleProvider.future);
  if (vehicle == null) return [];

  final data = await SupabaseService.client
      .from('fuel_logs')
      .select()
      .eq('vehicle_id', vehicle.id)
      .order('fuel_date', ascending: false)
      .limit(20);

  return (data as List).map((r) => FuelLog.fromJson(r as Map<String, dynamic>)).toList();
});

/// Submit pre-start check
Future<VehicleCheck?> submitVehicleCheck({
  required String vehicleId,
  required int odometerKm,
  required List<CheckItem> items,
  String? notes,
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

  final hasFail = items.any((i) => !i.passed);
  final hasCritical = items.any((i) => !i.passed && i.severity == 'critical');
  final status = hasCritical ? 'failed' : (hasFail ? 'partial' : 'passed');

  final row = await SupabaseService.client.from('vehicle_checks').insert({
    'organization_id': orgId,
    'vehicle_id': vehicleId,
    'user_id': user.id,
    'odometer_km': odometerKm,
    'status': status,
    'items': items.map((i) => i.toJson()).toList(),
    'notes': notes,
    'signed_at': DateTime.now().toIso8601String(),
  }).select().single();

  // Update vehicle odometer
  await SupabaseService.client
      .from('vehicles')
      .update({'odometer_km': odometerKm, 'updated_at': DateTime.now().toIso8601String()})
      .eq('id', vehicleId);

  return VehicleCheck.fromJson(row);
}

/// Log fuel
Future<FuelLog?> logFuel({
  required String vehicleId,
  required double litres,
  required double cost,
  String? stationName,
  String? receiptUrl,
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

  final row = await SupabaseService.client.from('fuel_logs').insert({
    'organization_id': orgId,
    'vehicle_id': vehicleId,
    'user_id': user.id,
    'litres': litres,
    'cost': cost,
    'price_per_litre': litres > 0 ? cost / litres : 0,
    'station_name': stationName,
    'receipt_url': receiptUrl,
  }).select().single();

  return FuelLog.fromJson(row);
}
