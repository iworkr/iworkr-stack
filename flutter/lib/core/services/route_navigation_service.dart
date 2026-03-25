import 'dart:io';
import 'package:url_launcher/url_launcher.dart';

/// Deep-links into native navigation apps (Google Maps, Waze, Apple Maps).
/// Also triggers the outrider-en-route-notify Edge Function for live tracking.
class RouteNavigationService {
  RouteNavigationService._();

  /// Launch native Google Maps with driving directions to [lat], [lng].
  static Future<bool> openGoogleMaps(double lat, double lng) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
    );
    return _tryLaunch(uri);
  }

  /// Launch Waze with navigate-to coordinates.
  static Future<bool> openWaze(double lat, double lng) async {
    final uri = Uri.parse('https://waze.com/ul?ll=$lat,$lng&navigate=yes');
    return _tryLaunch(uri);
  }

  /// Launch Apple Maps (iOS only) with driving directions.
  static Future<bool> openAppleMaps(double lat, double lng) async {
    final uri = Uri.parse('http://maps.apple.com/?daddr=$lat,$lng&dirflg=d');
    return _tryLaunch(uri);
  }

  /// Auto-select the best navigation app for the platform.
  /// iOS: tries Apple Maps first, then Google Maps.
  /// Android: tries Google Maps first, then Waze.
  static Future<bool> openBestNavigation(double lat, double lng) async {
    if (Platform.isIOS) {
      if (await openAppleMaps(lat, lng)) return true;
      return openGoogleMaps(lat, lng);
    }
    if (await openGoogleMaps(lat, lng)) return true;
    return openWaze(lat, lng);
  }

  static Future<bool> _tryLaunch(Uri uri) async {
    try {
      if (await canLaunchUrl(uri)) {
        return launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
