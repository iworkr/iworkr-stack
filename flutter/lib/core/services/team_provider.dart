import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Team Provider — Live Roster with Presence ────────────
// ═══════════════════════════════════════════════════════════

class TeamMember {
  final String userId;
  final String fullName;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final bool isActive;
  final DateTime? lastActive;
  final String? appVersion;
  final String? deviceOs;
  bool isOnline;

  TeamMember({
    required this.userId,
    required this.fullName,
    required this.email,
    this.phone,
    this.avatarUrl,
    required this.role,
    this.isActive = true,
    this.lastActive,
    this.appVersion,
    this.deviceOs,
    this.isOnline = false,
  });

  factory TeamMember.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>? ?? {};
    return TeamMember(
      userId: json['user_id'] as String,
      fullName: profile['full_name'] as String? ?? 'Unknown',
      email: profile['email'] as String? ?? '',
      phone: profile['phone'] as String?,
      avatarUrl: profile['avatar_url'] as String?,
      role: json['role'] as String? ?? 'technician',
      isActive: (json['status'] as String?) == 'active',
      lastActive: json['last_active_at'] != null
          ? DateTime.tryParse(json['last_active_at'] as String)
          : null,
    );
  }

  TeamMember copyWith({String? role, bool? isActive, bool? isOnline}) {
    return TeamMember(
      userId: userId,
      fullName: fullName,
      email: email,
      phone: phone,
      avatarUrl: avatarUrl,
      role: role ?? this.role,
      isActive: isActive ?? this.isActive,
      lastActive: lastActive,
      appVersion: appVersion,
      deviceOs: deviceOs,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}

// ── Filter enum ──────────────────────────────────────────

enum TeamFilter { all, admins, techs, offline }

// ── Team State ───────────────────────────────────────────

class TeamState {
  final List<TeamMember> members;
  final String searchQuery;
  final TeamFilter filter;
  final bool loading;
  final String? error;

  const TeamState({
    this.members = const [],
    this.searchQuery = '',
    this.filter = TeamFilter.all,
    this.loading = true,
    this.error,
  });

  TeamState copyWith({
    List<TeamMember>? members,
    String? searchQuery,
    TeamFilter? filter,
    bool? loading,
    String? error,
  }) {
    return TeamState(
      members: members ?? this.members,
      searchQuery: searchQuery ?? this.searchQuery,
      filter: filter ?? this.filter,
      loading: loading ?? this.loading,
      error: error,
    );
  }

  List<TeamMember> get filtered {
    var list = members;

    if (searchQuery.isNotEmpty) {
      final q = searchQuery.toLowerCase();
      list = list.where((m) =>
          m.fullName.toLowerCase().contains(q) ||
          m.email.toLowerCase().contains(q) ||
          (m.phone?.contains(q) ?? false)).toList();
    }

    switch (filter) {
      case TeamFilter.all:
        break;
      case TeamFilter.admins:
        list = list.where((m) => m.role == 'owner' || m.role == 'admin' || m.role == 'manager').toList();
      case TeamFilter.techs:
        list = list.where((m) => m.role == 'technician' || m.role == 'senior_tech' || m.role == 'apprentice').toList();
      case TeamFilter.offline:
        list = list.where((m) => !m.isOnline).toList();
    }

    return list;
  }
}

// ── Team Notifier ────────────────────────────────────────

class TeamNotifier extends StateNotifier<TeamState> {
  final Ref _ref;
  RealtimeChannel? _presenceChannel;
  RealtimeChannel? _memberChannel;

  TeamNotifier(this._ref) : super(const TeamState()) {
    _loadMembers();
  }

  String? get _orgId => _ref.read(activeWorkspaceIdProvider);

  Future<void> _loadMembers() async {
    final orgId = _orgId;
    if (orgId == null) {
      state = state.copyWith(members: [], loading: false);
      return;
    }

    try {
      final data = await SupabaseService.client
          .from('organization_members')
          .select('user_id, role, status, last_active_at, profiles(full_name, email, phone, avatar_url)')
          .eq('organization_id', orgId)
          .order('role');

      final members = (data as List)
          .map((row) => TeamMember.fromJson(row as Map<String, dynamic>))
          .toList();

      state = state.copyWith(members: members, loading: false, error: null);

      _subscribePresence(orgId);
      _subscribeMemberChanges(orgId);
    } catch (e) {
      state = state.copyWith(loading: false, error: 'Failed to load team');
      debugPrint('[TeamNotifier] Load error: $e');
    }
  }

  void _subscribePresence(String orgId) {
    _presenceChannel?.unsubscribe();
    _presenceChannel = SupabaseService.client.channel('team-presence-$orgId');

    _presenceChannel!
        .onPresenceSync((_) {
          final presences = _presenceChannel!.presenceState();
          final onlineIds = <String>{};
          for (final entry in presences) {
            for (final p in entry.presences) {
              final uid = p.payload['user_id'] as String?;
              if (uid != null) onlineIds.add(uid);
            }
          }

          final updated = state.members.map((m) {
            return m.copyWith(isOnline: onlineIds.contains(m.userId));
          }).toList();

          state = state.copyWith(members: updated);
        })
        .subscribe((status, _) async {
          if (status == RealtimeSubscribeStatus.subscribed) {
            final userId = SupabaseService.auth.currentUser?.id;
            if (userId != null) {
              await _presenceChannel!.track({'user_id': userId});
            }
          }
        });
  }

  void _subscribeMemberChanges(String orgId) {
    _memberChannel?.unsubscribe();
    _memberChannel = SupabaseService.client
        .channel('team-members-$orgId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'organization_members',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'organization_id',
            value: orgId,
          ),
          callback: (_) => _loadMembers(),
        )
        .subscribe();
  }

  void setSearch(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void setFilter(TeamFilter filter) {
    state = state.copyWith(filter: filter);
  }

  Future<void> refresh() => _loadMembers();

  Future<bool> updateMemberRole(String userId, String newRole) async {
    final orgId = _orgId;
    if (orgId == null) return false;

    final oldMembers = List<TeamMember>.from(state.members);
    state = state.copyWith(
      members: state.members.map((m) =>
          m.userId == userId ? m.copyWith(role: newRole) : m).toList(),
    );

    try {
      await SupabaseService.client
          .from('organization_members')
          .update({'role': newRole})
          .eq('organization_id', orgId)
          .eq('user_id', userId);
      return true;
    } catch (_) {
      state = state.copyWith(members: oldMembers);
      return false;
    }
  }

  Future<bool> suspendMember(String userId) async {
    final orgId = _orgId;
    if (orgId == null) return false;

    try {
      await SupabaseService.client
          .from('organization_members')
          .update({'status': 'suspended'})
          .eq('organization_id', orgId)
          .eq('user_id', userId);
      await _loadMembers();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> removeMember(String userId) async {
    final orgId = _orgId;
    if (orgId == null) return false;

    try {
      await SupabaseService.client
          .from('organization_members')
          .delete()
          .eq('organization_id', orgId)
          .eq('user_id', userId);
      await _loadMembers();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> inviteMember({
    required String email,
    required String fullName,
    required String role,
  }) async {
    final orgId = _orgId;
    if (orgId == null) return false;

    try {
      await SupabaseService.client.from('workspace_invites').insert({
        'organization_id': orgId,
        'email': email.trim().toLowerCase(),
        'full_name': fullName.trim(),
        'role': role,
        'invited_by': SupabaseService.auth.currentUser?.id,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  void dispose() {
    _presenceChannel?.unsubscribe();
    _memberChannel?.unsubscribe();
    super.dispose();
  }
}

// ── Provider ─────────────────────────────────────────────

final teamProvider = StateNotifierProvider<TeamNotifier, TeamState>((ref) {
  final notifier = TeamNotifier(ref);
  ref.onDispose(() => notifier.dispose());
  return notifier;
});
