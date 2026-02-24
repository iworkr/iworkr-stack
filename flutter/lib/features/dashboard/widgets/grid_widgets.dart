import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/dashboard_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/route_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/jobs/screens/create_job_sheet.dart';
import 'package:iworkr_mobile/features/scan/screens/scanner_screen.dart';
import 'package:iworkr_mobile/features/search/screens/command_palette_screen.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/pipeline_widget.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/risk_radar_widget.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/financial_pulse_widget.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/activity_timeline_widget.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

/// Builds the correct widget content for a given [config].
Widget buildGridWidget(DashboardWidgetConfig config, WidgetRef ref) {
  switch (config.type) {
    case 'revenue':
      return _RevenueWidget(size: config.size, ref: ref);
    case 'next_job':
      return _NextJobWidget(size: config.size, ref: ref);
    case 'quick_actions':
      return _QuickActionsWidget(size: config.size);
    case 'team_pulse':
      return _TeamPulseWidget(size: config.size, ref: ref);
    case 'schedule':
      return _ScheduleWidget(size: config.size, ref: ref);
    case 'route':
      return _RouteWidget(size: config.size, ref: ref);
    case 'stats':
      return _StatsWidget(size: config.size, ref: ref);
    case 'pipeline':
      return PipelineWidget(compact: config.size != WidgetSize.large);
    case 'risk_radar':
      return RiskRadarWidget(expanded: config.size == WidgetSize.large);
    case 'financial_pulse':
      return FinancialPulseWidget(expanded: config.size != WidgetSize.small);
    case 'activity':
      return ActivityTimelineWidget(expanded: config.size == WidgetSize.large);
    default:
      return Center(
        child: Text(config.type, style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10)),
      );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Revenue Widget ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _RevenueWidget extends StatelessWidget {
  final WidgetSize size;
  final WidgetRef ref;
  const _RevenueWidget({required this.size, required this.ref});

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(revenueStatsProvider);

    return statsAsync.when(
      loading: () => _WidgetShimmer(),
      error: (_, __) => _WidgetError(label: 'Revenue'),
      data: (stats) {
        final revenue = stats['totalRevenue'] ?? 0;
        final formatted = NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(revenue);

        switch (size) {
          case WidgetSize.small:
            return _SmallRevenue(formatted: formatted);
          case WidgetSize.medium:
            return _MediumRevenue(formatted: formatted, stats: stats);
          case WidgetSize.large:
            return _LargeRevenue(formatted: formatted, stats: stats);
        }
      },
    );
  }
}

class _SmallRevenue extends StatelessWidget {
  final String formatted;
  const _SmallRevenue({required this.formatted});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('REVENUE', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
        Text(
          formatted,
          style: GoogleFonts.jetBrainsMono(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1),
        ),
        SizedBox(height: 20, child: _MiniSparkline(color: ObsidianTheme.emerald)),
      ],
    );
  }
}

class _MediumRevenue extends StatelessWidget {
  final String formatted;
  final Map<String, double> stats;
  const _MediumRevenue({required this.formatted, required this.stats});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('REVENUE MTD', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: ObsidianTheme.emeraldDim,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(PhosphorIconsBold.trendUp, size: 10, color: ObsidianTheme.emerald),
                  const SizedBox(width: 3),
                  Text('+12%', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          formatted,
          style: GoogleFonts.jetBrainsMono(fontSize: 32, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1.5),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 40,
          child: _SparklineChart(color: ObsidianTheme.emerald, fillOpacity: 0.08),
        )
            .animate()
            .scaleX(begin: 0, end: 1, alignment: Alignment.centerLeft, duration: 800.ms, curve: Curves.easeOutCubic),
      ],
    );
  }
}

class _LargeRevenue extends StatelessWidget {
  final String formatted;
  final Map<String, double> stats;
  const _LargeRevenue({required this.formatted, required this.stats});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('REVENUE MTD', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), color: ObsidianTheme.emeraldDim),
              child: Text('+12% vs last month', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.emerald)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          formatted,
          style: GoogleFonts.jetBrainsMono(fontSize: 36, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1.5),
        ),
        const SizedBox(height: 16),
        Expanded(child: _BarChart()),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Stats Widget ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StatsWidget extends StatelessWidget {
  final WidgetSize size;
  final WidgetRef ref;
  const _StatsWidget({required this.size, required this.ref});

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(revenueStatsProvider);

    return statsAsync.when(
      loading: () => _WidgetShimmer(),
      error: (_, __) => _WidgetError(label: 'Stats'),
      data: (stats) {
        final active = stats['activeJobs']?.toInt() ?? 0;
        final completed = stats['jobsCompleted']?.toInt() ?? 0;

        if (size == WidgetSize.small) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(PhosphorIconsLight.briefcase, size: 12, color: ObsidianTheme.textMuted),
                  const SizedBox(width: 4),
                  Text('JOBS', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                ],
              ),
              Row(
                children: [
                  Text('$active', style: GoogleFonts.jetBrainsMono(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1)),
                  Text(' active', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                ],
              ),
              Row(
                children: [
                  Icon(PhosphorIconsBold.checkCircle, size: 10, color: ObsidianTheme.emerald),
                  const SizedBox(width: 4),
                  Text('$completed done', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                ],
              ),
            ],
          );
        }

        return Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(children: [
                    Icon(PhosphorIconsLight.briefcase, size: 12, color: ObsidianTheme.textMuted),
                    const SizedBox(width: 4),
                    Text('ACTIVE', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
                  ]),
                  const SizedBox(height: 6),
                  Text('$active', style: GoogleFonts.jetBrainsMono(fontSize: 28, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1)),
                ],
              ),
            ),
            Container(width: 1, height: 40, color: ObsidianTheme.border),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(children: [
                      Icon(PhosphorIconsLight.checkCircle, size: 12, color: ObsidianTheme.emerald),
                      const SizedBox(width: 4),
                      Text('DONE', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
                    ]),
                    const SizedBox(height: 6),
                    Text('$completed', style: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1)),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Next Job Widget ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _NextJobWidget extends StatelessWidget {
  final WidgetSize size;
  final WidgetRef ref;
  const _NextJobWidget({required this.size, required this.ref});

  @override
  Widget build(BuildContext context) {
    final blocksAsync = ref.watch(myTodayBlocksProvider);

    return blocksAsync.when(
      loading: () => _WidgetShimmer(),
      error: (_, __) => _WidgetError(label: 'Next Job'),
      data: (blocks) {
        final now = DateTime.now();
        final upcoming = blocks.where((b) =>
            b.endTime.isAfter(now) &&
            b.status != ScheduleBlockStatus.complete &&
            b.status != ScheduleBlockStatus.cancelled).toList();

        if (upcoming.isEmpty) {
          return _NoDataState(icon: PhosphorIconsLight.calendarBlank, label: 'No upcoming jobs');
        }

        final next = upcoming.first;
        final timeStr = '${next.startTime.hour.toString().padLeft(2, '0')}:${next.startTime.minute.toString().padLeft(2, '0')}';
        final isInProgress = next.status == ScheduleBlockStatus.inProgress;

        switch (size) {
          case WidgetSize.small:
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('NEXT', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                Text(timeStr, style: GoogleFonts.jetBrainsMono(fontSize: 22, fontWeight: FontWeight.w700, color: isInProgress ? ObsidianTheme.emerald : Colors.white)),
                Text(next.title, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            );

          case WidgetSize.medium:
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (isInProgress)
                      Container(
                        width: 6, height: 6,
                        margin: const EdgeInsets.only(right: 6),
                        decoration: BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald),
                      ),
                    Text(isInProgress ? 'IN PROGRESS' : 'NEXT JOB', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: isInProgress ? ObsidianTheme.emerald : ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                    const Spacer(),
                    Text(timeStr, style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white70)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(next.title, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                if (next.clientName != null || next.location != null)
                  Row(
                    children: [
                      Icon(PhosphorIconsLight.mapPin, size: 11, color: ObsidianTheme.textTertiary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(next.location ?? next.clientName ?? '', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
              ],
            );

          case WidgetSize.large:
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (isInProgress)
                      Container(width: 6, height: 6, margin: const EdgeInsets.only(right: 6), decoration: BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald)),
                    Text(isInProgress ? 'IN PROGRESS' : 'NEXT JOB', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: isInProgress ? ObsidianTheme.emerald : ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                    const Spacer(),
                    Text(timeStr, style: GoogleFonts.jetBrainsMono(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                  ],
                ),
                const SizedBox(height: 10),
                Text(next.title, style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
                if (next.clientName != null) ...[
                  const SizedBox(height: 4),
                  Text(next.clientName!, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textSecondary)),
                ],
                if (next.location != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(PhosphorIconsLight.mapPin, size: 11, color: ObsidianTheme.textTertiary),
                      const SizedBox(width: 4),
                      Expanded(child: Text(next.location!, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                ],
                const Spacer(),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          if (next.jobId != null) context.push('/jobs/${next.jobId}');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), color: ObsidianTheme.surface2, border: Border.all(color: ObsidianTheme.borderMedium)),
                          child: Center(child: Text('View Job', style: GoogleFonts.inter(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w500))),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          context.push('/flight-path');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            gradient: LinearGradient(colors: [ObsidianTheme.emerald, ObsidianTheme.emerald.withValues(alpha: 0.85)]),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(PhosphorIconsBold.navigationArrow, size: 12, color: Colors.white),
                              const SizedBox(width: 6),
                              Text('Navigate', style: GoogleFonts.inter(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            );
        }
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Quick Actions Widget ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _QuickActionsWidget extends StatelessWidget {
  final WidgetSize size;
  const _QuickActionsWidget({required this.size});

  @override
  Widget build(BuildContext context) {
    if (size == WidgetSize.small) {
      return GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ScannerScreen()));
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _AnimatedActionIcon(icon: PhosphorIconsLight.barcode, color: ObsidianTheme.emerald),
            const SizedBox(height: 6),
            Text('SCAN', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
          ],
        ),
      );
    }

    final actions = [
      _ActionDef(icon: PhosphorIconsLight.barcode, label: 'Scan', color: Colors.white, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ScannerScreen()))),
      _ActionDef(icon: PhosphorIconsLight.plus, label: 'New Job', color: Colors.white, onTap: () => showCreateJobSheet(context)),
      _ActionDef(icon: PhosphorIconsLight.magnifyingGlass, label: 'Search', color: Colors.white, onTap: () => showCommandPalette(context)),
      _ActionDef(icon: PhosphorIconsLight.timer, label: 'Clock', color: Colors.white, onTap: () => HapticFeedback.lightImpact()),
    ];

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: actions.map((a) {
        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            a.onTap();
          },
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _AnimatedActionIcon(icon: a.icon, color: a.color),
              const SizedBox(height: 6),
              Text(a.label.toUpperCase(), style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 0.5)),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _ActionDef {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionDef({required this.icon, required this.label, required this.color, required this.onTap});
}

class _AnimatedActionIcon extends StatefulWidget {
  final IconData icon;
  final Color color;
  const _AnimatedActionIcon({required this.icon, required this.color});

  @override
  State<_AnimatedActionIcon> createState() => _AnimatedActionIconState();
}

class _AnimatedActionIconState extends State<_AnimatedActionIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: Colors.white.withValues(alpha: 0.03 + _ctrl.value * 0.02),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Icon(widget.icon, size: 18, color: widget.color),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Team Pulse Widget ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _TeamPulseWidget extends StatelessWidget {
  final WidgetSize size;
  final WidgetRef ref;
  const _TeamPulseWidget({required this.size, required this.ref});

  @override
  Widget build(BuildContext context) {
    final teamAsync = ref.watch(teamMembersProvider);

    return teamAsync.when(
      loading: () => _WidgetShimmer(),
      error: (_, __) => _WidgetError(label: 'Team'),
      data: (members) {
        if (members.isEmpty) return _NoDataState(icon: PhosphorIconsLight.users, label: 'No team members');

        final displayMembers = size == WidgetSize.large ? members.take(5).toList() : members.take(3).toList();

        if (size == WidgetSize.medium) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('TEAM PULSE', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
              const SizedBox(height: 10),
              Row(
                children: displayMembers.map((m) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: _TeamAvatar(name: m['full_name'] as String? ?? '?', avatarUrl: m['avatar_url'] as String?, isOnline: true),
                  );
                }).toList(),
                ),
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('TEAM PULSE', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
            const SizedBox(height: 10),
            ...displayMembers.asMap().entries.map((e) {
              final m = e.value;
              final name = m['full_name'] as String? ?? 'Unknown';
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    _TeamAvatar(name: name, avatarUrl: m['avatar_url'] as String?, isOnline: true, size: 28),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white)),
                          Text('Active now', style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        );
      },
    );
  }
}

class _TeamAvatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final bool isOnline;
  final double size;
  const _TeamAvatar({required this.name, this.avatarUrl, required this.isOnline, this.size = 36});

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Stack(
      children: [
        avatarUrl != null && avatarUrl!.isNotEmpty
          ? CircleAvatar(
              radius: size / 2,
              backgroundImage: NetworkImage(avatarUrl!),
              backgroundColor: ObsidianTheme.surface2,
            )
          : Container(
          width: size, height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.surface2,
            border: Border.all(color: ObsidianTheme.borderMedium),
          ),
          child: Center(child: Text(initial, style: GoogleFonts.inter(fontSize: size * 0.36, fontWeight: FontWeight.w600, color: ObsidianTheme.textSecondary))),
        ),
        if (isOnline)
          Positioned(
            right: 0, bottom: 0,
            child: _BreathingDot(),
          ),
      ],
    );
  }
}

class _BreathingDot extends StatefulWidget {
  @override
  State<_BreathingDot> createState() => _BreathingDotState();
}

class _BreathingDotState extends State<_BreathingDot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Container(
          width: 10, height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emerald,
            border: Border.all(color: ObsidianTheme.void_, width: 2),
            boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.3 + _ctrl.value * 0.3), blurRadius: 4 + _ctrl.value * 4)],
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Schedule Widget ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ScheduleWidget extends StatelessWidget {
  final WidgetSize size;
  final WidgetRef ref;
  const _ScheduleWidget({required this.size, required this.ref});

  Color _statusColor(dynamic status) {
    final s = status.toString();
    if (s.contains('inProgress')) return ObsidianTheme.emerald;
    if (s.contains('enRoute')) return ObsidianTheme.emerald;
    if (s.contains('complete')) return ObsidianTheme.textTertiary;
    return ObsidianTheme.textMuted;
  }

  @override
  Widget build(BuildContext context) {
    final blocksAsync = ref.watch(myTodayBlocksProvider);

    return blocksAsync.when(
      loading: () => _WidgetShimmer(),
      error: (_, __) => _WidgetError(label: 'Schedule'),
      data: (blocks) {
        if (blocks.isEmpty) return _NoDataState(icon: PhosphorIconsLight.calendarBlank, label: 'Clear day ahead');

        final display = size == WidgetSize.large ? blocks.take(5).toList() : blocks.take(3).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text("TODAY'S SCHEDULE", style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                const Spacer(),
                GestureDetector(
                  onTap: () => context.go('/schedule'),
                  child: Text('View all', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textMuted, fontWeight: FontWeight.w500)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...display.map((b) {
              final time = '${b.startTime.hour.toString().padLeft(2, '0')}:${b.startTime.minute.toString().padLeft(2, '0')}';
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(width: 3, height: 32, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: _statusColor(b.status))),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(b.title, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text(b.location ?? b.clientName ?? '', style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    Text(time, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                  ],
                ),
              );
            }),
          ],
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Route Widget ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _RouteWidget extends StatelessWidget {
  final WidgetSize size;
  final WidgetRef ref;
  const _RouteWidget({required this.size, required this.ref});

  @override
  Widget build(BuildContext context) {
    final routeAsync = ref.watch(todayRouteProvider);

    return routeAsync.when(
      loading: () => _WidgetShimmer(),
      error: (_, __) => _WidgetError(label: 'Route'),
      data: (route) {
        if (route == null) {
          return GestureDetector(
            onTap: () async {
              HapticFeedback.mediumImpact();
              await generateOptimizedRoute();
              ref.invalidate(todayRouteProvider);
            },
            child: _NoDataState(icon: PhosphorIconsLight.path, label: 'Tap to optimize route'),
          );
        }

        return GestureDetector(
          onTap: () => context.push('/route'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ROUTE INTEL', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _RouteMiniStat(label: 'STOPS', value: '${route.jobSequence.length}', color: Colors.white),
                  _RouteMiniStat(label: 'DRIVE', value: route.driveTimeLabel, color: Colors.white),
                  _RouteMiniStat(label: 'DIST', value: route.distanceLabel, color: ObsidianTheme.emerald),
                ],
              ),
              if (size == WidgetSize.large) ...[
                const SizedBox(height: 12),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: CustomPaint(
                      painter: _MiniRouteMapPainter(stops: route.jobSequence),
                      size: const Size(double.infinity, double.infinity),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _RouteMiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _RouteMiniStat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: GoogleFonts.jetBrainsMono(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
        const SizedBox(height: 2),
        Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 7, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Shared Components ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _WidgetShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 20, height: 20,
        child: CircularProgressIndicator(color: ObsidianTheme.textTertiary, strokeWidth: 1.5),
      ),
    );
  }
}

class _WidgetError extends StatelessWidget {
  final String label;
  const _WidgetError({required this.label});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(PhosphorIconsLight.warning, size: 16, color: ObsidianTheme.rose),
          const SizedBox(height: 4),
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary)),
        ],
      ),
    );
  }
}

class _NoDataState extends StatelessWidget {
  final IconData icon;
  final String label;
  const _NoDataState({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.surface2),
            child: Icon(icon, size: 16, color: ObsidianTheme.textTertiary),
          ),
          const SizedBox(height: 6),
          Text(label, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
        ],
      ),
    );
  }
}

/// Animated sparkline (mini)
class _MiniSparkline extends StatefulWidget {
  final Color color;
  const _MiniSparkline({required this.color});

  @override
  State<_MiniSparkline> createState() => _MiniSparklineState();
}

class _MiniSparklineState extends State<_MiniSparkline>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => CustomPaint(
        painter: _SparklinePainter(progress: _ctrl.value, color: widget.color),
        size: const Size(double.infinity, 20),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final double progress;
  final Color color;
  _SparklinePainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final points = [0.4, 0.6, 0.35, 0.7, 0.5, 0.8, 0.65, 0.9];
    final path = Path();
    final step = size.width / (points.length - 1);

    for (int i = 0; i < points.length; i++) {
      final x = step * i;
      final y = size.height - (points[i] * size.height);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        final prev = Offset(step * (i - 1), size.height - (points[i - 1] * size.height));
        final cp1 = Offset((prev.dx + x) / 2, prev.dy);
        final cp2 = Offset((prev.dx + x) / 2, y);
        path.cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, x, y);
      }
    }

    final trimmedPath = _trimPath(path, progress);

    canvas.drawPath(
      trimmedPath,
      Paint()
        ..color = color
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  Path _trimPath(Path original, double fraction) {
    final metrics = original.computeMetrics().toList();
    if (metrics.isEmpty) return original;
    final totalLength = metrics.fold<double>(0, (sum, m) => sum + m.length);
    final trimLength = totalLength * fraction;

    final result = Path();
    double accumulated = 0;
    for (final metric in metrics) {
      if (accumulated + metric.length <= trimLength) {
        result.addPath(metric.extractPath(0, metric.length), Offset.zero);
        accumulated += metric.length;
      } else {
        final remaining = trimLength - accumulated;
        if (remaining > 0) {
          result.addPath(metric.extractPath(0, remaining), Offset.zero);
        }
        break;
      }
    }
    return result;
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.progress != progress;
}

/// Full sparkline chart with gradient fill
class _SparklineChart extends StatefulWidget {
  final Color color;
  final double fillOpacity;
  const _SparklineChart({required this.color, this.fillOpacity = 0.1});

  @override
  State<_SparklineChart> createState() => _SparklineChartState();
}

class _SparklineChartState extends State<_SparklineChart>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => CustomPaint(
        painter: _ChartPainter(progress: _ctrl.value, color: widget.color, fillOpacity: widget.fillOpacity),
        size: const Size(double.infinity, double.infinity),
      ),
    );
  }
}

class _ChartPainter extends CustomPainter {
  final double progress;
  final Color color;
  final double fillOpacity;
  _ChartPainter({required this.progress, required this.color, required this.fillOpacity});

  @override
  void paint(Canvas canvas, Size size) {
    final points = [0.3, 0.5, 0.4, 0.65, 0.55, 0.7, 0.6, 0.85, 0.75, 0.9];
    final path = Path();
    final step = size.width / (points.length - 1);

    for (int i = 0; i < points.length; i++) {
      final x = step * i;
      final y = size.height - (points[i] * size.height);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        final prev = Offset(step * (i - 1), size.height - (points[i - 1] * size.height));
        path.cubicTo((prev.dx + x) / 2, prev.dy, (prev.dx + x) / 2, y, x, y);
      }
    }

    // Clip to progress
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width * progress, size.height));

    // Fill gradient
    final fillPath = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: fillOpacity), color.withValues(alpha: 0)],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );

    // Stroke
    canvas.drawPath(
      path,
      Paint()..color = color..strokeWidth = 2..style = PaintingStyle.stroke..strokeCap = StrokeCap.round,
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(_ChartPainter old) => old.progress != progress;
}

/// Animated bar chart for revenue large widget
class _BarChart extends StatefulWidget {
  @override
  State<_BarChart> createState() => _BarChartState();
}

class _BarChartState extends State<_BarChart>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rng = Random(42);
    final values = List.generate(7, (_) => 0.3 + rng.nextDouble() * 0.7);
    final labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return LayoutBuilder(
          builder: (context, constraints) {
            final barW = constraints.maxWidth / values.length - 6;
            return Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(values.length, (i) {
                final h = (constraints.maxHeight - 16) * values[i] * _ctrl.value;
                return Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      width: barW.clamp(8, 32),
                      height: h.clamp(4, constraints.maxHeight - 16),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            ObsidianTheme.emerald.withValues(alpha: 0.6),
                            ObsidianTheme.emerald.withValues(alpha: 0.2),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(labels[i], style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary)),
                  ],
                );
              }),
            );
          },
        );
      },
    );
  }
}

/// Mini route map painter for the route widget
class _MiniRouteMapPainter extends CustomPainter {
  final List stops;
  _MiniRouteMapPainter({required this.stops});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = const Color(0xFF080810));

    final gridPaint = Paint()..color = Colors.white.withValues(alpha: 0.03)..strokeWidth = 0.5;
    for (double y = 0; y < size.height; y += 16) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 16) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    if (stops.isEmpty) return;

    final rng = Random(42);
    final points = <Offset>[];
    for (int i = 0; i < stops.length; i++) {
      final x = 16.0 + ((size.width - 32) / max(1, stops.length - 1)) * i;
      final y = 16.0 + rng.nextDouble() * (size.height - 32);
      points.add(Offset(x, y));
    }

    if (points.length > 1) {
      final path = Path()..moveTo(points.first.dx, points.first.dy);
      for (int i = 1; i < points.length; i++) {
        final p = points[i - 1];
        final c = points[i];
        path.cubicTo((p.dx + c.dx) / 2, p.dy, (p.dx + c.dx) / 2, c.dy, c.dx, c.dy);
      }
      canvas.drawPath(path, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.1)..strokeWidth = 4..style = PaintingStyle.stroke..strokeCap = StrokeCap.round);
      canvas.drawPath(path, Paint()..color = ObsidianTheme.emerald..strokeWidth = 1.5..style = PaintingStyle.stroke..strokeCap = StrokeCap.round);
    }

    for (int i = 0; i < points.length; i++) {
      canvas.drawCircle(points[i], 5, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.15));
      canvas.drawCircle(points[i], 3, Paint()..color = ObsidianTheme.emerald);
    }
  }

  @override
  bool shouldRepaint(covariant _MiniRouteMapPainter old) => old.stops.length != stops.length;
}

/// Team members provider
final teamMembersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client.from('profiles').select('id, full_name, avatar_url').limit(10);
  return (data as List).cast<Map<String, dynamic>>();
});
