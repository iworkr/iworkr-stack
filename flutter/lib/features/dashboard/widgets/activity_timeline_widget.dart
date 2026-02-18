import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/state_machine_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Activity Timeline — live feed of state changes across the organization.
class ActivityTimelineWidget extends ConsumerWidget {
  final bool expanded;
  const ActivityTimelineWidget({super.key, this.expanded = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgIdAsync = ref.watch(organizationIdProvider);

    return orgIdAsync.when(
      loading: () => const _TimelineShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (orgId) {
        if (orgId == null) return const SizedBox.shrink();
        return _TimelineContent(orgId: orgId, expanded: expanded);
      },
    );
  }
}

class _TimelineContent extends ConsumerWidget {
  final String orgId;
  final bool expanded;
  const _TimelineContent({required this.orgId, required this.expanded});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auditAsync = ref.watch(recentAuditLogProvider(orgId));

    return auditAsync.when(
      loading: () => const _TimelineShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (entries) {
        if (entries.isEmpty) {
          return _EmptyTimeline(expanded: expanded);
        }
        return _TimelineView(entries: entries, expanded: expanded);
      },
    );
  }
}

class _TimelineView extends StatelessWidget {
  final List<Map<String, dynamic>> entries;
  final bool expanded;
  const _TimelineView({required this.entries, required this.expanded});

  @override
  Widget build(BuildContext context) {
    final display = expanded ? entries.take(8).toList() : entries.take(4).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(PhosphorIconsLight.pulse, size: 12, color: ObsidianTheme.blue),
            const SizedBox(width: 6),
            Text(
              'ACTIVITY',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
                letterSpacing: 1.5,
              ),
            ),
            const Spacer(),
            Text(
              '${entries.length} events',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...display.asMap().entries.map((e) {
          final entry = e.value;
          final isLast = e.key == display.length - 1;
          return _TimelineEntry(
            entry: entry,
            isLast: isLast,
            expanded: expanded,
          )
              .animate()
              .fadeIn(
                delay: Duration(milliseconds: 80 + e.key * 60),
                duration: 400.ms,
                curve: Curves.easeOutCubic,
              )
              .moveX(
                begin: -6,
                delay: Duration(milliseconds: 80 + e.key * 60),
                duration: 400.ms,
                curve: Curves.easeOutCubic,
              );
        }),
      ],
    );
  }
}

class _TimelineEntry extends StatelessWidget {
  final Map<String, dynamic> entry;
  final bool isLast;
  final bool expanded;

  const _TimelineEntry({
    required this.entry,
    required this.isLast,
    required this.expanded,
  });

  @override
  Widget build(BuildContext context) {
    final entityType = entry['entity_type'] as String? ?? 'unknown';
    final action = entry['action'] as String? ?? '';
    final newData = entry['new_data'] as Map<String, dynamic>? ?? {};
    final oldData = entry['old_data'] as Map<String, dynamic>? ?? {};
    final createdAt = DateTime.tryParse(entry['created_at']?.toString() ?? '');

    final meta = _resolveEntryMeta(entityType, action, oldData, newData);
    final timeAgo = createdAt != null ? _timeAgo(createdAt) : '';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline line + dot
          SizedBox(
            width: 20,
            child: Column(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: meta.color,
                    border: Border.all(
                      color: meta.color.withValues(alpha: 0.3),
                      width: 2,
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1,
                      color: ObsidianTheme.border,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(meta.icon, size: 12, color: meta.color),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          meta.title,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        timeAgo,
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 9,
                          color: ObsidianTheme.textTertiary,
                        ),
                      ),
                    ],
                  ),
                  if (expanded && meta.subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        meta.subtitle!,
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          color: ObsidianTheme.textTertiary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  _EntryMeta _resolveEntryMeta(
    String entityType,
    String action,
    Map<String, dynamic> oldData,
    Map<String, dynamic> newData,
  ) {
    final fromStatus = oldData['status'] as String?;
    final toStatus = newData['status'] as String?;

    if (action == 'status_change' && fromStatus != null && toStatus != null) {
      return _EntryMeta(
        icon: _iconForEntity(entityType),
        color: _colorForStatus(toStatus),
        title: '${_entityLabel(entityType)} → ${_statusLabel(toStatus)}',
        subtitle: 'Changed from ${_statusLabel(fromStatus)}',
      );
    }

    if (action.contains('create') || action.contains('insert')) {
      return _EntryMeta(
        icon: PhosphorIconsLight.plus,
        color: ObsidianTheme.emerald,
        title: '${_entityLabel(entityType)} created',
        subtitle: null,
      );
    }

    return _EntryMeta(
      icon: PhosphorIconsLight.pencilSimple,
      color: ObsidianTheme.blue,
      title: '${_entityLabel(entityType)} updated',
      subtitle: action,
    );
  }

  IconData _iconForEntity(String type) {
    switch (type) {
      case 'job': return PhosphorIconsLight.briefcase;
      case 'invoice': return PhosphorIconsLight.receipt;
      case 'quote': return PhosphorIconsLight.fileText;
      default: return PhosphorIconsLight.circleNotch;
    }
  }

  Color _colorForStatus(String status) {
    switch (status) {
      case 'done':
      case 'paid':
      case 'accepted':
        return ObsidianTheme.emerald;
      case 'in_progress':
      case 'scheduled':
        return ObsidianTheme.blue;
      case 'overdue':
      case 'cancelled':
      case 'rejected':
        return ObsidianTheme.rose;
      case 'sent':
      case 'viewed':
        return ObsidianTheme.amber;
      case 'invoiced':
        return const Color(0xFFA78BFA);
      default:
        return ObsidianTheme.textMuted;
    }
  }

  String _entityLabel(String type) {
    switch (type) {
      case 'job': return 'Job';
      case 'invoice': return 'Invoice';
      case 'quote': return 'Quote';
      default: return type;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'backlog': return 'Draft';
      case 'todo': return 'To Do';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      case 'done': return 'Completed';
      case 'invoiced': return 'Invoiced';
      case 'cancelled': return 'Cancelled';
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'partially_paid': return 'Partial';
      case 'paid': return 'Paid';
      case 'overdue': return 'Overdue';
      case 'voided': return 'Void';
      case 'viewed': return 'Viewed';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${(diff.inDays / 7).floor()}w';
  }
}

class _EmptyTimeline extends StatelessWidget {
  final bool expanded;
  const _EmptyTimeline({required this.expanded});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(PhosphorIconsLight.pulse, size: 12, color: ObsidianTheme.blue),
            const SizedBox(width: 6),
            Text(
              'ACTIVITY',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
        SizedBox(height: expanded ? 20 : 12),
        Center(
          child: Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.surface2,
                ),
                child: Icon(PhosphorIconsLight.pulse, size: 16, color: ObsidianTheme.textTertiary),
              ),
              const SizedBox(height: 6),
              Text(
                'No activity yet',
                style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TimelineShimmer extends StatelessWidget {
  const _TimelineShimmer();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(3, (i) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.shimmerBase,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                height: 14,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: ObsidianTheme.shimmerBase,
                ),
              ),
            ),
          ],
        ),
      )),
    );
  }
}

class _EntryMeta {
  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  const _EntryMeta({
    required this.icon,
    required this.color,
    required this.title,
    this.subtitle,
  });
}
