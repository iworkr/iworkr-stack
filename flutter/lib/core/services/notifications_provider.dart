import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/notification_item.dart';

// ═══════════════════════════════════════════════════════════
// ── Notifications — Realtime Stream ──────────────────────
// ═══════════════════════════════════════════════════════════

final notificationsProvider = StreamProvider<List<NotificationItem>>((ref) {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<NotificationItem>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('notifications')
          .select()
          .eq('user_id', userId)
          .eq('archived', false)
          .order('created_at', ascending: false)
          .limit(30);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((n) => NotificationItem.fromJson(n as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('notifications-$userId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'notifications',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'user_id',
          value: userId,
        ),
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Unread count — derived reactively from the notifications stream
final unreadCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(notificationsProvider).valueOrNull ?? [];
  return notifications.where((n) => !n.read).length;
});
