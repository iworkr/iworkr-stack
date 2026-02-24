import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:iworkr_mobile/core/services/notifications_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/models/notification_item.dart';

/// Inbox screen — "The Mission Log" (grouped notifications with deep links)
class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  IconData _iconForType(String type) {
    switch (type) {
      case 'job_assigned':
        return PhosphorIconsLight.briefcase;
      case 'mention':
        return PhosphorIconsLight.at;
      case 'system':
        return PhosphorIconsLight.gearSix;
      case 'invoice_paid':
        return PhosphorIconsLight.currencyDollar;
      case 'schedule_conflict':
        return PhosphorIconsLight.warning;
      case 'form_signed':
        return PhosphorIconsLight.fileText;
      case 'team_invite':
        return PhosphorIconsLight.userPlus;
      case 'leave_approved':
        return PhosphorIconsLight.calendarCheck;
      case 'asset_alert':
        return PhosphorIconsLight.cube;
      case 'timesheet':
        return PhosphorIconsLight.clock;
      default:
        return PhosphorIconsLight.bellSimple;
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
      case 'leave_approved':
        return ObsidianTheme.emerald;
      case 'asset_alert':
        return ObsidianTheme.violet;
      default:
        return ObsidianTheme.blue;
    }
  }

  /// Group notifications by date bucket: Today, Yesterday, This Week, Earlier
  Map<String, List<NotificationItem>> _groupByDate(List<NotificationItem> items) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final weekAgo = today.subtract(const Duration(days: 7));

    final groups = <String, List<NotificationItem>>{};
    for (final n in items) {
      final d = DateTime(n.createdAt.year, n.createdAt.month, n.createdAt.day);
      String bucket;
      if (d == today || d.isAfter(today)) {
        bucket = 'Today';
      } else if (d == yesterday) {
        bucket = 'Yesterday';
      } else if (d.isAfter(weekAgo)) {
        bucket = 'This Week';
      } else {
        bucket = 'Earlier';
      }
      groups.putIfAbsent(bucket, () => []).add(n);
    }
    return groups;
  }

  void _handleDeepLink(BuildContext context, NotificationItem n) {
    HapticFeedback.lightImpact();
    if (n.relatedJobId != null) {
      context.push('/jobs/${n.relatedJobId}');
    } else if (n.actionLink != null && n.actionLink!.isNotEmpty) {
      context.push(n.actionLink!);
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
                  const SizedBox(width: 8),
                  // Unread count badge
                  Consumer(
                    builder: (_, ref, __) {
                      final count = ref.watch(unreadCountProvider);
                      if (count == 0) return const SizedBox.shrink();
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusFull,
                          color: ObsidianTheme.emeraldDim,
                        ),
                        child: Text(
                          '$count',
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
                        ),
                      );
                    },
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () async {
                      HapticFeedback.lightImpact();
                      final userId = SupabaseService.auth.currentUser?.id;
                      if (userId == null) return;
                      await SupabaseService.client
                          .from('notifications')
                          .update({'read': true})
                          .eq('user_id', userId)
                          .eq('read', false);
                      ref.invalidate(notificationsProvider);
                    },
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
                    return const AnimatedEmptyState(
                      type: EmptyStateType.inbox,
                      title: 'Inbox Zero',
                      subtitle: 'All caught up. Nothing to triage.',
                    );
                  }

                  final grouped = _groupByDate(notifications);
                  final bucketOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];
                  final activeBuckets = bucketOrder.where((b) => grouped.containsKey(b)).toList();

                  return RefreshIndicator(
                    color: ObsidianTheme.emerald,
                    backgroundColor: ObsidianTheme.surface1,
                    onRefresh: () async {
                      HapticFeedback.mediumImpact();
                      ref.invalidate(notificationsProvider);
                    },
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 120),
                      itemCount: activeBuckets.fold<int>(0, (sum, b) => sum + grouped[b]!.length + 1),
                      itemBuilder: (context, flatIndex) {
                        int cursor = 0;
                        for (final bucket in activeBuckets) {
                          if (flatIndex == cursor) {
                            return _SectionHeader(label: bucket, index: cursor);
                          }
                          cursor++;
                          final items = grouped[bucket]!;
                          final itemIdx = flatIndex - cursor;
                          if (itemIdx < items.length) {
                            final n = items[itemIdx];
                            return _NotificationRow(
                              notification: n,
                              index: flatIndex,
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
                              onTap: () {
                                _handleDeepLink(context, n);
                                if (!n.read) {
                                  SupabaseService.client
                                      .from('notifications')
                                      .update({'read': true})
                                      .eq('id', n.id);
                                  ref.invalidate(notificationsProvider);
                                }
                              },
                            );
                          }
                          cursor += items.length;
                        }
                        return const SizedBox.shrink();
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

class _SectionHeader extends StatelessWidget {
  final String label;
  final int index;
  const _SectionHeader({required this.label, required this.index});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.jetBrainsMono(
          fontSize: 10, color: ObsidianTheme.textTertiary,
          letterSpacing: 1.5, fontWeight: FontWeight.w600,
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 40 + index * 10), duration: 300.ms);
  }
}

class _NotificationRow extends StatelessWidget {
  final NotificationItem notification;
  final int index;
  final IconData icon;
  final Color color;
  final VoidCallback onDismiss;
  final VoidCallback onTap;

  const _NotificationRow({
    required this.notification,
    required this.index,
    required this.icon,
    required this.color,
    required this.onDismiss,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasDeepLink = notification.relatedJobId != null ||
        (notification.actionLink != null && notification.actionLink!.isNotEmpty);

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
      background: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 20),
        color: ObsidianTheme.emerald.withValues(alpha: 0.1),
        child: const Icon(PhosphorIconsLight.check, color: ObsidianTheme.emerald, size: 20),
      ),
      secondaryBackground: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: ObsidianTheme.shimmerBase,
        child: const Icon(PhosphorIconsLight.clock, color: ObsidianTheme.textTertiary, size: 20),
      ),
      child: GestureDetector(
        onTap: onTap,
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
                    Row(
                      children: [
                        Text(
                          timeago.format(notification.createdAt),
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                        ),
                        if (hasDeepLink) ...[
                          const SizedBox(width: 6),
                          Icon(PhosphorIconsLight.arrowSquareOut, size: 10, color: ObsidianTheme.textTertiary),
                        ],
                      ],
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
