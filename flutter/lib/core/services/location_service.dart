import 'dart:async';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:uuid/uuid.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/timeclock_provider.dart';

const _uuid = Uuid();

// ═══════════════════════════════════════════════════════════
// ── Location Service — Clock-In Gated GPS Tracking ───────
// ═══════════════════════════════════════════════════════════
//
// GPS tracking is STRICTLY tied to the is_clocked_in state.
// When the user clocks out, tracking is completely killed.
// Telemetry logs are batched locally and synced every 60 seconds.
//
// NOTE: This is a lightweight wrapper. For full background tracking
// in production, integrate `flutter_background_geolocation` by
// Transistor Software, which handles OS-level lifecycle, permissions,
// and battery optimization natively. This service provides the
// app-level gating and telemetry logging infrastructure.

class LocationService {
  final AppDatabase _db;
  Timer? _syncTimer;
  Timer? _heartbeatTimer;
  StreamSubscription<Position>? _positionSub;
  bool _tracking = false;

  LocationService(this._db);

  bool get isTracking => _tracking;

  /// Start tracking — only when clocked in.
  Future<void> startTracking() async {
    if (_tracking) return;
    _tracking = true;

    // Request location permission if needed
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _tracking = false;
        return;
      }
    }

    // Start GPS position stream
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // meters — only report when moved 10m+
      ),
    ).listen((position) {
      recordPoint(
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed * 3.6, // m/s → km/h
        heading: position.heading,
        accuracy: position.accuracy,
        isMock: position.isMocked,
      );
    });

    _syncTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => syncTelemetryBatch(),
    );

    _heartbeatTimer = Timer.periodic(
      const Duration(minutes: 15),
      (_) => _recordHeartbeat(),
    );
  }

  /// Kill tracking — called on clock out.
  void stopTracking() {
    _tracking = false;
    _positionSub?.cancel();
    _positionSub = null;
    _syncTimer?.cancel();
    _heartbeatTimer?.cancel();
    _syncTimer = null;
    _heartbeatTimer = null;
  }

  /// Record a GPS point to the local database.
  Future<void> recordPoint({
    required double latitude,
    required double longitude,
    double? speed,
    double? heading,
    double? accuracy,
    int? battery,
    bool isMock = false,
  }) async {
    if (!_tracking) return;

    await _db.insertTelemetry(TelemetryLogsCompanion(
      id: Value(_uuid.v4()),
      timestampUtc: Value(DateTime.now().toUtc()),
      latitude: Value(latitude),
      longitude: Value(longitude),
      speedKmh: Value(speed),
      heading: Value(heading),
      accuracyMeters: Value(accuracy),
      batteryLevel: Value(battery),
      isMockLocation: Value(isMock),
    ));
  }

  /// Record a heartbeat GPS ping (zero-speed point) to prove the service
  /// is alive during stationary periods.
  Future<void> _recordHeartbeat() async {
    if (!_tracking) return;
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      );
      await recordPoint(
        latitude: position.latitude,
        longitude: position.longitude,
        speed: 0,
        heading: position.heading,
        accuracy: position.accuracy,
        isMock: position.isMocked,
      );
    } catch (_) {
      // Heartbeat is best-effort — don't crash tracking on failure
    }
  }

  /// Sync unsynced telemetry to Supabase in batches.
  Future<void> syncTelemetryBatch() async {
    try {
      final points = await _db.unsyncedTelemetry(limit: 50);
      if (points.isEmpty) return;

      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) return;

      final rows = points.map((p) => {
        'user_id': userId,
        'timestamp_utc': p.timestampUtc.toIso8601String(),
        'latitude': p.latitude,
        'longitude': p.longitude,
        'speed_kmh': p.speedKmh,
        'heading': p.heading,
        'accuracy_meters': p.accuracyMeters,
        'battery_level': p.batteryLevel,
        'is_mock_location': p.isMockLocation,
      }).toList();

      await SupabaseService.client.from('telemetry_logs').insert(rows);
      await _db.markTelemetrySynced(points.map((p) => p.id).toList());
    } catch (_) {}
  }

  void dispose() {
    stopTracking();
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final locationServiceProvider = Provider<LocationService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  final service = LocationService(db);
  ref.onDispose(() => service.dispose());
  return service;
});

/// Whether the user is currently clocked in (reactive).
final isClockedInProvider = FutureProvider<bool>((ref) async {
  final entry = await ref.watch(activeTimeEntryProvider.future);
  return entry != null;
});
