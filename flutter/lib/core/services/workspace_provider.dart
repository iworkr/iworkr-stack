import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

// ── Secure Storage ─────────────────────────────────────
const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
);

const _kActiveWorkspaceKey = 'active_workspace_id';
const _kLastActiveMapKey = 'workspace_last_active_map';

// ═══════════════════════════════════════════════════════════
// ── Workspace Model ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class Workspace {
  final String organizationId;
  final String name;
  final String slug;
  final String? trade;
  final String? logoUrl;
  final String role;
  final String status;
  final String? branch;
  final int unreadCount;
  final DateTime? joinedAt;
  final Map<String, dynamic>? settings;
  final String brandColorHex;

  const Workspace({
    required this.organizationId,
    required this.name,
    required this.slug,
    this.trade,
    this.logoUrl,
    required this.role,
    required this.status,
    this.branch,
    this.unreadCount = 0,
    this.joinedAt,
    this.settings,
    // Default brand color (emerald green); overridden by workspace settings
    this.brandColorHex = '#10B981',
  });

  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.substring(0, name.length.clamp(0, 2)).toUpperCase();
  }

  bool get isOwner => role == 'owner';
  bool get isAdmin => role == 'admin' || role == 'owner';

  factory Workspace.fromJson(Map<String, dynamic> json) {
    final org = json['organizations'] as Map<String, dynamic>? ?? {};
    return Workspace(
      organizationId: json['organization_id'] as String,
      name: org['name'] as String? ?? 'Unknown',
      slug: org['slug'] as String? ?? '',
      trade: org['trade'] as String?,
      logoUrl: org['logo_url'] as String?,
      role: json['role'] as String? ?? 'technician',
      status: json['status'] as String? ?? 'active',
      branch: json['branch'] as String?,
      joinedAt: json['joined_at'] != null
          ? DateTime.tryParse(json['joined_at'] as String)
          : null,
      settings: org['settings'] as Map<String, dynamic>?,
      // Default brand color (emerald green); overridden by workspace settings
      brandColorHex: org['brand_color_hex'] as String? ?? '#10B981',
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// All workspaces the current user has active membership in
final allWorkspacesProvider = FutureProvider<List<Workspace>>((ref) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('joined_at', ascending: true);

  return (data as List).map((e) => Workspace.fromJson(e)).toList();
});

/// Active workspace ID — persisted across sessions
final activeWorkspaceIdProvider =
    StateNotifierProvider<ActiveWorkspaceNotifier, String?>((ref) {
      return ActiveWorkspaceNotifier(ref);
    });

class ActiveWorkspaceNotifier extends StateNotifier<String?> {
  final Ref ref;

  ActiveWorkspaceNotifier(this.ref) : super(null) {
    _loadPersistedWorkspace();
  }

  Future<void> _loadPersistedWorkspace() async {
    try {
      final stored = await _storage.read(key: _kActiveWorkspaceKey);
      if (stored != null && stored.isNotEmpty) {
        state = stored;
        return;
      }
      final workspaces = await ref.read(allWorkspacesProvider.future);
      if (workspaces.isNotEmpty) {
        state = workspaces.first.organizationId;
        await _storage.write(
          key: _kActiveWorkspaceKey,
          value: workspaces.first.organizationId,
        );
      }
    } on PlatformException catch (e) {
      // Keychain access can fail in test/sandboxed environments (e.g. macOS -34018).
      // Continue without persisted workspace; user will select after login.
      if (e.code != '-34018' && e.code != 'Unexpected security result code') {
        rethrow;
      }
    }
  }

  Future<void> switchTo(String workspaceId) async {
    if (state == workspaceId) return;
    state = workspaceId;
    await _storage.write(key: _kActiveWorkspaceKey, value: workspaceId);
    await _recordLastActive(workspaceId);
  }

  Future<void> _recordLastActive(String workspaceId) async {
    final raw = await _storage.read(key: _kLastActiveMapKey);
    final map = raw != null
        ? Map<String, String>.from(json.decode(raw) as Map)
        : <String, String>{};
    map[workspaceId] = DateTime.now().toUtc().toIso8601String();
    await _storage.write(key: _kLastActiveMapKey, value: json.encode(map));
  }
}

/// The active Workspace object (derived)
final activeWorkspaceProvider = FutureProvider<Workspace?>((ref) async {
  final activeId = ref.watch(activeWorkspaceIdProvider);
  if (activeId == null) return null;

  final workspaces = await ref.watch(allWorkspacesProvider.future);
  return workspaces.where((w) => w.organizationId == activeId).firstOrNull;
});

/// Cross-workspace unread notification counts (polled every 5 minutes)
final workspaceUnreadProvider = StreamProvider<Map<String, int>>((ref) async* {
  final user = SupabaseService.auth.currentUser;
  if (user == null) {
    yield {};
    return;
  }

  while (true) {
    try {
      final workspaces = await ref.read(allWorkspacesProvider.future);
      final counts = <String, int>{};

      for (final ws in workspaces) {
        final result = await SupabaseService.client
            .from('notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('organization_id', ws.organizationId)
            .eq('read', false);
        counts[ws.organizationId] = (result as List).length;
      }

      yield counts;
    } catch (_) {
      yield {};
    }

    await Future.delayed(const Duration(minutes: 5));
  }
});
