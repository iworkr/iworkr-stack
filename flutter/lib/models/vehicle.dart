/// Vehicle — fleet registry entry.
///
/// Mirrors Supabase `vehicles` table.
class Vehicle {
  final String id;
  final String organizationId;
  final String name;
  final String? registration;
  final String? make;
  final String? model;
  final int? year;
  final String? vin;
  final String? assignedTo;
  final int odometerKm;
  final int serviceIntervalKm;
  final int lastServiceKm;
  final DateTime? lastServiceDate;
  final String status;
  final DateTime createdAt;

  const Vehicle({
    required this.id,
    required this.organizationId,
    required this.name,
    this.registration,
    this.make,
    this.model,
    this.year,
    this.vin,
    this.assignedTo,
    this.odometerKm = 0,
    this.serviceIntervalKm = 10000,
    this.lastServiceKm = 0,
    this.lastServiceDate,
    this.status = 'active',
    required this.createdAt,
  });

  int get kmSinceService => odometerKm - lastServiceKm;
  int get kmToService => serviceIntervalKm - kmSinceService;
  bool get serviceOverdue => kmToService <= 0;
  bool get serviceSoon => kmToService > 0 && kmToService < 500;

  double get healthPercent {
    if (serviceIntervalKm <= 0) return 1.0;
    return (1.0 - (kmSinceService / serviceIntervalKm)).clamp(0.0, 1.0);
  }

  String get displayName => '$name${registration != null ? ' ($registration)' : ''}';

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      name: json['name'] as String? ?? '',
      registration: json['registration'] as String?,
      make: json['make'] as String?,
      model: json['model'] as String?,
      year: json['year'] as int?,
      vin: json['vin'] as String?,
      assignedTo: json['assigned_to'] as String?,
      odometerKm: json['odometer_km'] as int? ?? 0,
      serviceIntervalKm: json['service_interval_km'] as int? ?? 10000,
      lastServiceKm: json['last_service_km'] as int? ?? 0,
      lastServiceDate: json['last_service_date'] != null
          ? DateTime.tryParse(json['last_service_date'] as String)
          : null,
      status: json['status'] as String? ?? 'active',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// Vehicle Check — daily pre-start inspection.
///
/// Mirrors Supabase `vehicle_checks`.
class VehicleCheck {
  final String id;
  final String organizationId;
  final String vehicleId;
  final String userId;
  final DateTime checkDate;
  final int? odometerKm;
  final String status; // passed, failed, partial
  final List<CheckItem> items;
  final String? notes;
  final DateTime? signedAt;
  final DateTime createdAt;

  const VehicleCheck({
    required this.id,
    required this.organizationId,
    required this.vehicleId,
    required this.userId,
    required this.checkDate,
    this.odometerKm,
    required this.status,
    this.items = const [],
    this.notes,
    this.signedAt,
    required this.createdAt,
  });

  bool get isPassed => status == 'passed';
  bool get hasCriticalFault => items.any((i) => i.failed && i.severity == 'critical');

  factory VehicleCheck.fromJson(Map<String, dynamic> json) {
    final itemsRaw = json['items'] as List<dynamic>? ?? [];
    return VehicleCheck(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      vehicleId: json['vehicle_id'] as String,
      userId: json['user_id'] as String,
      checkDate: DateTime.tryParse(json['check_date'] as String? ?? '') ?? DateTime.now(),
      odometerKm: json['odometer_km'] as int?,
      status: json['status'] as String? ?? 'passed',
      items: itemsRaw.map((i) => CheckItem.fromJson(i as Map<String, dynamic>)).toList(),
      notes: json['notes'] as String?,
      signedAt: json['signed_at'] != null ? DateTime.tryParse(json['signed_at'] as String) : null,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// A single check item in the pre-start inspection
class CheckItem {
  final String area;     // e.g. 'tires', 'lights', 'brakes', 'fluids'
  final bool passed;
  final String? severity; // minor, major, critical
  final String? notes;
  final String? photoUrl;

  const CheckItem({
    required this.area,
    required this.passed,
    this.severity,
    this.notes,
    this.photoUrl,
  });

  bool get failed => !passed;

  factory CheckItem.fromJson(Map<String, dynamic> json) {
    return CheckItem(
      area: json['area'] as String? ?? '',
      passed: json['passed'] as bool? ?? true,
      severity: json['severity'] as String?,
      notes: json['notes'] as String?,
      photoUrl: json['photo_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'area': area,
        'passed': passed,
        'severity': severity,
        'notes': notes,
        'photo_url': photoUrl,
      };
}

/// Fuel Log — receipt entry.
class FuelLog {
  final String id;
  final String organizationId;
  final String vehicleId;
  final String userId;
  final double? litres;
  final double? cost;
  final double? pricePerLitre;
  final String? stationName;
  final String? receiptUrl;
  final DateTime fuelDate;
  final DateTime createdAt;

  const FuelLog({
    required this.id,
    required this.organizationId,
    required this.vehicleId,
    required this.userId,
    this.litres,
    this.cost,
    this.pricePerLitre,
    this.stationName,
    this.receiptUrl,
    required this.fuelDate,
    required this.createdAt,
  });

  String get costLabel => cost != null ? '\$${cost!.toStringAsFixed(2)}' : '--';
  String get litresLabel => litres != null ? '${litres!.toStringAsFixed(1)}L' : '--';

  factory FuelLog.fromJson(Map<String, dynamic> json) {
    return FuelLog(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      vehicleId: json['vehicle_id'] as String,
      userId: json['user_id'] as String,
      litres: (json['litres'] as num?)?.toDouble(),
      cost: (json['cost'] as num?)?.toDouble(),
      pricePerLitre: (json['price_per_litre'] as num?)?.toDouble(),
      stationName: json['station_name'] as String?,
      receiptUrl: json['receipt_url'] as String?,
      fuelDate: DateTime.tryParse(json['fuel_date'] as String? ?? '') ?? DateTime.now(),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
