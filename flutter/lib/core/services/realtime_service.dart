import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Centralized Realtime Service ──────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Manages a single workspace-scoped WebSocket channel that all
// Realtime features multiplex over. Handles Presence tracking
// and Broadcast events without opening redundant connections.

class RealtimeService {
  final SupabaseClient _client;
  RealtimeChannel? _workspaceChannel;
  String? _activeOrgId;
  String? _activeUserId;

  final _presenceController = StreamController<List<PresenceMember>>.broadcast();
  final _broadcastController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<List<PresenceMember>> get presenceStream => _presenceController.stream;
  Stream<Map<String, dynamic>> get broadcastStream => _broadcastController.stream;

  RealtimeService(this._client);

  bool get isConnected => _workspaceChannel != null;

  /// Connect to the workspace-scoped Realtime channel.
  /// Call this after login and workspace selection.
  void connect({required String orgId, required String userId, Map<String, dynamic>? presenceState}) {
    if (_activeOrgId == orgId && _workspaceChannel != null) return;

    disconnect();

    _activeOrgId = orgId;
    _activeUserId = userId;

    _workspaceChannel = _client
        .channel('workspace:$orgId')
        .onPresenceSync((payload) {
          final presences = _workspaceChannel?.presenceState();
          if (presences == null) return;
          final members = <PresenceMember>[];
          for (final entry in presences) {
            for (final p in entry.presences) {
              final uid = p.payload['user_id'] as String?;
              if (uid != null) {
                members.add(PresenceMember.fromPayload(uid, p.payload));
              }
            }
          }
          if (!_presenceController.isClosed) {
            _presenceController.add(members);
          }
        })
        .onPresenceJoin((payload) {
          debugPrint('[Realtime] Presence join: ${payload.newPresences.length} member(s)');
        })
        .onPresenceLeave((payload) {
          debugPrint('[Realtime] Presence leave: ${payload.leftPresences.length} member(s)');
        })
        .onBroadcast(event: '*', callback: (payload) {
          if (!_broadcastController.isClosed) {
            _broadcastController.add(payload);
          }
        })
        .subscribe((status, [error]) {
          debugPrint('[Realtime] workspace:$orgId status=$status');
          if (status == RealtimeSubscribeStatus.subscribed) {
            _workspaceChannel?.track(presenceState ?? {
              'user_id': userId,
              'status': 'online',
              'connected_at': DateTime.now().toUtc().toIso8601String(),
            });
          }
        });
  }

  /// Send a broadcast event to all connected clients in the workspace.
  void broadcast(String event, Map<String, dynamic> payload) {
    _workspaceChannel?.sendBroadcastMessage(
      event: event,
      payload: {
        ...payload,
        'sender_id': _activeUserId,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      },
    );
  }

  /// Update the current user's presence state (e.g. with GPS coordinates).
  void updatePresence(Map<String, dynamic> state) {
    _workspaceChannel?.track({
      'user_id': _activeUserId,
      ...state,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Disconnect and clean up the workspace channel.
  void disconnect() {
    if (_workspaceChannel != null) {
      _client.removeChannel(_workspaceChannel!);
      _workspaceChannel = null;
      _activeOrgId = null;
    }
  }

  void dispose() {
    disconnect();
    _presenceController.close();
    _broadcastController.close();
  }
}

/// Parsed presence member from the channel state.
class PresenceMember {
  final String presenceRef;
  final String? userId;
  final String status;
  final double? lat;
  final double? lng;
  final DateTime? connectedAt;
  final Map<String, dynamic> raw;

  const PresenceMember({
    required this.presenceRef,
    this.userId,
    this.status = 'online',
    this.lat,
    this.lng,
    this.connectedAt,
    this.raw = const {},
  });

  factory PresenceMember.fromPayload(String userId, Map<String, dynamic> p) {
    return PresenceMember(
      presenceRef: userId,
      userId: userId,
      status: p['status'] as String? ?? 'online',
      lat: (p['lat'] as num?)?.toDouble(),
      lng: (p['lng'] as num?)?.toDouble(),
      connectedAt: p['connected_at'] != null
          ? DateTime.tryParse(p['connected_at'] as String)
          : null,
      raw: p,
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Riverpod Providers ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  final service = RealtimeService(SupabaseService.client);
  ref.onDispose(() => service.dispose());
  return service;
});

/// Auto-connects to the workspace channel when the active workspace changes.
final realtimeConnectionProvider = Provider<void>((ref) {
  final orgId = ref.watch(activeWorkspaceIdProvider);
  final userId = SupabaseService.auth.currentUser?.id;
  final service = ref.read(realtimeServiceProvider);

  if (orgId != null && userId != null) {
    service.connect(orgId: orgId, userId: userId);
  } else {
    service.disconnect();
  }
});

/// Stream of online presence members in the current workspace.
final presenceStreamProvider = StreamProvider<List<PresenceMember>>((ref) {
  ref.watch(realtimeConnectionProvider);
  final service = ref.read(realtimeServiceProvider);
  return service.presenceStream;
});

/// Stream of broadcast events in the current workspace.
final broadcastStreamProvider = StreamProvider<Map<String, dynamic>>((ref) {
  ref.watch(realtimeConnectionProvider);
  final service = ref.read(realtimeServiceProvider);
  return service.broadcastStream;
});

/// Count of currently online team members.
final onlineCountProvider = Provider<int>((ref) {
  final presence = ref.watch(presenceStreamProvider).valueOrNull ?? [];
  return presence.where((m) => m.status == 'online').length;
});

/// Map of online user IDs to their presence data (for dispatch map markers).
final onlineUsersMapProvider = Provider<Map<String, PresenceMember>>((ref) {
  final presence = ref.watch(presenceStreamProvider).valueOrNull ?? [];
  return {
    for (final m in presence)
      if (m.userId != null) m.userId!: m,
  };
});
