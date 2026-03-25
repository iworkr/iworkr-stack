import 'dart:async';

import 'package:geolocator/geolocator.dart';

class LocationAccuracyException implements Exception {
  final String message;
  final double accuracy;
  LocationAccuracyException(this.message, this.accuracy);
  @override
  String toString() => 'LocationAccuracyException: $message (accuracy: ${accuracy}m)';
}

class MockLocationException implements Exception {
  final String message;
  MockLocationException(this.message);
  @override
  String toString() => 'MockLocationException: $message';
}

class LocationService {
  static const double maxAccuracyThreshold = 100.0;

  static Future<bool> checkPermissions() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  /// Acquire a high-accuracy GPS position.
  /// Throws [LocationAccuracyException] if signal is too weak (>100m radius).
  /// Throws [MockLocationException] if a fake GPS app is detected.
  static Future<Position> getHighAccuracyPosition({
    double accuracyThreshold = maxAccuracyThreshold,
    Duration timeout = const Duration(seconds: 15),
  }) async {
    final hasPermission = await checkPermissions();
    if (!hasPermission) {
      throw LocationAccuracyException(
        'Location permissions not granted. Please enable location services.',
        double.infinity,
      );
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
      ),
    ).timeout(
      timeout,
      onTimeout: () => throw LocationAccuracyException(
        'GPS timeout — could not acquire satellite lock within ${timeout.inSeconds}s. Move to open sky.',
        double.infinity,
      ),
    );

    if (position.isMocked) {
      throw MockLocationException(
        'Mock location detected. Disable GPS spoofing applications to continue.',
      );
    }

    if (position.accuracy > accuracyThreshold) {
      throw LocationAccuracyException(
        'GPS signal too weak (${position.accuracy.toStringAsFixed(0)}m accuracy). '
        'Step outside or wait for a better satellite lock.',
        position.accuracy,
      );
    }

    return position;
  }

  /// Calculate Haversine distance between two coordinates in meters.
  static double haversineDistance(
    double lat1, double lng1,
    double lat2, double lng2,
  ) {
    return Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
  }
}
