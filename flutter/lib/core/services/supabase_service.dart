import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Callback for widget deep links — set by the router at startup
typedef WidgetDeepLinkHandler = void Function(String path);

/// Supabase singleton access + deep link handler
class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;
  static GoTrueClient get auth => client.auth;

  static WidgetDeepLinkHandler? onWidgetDeepLink;
  static String? pendingWidgetDeepLink;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'https://olqjuadvseoxpfjzlghb.supabase.co',
      anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY',
    );
  }

  /// Initialize deep link listener for auth callbacks AND widget deep links.
  static void initDeepLinks() {
    final appLinks = AppLinks();

    // Cold start: check if app was launched via a deep link
    appLinks.getInitialLink().then((uri) {
      if (uri != null) _routeUri(uri);
    });

    // Warm start: handle links while app is running
    appLinks.uriLinkStream.listen(_routeUri);
  }

  static void _routeUri(Uri uri) {
    // Widget deep links use the iworkr:// scheme
    if (uri.scheme == 'iworkr') {
      final path = '/${uri.host}${uri.path}';
      debugPrint('[DeepLink] Widget link: $path');
      if (onWidgetDeepLink != null) {
        onWidgetDeepLink!(path);
      } else {
        pendingWidgetDeepLink = path;
      }
      return;
    }

    // Auth deep links (Supabase OAuth / magic link)
    _handleAuthDeepLink(uri);
  }

  /// Extract auth tokens from deep link URI and establish session,
  /// then sync any OAuth profile data (avatar, name) to the profiles table.
  /// Uses getSessionFromUrl to properly handle both PKCE (code) and implicit (fragment) flows.
  static Future<void> _handleAuthDeepLink(Uri uri) async {
    final hasAuthData = uri.fragment.contains('access_token') ||
        uri.fragment.contains('refresh_token') ||
        uri.queryParameters.containsKey('code');
    if (!hasAuthData) return;

    await auth.getSessionFromUrl(uri);

    // Sync Google profile data (avatar + name) into profiles table
    await _syncOAuthProfile();
  }

  /// Pull avatar_url and full_name from user_metadata and persist to profiles
  static Future<void> _syncOAuthProfile() async {
    final user = auth.currentUser;
    if (user == null) return;

    final meta = user.userMetadata ?? {};
    final avatarUrl = meta['avatar_url'] ?? meta['picture'];
    final fullName = meta['full_name'] ?? meta['name'];

    if (avatarUrl == null && fullName == null) return;

    await client.from('profiles').update({
      if (avatarUrl != null) 'avatar_url': avatarUrl,
      if (fullName != null) 'full_name': fullName,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', user.id);
  }
}

final supabaseProvider = Provider<SupabaseClient>((ref) {
  return SupabaseService.client;
});

final authStateProvider = StreamProvider<AuthState>((ref) {
  return SupabaseService.auth.onAuthStateChange;
});

final currentUserProvider = Provider<User?>((ref) {
  return SupabaseService.auth.currentUser;
});
