import 'dart:convert';

import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

/// Google Maps API key — same key used by the Maps SDK (set in native configs).
const _kGoogleMapsKey = String.fromEnvironment(
  'GOOGLE_MAPS_API_KEY',
  defaultValue: 'AIzaSyCm2qIL3j_gV4SuQC3ycetFsNVX-NsWfwo',
);

/// Fetch road-following polyline points between an ordered list of [stops].
///
/// Calls the Google Directions API with driving mode and returns the decoded
/// overview polyline. Falls back to straight lines between stops if the API
/// call fails or no key is configured.
Future<List<LatLng>> fetchRoutePolyline(List<LatLng> stops) async {
  if (stops.length < 2) return stops;
  if (_kGoogleMapsKey.isEmpty) return stops;

  try {
    final origin = '${stops.first.latitude},${stops.first.longitude}';
    final destination = '${stops.last.latitude},${stops.last.longitude}';

    // Intermediate stops become waypoints
    String? waypoints;
    if (stops.length > 2) {
      final wps = stops
          .sublist(1, stops.length - 1)
          .map((s) => '${s.latitude},${s.longitude}')
          .join('|');
      waypoints = wps;
    }

    final uri = Uri.https('maps.googleapis.com', '/maps/api/directions/json', {
      'origin': origin,
      'destination': destination,
      if (waypoints != null) 'waypoints': waypoints,
      'mode': 'driving',
      'key': _kGoogleMapsKey,
    });

    final response = await http.get(uri).timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) return stops;

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final routes = json['routes'] as List?;
    if (routes == null || routes.isEmpty) return stops;

    final overviewPolyline =
        (routes[0] as Map<String, dynamic>)['overview_polyline'] as Map<String, dynamic>?;
    final encoded = overviewPolyline?['points'] as String?;
    if (encoded == null || encoded.isEmpty) return stops;

    return decodePolyline(encoded);
  } catch (_) {
    // Network error, timeout, or invalid response — fall back to straight lines
    return stops;
  }
}

/// Decode a Google encoded polyline string into a list of [LatLng] points.
///
/// See: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
List<LatLng> decodePolyline(String encoded) {
  final points = <LatLng>[];
  int index = 0;
  int lat = 0;
  int lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    int shift = 0;
    int result = 0;
    int b;
    do {
      b = encoded.codeUnitAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) != 0 ? ~(result >> 1) : (result >> 1);

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      b = encoded.codeUnitAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) != 0 ? ~(result >> 1) : (result >> 1);

    points.add(LatLng(lat / 1e5, lng / 1e5));
  }

  return points;
}
