import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:iworkr_mobile/core/theme/brand_theme.dart';

/// Project Chameleon — Offline brand cache.
///
/// Persists workspace branding to SharedPreferences so the app
/// renders the correct brand identity even when offline.
class BrandCacheService {
  static const _key = 'cached_workspace_branding';
  static const _storage = FlutterSecureStorage();

  /// Cache the branding payload from Supabase
  static Future<void> cache(Map<String, dynamic> payload) async {
    await _storage.write(key: _key, value: jsonEncode(payload));
  }

  /// Restore cached branding (returns null if no cache exists)
  static Future<BrandTheme?> restore() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;

    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      return BrandTheme.fromHex(
        primaryHex: data['primary_color_hex'] as String? ?? '#10B981',
        accentHex: data['accent_color_hex'] as String?,
        textOnPrimaryHex: data['text_on_primary_hex'] as String?,
        appName: data['app_name'] as String?,
        logoLightUrl: data['logo_light_url'] as String?,
        logoDarkUrl: data['logo_dark_url'] as String?,
        appIconUrl: data['app_icon_url'] as String?,
      );
    } catch (_) {
      return null;
    }
  }

  /// Clear the cache (on logout)
  static Future<void> clear() async {
    await _storage.delete(key: _key);
  }
}
