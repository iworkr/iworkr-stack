import 'dart:async';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  bool _tracking = false;

  LocationService(this._db);

  bool get isTracking => _tracking;

  /// Start tracking — only when clocked in.
  Future<void> startTracking() async {
    if (_tracking) return;
    _tracking = true;
    // INCOMPLETE:PARTIAL — startTracking only sets up sync timers but never starts GPS listening; no Geolocator.getPositionStream() or background geolocation plugin integration.

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

  Future<void> _recordHeartbeat() async {
    // INCOMPLETE:PARTIAL — _recordHeartbeat is an empty stub; heartbeat GPS pings are never actually recorded.
    // Heartbeat pings are recorded as zero-speed points
    // to prove the service is alive during stationary periods.
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
