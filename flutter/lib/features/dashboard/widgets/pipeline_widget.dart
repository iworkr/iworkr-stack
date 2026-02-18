import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/state_machine_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Lead-to-Cash Pipeline — animated visualization of the workflow engine.
class PipelineWidget extends ConsumerWidget {
  final bool compact;
  const PipelineWidget({super.key, this.compact = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgIdAsync = ref.watch(organizationIdProvider);

    return orgIdAsync.when(
      loading: () => const _PipelineShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (orgId) {
        if (orgId == null) return const SizedBox.shrink();
        return _PipelineContent(orgId: orgId, compact: compact);
      },
    );
  }
}

class _PipelineContent extends ConsumerWidget {
  final String orgId;
  final bool compact;
  const _PipelineContent({required this.orgId, required this.compact});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(pipelineStatsProvider(orgId));

    return statsAsync.when(
      loading: () => const _PipelineShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) => _PipelineView(stats: stats, compact: compact),
    );
  }
}

class _PipelineView extends StatefulWidget {
  final Map<String, int> stats;
  final bool compact;
  const _PipelineView({required this.stats, required this.compact});

  @override
  State<_PipelineView> createState() => _PipelineViewState();
}

class _PipelineViewState extends State<_PipelineView>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))
      ..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  static const _stages = [
    _Stage('Draft', 'backlog', PhosphorIconsLight.noteBlank, ObsidianTheme.textMuted),
    _Stage('Queued', 'todo', PhosphorIconsLight.queue, ObsidianTheme.blue),
    _Stage('Scheduled', 'scheduled', PhosphorIconsLight.calendarCheck, ObsidianTheme.amber),
    _Stage('Executing', 'in_progress', PhosphorIconsLight.lightning, ObsidianTheme.emerald),
    _Stage('Completed', 'done', PhosphorIconsLight.checkCircle, ObsidianTheme.emerald),
    _Stage('Invoiced', 'invoiced', PhosphorIconsLight.receipt, Color(0xFFA78BFA)),
  ];

  @override
  Widget build(BuildContext context) {
    final total = widget.stats.values.fold<int>(0, (s, v) => s + v) -
        (widget.stats['cancelled'] ?? 0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(PhosphorIconsLight.flowArrow, size: 12, color: ObsidianTheme.emerald),
            const SizedBox(width: 6),
            Text(
              'LEAD-TO-CASH',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
                letterSpacing: 1.5,
              ),
            ),
            const Spacer(),
            Text(
              '$total active',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
              ),
            ),
          ],
        ),
        SizedBox(height: widget.compact ? 10 : 16),
        if (widget.compact)
          _CompactPipeline(stages: _stages, stats: widget.stats, total: total, progress: _ctrl)
        else
          _ExpandedPipeline(stages: _stages, stats: widget.stats, total: total, progress: _ctrl),
      ],
    );
  }
}

class _CompactPipeline extends StatelessWidget {
  final List<_Stage> stages;
  final Map<String, int> stats;
  final int total;
  final AnimationController progress;

  const _CompactPipeline({
    required this.stages,
    required this.stats,
    required this.total,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: progress,
      builder: (_, __) {
        return Column(
          children: [
            SizedBox(
              height: 6,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: Row(
                  children: stages.asMap().entries.map((e) {
                    final count = stats[e.value.key] ?? 0;
                    final fraction = total > 0 ? count / total : 0.0;
                    final animFraction = fraction * progress.value;
                    return Expanded(
                      flex: max(1, (animFraction * 100).round()),
                      child: Container(
                        color: e.value.color.withValues(alpha: 0.6 + 0.4 * progress.value),
                        margin: EdgeInsets.only(right: e.key < stages.length - 1 ? 1.5 : 0),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: stages.map((s) {
                final count = stats[s.key] ?? 0;
                return Column(
                  children: [
                    Text(
                      '$count',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: count > 0 ? s.color : ObsidianTheme.textDisabled,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      s.label.substring(0, min(4, s.label.length)),
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 7,
                        color: ObsidianTheme.textTertiary,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }
}

class _ExpandedPipeline extends StatelessWidget {
  final List<_Stage> stages;
  final Map<String, int> stats;
  final int total;
  final AnimationController progress;

  const _ExpandedPipeline({
    required this.stages,
    required this.stats,
    required this.total,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: progress,
      builder: (_, __) {
        return Column(
          children: [
            // Segmented bar
            SizedBox(
              height: 8,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Row(
                  children: stages.asMap().entries.map((e) {
                    final count = stats[e.value.key] ?? 0;
                    final fraction = total > 0 ? count / total : 0.0;
                    return Expanded(
                      flex: max(1, (fraction * 100).round()),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 600),
                        color: e.value.color.withValues(alpha: 0.5 + 0.5 * progress.value),
                        margin: EdgeInsets.only(right: e.key < stages.length - 1 ? 2 : 0),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Stage cards
            ...stages.asMap().entries.map((e) {
              final s = e.value;
              final count = stats[s.key] ?? 0;
              final delayMs = 200 + e.key * 80;

              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: s.color.withValues(alpha: 0.1),
                      ),
                      child: Icon(s.icon, size: 14, color: s.color),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        s.label,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: count > 0 ? Colors.white : ObsidianTheme.textTertiary,
                        ),
                      ),
                    ),
                    // Connection line
                    if (e.key < stages.length - 1)
                      Container(
                        width: 16,
                        height: 1,
                        color: ObsidianTheme.border,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                    Text(
                      '$count',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: count > 0 ? s.color : ObsidianTheme.textDisabled,
                      ),
                    ),
                  ],
                ),
              )
                  .animate()
                  .fadeIn(
                    delay: Duration(milliseconds: delayMs),
                    duration: 400.ms,
                    curve: Curves.easeOutCubic,
                  )
                  .moveX(
                    begin: -8,
                    delay: Duration(milliseconds: delayMs),
                    duration: 400.ms,
                    curve: Curves.easeOutCubic,
                  );
            }),
          ],
        );
      },
    );
  }
}

class _Stage {
  final String label;
  final String key;
  final IconData icon;
  final Color color;
  const _Stage(this.label, this.key, this.icon, this.color);
}

class _PipelineShimmer extends StatelessWidget {
  const _PipelineShimmer();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: ObsidianTheme.shimmerBase,
          ),
        ),
        const SizedBox(height: 16),
        ...List.generate(4, (i) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: ObsidianTheme.shimmerBase,
            ),
          ),
        )),
      ],
    );
  }
}
