import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:iworkr_mobile/core/services/notification_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/models/profile.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ── Secure Storage ────────────────────────────────────
const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
);

/// Provides the current user's Profile from the profiles table
final profileProvider = FutureProvider<Profile?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;

  final data = await SupabaseService.client
      .from('profiles')
      .select()
      .eq('id', user.id)
      .maybeSingle();

  if (data == null) return null;
  return Profile.fromJson(data);
});

/// Provides the user's organization membership (scoped to active workspace)
final organizationProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;

  // Use the active workspace if set, otherwise fall back to first match
  final activeWsId = ref.watch(activeWorkspaceIdProvider);

  var query = SupabaseService.client
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

  if (activeWsId != null) {
    query = query.eq('organization_id', activeWsId);
  }

  final data = await query.maybeSingle();
  return data;
});

/// Provides the organization ID (active workspace) — always validated
final organizationIdProvider = FutureProvider<String?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;

  // Always fetch the user's actual memberships first
  final workspaces = await ref.watch(allWorkspacesProvider.future);
  if (workspaces.isEmpty) return null;

  final validOrgIds = workspaces.map((w) => w.organizationId).toSet();

  // Check if the active workspace ID is valid for this user
  final activeWsId = ref.watch(activeWorkspaceIdProvider);
  if (activeWsId != null && validOrgIds.contains(activeWsId)) {
    return activeWsId;
  }

  // Fall back to first workspace
  return workspaces.first.organizationId;
});

/// True when user is linked to at least one participant portal profile.
final portalAccessProvider = FutureProvider<bool>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return false;
  try {
    final row = await SupabaseService.client
        .from('participant_network_members')
        .select('participant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
    return row != null;
  } catch (_) {
    return false;
  }
});

/// Auth notifier — handles all authentication methods.
///
/// Supports:
/// - Google OAuth
/// - Magic Link (Email OTP)
/// - Email + Password
/// - Phone + SMS OTP
/// - Sign Out
class AuthNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref ref;
  AuthNotifier(this.ref) : super(const AsyncValue.data(null));

  /// Sign in with email + password
  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) async {
    state = const AsyncValue.loading();
    try {
      final override = ref.read(authSignInOverrideProvider);
      final response = override != null
          ? await override(email: email, password: password)
          : await SupabaseService.auth.signInWithPassword(
              email: email,
              password: password,
            );
      // Store session securely (skip in tests when override is used if desired)
      if (response.session != null) {
        await _storeSession(response.session!);
      }
      state = const AsyncValue.data(null);
      return response;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  /// Send magic link (email OTP)
  Future<void> sendMagicLink(String email) async {
    await SupabaseService.auth.signInWithOtp(
      email: email,
      emailRedirectTo: 'com.iworkr.mobile://login-callback',
    );
  }

  /// Sign in with Google OAuth.
  /// Uses redirectTo so Supabase sends the user back to the app after login (not the website).
  /// Supabase Dashboard must have: Redirect URLs = com.iworkr.mobile://login-callback
  /// Google OAuth client ID is configured in the Google Cloud Console and Supabase Dashboard.
  Future<void> signInWithGoogle() async {
    await SupabaseService.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: 'com.iworkr.mobile://login-callback',
      scopes: 'openid email profile',
      queryParams: {'access_type': 'offline', 'prompt': 'consent'},
    );
  }

  /// Send SMS OTP to phone number
  Future<void> sendPhoneOtp(String phone) async {
    await SupabaseService.auth.signInWithOtp(phone: phone);
  }

  /// Verify SMS OTP code
  Future<AuthResponse> verifyPhoneOtp({
    required String phone,
    required String token,
  }) async {
    state = const AsyncValue.loading();
    try {
      final response = await SupabaseService.auth.verifyOTP(
        phone: phone,
        token: token,
        type: OtpType.sms,
      );
      if (response.session != null) {
        await _storeSession(response.session!);
      }
      state = const AsyncValue.data(null);
      return response;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  /// Set/update user password (for existing magic-link-only users)
  Future<UserResponse> updatePassword(String newPassword) async {
    return await SupabaseService.auth.updateUser(
      UserAttributes(password: newPassword),
    );
  }

  /// Sign out and clear secure storage.
  /// Also purges FCM token to prevent cross-account notification leaks.
  Future<void> signOut() async {
    state = const AsyncValue.loading();
    // Project Beacon-Recovery: purge device token BEFORE session is destroyed
    // so we still have auth.uid() available for the Supabase delete query.
    try {
      await FCMService.instance.purgeTokenOnLogout();
    } catch (_) {
      // Non-fatal — proceed with sign-out regardless
    }
    await _clearSession();
    await SupabaseService.auth.signOut();
    state = const AsyncValue.data(null);
  }

  /// Store session tokens securely
  Future<void> _storeSession(Session session) async {
    await _storage.write(key: 'access_token', value: session.accessToken);
    await _storage.write(key: 'refresh_token', value: session.refreshToken);
  }

  /// Clear secure storage
  Future<void> _clearSession() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }
}

/// Optional override for tests: when set, signInWithPassword uses this instead of Supabase.
final authSignInOverrideProvider = Provider<Future<AuthResponse> Function({required String email, required String password})?>((ref) => null);

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AsyncValue<void>>((ref) {
  return AuthNotifier(ref);
});
