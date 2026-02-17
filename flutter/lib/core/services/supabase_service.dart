import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase singleton access + deep link handler
class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;
  static GoTrueClient get auth => client.auth;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'https://iaroashargzwsuuciqox.supabase.co',
      anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhcm9hc2hhcmd6d3N1dWNpcW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjc3MzgsImV4cCI6MjA4NjgwMzczOH0.jMV3QdFNZ8UzAQrZGyLwI2k_vjZ4oYBv2USLH5gOZpM',
    );
  }

  /// Initialize deep link listener for magic link / OAuth callbacks.
  ///
  /// Handles both:
  /// - Custom scheme: com.iworkr.mobile://login-callback#access_token=...
  /// - Universal links: https://iaroashargzwsuuciqox.supabase.co/auth/v1/callback?...
  static void initDeepLinks() {
    final appLinks = AppLinks();

    // Handle link when app is already running
    appLinks.uriLinkStream.listen((uri) {
      _handleAuthDeepLink(uri);
    });
  }

  /// Extract auth tokens from deep link URI and establish session
  static Future<void> _handleAuthDeepLink(Uri uri) async {
    // supabase_flutter handles most of this automatically, but we ensure
    // fragments with access_token are processed
    final fragment = uri.fragment;
    if (fragment.isNotEmpty && fragment.contains('access_token')) {
      // Parse the fragment as query parameters
      final params = Uri.splitQueryString(fragment);
      final accessToken = params['access_token'];
      final refreshToken = params['refresh_token'];

      if (accessToken != null && refreshToken != null) {
        await auth.setSession(refreshToken);
      }
    }
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
