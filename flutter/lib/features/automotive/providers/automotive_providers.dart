import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/automotive/models/automotive_models.dart';
import 'package:iworkr_mobile/features/automotive/services/automotive_bridge_service.dart';

// ============================================================================
// Project Outrider — Riverpod Providers
// ============================================================================

/// Whether the device is currently connected to CarPlay/Android Auto.
/// The Safe Driving Mode overlay listens to this.
final automotiveConnectionProvider =
    StateProvider<AutomotiveConnectionState>((ref) {
  return AutomotiveConnectionState.disconnected;
});

/// The shift/job ID currently focused on the car display.
/// Used for seamless handoff when disconnecting.
final focusedCarShiftProvider = StateProvider<String?>((ref) => null);

/// The GoRouter path to navigate to after car disconnect (handoff).
final handoffRouteProvider = StateProvider<String?>((ref) => null);

/// The currently checked-out fleet vehicle ID (if any).
final activeVehicleProvider = StateProvider<String?>((ref) => null);

/// User's automotive preferences from Supabase.
final automotivePrefsProvider =
    FutureProvider<AutomotivePreferences>((ref) async {
  final client = SupabaseService.client;
  final user = client.auth.currentUser;
  if (user == null) return const AutomotivePreferences();

  final response = await client
      .from('user_automotive_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

  if (response == null) return const AutomotivePreferences();
  return AutomotivePreferences.fromJson(response);
});

/// The automotive bridge service singleton (initialized in main.dart).
final automotiveBridgeProvider = Provider<AutomotiveBridgeService>((ref) {
  return AutomotiveBridgeService(ref);
});

/// Telemetry buffer — stores GPS points during a car session.
/// Flushed to Supabase on disconnect.
final telemetryBufferProvider =
    StateNotifierProvider<TelemetryBufferNotifier, List<TelemetryPoint>>((ref) {
  return TelemetryBufferNotifier();
});

class TelemetryBufferNotifier extends StateNotifier<List<TelemetryPoint>> {
  TelemetryBufferNotifier() : super([]);

  void addPoint(TelemetryPoint point) {
    state = [...state, point];
  }

  void clear() {
    state = [];
  }

  /// Calculate total distance from buffered points (Haversine)
  double get totalDistanceKm {
    if (state.length < 2) return 0;
    double total = 0;
    for (int i = 1; i < state.length; i++) {
      total += _haversine(
        state[i - 1].lat,
        state[i - 1].lng,
        state[i].lat,
        state[i].lng,
      );
    }
    return total;
  }

  double get maxSpeedKmh {
    if (state.isEmpty) return 0;
    return state.map((p) => p.speedKmh).reduce((a, b) => a > b ? a : b);
  }

  double get avgSpeedKmh {
    if (state.isEmpty) return 0;
    return state.map((p) => p.speedKmh).reduce((a, b) => a + b) / state.length;
  }

  static double _haversine(
      double lat1, double lng1, double lat2, double lng2) {
    const r = 6371.0; // Earth radius in km
    final dLat = _toRad(lat2 - lat1);
    final dLng = _toRad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRad(lat1)) * math.cos(_toRad(lat2)) *
        math.sin(dLng / 2) * math.sin(dLng / 2);
    return 2 * r * math.asin(math.sqrt(a));
  }

  static double _toRad(double deg) => deg * math.pi / 180;
}
