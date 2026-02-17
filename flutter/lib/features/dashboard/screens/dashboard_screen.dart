import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/quick_action_row.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/schedule_preview.dart';
import 'package:intl/intl.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final revenueAsync = ref.watch(revenueStatsProvider);
    final todayBlocks = ref.watch(myTodayBlocksProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: ObsidianTheme.emerald,
          backgroundColor: ObsidianTheme.surface1,
          onRefresh: () async {
            HapticFeedback.mediumImpact();
            ref.invalidate(revenueStatsProvider);
            ref.invalidate(myTodayBlocksProvider);
            ref.invalidate(profileProvider);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
            children: [
              // Header greeting
              profileAsync.when(
                data: (profile) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _greeting(),
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: ObsidianTheme.textMuted,
                      ),
                    )
                        .animate()
                        .fadeIn(duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
                    const SizedBox(height: 2),
                    Text(
                      profile?.displayName ?? 'Operator',
                      style: GoogleFonts.inter(
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        color: ObsidianTheme.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    )
                        .animate()
                        .fadeIn(delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
                  ],
                ),
                loading: () => const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerLoading(width: 100, height: 14),
                    SizedBox(height: 8),
                    ShimmerLoading(width: 200, height: 28),
                  ],
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),

              const SizedBox(height: 24),

              // Revenue hero card
              revenueAsync.when(
                data: (stats) => _RevenueHeroCard(stats: stats),
                loading: () => ShimmerLoading(height: 140, borderRadius: ObsidianTheme.radiusLg),
                error: (_, __) => const SizedBox.shrink(),
              ),

              const SizedBox(height: 12),

              // Stat bento grid
              revenueAsync.when(
                data: (stats) => Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                        label: 'ACTIVE JOBS',
                        value: stats['activeJobs']?.toInt().toString() ?? '0',
                        icon: PhosphorIconsRegular.briefcase,
                        color: ObsidianTheme.blue,
                        index: 0,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatCard(
                        label: 'COMPLETED',
                        value: stats['jobsCompleted']?.toInt().toString() ?? '0',
                        icon: PhosphorIconsRegular.checkCircle,
                        color: ObsidianTheme.emerald,
                        index: 1,
                      ),
                    ),
                  ],
                ),
                loading: () => Row(
                  children: [
                    Expanded(child: ShimmerLoading(height: 80, borderRadius: ObsidianTheme.radiusLg)),
                    const SizedBox(width: 10),
                    Expanded(child: ShimmerLoading(height: 80, borderRadius: ObsidianTheme.radiusLg)),
                  ],
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),

              const SizedBox(height: 28),

              // Quick actions
              Text(
                'QUICK ACTIONS',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: ObsidianTheme.textTertiary,
                  letterSpacing: 1.5,
                ),
              ).animate().fadeIn(delay: 400.ms, duration: 300.ms),
              const SizedBox(height: 12),
              const QuickActionRow(),

              const SizedBox(height: 28),

              // Today's schedule preview
              Text(
                "TODAY'S SCHEDULE",
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: ObsidianTheme.textTertiary,
                  letterSpacing: 1.5,
                ),
              ).animate().fadeIn(delay: 500.ms, duration: 300.ms),
              const SizedBox(height: 12),
              todayBlocks.when(
                data: (blocks) => SchedulePreview(blocks: blocks),
                loading: () => Column(
                  children: List.generate(
                    3,
                    (_) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ShimmerLoading(height: 64, borderRadius: ObsidianTheme.radiusLg),
                    ),
                  ),
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Revenue hero card — matches web widget-shell + sparkline pattern.
class _RevenueHeroCard extends StatelessWidget {
  final Map<String, double> stats;
  const _RevenueHeroCard({required this.stats});

  @override
  Widget build(BuildContext context) {
    final revenue = stats['totalRevenue'] ?? 0;
    final formatted = NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(revenue);

    return GlassCard(
      padding: const EdgeInsets.all(20),
      borderRadius: ObsidianTheme.radiusLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'REVENUE MTD',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: ObsidianTheme.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusFull,
                  color: ObsidianTheme.emeraldDim,
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
                ),
                child: Text(
                  'This Month',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    color: ObsidianTheme.emerald,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            formatted,
            style: GoogleFonts.inter(
              fontSize: 36,
              fontWeight: FontWeight.w600,
              color: ObsidianTheme.textPrimary,
              letterSpacing: -1.5,
            ),
          ),
          const SizedBox(height: 12),
          // Sparkline gradient bar
          Container(
            height: 2,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(1),
              gradient: LinearGradient(
                colors: [
                  ObsidianTheme.emerald.withValues(alpha: 0.0),
                  ObsidianTheme.emerald.withValues(alpha: 0.4),
                  ObsidianTheme.emerald.withValues(alpha: 0.15),
                ],
              ),
            ),
          )
              .animate()
              .scaleX(begin: 0, end: 1, alignment: Alignment.centerLeft, delay: 600.ms, duration: 800.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

/// Stat card — glass bento grid items
class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final int index;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      borderRadius: ObsidianTheme.radiusLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: ObsidianTheme.textTertiary,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w600,
              color: ObsidianTheme.textPrimary,
              letterSpacing: -1,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 300 + index * 80), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 300 + index * 80), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}
