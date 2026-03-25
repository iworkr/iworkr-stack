import 'package:geolocator/geolocator.dart';

import 'location_service.dart';
import 'ntp_service.dart';

/// Result of a spatial gate check.
class SpatialGateResult {
  final bool passed;
  final int distanceMeters;
  final double accuracy;
  final double workerLat;
  final double workerLng;
  final double jobLat;
  final double jobLng;
  final DateTime trueTime;
  final int clockOffsetMs;
  final String? failureReason;

  const SpatialGateResult({
    required this.passed,
    required this.distanceMeters,
    required this.accuracy,
    required this.workerLat,
    required this.workerLng,
    required this.jobLat,
    required this.jobLng,
    required this.trueTime,
    required this.clockOffsetMs,
    this.failureReason,
  });
}

class SpatialGateService {
  static const int geofenceRadiusMeters = 150;

  /// Perform the full spatial + temporal gate for clock-in or clock-out.
  ///
  /// Returns a [SpatialGateResult] with `passed = true` if within the geofence,
  /// or `passed = false` with distance and failure metadata for the override flow.
  static Future<SpatialGateResult> checkGate({
    required double jobLat,
    required double jobLng,
    int radiusMeters = geofenceRadiusMeters,
  }) async {
    final Position position = await LocationService.getHighAccuracyPosition();

    final ntpNow = NtpService.instance.now;
    final clockOffset = NtpService.instance.offset.inMilliseconds;

    final distanceMeters = Geolocator.distanceBetween(
      position.latitude,
      position.longitude,
      jobLat,
      jobLng,
    ).round();

    final passed = distanceMeters <= radiusMeters;

    return SpatialGateResult(
      passed: passed,
      distanceMeters: distanceMeters,
      accuracy: position.accuracy,
      workerLat: position.latitude,
      workerLng: position.longitude,
      jobLat: jobLat,
      jobLng: jobLng,
      trueTime: ntpNow,
      clockOffsetMs: clockOffset,
      failureReason: passed
          ? null
          : 'Worker is ${_formatDistance(distanceMeters)} from the job site '
              '(limit: ${radiusMeters}m).',
    );
  }

  static String _formatDistance(int meters) {
    if (meters >= 1000) {
      return '${(meters / 1000).toStringAsFixed(1)} km';
    }
    return '${meters}m';
  }
}
