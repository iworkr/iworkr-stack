import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/notification_item.dart';

/// Provides inbox notifications for the current user
final notificationsProvider = FutureProvider<List<NotificationItem>>((ref) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return [];

  final data = await SupabaseService.client
      .from('notifications')
      .select()
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', ascending: false)
      .limit(30);

  return (data as List)
      .map((n) => NotificationItem.fromJson(n as Map<String, dynamic>))
      .toList();
});

/// Unread count
final unreadCountProvider = FutureProvider<int>((ref) async {
  final notifications = await ref.watch(notificationsProvider.future);
  return notifications.where((n) => !n.read).length;
});
