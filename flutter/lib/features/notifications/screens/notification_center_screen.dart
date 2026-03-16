import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/notification_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Notification Center ──────────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Full-screen notification hub with realtime updates,
// swipe actions (archive / toggle read), filter tabs, and
// deep-link navigation via action_url.

enum _NotificationFilter { all, unread, mentions, shifts, system }

class NotificationCenterScreen extends ConsumerStatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  ConsumerState<NotificationCenterScreen> createState() =>
      _NotificationCenterScreenState();
}

class _NotificationCenterScreenState
    extends ConsumerState<NotificationCenterScreen> {
  _NotificationFilter _filter = _NotificationFilter.all;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final notificationsAsync = ref.watch(notificationsProvider);
    final unreadCount = ref.watch(unreadCountProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: RefreshIndicator(
        onRefresh: () async {
          HapticFeedback.mediumImpact();
          ref.invalidate(notificationsProvider);
          // Give the stream a moment to re-emit
          await Future.delayed(const Duration(milliseconds: 500));
        },
        color: ObsidianTheme.emerald,
        backgroundColor: c.surface,
        child: CustomScrollView(
          slivers: [
            // ── Glass App Bar ──────────────────────────────
            SliverAppBar(
              pinned: true,
              floating: false,
              expandedHeight: 100,
              backgroundColor: Colors.transparent,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              leading: GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).maybePop();
                },
                child: Center(
                  child: Icon(PhosphorIconsLight.arrowLeft,
                      color: c.textPrimary, size: 22),
                ),
              ),
              flexibleSpace: ClipRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: FlexibleSpaceBar(
                    titlePadding: const EdgeInsets.only(left: 56, bottom: 14),
                    title: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'INBOX',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: ObsidianTheme.emerald,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Notifications',
                          style: GoogleFonts.inter(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            color: c.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                    background:
                        Container(color: c.canvas.withValues(alpha: 0.85)),
                  ),
                ),
              ),
              actions: [
                if (unreadCount > 0)
                  GestureDetector(
                    onTap: () async {
                      HapticFeedback.mediumImpact();
                      await markAllNotificationsRead();
                      ref.invalidate(notificationsProvider);
                    },
                    child: Padding(
                      padding: const EdgeInsets.only(right: 16),
                      child: Text(
                        'Mark all read',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: ObsidianTheme.emerald,
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            // ── Filter Tabs ────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _NotificationFilter.values.map((f) {
                      final isActive = _filter == f;
                      final label = switch (f) {
                        _NotificationFilter.all => 'All',
                        _NotificationFilter.unread => 'Unread',
                        _NotificationFilter.mentions => 'Mentions',
                        _NotificationFilter.shifts => 'Shifts',
                        _NotificationFilter.system => 'System',
                      };
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            setState(() => _filter = f);
                          },
                          child: AnimatedContainer(
                            duration: ObsidianTheme.fast,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? ObsidianTheme.emerald
                                      .withValues(alpha: 0.15)
                                  : c.surface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isActive
                                    ? ObsidianTheme.emerald
                                        .withValues(alpha: 0.4)
                                    : c.border,
                              ),
                            ),
                            child: Text(
                              label,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isActive
                                    ? ObsidianTheme.emerald
                                    : c.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),

            // ── Notification List ──────────────────────────
            notificationsAsync.when(
              loading: () => const SliverFillRemaining(
                child:
                    Center(child: CircularProgressIndicator(strokeWidth: 2)),
              ),
              error: (e, _) => SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.warningCircle,
                            size: 40, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text(
                          'Failed to load notifications',
                          style: GoogleFonts.inter(
                              color: c.textTertiary, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$e',
                          style: GoogleFonts.inter(
                              color: c.textDisabled, fontSize: 12),
                          textAlign: TextAlign.center,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              data: (allNotifications) {
                final filtered = _applyFilter(allNotifications);

                if (filtered.isEmpty) {
                  return SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(PhosphorIconsLight.bellSimple,
                              size: 48, color: c.textDisabled),
                          const SizedBox(height: 12),
                          Text(
                            _filter == _NotificationFilter.all
                                ? 'No notifications yet'
                                : 'No ${_filter.name} notifications',
                            style: GoogleFonts.inter(
                                color: c.textTertiary, fontSize: 15),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'You\'re all caught up',
                            style: GoogleFonts.inter(
                                color: c.textDisabled, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(0, 0, 0, 100),
                  sliver: SliverList.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final notification = filtered[index];
                      return _NotificationTile(
                        notification: notification,
                        onTap: () => _handleTap(notification),
                        onArchive: () => _handleArchive(notification),
                        onToggleRead: () => _handleToggleRead(notification),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  List<NotificationItem> _applyFilter(List<NotificationItem> items) {
    return switch (_filter) {
      _NotificationFilter.all => items,
      _NotificationFilter.unread => items.where((n) => !n.read).toList(),
      _NotificationFilter.mentions =>
        items.where((n) => n.type == 'mention' || n.type == 'chat_reply').toList(),
      _NotificationFilter.shifts => items
          .where((n) =>
              n.type == 'shift_assigned' ||
              n.type == 'shift_reminder' ||
              n.type == 'shift_updated')
          .toList(),
      _NotificationFilter.system =>
        items.where((n) => n.type == 'system' || n.type == 'announcement').toList(),
    };
  }

  Future<void> _handleTap(NotificationItem notification) async {
    HapticFeedback.lightImpact();

    // Mark as read
    if (!notification.read) {
      await markNotificationRead(notification.id);
      ref.invalidate(notificationsProvider);
    }

    // Navigate to action URL if available
    if (mounted) {
      final url = notification.actionUrl ?? notification.actionLink;
      if (url != null && url.isNotEmpty) {
        context.push(url);
      }
    }
  }

  Future<void> _handleArchive(NotificationItem notification) async {
    HapticFeedback.mediumImpact();
    await archiveNotification(notification.id);
    ref.invalidate(notificationsProvider);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Notification archived',
              style: GoogleFonts.inter(fontSize: 14)),
          backgroundColor: ObsidianTheme.surface2,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _handleToggleRead(NotificationItem notification) async {
    HapticFeedback.lightImpact();
    await toggleNotificationRead(notification.id,
        currentlyRead: notification.read);
    ref.invalidate(notificationsProvider);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Notification Tile ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _NotificationTile extends StatelessWidget {
  final NotificationItem notification;
  final VoidCallback onTap;
  final VoidCallback onArchive;
  final VoidCallback onToggleRead;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
    required this.onArchive,
    required this.onToggleRead,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final (icon, iconBg) = _iconForType(notification.type);

    return Dismissible(
      key: ValueKey(notification.id),
      background: _SwipeBackground(
        alignment: Alignment.centerLeft,
        color: ObsidianTheme.careBlue,
        icon: notification.read
            ? PhosphorIconsBold.envelopeSimple
            : PhosphorIconsBold.envelopeSimpleOpen,
        label: notification.read ? 'Unread' : 'Read',
      ),
      secondaryBackground: _SwipeBackground(
        alignment: Alignment.centerRight,
        color: ObsidianTheme.rose,
        icon: PhosphorIconsBold.trash,
        label: 'Archive',
      ),
      confirmDismiss: (direction) async {
        if (direction == DismissDirection.startToEnd) {
          onToggleRead();
          return false; // Don't remove from list
        } else {
          onArchive();
          return true; // Remove from list
        }
      },
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: notification.read ? Colors.transparent : c.activeBg,
            border: Border(
              bottom: BorderSide(color: c.border, width: 0.5),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Unread dot + Icon ──
              SizedBox(
                width: 44,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // Icon circle
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: iconBg.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Icon(icon, size: 18, color: iconBg),
                      ),
                    ),
                    // Unread indicator
                    if (!notification.read)
                      Positioned(
                        left: -4,
                        top: 14,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: ObsidianTheme.emerald,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color:
                                    ObsidianTheme.emerald.withValues(alpha: 0.4),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // ── Content ──
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title row
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight:
                                  notification.read ? FontWeight.w500 : FontWeight.w600,
                              color: c.textPrimary,
                              letterSpacing: -0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _timeAgo(notification.createdAt),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: c.textTertiary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),

                    // Sender name
                    if (notification.senderName != null &&
                        notification.senderName!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          notification.senderName!,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: c.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),

                    // Body
                    if (notification.body.isNotEmpty)
                      Text(
                        notification.body,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: c.textMuted,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                    // Priority badge
                    if (notification.isHighPriority)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.roseDim,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            notification.priority.toUpperCase(),
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                              color: ObsidianTheme.rose,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // ── Chevron ──
              Padding(
                padding: const EdgeInsets.only(top: 10, left: 4),
                child: Icon(PhosphorIconsLight.caretRight,
                    size: 14, color: c.textDisabled),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Returns (icon, background color) based on notification type.
  (IconData, Color) _iconForType(String type) {
    return switch (type) {
      'mention' => (PhosphorIconsBold.at, ObsidianTheme.careBlue),
      'nudge' => (PhosphorIconsBold.clock, ObsidianTheme.amber),
      'announcement' => (PhosphorIconsBold.megaphone, ObsidianTheme.rose),
      'job_assigned' => (PhosphorIconsBold.briefcase, ObsidianTheme.emerald),
      'invoice_paid' => (PhosphorIconsBold.creditCard, ObsidianTheme.emerald),
      'shift_assigned' ||
      'shift_reminder' ||
      'shift_updated' =>
        (PhosphorIconsBold.calendarCheck, ObsidianTheme.emerald),
      'chat_reply' => (PhosphorIconsBold.chatCircle, ObsidianTheme.violet),
      'system' => (PhosphorIconsBold.bell, const Color(0xFF71717A)), // zinc-500
      _ => (PhosphorIconsBold.bellSimple, const Color(0xFF71717A)),
    };
  }
}

// ═══════════════════════════════════════════════════════════
// ── Swipe Background ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _SwipeBackground extends StatelessWidget {
  final Alignment alignment;
  final Color color;
  final IconData icon;
  final String label;

  const _SwipeBackground({
    required this.alignment,
    required this.color,
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final isLeft = alignment == Alignment.centerLeft;
    return Container(
      color: color.withValues(alpha: 0.15),
      padding: EdgeInsets.only(
        left: isLeft ? 24 : 0,
        right: isLeft ? 0 : 24,
      ),
      alignment: alignment,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!isLeft) ...[
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Icon(icon, size: 20, color: color),
          if (isLeft) ...[
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

String _timeAgo(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
  return '${dt.day}/${dt.month}/${dt.year}';
}
