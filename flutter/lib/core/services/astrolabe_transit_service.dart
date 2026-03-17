import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Project Astrolabe — Transit Location Service
//
// Privacy-first GPS capture for NDIS Provider Travel auto-billing.
// We capture ONLY two discrete points: clock-out coordinate (Point A)
// and clock-in coordinate (Point B). We do NOT track the polyline
// route during PROVIDER_TRAVEL (worker privacy protection).
//
// For PARTICIPANT_TRANSPORT, we capture a continuous breadcrumb
// trail because the route is a client safety record.
// ═══════════════════════════════════════════════════════════════════════════

enum TransitType { providerTravel, participantTransport }

class TransitCapture {
  final double startLat;
  final double startLng;
  final DateTime startTime;
  final String? originShiftId;
  final TransitType transitType;

  const TransitCapture({
    required this.startLat,
    required this.startLng,
    required this.startTime,
    this.originShiftId,
    required this.transitType,
  });
}

class TransitResult {
  final bool ok;
  final String? claimId;
  final String? travelLogId;
  final String? status;
  final int? billableLaborMinutes;
  final double? billableNonLaborKm;
  final double? calculatedLaborCost;
  final double? calculatedNonLaborCost;
  final double? totalClaimValue;
  final String? flaggedReason;
  final String? error;

  const TransitResult({
    required this.ok,
    this.claimId,
    this.travelLogId,
    this.status,
    this.billableLaborMinutes,
    this.billableNonLaborKm,
    this.calculatedLaborCost,
    this.calculatedNonLaborCost,
    this.totalClaimValue,
    this.flaggedReason,
    this.error,
  });

  factory TransitResult.fromJson(Map<String, dynamic> json) {
    return TransitResult(
      ok: json['ok'] as bool? ?? false,
      claimId: json['claim_id'] as String?,
      travelLogId: json['travel_log_id'] as String?,
      status: json['status'] as String?,
      billableLaborMinutes: json['billable_labor_minutes'] as int?,
      billableNonLaborKm: (json['billable_non_labor_km'] as num?)?.toDouble(),
      calculatedLaborCost: (json['calculated_labor_cost'] as num?)?.toDouble(),
      calculatedNonLaborCost: (json['calculated_non_labor_cost'] as num?)?.toDouble(),
      totalClaimValue: (json['total_claim_value'] as num?)?.toDouble(),
      flaggedReason: json['flagged_reason'] as String?,
      error: json['error'] as String?,
    );
  }

  factory TransitResult.error(String message) =>
    TransitResult(ok: false, error: message);
}

/// Astrolabe Transit Location Service
///
/// Manages the lifecycle of GPS captures for inter-shift transit.
/// This service is instantiated per-transit and disposed after submission.
class AstrolabeTransitService {
  static final AstrolabeTransitService _instance = AstrolabeTransitService._internal();
  factory AstrolabeTransitService() => _instance;
  AstrolabeTransitService._internal();

  TransitCapture? _activeTransit;
  StreamSubscription<Position>? _participantTransportSub;
  final List<Map<String, double>> _breadcrumbs = [];

  bool get isTransiting => _activeTransit != null;
  TransitCapture? get activeTransit => _activeTransit;

  // ─── Permission Check ─────────────────────────────────────────────────────

  static Future<bool> ensureLocationPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  // ─── Capture start-point (Clock-Out event on Shift A) ────────────────────

  Future<TransitCapture?> captureTransitStart({
    required String? originShiftId,
    required TransitType transitType,
  }) async {
    final hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      debugPrint('[Astrolabe] Location permission denied');
      return null;
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      _activeTransit = TransitCapture(
        startLat: position.latitude,
        startLng: position.longitude,
        startTime: DateTime.now().toUtc(),
        originShiftId: originShiftId,
        transitType: transitType,
      );

      // For PARTICIPANT_TRANSPORT: start continuous breadcrumb tracking
      if (transitType == TransitType.participantTransport) {
        _startBreadcrumbTracking();
      }

      debugPrint('[Astrolabe] Transit start captured: ${position.latitude}, ${position.longitude}');
      return _activeTransit;
    } catch (e) {
      debugPrint('[Astrolabe] Failed to capture start position: $e');
      return null;
    }
  }

  // ─── Breadcrumb tracking (PARTICIPANT_TRANSPORT only) ────────────────────

  void _startBreadcrumbTracking() {
    _breadcrumbs.clear();
    _participantTransportSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 50, // capture every 50m of movement
      ),
    ).listen((position) {
      _breadcrumbs.add({'lat': position.latitude, 'lng': position.longitude});
      // Cap at 1000 points to prevent memory issues on long journeys
      if (_breadcrumbs.length > 1000) _breadcrumbs.removeAt(0);
    });
  }

  void _stopBreadcrumbTracking() {
    _participantTransportSub?.cancel();
    _participantTransportSub = null;
  }

  // ─── Submit transit (Clock-In event on Shift B) ───────────────────────────

  Future<TransitResult> submitTransit({
    required String organizationId,
    required String workerId,
    required String? destinationShiftId,
  }) async {
    final transit = _activeTransit;
    if (transit == null) {
      return TransitResult.error('No active transit to submit');
    }

    // Stop breadcrumb tracking immediately (privacy lifecycle)
    _stopBreadcrumbTracking();

    final hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      _reset();
      return TransitResult.error('Location permission denied');
    }

    try {
      // Capture end position (Clock-In at Shift B)
      final endPosition = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      final endTime = DateTime.now().toUtc();

      // Build encoded polyline for PARTICIPANT_TRANSPORT only
      String? routePolyline;
      if (transit.transitType == TransitType.participantTransport && _breadcrumbs.isNotEmpty) {
        routePolyline = _encodePolyline(_breadcrumbs);
      }

      // Build payload
      final payload = {
        'organization_id': organizationId,
        'worker_id': workerId,
        'transit_type': transit.transitType == TransitType.providerTravel
          ? 'PROVIDER_TRAVEL'
          : 'PARTICIPANT_TRANSPORT',
        'origin_shift_id': transit.originShiftId,
        'destination_shift_id': destinationShiftId,
        'start_lat': transit.startLat,
        'start_lng': transit.startLng,
        'end_lat': endPosition.latitude,
        'end_lng': endPosition.longitude,
        'device_start_time': transit.startTime.toIso8601String(),
        'device_end_time': endTime.toIso8601String(),
        if (routePolyline != null) 'route_polyline': routePolyline,
        'device_os': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        'app_version': '1.0.0',
      };

      // Post to Edge Function via Supabase client
      final session = SupabaseService.auth.currentSession;
      if (session == null) {
        _reset();
        return TransitResult.error('Not authenticated');
      }
      final response = await SupabaseService.client.functions.invoke(
        'process-transit',
        body: payload,
      );

      _reset();

      if (response.data == null) {
        return TransitResult.error('Empty response from transit engine');
      }

      final resultMap = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : json.decode(response.data.toString()) as Map<String, dynamic>;

      return TransitResult.fromJson(resultMap);
    } catch (e) {
      _reset();
      debugPrint('[Astrolabe] Transit submission error: $e');
      return TransitResult.error(e.toString());
    }
  }

  // ─── Cancel transit (worker cancelled between shifts) ────────────────────

  void cancelTransit() {
    _stopBreadcrumbTracking();
    _reset();
    debugPrint('[Astrolabe] Transit cancelled');
  }

  void _reset() {
    _activeTransit = null;
    _breadcrumbs.clear();
  }

  // ─── Simplified Polyline Encoder ──────────────────────────────────────────
  // Google's Encoded Polyline Algorithm Format
  String _encodePolyline(List<Map<String, double>> points) {
    final buffer = StringBuffer();
    int lastLat = 0, lastLng = 0;

    for (final point in points) {
      final lat = (point['lat']! * 1e5).round();
      final lng = (point['lng']! * 1e5).round();
      buffer.write(_encodeSingle(lat - lastLat));
      buffer.write(_encodeSingle(lng - lastLng));
      lastLat = lat;
      lastLng = lng;
    }

    return buffer.toString();
  }

  String _encodeSingle(int value) {
    int v = value < 0 ? ~(value << 1) : value << 1;
    final chunks = <int>[];
    while (v >= 0x20) {
      chunks.add((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    chunks.add(v + 63);
    return String.fromCharCodes(chunks);
  }
}
