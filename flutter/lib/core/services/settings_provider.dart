import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:local_auth/local_auth.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Settings State Model ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

class SettingsState {
  // Profile (cloud)
  final String displayName;
  final String email;
  final String? avatarUrl;
  final String? phone;

  // Security (local device)
  final bool biometricsEnabled;
  final bool biometricsAvailable;

  // Notifications (cloud)
  final bool pushEnabled;
  final bool emailEnabled;
  final bool smsEnabled;
  final bool jobAssigned;
  final bool jobStatusChange;
  final bool mentionedInChat;

  // Workspace (cloud, admin-only)
  final String? companyName;
  final String? supportEmail;

  // UI
  final bool saving;

  const SettingsState({
    this.displayName = '',
    this.email = '',
    this.avatarUrl,
    this.phone,
    this.biometricsEnabled = false,
    this.biometricsAvailable = false,
    this.pushEnabled = true,
    this.emailEnabled = true,
    this.smsEnabled = false,
    this.jobAssigned = true,
    this.jobStatusChange = true,
    this.mentionedInChat = true,
    this.companyName,
    this.supportEmail,
    this.saving = false,
  });

  SettingsState copyWith({
    String? displayName,
    String? email,
    String? avatarUrl,
    String? phone,
    bool? biometricsEnabled,
    bool? biometricsAvailable,
    bool? pushEnabled,
    bool? emailEnabled,
    bool? smsEnabled,
    bool? jobAssigned,
    bool? jobStatusChange,
    bool? mentionedInChat,
    String? companyName,
    String? supportEmail,
    bool? saving,
  }) {
    return SettingsState(
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      phone: phone ?? this.phone,
      biometricsEnabled: biometricsEnabled ?? this.biometricsEnabled,
      biometricsAvailable: biometricsAvailable ?? this.biometricsAvailable,
      pushEnabled: pushEnabled ?? this.pushEnabled,
      emailEnabled: emailEnabled ?? this.emailEnabled,
      smsEnabled: smsEnabled ?? this.smsEnabled,
      jobAssigned: jobAssigned ?? this.jobAssigned,
      jobStatusChange: jobStatusChange ?? this.jobStatusChange,
      mentionedInChat: mentionedInChat ?? this.mentionedInChat,
      companyName: companyName ?? this.companyName,
      supportEmail: supportEmail ?? this.supportEmail,
      saving: saving ?? this.saving,
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Settings Notifier ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
);

class SettingsNotifier extends StateNotifier<SettingsState> {
  final Ref _ref;

  SettingsNotifier(this._ref) : super(const SettingsState()) {
    _initialize();
  }

  String? get _userId => SupabaseService.auth.currentUser?.id;

  Future<void> _initialize() async {
    await Future.wait([
      _loadProfile(),
      _loadBiometrics(),
      _loadNotificationPrefs(),
      _loadWorkspaceInfo(),
    ]);
  }

  // ── Profile (Cloud) ────────────────────────────────────

  Future<void> _loadProfile() async {
    final profile = await _ref.read(profileProvider.future);
    if (profile == null) return;
    state = state.copyWith(
      displayName: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      phone: profile.phone,
    );
  }

  Future<void> updateDisplayName(String name) async {
    if (name.trim().isEmpty || name == state.displayName) return;
    final old = state.displayName;
    state = state.copyWith(displayName: name, saving: true);
    try {
      await SupabaseService.client
          .from('profiles')
          .update({'full_name': name.trim()})
          .eq('id', _userId!);
      _ref.invalidate(profileProvider);
    } catch (_) {
      state = state.copyWith(displayName: old);
    }
    state = state.copyWith(saving: false);
  }

  Future<void> updatePhone(String phone) async {
    if (phone == state.phone) return;
    final old = state.phone;
    state = state.copyWith(phone: phone, saving: true);
    try {
      await SupabaseService.client
          .from('profiles')
          .update({'phone': phone.trim()})
          .eq('id', _userId!);
      _ref.invalidate(profileProvider);
    } catch (_) {
      state = state.copyWith(phone: old);
    }
    state = state.copyWith(saving: false);
  }

  Future<String?> uploadAvatar(XFile image) async {
    if (_userId == null) return null;
    state = state.copyWith(saving: true);
    try {
      final bytes = await image.readAsBytes();
      final ext = image.path.split('.').last;
      final path = '$_userId/avatar.$ext';

      await SupabaseService.client.storage
          .from('avatars')
          .uploadBinary(path, bytes, fileOptions: const FileOptions(upsert: true));

      final url = SupabaseService.client.storage
          .from('avatars')
          .getPublicUrl(path);

      final publicUrl = '$url?t=${DateTime.now().millisecondsSinceEpoch}';

      await SupabaseService.client
          .from('profiles')
          .update({'avatar_url': publicUrl})
          .eq('id', _userId!);

      state = state.copyWith(avatarUrl: publicUrl);
      _ref.invalidate(profileProvider);
      return publicUrl;
    } catch (_) {
      return null;
    } finally {
      state = state.copyWith(saving: false);
    }
  }

  // ── Biometrics (Local Device) ──────────────────────────

  Future<void> _loadBiometrics() async {
    final auth = LocalAuthentication();
    bool available = false;
    try {
      available = await auth.canCheckBiometrics || await auth.isDeviceSupported();
    } catch (_) {}

    final stored = await _storage.read(key: 'require_biometrics');
    state = state.copyWith(
      biometricsAvailable: available,
      biometricsEnabled: stored == 'true',
    );
  }

  Future<bool> toggleBiometrics() async {
    final auth = LocalAuthentication();
    final newValue = !state.biometricsEnabled;

    if (newValue) {
      try {
        final authenticated = await auth.authenticate(
          localizedReason: 'Authenticate to enable biometric lock',
          options: const AuthenticationOptions(biometricOnly: true),
        );
        if (!authenticated) return false;
      } catch (_) {
        return false;
      }
    }

    await _storage.write(key: 'require_biometrics', value: newValue.toString());
    state = state.copyWith(biometricsEnabled: newValue);
    return true;
  }

  // ── Notifications (Cloud — Optimistic) ─────────────────

  Future<void> _loadNotificationPrefs() async {
    if (_userId == null) return;
    try {
      final data = await SupabaseService.client
          .from('user_preferences')
          .select()
          .eq('user_id', _userId!)
          .maybeSingle();
      if (data != null) {
        state = state.copyWith(
          pushEnabled: data['push_enabled'] as bool? ?? true,
          emailEnabled: data['email_enabled'] as bool? ?? true,
          smsEnabled: data['sms_enabled'] as bool? ?? false,
          jobAssigned: data['job_assigned'] as bool? ?? true,
          jobStatusChange: data['job_status_change'] as bool? ?? true,
          mentionedInChat: data['mentioned_in_chat'] as bool? ?? true,
        );
      }
    } catch (_) {}
  }

  Future<bool> setNotificationPref(String key, bool value) async {
    final old = _getNotifValue(key);
    _setNotifValue(key, value);

    try {
      await SupabaseService.client
          .from('user_preferences')
          .upsert({
            'user_id': _userId!,
            key: value,
          }, onConflict: 'user_id');
      return true;
    } catch (_) {
      _setNotifValue(key, old);
      return false;
    }
  }

  bool _getNotifValue(String key) {
    switch (key) {
      case 'push_enabled': return state.pushEnabled;
      case 'email_enabled': return state.emailEnabled;
      case 'sms_enabled': return state.smsEnabled;
      case 'job_assigned': return state.jobAssigned;
      case 'job_status_change': return state.jobStatusChange;
      case 'mentioned_in_chat': return state.mentionedInChat;
      default: return false;
    }
  }

  void _setNotifValue(String key, bool value) {
    switch (key) {
      case 'push_enabled': state = state.copyWith(pushEnabled: value);
      case 'email_enabled': state = state.copyWith(emailEnabled: value);
      case 'sms_enabled': state = state.copyWith(smsEnabled: value);
      case 'job_assigned': state = state.copyWith(jobAssigned: value);
      case 'job_status_change': state = state.copyWith(jobStatusChange: value);
      case 'mentioned_in_chat': state = state.copyWith(mentionedInChat: value);
    }
  }

  // ── Workspace Admin (Cloud) ────────────────────────────

  Future<void> _loadWorkspaceInfo() async {
    final ws = _ref.read(activeWorkspaceProvider).valueOrNull;
    if (ws == null) return;
    try {
      final data = await SupabaseService.client
          .from('organizations')
          .select('name, support_email')
          .eq('id', ws.organizationId)
          .maybeSingle();
      if (data != null) {
        state = state.copyWith(
          companyName: data['name'] as String?,
          supportEmail: data['support_email'] as String?,
        );
      }
    } catch (_) {}
  }

  Future<void> updateCompanyName(String name) async {
    if (name.trim().isEmpty) return;
    final ws = _ref.read(activeWorkspaceProvider).valueOrNull;
    if (ws == null) return;
    state = state.copyWith(companyName: name, saving: true);
    try {
      await SupabaseService.client
          .from('organizations')
          .update({'name': name.trim()})
          .eq('id', ws.organizationId);
      _ref.invalidate(allWorkspacesProvider);
    } catch (_) {}
    state = state.copyWith(saving: false);
  }

  Future<void> updateSupportEmail(String email) async {
    final ws = _ref.read(activeWorkspaceProvider).valueOrNull;
    if (ws == null) return;
    state = state.copyWith(supportEmail: email, saving: true);
    try {
      await SupabaseService.client
          .from('organizations')
          .update({'support_email': email.trim()})
          .eq('id', ws.organizationId);
    } catch (_) {}
    state = state.copyWith(saving: false);
  }

  // ── Destructive ────────────────────────────────────────

  Future<void> deleteAccount() async {
    state = state.copyWith(saving: true);
    try {
      await SupabaseService.client.functions.invoke('delete-account');
      await _storage.deleteAll();
      await SupabaseService.auth.signOut();
    } catch (_) {}
    state = state.copyWith(saving: false);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Provider ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final settingsProvider = StateNotifierProvider<SettingsNotifier, SettingsState>((ref) {
  return SettingsNotifier(ref);
});

/// Check biometric lock requirement on app boot
final biometricLockProvider = FutureProvider<bool>((ref) async {
  final stored = await _storage.read(key: 'require_biometrics');
  return stored == 'true';
});
