import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';

/// Project Outrider-Pulse — Live Dispatch Tracking Engine
///
/// State machine lifecycle:
///   DORMANT → INITIALIZING → ACTIVE → GEOFENCE_APPROACH → TERMINATED
///
/// Privacy guarantees:
///   1. GPS transmission suppressed until 500m from origin (Home Start Problem)
///   2. Auto-terminate at 150m geofence around destination
///   3. 4-hour TTL killswitch
///   4. Only active during explicit en-route state

enum TrackingState {
  dormant,
  initializing,
  active,
  geofenceApproach,
  terminated,
}

class TrackingSession {
  final String sessionId;
  final String token;
  final String trackingUrl;
  final double destinationLat;
  final double destinationLng;
  final double? originLat;
  final double? originLng;
  final String? clientName;
  final String? workerName;

  TrackingSession({
    required this.sessionId,
    required this.token,
    required this.trackingUrl,
    required this.destinationLat,
    required this.destinationLng,
    this.originLat,
    this.originLng,
    this.clientName,
    this.workerName,
  });
}

class TrackingDispatchService {
  StreamSubscription<Position>? _positionSub;
  Timer? _heartbeatTimer;
  Timer? _ttlTimer;
  TrackingSession? _currentSession;
  TrackingState _state = TrackingState.dormant;
  bool _originSuppressed = true;
  int _pingCount = 0;

  static const int _suppressDistanceMeters = 500;
  static const int _geofenceRadiusMeters = 150;
  static const int _geofenceApproachRadiusMeters = 500;
  static const int _distanceFilterMeters = 50;
  static const Duration _ttlDuration = Duration(hours: 4);
  static const Duration _heartbeatInterval = Duration(minutes: 5);

  TrackingState get state => _state;
  TrackingSession? get currentSession => _currentSession;
  bool get isTracking => _state == TrackingState.active || _state == TrackingState.geofenceApproach;

  /// Start tracking for a job — called when worker taps "En Route"
  ///
  /// 1. Gets current GPS coordinates
  /// 2. Calls outrider-en-route-notify Edge Function
  /// 3. Starts background location streaming to Supabase
  Future<TrackingSession?> startTracking({
    required String jobId,
    required String workerId,
    String? shiftId,
    String? vehicleId,
  }) async {
    if (_state != TrackingState.dormant && _state != TrackingState.terminated) {
      debugPrint('[Outrider] Cannot start: already in state $_state');
      return _currentSession;
    }

    _state = TrackingState.initializing;

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          _state = TrackingState.dormant;
          debugPrint('[Outrider] Location permission denied');
          return null;
        }
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      // Call outrider-en-route-notify Edge Function
      final response = await SupabaseService.client.functions.invoke(
        'outrider-en-route-notify',
        body: {
          if (shiftId != null) 'shift_id': shiftId else 'job_id': jobId,
          'worker_id': workerId,
          'target_status': 'EN_ROUTE',
          'current_lat': position.latitude,
          'current_lng': position.longitude,
          if (vehicleId != null) 'vehicle_id': vehicleId,
        },
      );

      final data = response.data;
      if (data == null || data['success'] != true) {
        _state = TrackingState.dormant;
        debugPrint('[Outrider] Edge function failed: ${data?['error']}');
        return null;
      }

      final sessionId = data['session_id'] as String?;
      final token = data['tracking_url']?.toString().split('/').last ?? '';

      if (sessionId == null) {
        _state = TrackingState.dormant;
        debugPrint('[Outrider] No session_id returned');
        return null;
      }

      // Determine destination from the Edge Function response or job data
      double destLat = 0;
      double destLng = 0;

      final jobData = await SupabaseService.client
          .from('jobs')
          .select('location_lat, location_lng, site_lat, site_lng')
          .eq('id', jobId)
          .maybeSingle();

      if (jobData != null) {
        destLat = (jobData['site_lat'] ?? jobData['location_lat'] ?? 0).toDouble();
        destLng = (jobData['site_lng'] ?? jobData['location_lng'] ?? 0).toDouble();
      }

      _currentSession = TrackingSession(
        sessionId: sessionId,
        token: token,
        trackingUrl: data['tracking_url'] ?? '',
        destinationLat: destLat,
        destinationLng: destLng,
        originLat: position.latitude,
        originLng: position.longitude,
        clientName: data['client_name'],
        workerName: data['worker_name'],
      );

      _originSuppressed = true;
      _pingCount = 0;
      _state = TrackingState.active;

      _startLocationStream();
      _startHeartbeat();
      _startTTLTimer();

      debugPrint('[Outrider] Tracking ACTIVE: session=$sessionId, SMS=${data['sms_sent'] == true ? 'SENT' : 'SKIPPED'}');

      return _currentSession;
    } catch (e) {
      _state = TrackingState.dormant;
      debugPrint('[Outrider] Start tracking error: $e');
      return null;
    }
  }

  /// Start GPS position stream
  void _startLocationStream() {
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: _distanceFilterMeters,
      ),
    ).listen(
      _onPositionUpdate,
      onError: (e) => debugPrint('[Outrider] GPS stream error: $e'),
    );
  }

  /// Process each GPS position update
  Future<void> _onPositionUpdate(Position position) async {
    if (!isTracking || _currentSession == null) return;

    final session = _currentSession!;

    // Privacy obfuscation: suppress if too close to origin
    if (_originSuppressed && session.originLat != null) {
      final distFromOrigin = _haversineDistance(
        position.latitude,
        position.longitude,
        session.originLat!,
        session.originLng!,
      );

      if (distFromOrigin < _suppressDistanceMeters) {
        debugPrint('[Outrider] Suppressed: ${distFromOrigin.toInt()}m from origin (need ${_suppressDistanceMeters}m)');
        return;
      }
      _originSuppressed = false;
      debugPrint('[Outrider] Origin suppression lifted at ${distFromOrigin.toInt()}m');
    }

    // Check geofence
    final distToDest = _haversineDistance(
      position.latitude,
      position.longitude,
      session.destinationLat,
      session.destinationLng,
    );

    // Auto-arrive at 150m
    if (distToDest < _geofenceRadiusMeters) {
      debugPrint('[Outrider] GEOFENCE BREACH: ${distToDest.toInt()}m — auto-arriving');
      await terminateTracking(reason: 'arrived');
      return;
    }

    // Geofence approach at 500m
    if (distToDest < _geofenceApproachRadiusMeters && _state == TrackingState.active) {
      _state = TrackingState.geofenceApproach;
      debugPrint('[Outrider] GEOFENCE APPROACH: ${distToDest.toInt()}m');
    }

    // Push telemetry to Supabase via RPC
    try {
      await SupabaseService.client.rpc('log_telemetry_ping', params: {
        'p_session_id': session.sessionId,
        'p_lat': position.latitude,
        'p_lng': position.longitude,
        'p_heading': position.heading,
        'p_speed': position.speed,
        'p_accuracy': position.accuracy,
        'p_altitude': position.altitude,
      });

      _pingCount++;

      if (_pingCount % 10 == 0) {
        debugPrint('[Outrider] Ping #$_pingCount — ${distToDest.toInt()}m to dest');
      }
    } catch (e) {
      debugPrint('[Outrider] Telemetry push error: $e');
    }
  }

  /// Heartbeat: send a position even when stationary
  void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) async {
      if (!isTracking) return;
      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
        );
        _onPositionUpdate(pos);
      } catch (e) {
        debugPrint('[Outrider] Heartbeat error: $e');
      }
    });
  }

  /// TTL killswitch: auto-terminate after 4 hours
  void _startTTLTimer() {
    _ttlTimer = Timer(_ttlDuration, () {
      debugPrint('[Outrider] TTL EXPIRED — force terminating');
      terminateTracking(reason: 'expired');
    });
  }

  /// Terminate tracking — called on "Arrived" tap, geofence, or TTL
  Future<void> terminateTracking({String reason = 'arrived'}) async {
    if (_state == TrackingState.terminated || _state == TrackingState.dormant) return;

    final sessionId = _currentSession?.sessionId;
    _state = TrackingState.terminated;

    _positionSub?.cancel();
    _positionSub = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _ttlTimer?.cancel();
    _ttlTimer = null;

    if (sessionId != null) {
      try {
        await SupabaseService.client.rpc('terminate_tracking_session', params: {
          'p_session_id': sessionId,
          'p_reason': reason,
        });
        debugPrint('[Outrider] Session TERMINATED: $reason (${_pingCount} pings)');
      } catch (e) {
        debugPrint('[Outrider] Terminate error: $e');
      }
    }

    _currentSession = null;
    _pingCount = 0;
    _originSuppressed = true;
    _state = TrackingState.dormant;
  }

  /// Haversine distance in meters
  double _haversineDistance(
    double lat1, double lon1,
    double lat2, double lon2,
  ) {
    const earthRadius = 6371000.0;
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) *
        sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  double _toRadians(double degrees) => degrees * pi / 180;

  void dispose() {
    terminateTracking(reason: 'app_disposed');
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final trackingDispatchServiceProvider = Provider<TrackingDispatchService>((ref) {
  final service = TrackingDispatchService();
  ref.onDispose(() => service.dispose());
  return service;
});

final trackingStateProvider = StateProvider<TrackingState>((ref) {
  return TrackingState.dormant;
});

final activeTrackingSessionProvider = StateProvider<TrackingSession?>((ref) {
  return null;
});
