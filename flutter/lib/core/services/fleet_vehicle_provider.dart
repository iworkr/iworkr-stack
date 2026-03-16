import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

class ShiftVehicleBooking {
  final String id;
  final String vehicleId;
  final String status;
  final double? checkoutOdometer;
  final double? currentOdometer;
  final String? vehicleName;
  final String? registrationNumber;

  const ShiftVehicleBooking({
    required this.id,
    required this.vehicleId,
    required this.status,
    this.checkoutOdometer,
    this.currentOdometer,
    this.vehicleName,
    this.registrationNumber,
  });

  factory ShiftVehicleBooking.fromJson(Map<String, dynamic> json) {
    final vehicle = (json['fleet_vehicles'] as Map?)?.cast<String, dynamic>();
    return ShiftVehicleBooking(
      id: (json['id'] ?? '').toString(),
      vehicleId: (json['vehicle_id'] ?? '').toString(),
      status: (json['status'] ?? 'scheduled').toString(),
      checkoutOdometer: (json['checkout_odometer'] as num?)?.toDouble(),
      currentOdometer: (vehicle?['current_odometer'] as num?)?.toDouble(),
      vehicleName: vehicle?['name']?.toString(),
      registrationNumber: vehicle?['registration_number']?.toString(),
    );
  }
}

Future<ShiftVehicleBooking?> fetchShiftVehicleBooking(String shiftId) async {
  final row = await SupabaseService.client
      .from('vehicle_bookings')
      .select('id, vehicle_id, status, checkout_odometer, fleet_vehicles(name, registration_number, current_odometer)')
      .eq('shift_id', shiftId)
      .inFilter('status', ['scheduled', 'checked_out'])
      .order('created_at')
      .limit(1)
      .maybeSingle();
  if (row == null) return null;
  return ShiftVehicleBooking.fromJson(row);
}

Future<void> checkoutVehicleBooking({
  required String bookingId,
  required double odometer,
  required bool hasDefects,
  required int? fuelLevelPercent,
  required Map<String, dynamic> inspectionData,
}) async {
  final userId = Supabase.instance.client.auth.currentUser?.id;
  if (userId == null) throw Exception('Unauthorized');
  final nowIso = DateTime.now().toUtc().toIso8601String();

  final booking = await SupabaseService.client
      .from('vehicle_bookings')
      .select('id, organization_id, vehicle_id, status')
      .eq('id', bookingId)
      .single();

  if ((booking['status'] ?? '').toString() != 'scheduled') {
    throw Exception('Booking is not in scheduled state');
  }

  await SupabaseService.client.from('vehicle_bookings').update({
    'status': 'checked_out',
    'checkout_time': nowIso,
    'checkout_odometer': odometer,
    'worker_id': userId,
  }).eq('id', bookingId);

  await SupabaseService.client.from('vehicle_inspections').insert({
    'organization_id': booking['organization_id'],
    'vehicle_id': booking['vehicle_id'],
    'booking_id': bookingId,
    'worker_id': userId,
    'inspection_type': 'checkout',
    'inspection_data': inspectionData,
    'has_defects': hasDefects,
    'fuel_level_percent': fuelLevelPercent,
  });

  await SupabaseService.client.from('fleet_vehicles').update({
    'status': hasDefects ? 'out_of_service_defect' : 'in_use',
    'current_odometer': odometer,
    'updated_at': nowIso,
  }).eq('id', booking['vehicle_id']);
}
