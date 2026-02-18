import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// OS-aware native map launcher.
///
/// iOS  → Apple Maps (`maps://`)
/// Android → Google Maps (`geo:`) with fallback to browser
class MapLauncherService {
  MapLauncherService._();

  /// Launch navigation to [lat],[lng] with an optional [label].
  static Future<bool> navigate({
    required double lat,
    required double lng,
    String? label,
  }) async {
    final Uri uri;

    if (Platform.isIOS) {
      uri = Uri.parse(
        'http://maps.apple.com/?daddr=$lat,$lng&dirflg=d',
      );
    } else {
      final encodedLabel = Uri.encodeComponent(label ?? 'Job Location');
      uri = Uri.parse(
        'geo:$lat,$lng?q=$lat,$lng($encodedLabel)',
      );
    }

    if (await canLaunchUrl(uri)) {
      return launchUrl(uri, mode: LaunchMode.externalApplication);
    }

    // Fallback: open Google Maps in the browser
    final browserUri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
    );
    return launchUrl(browserUri, mode: LaunchMode.externalApplication);
  }

  /// Open the map centered on [lat],[lng] without starting navigation.
  static Future<bool> openMap({
    required double lat,
    required double lng,
    String? label,
  }) async {
    final Uri uri;

    if (Platform.isIOS) {
      uri = Uri.parse('http://maps.apple.com/?ll=$lat,$lng&q=${Uri.encodeComponent(label ?? '')}');
    } else {
      final encodedLabel = Uri.encodeComponent(label ?? 'Location');
      uri = Uri.parse('geo:$lat,$lng?q=$lat,$lng($encodedLabel)');
    }

    if (await canLaunchUrl(uri)) {
      return launchUrl(uri, mode: LaunchMode.externalApplication);
    }

    final browserUri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );
    return launchUrl(browserUri, mode: LaunchMode.externalApplication);
  }

  /// Show a snackbar confirmation after launching.
  static void showLaunchFeedback(BuildContext context, {bool success = true}) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success ? 'Opening navigation…' : 'Could not open maps',
          style: const TextStyle(fontSize: 13),
        ),
        backgroundColor: success ? const Color(0xFF10B981) : const Color(0xFFEF4444),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 80),
      ),
    );
  }
}
