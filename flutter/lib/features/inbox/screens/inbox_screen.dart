import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:iworkr_mobile/core/services/notifications_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/empty_state.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/models/notification_item.dart';

/// Inbox screen — "Triage" (Linear-inspired swipeable notifications)
///
/// Web spec:
/// - Swipe right: Archive (Emerald check)
/// - Swipe left: Snooze (Zinc clock)
/// - Unread: glowing pip
/// - Row: compact, border-b border-white/5
class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  IconData _iconForType(String type) {
    switch (type) {
      case 'job_assigned':
        return PhosphorIconsRegular.briefcase;
      case 'mention':
        return PhosphorIconsRegular.at;
      case 'system':
        return PhosphorIconsRegular.gear;
      case 'invoice_paid':
        return PhosphorIconsRegular.currencyDollar;
      case 'schedule_conflict':
        return PhosphorIconsRegular.warning;
      case 'form_signed':
        return PhosphorIconsRegular.fileText;
      case 'team_invite':
        return PhosphorIconsRegular.userPlus;
      default:
        return PhosphorIconsRegular.bell;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'system':
        return ObsidianTheme.rose;
      case 'invoice_paid':
        return ObsidianTheme.emerald;
      case 'schedule_conflict':
        return ObsidianTheme.amber;
      default:
        return ObsidianTheme.blue;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Text(
                    'Inbox',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => HapticFeedback.lightImpact(),
                    child: Text(
                      'Mark all read',
                      style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary),
                    ),
                  ),
                ],
              ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
            ),

            Expanded(
              child: notifAsync.when(
                data: (notifications) {
                  if (notifications.isEmpty) {
                    return const EmptyState(
                      icon: PhosphorIconsRegular.tray,
                      title: 'Inbox Zero',
                      subtitle: 'All caught up. Nothing to triage.',
                    );
                  }

                  return RefreshIndicator(
                    color: ObsidianTheme.emerald,
                    backgroundColor: ObsidianTheme.surface1,
                    onRefresh: () async {
                      HapticFeedback.mediumImpact();
                      ref.invalidate(notificationsProvider);
                    },
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 120),
                      itemCount: notifications.length,
                      itemBuilder: (context, i) {
                        final n = notifications[i];
                        return _NotificationRow(
                          notification: n,
                          index: i,
                          icon: _iconForType(n.type),
                          color: _colorForType(n.type),
                          onDismiss: () async {
                            HapticFeedback.mediumImpact();
                            await SupabaseService.client
                                .from('notifications')
                                .update({'archived': true})
                                .eq('id', n.id);
                            ref.invalidate(notificationsProvider);
                          },
                          onMarkRead: () async {
                            await SupabaseService.client
                                .from('notifications')
                                .update({'read': true})
                                .eq('id', n.id);
                            ref.invalidate(notificationsProvider);
                          },
                        );
                      },
                    ),
                  );
                },
                loading: () => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: List.generate(
                      6,
                      (_) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ShimmerLoading(height: 64, borderRadius: ObsidianTheme.radiusMd),
                      ),
                    ),
                  ),
                ),
                error: (e, _) => Center(
                  child: Text('Error: $e', style: const TextStyle(color: ObsidianTheme.rose)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  final NotificationItem notification;
  final int index;
  final IconData icon;
  final Color color;
  final VoidCallback onDismiss;
  final VoidCallback onMarkRead;

  const _NotificationRow({
    required this.notification,
    required this.index,
    required this.icon,
    required this.color,
    required this.onDismiss,
    required this.onMarkRead,
  });

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: ValueKey(notification.id),
      direction: DismissDirection.horizontal,
      confirmDismiss: (direction) async {
        if (direction == DismissDirection.startToEnd) {
          onDismiss();
          return true;
        }
        return false;
      },
      // Swipe right: Archive (Emerald)
      background: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 20),
        color: ObsidianTheme.emerald.withValues(alpha: 0.1),
        child: const Icon(PhosphorIconsRegular.check, color: ObsidianTheme.emerald, size: 20),
      ),
      // Swipe left: Snooze (Zinc)
      secondaryBackground: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: ObsidianTheme.shimmerBase,
        child: const Icon(PhosphorIconsRegular.clock, color: ObsidianTheme.textTertiary, size: 20),
      ),
      child: GestureDetector(
        onTap: onMarkRead,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: ObsidianTheme.border)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Unread indicator — glowing pip
              if (!notification.read)
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(top: 7, right: 10),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color,
                    boxShadow: [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 6)],
                  ),
                )
              else
                const SizedBox(width: 16),

              // Icon
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  color: color.withValues(alpha: 0.1),
                ),
                child: Icon(icon, size: 14, color: color),
              ),
              const SizedBox(width: 12),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: notification.read ? FontWeight.w400 : FontWeight.w500,
                        color: notification.read ? ObsidianTheme.textSecondary : ObsidianTheme.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (notification.body != null && notification.body!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        notification.body!,
                        style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      timeago.format(notification.createdAt),
                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 80 + index * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 80 + index * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}
