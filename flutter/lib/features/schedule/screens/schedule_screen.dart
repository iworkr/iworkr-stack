import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:intl/intl.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/empty_state.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

/// Schedule screen — "The Tactical Timeline"
///
/// Web spec (schedule):
/// - Background: #050505
/// - Laser line: #10B981 1px with glow shadow
/// - Job blocks: bg-[#1A1A1A], border-white/5, 3px status spine
/// - Date navigator: segmented control style
class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final blocksAsync = ref.watch(scheduleBlocksProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header + Date Navigator
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Schedule',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

                  const SizedBox(height: 14),

                  // Date Navigator — web: segmented control, bg-zinc-900 rounded-lg p-1
                  Row(
                    children: [
                      _NavArrow(
                        icon: PhosphorIconsRegular.caretLeft,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          ref.read(selectedDateProvider.notifier).state =
                              selectedDate.subtract(const Duration(days: 1));
                        },
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            ref.read(selectedDateProvider.notifier).state = DateTime.now();
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              borderRadius: ObsidianTheme.radiusMd,
                              color: ObsidianTheme.shimmerBase,
                              border: Border.all(color: ObsidianTheme.border),
                            ),
                            child: Center(
                              child: Text(
                                _isToday(selectedDate)
                                    ? 'Today, ${DateFormat('MMM d').format(selectedDate)}'
                                    : DateFormat('EEE, MMM d').format(selectedDate),
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: ObsidianTheme.textPrimary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _NavArrow(
                        icon: PhosphorIconsRegular.caretRight,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          ref.read(selectedDateProvider.notifier).state =
                              selectedDate.add(const Duration(days: 1));
                        },
                      ),
                    ],
                  ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // The Laser Line — current time indicator
            if (_isToday(selectedDate))
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.emerald,
                        boxShadow: [
                          BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 6),
                          BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.2), blurRadius: 12),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      DateFormat('h:mm a').format(DateTime.now()),
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        color: ObsidianTheme.emerald,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        height: 1,
                        decoration: BoxDecoration(
                          color: ObsidianTheme.emerald,
                          boxShadow: [
                            BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 6),
                            BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.2), blurRadius: 12),
                          ],
                        ),
                      ),
                    ),
                  ],
                )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .fadeIn(duration: 400.ms)
                    .then()
                    .custom(
                      duration: 2000.ms,
                      builder: (context, value, child) => Opacity(
                        opacity: 0.7 + 0.3 * value,
                        child: child,
                      ),
                    ),
              ),

            const SizedBox(height: 8),

            // Timeline
            Expanded(
              child: blocksAsync.when(
                data: (blocks) {
                  if (blocks.isEmpty) {
                    return const EmptyState(
                      icon: PhosphorIconsRegular.calendarBlank,
                      title: 'No signal detected',
                      subtitle: 'Schedule is clear for this day.',
                    );
                  }
                  return _TimelineView(blocks: blocks, selectedDate: selectedDate);
                },
                loading: () => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: List.generate(
                      4,
                      (_) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: ShimmerLoading(height: 72, borderRadius: ObsidianTheme.radiusLg),
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

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }
}

class _TimelineView extends StatelessWidget {
  final List<ScheduleBlock> blocks;
  final DateTime selectedDate;
  const _TimelineView({required this.blocks, required this.selectedDate});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final isToday = selectedDate.year == now.year &&
        selectedDate.month == now.month &&
        selectedDate.day == now.day;

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
      itemCount: blocks.length,
      itemBuilder: (context, i) {
        final block = blocks[i];
        final isActive = isToday &&
            now.isAfter(block.startTime) &&
            now.isBefore(block.endTime);

        return _ScheduleBlockCard(block: block, index: i, isActive: isActive);
      },
    );
  }
}

/// Schedule block card — matches web ScheduleBlock.tsx
class _ScheduleBlockCard extends StatelessWidget {
  final ScheduleBlock block;
  final int index;
  final bool isActive;

  const _ScheduleBlockCard({required this.block, required this.index, required this.isActive});

  Color _statusColor() {
    if (isActive) return ObsidianTheme.emerald;
    switch (block.status) {
      case ScheduleBlockStatus.inProgress:
        return ObsidianTheme.emerald;
      case ScheduleBlockStatus.enRoute:
        return ObsidianTheme.amber;
      case ScheduleBlockStatus.complete:
        return ObsidianTheme.textTertiary;
      case ScheduleBlockStatus.cancelled:
        return ObsidianTheme.rose;
      default:
        return ObsidianTheme.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: ObsidianTheme.surface1,
        border: Border.all(
          color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.border,
        ),
        boxShadow: isActive
            ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.08), blurRadius: 12)]
            : null,
      ),
      child: ClipRRect(
        borderRadius: ObsidianTheme.radiusLg,
        child: Row(
          children: [
            // Status spine (3px)
            Container(
              width: 3,
              height: 72,
              decoration: BoxDecoration(
                color: _statusColor(),
                boxShadow: isActive
                    ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.3), blurRadius: 8)]
                    : null,
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          block.timeRange,
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            color: ObsidianTheme.textTertiary,
                          ),
                        ),
                        if (isActive) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: ObsidianTheme.emeraldDim,
                            ),
                            child: Text(
                              'NOW',
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 8,
                                color: ObsidianTheme.emerald,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const Spacer(),
                        Text(
                          block.status.label,
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            color: ObsidianTheme.textTertiary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      block.title,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: ObsidianTheme.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (block.location != null) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(PhosphorIconsRegular.mapPin, size: 10, color: ObsidianTheme.textTertiary),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              block.location!,
                              style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 150 + index * 30), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveX(begin: -12, end: 0, delay: Duration(milliseconds: 150 + index * 30), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

/// Nav arrow — web spec: ghost button
class _NavArrow extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _NavArrow({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          border: Border.all(color: ObsidianTheme.borderMedium),
          color: ObsidianTheme.surface1,
        ),
        child: Icon(icon, size: 16, color: ObsidianTheme.textSecondary),
      ),
    );
  }
}
