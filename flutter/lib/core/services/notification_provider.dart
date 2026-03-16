import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ═══════════════════════════════════════════════════════════
// ── Notification Provider — FCM + Realtime Push Center ───
// ═══════════════════════════════════════════════════════════
//
// Manages notification state, realtime subscriptions, and
// device registration for push notifications. All reads go
// through Riverpod; writes use top-level async helpers so
// they can be called from anywhere (widgets, deep links, etc).

// ── NotificationItem Model ─────────────────────────────────

class NotificationItem {
  final String id;
  final String organizationId;
  final String userId;
  final String type;
  final String title;
  final String body;
  final String? senderName;
  final Map<String, dynamic>? context;
  final bool read;
  final bool archived;
  final DateTime? snoozedUntil;
  final String? actionUrl;
  final String? actionLink;
  final String priority;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;

  const NotificationItem({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.type,
    required this.title,
    required this.body,
    this.senderName,
    this.context,
    this.read = false,
    this.archived = false,
    this.snoozedUntil,
    this.actionUrl,
    this.actionLink,
    this.priority = 'normal',
    this.metadata = const {},
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String? ?? '',
      userId: json['user_id'] as String,
      type: json['type'] as String? ?? 'system',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      senderName: json['sender_name'] as String?,
      context: json['context'] as Map<String, dynamic>?,
      read: json['read'] as bool? ?? false,
      archived: json['archived'] as bool? ?? false,
      snoozedUntil: json['snoozed_until'] != null
          ? DateTime.tryParse(json['snoozed_until'] as String)
          : null,
      actionUrl: json['action_url'] as String?,
      actionLink: json['action_link'] as String?,
      priority: json['priority'] as String? ?? 'normal',
      metadata: (json['metadata'] as Map<String, dynamic>?) ?? {},
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  /// Whether this notification is currently snoozed.
  bool get isSnoozed =>
      snoozedUntil != null && snoozedUntil!.isAfter(DateTime.now());

  /// Whether this is a high-priority notification.
  bool get isHighPriority => priority == 'high' || priority == 'urgent';
}

// ── Providers ──────────────────────────────────────────────

/// Streams all non-archived notifications for the current user.
/// Subscribes to realtime INSERT events so the list updates live.
final notificationsProvider =
    StreamProvider.autoDispose<List<NotificationItem>>((ref) async* {
  final orgId = await ref.watch(organizationIdProvider.future);
  final user = SupabaseService.auth.currentUser;
  if (user == null || orgId == null) {
    yield [];
    return;
  }

  // Initial fetch
  final initial = await SupabaseService.client
      .from('notifications')
      .select()
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', ascending: false)
      .limit(100);

  var items =
      (initial as List).map((e) => NotificationItem.fromJson(e)).toList();
  yield items;

  // Realtime subscription for new notifications
  final controller = StreamController<List<NotificationItem>>();

  final channel = SupabaseService.client
      .channel('notifications:${user.id}')
      .onPostgresChanges(
        event: PostgresChangeEvent.insert,
        schema: 'public',
        table: 'notifications',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'user_id',
          value: user.id,
        ),
        callback: (payload) {
          final newItem = NotificationItem.fromJson(payload.newRecord);
          if (!newItem.archived) {
            items = [newItem, ...items];
            // Cap at 100 items
            if (items.length > 100) items = items.sublist(0, 100);
            controller.add(List.unmodifiable(items));
          }
        },
      )
      .subscribe();

  ref.onDispose(() {
    SupabaseService.client.removeChannel(channel);
    controller.close();
  });

  yield* controller.stream;
});

/// Count of unread, non-archived notifications.
final unreadCountProvider = Provider.autoDispose<int>((ref) {
  final async = ref.watch(notificationsProvider);
  return async.maybeWhen(
    data: (items) => items.where((n) => !n.read && !n.archived).length,
    orElse: () => 0,
  );
});

// ── Mutation Helpers ───────────────────────────────────────

/// Mark a single notification as read.
Future<void> markNotificationRead(String id) async {
  await SupabaseService.client.from('notifications').update({
    'read': true,
    'read_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', id);
}

/// Mark all unread notifications as read for the current user.
Future<void> markAllNotificationsRead() async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;

  await SupabaseService.client
      .from('notifications')
      .update({
        'read': true,
        'read_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('user_id', user.id)
      .eq('read', false);
}

/// Archive a notification (soft delete).
Future<void> archiveNotification(String id) async {
  await SupabaseService.client.from('notifications').update({
    'archived': true,
  }).eq('id', id);
}

/// Toggle the read state of a notification.
Future<void> toggleNotificationRead(String id, {required bool currentlyRead}) async {
  await SupabaseService.client.from('notifications').update({
    'read': !currentlyRead,
    if (!currentlyRead) 'read_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', id);
}

// ── Device Registration (FCM) ─────────────────────────────

/// Register this device for push notifications.
/// Currently a placeholder until firebase_messaging is integrated.
Future<void> registerDevice() async {
  // TODO: final token = await FirebaseMessaging.instance.getToken();
  // For now, return early. When ready, uncomment below:
  return;

  // ignore: dead_code
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;

  // final deviceType = Platform.isIOS ? 'ios' : 'android';
  //
  // await SupabaseService.client.from('user_devices').upsert({
  //   'user_id': user.id,
  //   'device_type': deviceType,
  //   'fcm_token': token,
  //   'app_version': '1.0.0', // TODO: read from package_info_plus
  //   'is_active': true,
  //   'updated_at': DateTime.now().toUtc().toIso8601String(),
  // }, onConflict: 'user_id,fcm_token');
}
