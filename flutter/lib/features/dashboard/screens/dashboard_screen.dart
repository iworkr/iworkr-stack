import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/industry_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/governance_policy_provider.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/services/credentials_provider.dart';
import 'package:iworkr_mobile/core/services/incidents_provider.dart';
import 'package:iworkr_mobile/core/services/timeclock_provider.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/jobs/screens/create_job_sheet.dart';
import 'package:iworkr_mobile/features/scan/screens/scanner_screen.dart';
import 'package:iworkr_mobile/features/search/screens/command_palette_screen.dart';
import 'package:iworkr_mobile/features/workspace/widgets/workspace_mega_menu.dart';
import 'package:iworkr_mobile/models/care_shift.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

// ═══════════════════════════════════════════════════════════
// ── The Command Deck — Dashboard ─────────────────────────
// ═══════════════════════════════════════════════════════════

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with TickerProviderStateMixin {
  bool _wormholeTrigger = false;
  bool _scrolled = false;
  late final WorkspaceMegaMenuController _megaMenu;
  final _appBarLayerLink = LayerLink();

  @override
  void initState() {
    super.initState();
    _megaMenu = WorkspaceMegaMenuController(
      vsync: this,
      link: _appBarLayerLink,
    );
    _megaMenu.onWorkspaceSwitched = () {
      if (mounted) {
        setState(() => _wormholeTrigger = true);
      }
    };
  }

  @override
  void dispose() {
    _megaMenu.dispose();
    super.dispose();
  }

  void _toggleMegaMenu() {
    _megaMenu.open(context, ref);
  }

  Future<void> _refresh() async {
    HapticFeedback.mediumImpact();
    ref.invalidate(jobsStreamProvider);
    ref.invalidate(myTodayBlocksProvider);
    ref.invalidate(myCareShiftsProvider);
    ref.invalidate(credentialStatsProvider);
    ref.invalidate(incidentStatsProvider);
    ref.invalidate(profileProvider);
    ref.invalidate(allWorkspacesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final wsAsync = ref.watch(activeWorkspaceProvider);

    return WormholeTransition(
      trigger: _wormholeTrigger,
      onComplete: () => setState(() => _wormholeTrigger = false),
      child: Scaffold(
        backgroundColor: c.canvas,
        body: NotificationListener<ScrollNotification>(
          onNotification: (n) {
            final scrolled = n.metrics.pixels > 4;
            if (scrolled != _scrolled) setState(() => _scrolled = scrolled);
            return false;
          },
          child: Stack(
            children: [
              RefreshIndicator(
                color: ref.watch(isCareProvider) ? ObsidianTheme.careBlue : ObsidianTheme.emerald,
                backgroundColor: c.surface,
                onRefresh: _refresh,
                edgeOffset: 100,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverToBoxAdapter(
                      child: SizedBox(
                        height: MediaQuery.of(context).padding.top + 60,
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                      sliver: SliverList.list(
                        children: ref.watch(isCareProvider)
                            ? _buildCareDashboard(ref, context)
                            : _buildTradesDashboard(ref),
                      ),
                    ),
                  ],
                ),
              ),
              _GlassAppBar(
                workspace: wsAsync.valueOrNull,
                scrolled: _scrolled,
                onWorkspaceTap: _toggleMegaMenu,
                onSearchTap: () => showCommandPalette(context),
                onNotificationTap: () => context.push('/inbox'),
                megaMenuAnimation: _megaMenu.animation,
                layerLink: _appBarLayerLink,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Trades-specific dashboard layout
  List<Widget> _buildTradesDashboard(WidgetRef ref) => [
        _RevenueCard(ref: ref),
        const SizedBox(height: 12),
        _DispatchCard(),
        const SizedBox(height: 12),
        _ScheduleCard(ref: ref),
        const SizedBox(height: 12),
        _TriageCard(ref: ref),
        const SizedBox(height: 16),
        _QuickActionsRow(),
      ];

  /// Care-specific dashboard layout (Project Nightingale)
  List<Widget> _buildCareDashboard(WidgetRef ref, BuildContext context) => [
        const _CareShiftHero(),
        const SizedBox(height: 14),
        const _CareQuickActions(),
        const SizedBox(height: 14),
        _CareTodayRoster(ref: ref),
        const SizedBox(height: 14),
        _CareComplianceBanner(ref: ref),
      ];
}

// ═══════════════════════════════════════════════════════════
// ── Glassmorphic App Bar ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _GlassAppBar extends StatelessWidget {
  final Workspace? workspace;
  final bool scrolled;
  final VoidCallback onWorkspaceTap;
  final VoidCallback onSearchTap;
  final VoidCallback onNotificationTap;
  final AnimationController? megaMenuAnimation;
  final LayerLink? layerLink;

  const _GlassAppBar({
    required this.workspace,
    required this.scrolled,
    required this.onWorkspaceTap,
    required this.onSearchTap,
    required this.onNotificationTap,
    this.megaMenuAnimation,
    this.layerLink,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final topPad = MediaQuery.of(context).padding.top;

    return CompositedTransformTarget(
      link: layerLink ?? LayerLink(),
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.fromLTRB(16, topPad + 10, 16, 10),
            decoration: BoxDecoration(
              color: c.canvas.withValues(alpha: 0.85),
              border: Border(
                bottom: BorderSide(
                  color: scrolled
                      ? c.border
                      : Colors.transparent,
                ),
              ),
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: onWorkspaceTap,
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _WorkspaceLogo(workspace: workspace),
                      const SizedBox(width: 10),
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.45,
                        ),
                        child: Text(
                          workspace?.name ?? 'iWorkr',
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: c.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      megaMenuAnimation != null
                          ? AnimatedBuilder(
                              animation: megaMenuAnimation!,
                              builder: (context, child) {
                                return Transform.rotate(
                                  angle: megaMenuAnimation!.value * 3.14159,
                                  child: child,
                                );
                              },
                              child: Icon(
                                PhosphorIconsBold.caretDown,
                                size: 10,
                                color: c.textMuted,
                              ),
                            )
                          : Icon(
                              PhosphorIconsBold.caretDown,
                              size: 10,
                              color: c.textMuted,
                            ),
                    ],
                  ),
                ),
                const Spacer(),
                const _SyncStatusIndicator(),
                const SizedBox(width: 6),
                _GhostIconButton(
                  icon: CupertinoIcons.search,
                  onTap: onSearchTap,
                ),
                const SizedBox(width: 6),
                _NotificationButton(onTap: onNotificationTap),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SyncStatusIndicator extends ConsumerWidget {
  const _SyncStatusIndicator();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final status = ref.watch(syncStatusProvider);

    if (status == SyncStatus.synced) return const SizedBox.shrink();

    final icon = switch (status) {
      SyncStatus.offline => PhosphorIconsLight.cloudSlash,
      SyncStatus.syncing => PhosphorIconsLight.arrowsClockwise,
      SyncStatus.failed => PhosphorIconsLight.warning,
      _ => PhosphorIconsLight.cloud,
    };

    final color = switch (status) {
      SyncStatus.offline => c.textMuted,
      SyncStatus.syncing => ObsidianTheme.emerald,
      SyncStatus.failed => ObsidianTheme.amber,
      _ => c.textMuted,
    };

    return Padding(
      padding: const EdgeInsets.only(right: 2),
      child: Icon(icon, size: 14, color: color),
    );
  }
}

class _WorkspaceLogo extends StatelessWidget {
  final Workspace? workspace;
  const _WorkspaceLogo({this.workspace});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: c.surfaceSecondary,
        border: Border.all(color: c.borderMedium),
        image: workspace?.logoUrl != null
            ? DecorationImage(
                image: NetworkImage(workspace!.logoUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: workspace?.logoUrl == null
          ? Center(
              child: Text(
                workspace?.initials ?? 'iW',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: ObsidianTheme.emerald,
                ),
              ),
            )
          : null,
    );
  }
}

class _GhostIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _GhostIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: c.activeBg,
        ),
        child: Icon(icon, size: 17, color: c.textSecondary),
      ),
    );
  }
}

class _NotificationButton extends StatelessWidget {
  final VoidCallback onTap;
  const _NotificationButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: c.activeBg,
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(CupertinoIcons.bell, size: 17, color: c.textSecondary),
            Positioned(
              top: 7,
              right: 8,
              child: Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Core Widget 1: Revenue MTD ──────────────────────────
// ═══════════════════════════════════════════════════════════

class _RevenueCard extends StatelessWidget {
  final WidgetRef ref;
  const _RevenueCard({required this.ref});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final statsAsync = ref.watch(revenueStatsProvider);

    return _TapCard(
      onTap: () => context.push('/finance'),
      child: statsAsync.when(
        loading: () => const SizedBox(height: 80, child: Center(child: CupertinoActivityIndicator())),
        error: (_, __) => SizedBox(
          height: 80,
          child: Center(child: Text('Revenue unavailable', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12))),
        ),
        data: (stats) {
          final revenue = stats['totalRevenue'] ?? 0;
          final formatted = NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(revenue);

          final t = ref.read(labelTranslatorProvider);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    t('REVENUE MTD'),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 9,
                      color: c.textTertiary,
                      letterSpacing: 1.5,
                    ),
                  ),
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
                        Text('+100%', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('vs last month', style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary)),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                formatted,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                  color: c.textPrimary,
                  letterSpacing: -1.5,
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 40,
                child: _SparklineChart(),
              ),
            ],
          );
        },
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 12, delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

// ═══════════════════════════════════════════════════════════
// ── Core Widget 2: Live Dispatch (Map) ──────────────────
// ═══════════════════════════════════════════════════════════

class _DispatchCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final t = ref.watch(labelTranslatorProvider);
    return _TapCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/overwatch'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.emerald,
                    boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 6)],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  t('LIVE DISPATCH'),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 9,
                    color: c.textTertiary,
                    letterSpacing: 1.5,
                  ),
                ),
                const Spacer(),
                Text(
                  'View Map →',
                  style: GoogleFonts.inter(fontSize: 11, color: c.textMuted),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
            child: SizedBox(
              height: 180,
              width: double.infinity,
              child: CustomPaint(painter: _DarkEarthMapPainter(canvas: c.canvas, roadColor: c.shimmerBase)),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 12, delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

// ═══════════════════════════════════════════════════════════
// ── Core Widget 3: Today's Schedule ─────────────────────
// ═══════════════════════════════════════════════════════════

class _ScheduleCard extends StatelessWidget {
  final WidgetRef ref;
  const _ScheduleCard({required this.ref});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final blocksAsync = ref.watch(myTodayBlocksProvider);

    return _TapCard(
      onTap: () => context.push('/schedule'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                "TODAY'S SCHEDULE",
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: c.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Text('View all →', style: GoogleFonts.inter(fontSize: 11, color: c.textMuted)),
            ],
          ),
          const SizedBox(height: 12),
          blocksAsync.when(
            loading: () => const SizedBox(height: 60, child: Center(child: CupertinoActivityIndicator())),
            error: (_, __) => SizedBox(
              height: 60,
              child: Center(child: Text('Schedule unavailable', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12))),
            ),
            data: (blocks) {
              if (blocks.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      'Clear day ahead',
                      style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                    ),
                  ),
                );
              }

              final display = blocks.take(3).toList();
              return Column(
                children: display.asMap().entries.map((entry) {
                  final i = entry.key;
                  final b = entry.value;
                  return _ScheduleRow(block: b, index: i);
                }).toList(),
              );
            },
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 300.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 12, delay: 300.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

class _ScheduleRow extends StatelessWidget {
  final ScheduleBlock block;
  final int index;
  const _ScheduleRow({required this.block, required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final time = '${block.startTime.hour.toString().padLeft(2, '0')}:${block.startTime.minute.toString().padLeft(2, '0')}';
    final isLive = block.status.toString().contains('inProgress');

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        if (block.jobId != null) {
          context.push('/jobs/${block.jobId}');
        }
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: EdgeInsets.only(bottom: index < 2 ? 8 : 0),
        child: Row(
          children: [
            Container(
              width: 3,
              height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: isLive ? ObsidianTheme.emerald : c.textMuted,
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 42,
              child: Text(
                time,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 12,
                  color: c.textMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    block.title,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: c.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (block.location != null || block.clientName != null)
                    Text(
                      block.location ?? block.clientName ?? '',
                      style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            if (isLive)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: ObsidianTheme.emeraldDim,
                ),
                child: Text(
                  'LIVE',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 8,
                    color: ObsidianTheme.emerald,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Core Widget 4: Triage / Inbox ───────────────────────
// ═══════════════════════════════════════════════════════════

class _TriageCard extends StatelessWidget {
  final WidgetRef ref;
  const _TriageCard({required this.ref});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return _TapCard(
      onTap: () => context.push('/inbox'),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: c.activeBg,
            ),
            child: Icon(PhosphorIconsLight.tray, size: 18, color: c.textSecondary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Triage',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                  ),
                ),
                Text(
                  'Priority messages & alerts',
                  style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: ObsidianTheme.emeraldDim,
            ),
            child: Text(
              'NEW',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.emerald,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Icon(PhosphorIconsLight.caretRight, size: 14, color: c.textMuted),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 400.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 12, delay: 400.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

// ═══════════════════════════════════════════════════════════
// ── Core Widget 5: Quick Actions ────────────────────────
// ═══════════════════════════════════════════════════════════

class _QuickActionsRow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(labelTranslatorProvider);
    final actions = [
      _QA(icon: PhosphorIconsLight.barcode, label: 'SCAN', onTap: () {
        Navigator.of(context).push(CupertinoPageRoute(builder: (_) => const ScannerScreen()));
      }),
      _QA(icon: PhosphorIconsLight.plus, label: t('NEW JOB'), onTap: () => showCreateJobSheet(context)),
      _QA(icon: PhosphorIconsLight.magnifyingGlass, label: 'SEARCH', onTap: () => showCommandPalette(context)),
      _QA(icon: PhosphorIconsLight.timer, label: t('CLOCK IN'), onTap: () {
        HapticFeedback.mediumImpact();
        context.push('/profile/timeclock');
      }),
    ];

    return Row(
      children: actions.asMap().entries.map((e) {
        final i = e.key;
        final a = e.value;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: i < actions.length - 1 ? 10 : 0),
            child: _QuickActionTile(action: a, index: i),
          ),
        );
      }).toList(),
    )
        .animate()
        .fadeIn(delay: 500.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 12, delay: 500.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

class _QA {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QA({required this.icon, required this.label, required this.onTap});
}

class _QuickActionTile extends StatefulWidget {
  final _QA action;
  final int index;
  const _QuickActionTile({required this.action, required this.index});

  @override
  State<_QuickActionTile> createState() => _QuickActionTileState();
}

class _QuickActionTileState extends State<_QuickActionTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.action.onTap();
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        height: 72,
        transform: _pressed ? Matrix4.diagonal3Values(0.95, 0.95, 1) : Matrix4.identity(),
        transformAlignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: _pressed ? c.border : c.hoverBg,
          border: Border.all(color: c.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(widget.action.icon, size: 20, color: c.textPrimary),
            const SizedBox(height: 6),
            Text(
              widget.action.label,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 8,
                color: c.textMuted,
                fontWeight: FontWeight.w500,
                letterSpacing: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Shared Components ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _TapCard extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final EdgeInsetsGeometry? padding;
  const _TapCard({required this.child, required this.onTap, this.padding});

  @override
  State<_TapCard> createState() => _TapCardState();
}

class _TapCardState extends State<_TapCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: widget.padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: _pressed
              ? c.surface.withValues(alpha: 0.95)
              : c.surface,
          border: Border.all(color: c.border),
        ),
        foregroundDecoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: _pressed ? c.hoverBg : Colors.transparent,
        ),
        child: widget.child,
      ),
    );
  }
}

/// Emerald sparkline chart for the Revenue card
class _SparklineChart extends StatefulWidget {
  @override
  State<_SparklineChart> createState() => _SparklineChartState();
}

class _SparklineChartState extends State<_SparklineChart> with SingleTickerProviderStateMixin {
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
        painter: _SparklinePainter(progress: _ctrl.value),
        size: const Size(double.infinity, 40),
      ),
    )
        .animate()
        .scaleX(begin: 0, end: 1, alignment: Alignment.centerLeft, duration: 800.ms, curve: Curves.easeOutCubic);
  }
}

class _SparklinePainter extends CustomPainter {
  final double progress;
  _SparklinePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final points = [0.4, 0.55, 0.35, 0.65, 0.45, 0.7, 0.5, 0.85, 0.6, 0.95];
    final path = Path();
    final step = size.width / (points.length - 1);

    for (int i = 0; i < points.length; i++) {
      final x = step * i;
      final y = size.height - (points[i] * size.height * 0.8);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        final prev = Offset(step * (i - 1), size.height - (points[i - 1] * size.height * 0.8));
        final cp1 = Offset((prev.dx + x) / 2, prev.dy);
        final cp2 = Offset((prev.dx + x) / 2, y);
        path.cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, x, y);
      }
    }

    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return;
    final totalLen = metrics.fold<double>(0, (s, m) => s + m.length);
    final trimLen = totalLen * progress;

    final trimmed = Path();
    double accumulated = 0;
    for (final m in metrics) {
      if (accumulated + m.length <= trimLen) {
        trimmed.addPath(m.extractPath(0, m.length), Offset.zero);
        accumulated += m.length;
      } else {
        final remaining = trimLen - accumulated;
        if (remaining > 0) trimmed.addPath(m.extractPath(0, remaining), Offset.zero);
        break;
      }
    }

    canvas.drawPath(
      trimmed,
      Paint()
        ..color = ObsidianTheme.emerald
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.progress != progress;
}

/// Dark Earth tactical map painter
class _DarkEarthMapPainter extends CustomPainter {
  final Color canvas;
  final Color roadColor;
  _DarkEarthMapPainter({required this.canvas, required this.roadColor});

  @override
  void paint(Canvas canvasObj, Size size) {
    canvasObj.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = canvas,
    );

    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.025)
      ..strokeWidth = 0.5;
    for (double y = 0; y < size.height; y += 20) {
      canvasObj.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 20) {
      canvasObj.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    final roadPaint = Paint()
      ..color = roadColor
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvasObj.drawLine(Offset(size.width * 0.1, size.height * 0.5), Offset(size.width * 0.9, size.height * 0.3), roadPaint);
    canvasObj.drawLine(Offset(size.width * 0.3, size.height * 0.1), Offset(size.width * 0.4, size.height * 0.9), roadPaint);
    canvasObj.drawLine(Offset(size.width * 0.6, size.height * 0.2), Offset(size.width * 0.8, size.height * 0.8), roadPaint);

    final dots = [
      Offset(size.width * 0.25, size.height * 0.35),
      Offset(size.width * 0.55, size.height * 0.45),
      Offset(size.width * 0.70, size.height * 0.30),
      Offset(size.width * 0.40, size.height * 0.65),
      Offset(size.width * 0.80, size.height * 0.60),
    ];

    for (final dot in dots) {
      canvasObj.drawCircle(dot, 6, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.15));
      canvasObj.drawCircle(dot, 4, Paint()..color = ObsidianTheme.emerald);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ═══════════════════════════════════════════════════════════
// ── Wormhole Transition (Workspace Switch) ──────────────
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// ── Care Compliance Banner (Project Nightingale) ────────
// ═══════════════════════════════════════════════════════════
//
// Shows a compact compliance + care summary on the dashboard
// ONLY for care-sector organizations. Hidden for trades orgs.

class _CareComplianceBanner extends ConsumerWidget {
  final WidgetRef ref;
  const _CareComplianceBanner({required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isCare = ref.watch(isCareProvider);
    if (!isCare) return const SizedBox.shrink();

    final c = context.iColors;
    final credStats = ref.watch(credentialStatsProvider);
    final incStats = ref.watch(incidentStatsProvider);

    final hasAlerts = credStats.expired > 0 || credStats.expiring > 0 || incStats.critical > 0;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/care');
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: hasAlerts ? ObsidianTheme.amber.withValues(alpha: 0.25) : c.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(PhosphorIconsFill.shieldCheck, size: 16,
                    color: hasAlerts ? ObsidianTheme.amber : ObsidianTheme.emerald),
                const SizedBox(width: 8),
                Text(
                  'COMPLIANCE',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: hasAlerts ? ObsidianTheme.amber : ObsidianTheme.emerald,
                  ),
                ),
                const Spacer(),
                Icon(PhosphorIconsLight.caretRight, size: 16, color: c.textTertiary),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _ComplianceStat(
                    label: 'Credentials',
                    value: '${credStats.verified}/${credStats.total}',
                    color: credStats.expired > 0 ? ObsidianTheme.rose : ObsidianTheme.emerald,
                    icon: PhosphorIconsFill.certificate,
                  ),
                ),
                Container(width: 1, height: 36, color: c.border),
                Expanded(
                  child: _ComplianceStat(
                    label: 'Incidents',
                    value: '${incStats.open}',
                    color: incStats.critical > 0 ? ObsidianTheme.rose : ObsidianTheme.amber,
                    icon: PhosphorIconsFill.warningCircle,
                  ),
                ),
                if (credStats.expiring > 0) ...[
                  Container(width: 1, height: 36, color: c.border),
                  Expanded(
                    child: _ComplianceStat(
                      label: 'Expiring',
                      value: '${credStats.expiring}',
                      color: ObsidianTheme.amber,
                      icon: PhosphorIconsFill.timer,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 300.ms, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, delay: 300.ms, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

class _ComplianceStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _ComplianceStat({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 6),
        Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: color)),
        const SizedBox(height: 2),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary)),
      ],
    );
  }
}

class WormholeTransition extends StatefulWidget {
  final bool trigger;
  final VoidCallback onComplete;
  final Widget child;

  const WormholeTransition({
    super.key,
    required this.trigger,
    required this.onComplete,
    required this.child,
  });

  @override
  State<WormholeTransition> createState() => _WormholeTransitionState();
}

class _WormholeTransitionState extends State<WormholeTransition>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _ctrl.addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        _ctrl.reverse();
      } else if (s == AnimationStatus.dismissed && widget.trigger) {
        widget.onComplete();
      }
    });
  }

  @override
  void didUpdateWidget(WormholeTransition old) {
    super.didUpdateWidget(old);
    if (widget.trigger && !old.trigger) _ctrl.forward();
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
      builder: (_, child) {
        final scale = 1.0 - (_ctrl.value * 0.04);
        final opacity = 1.0 - (_ctrl.value * 0.5);
        return Opacity(
          opacity: opacity.clamp(0.0, 1.0),
          child: Transform.scale(scale: scale, child: child),
        );
      },
      child: widget.child,
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Care: Clock In / Out Card ────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CareShiftHero extends ConsumerStatefulWidget {
  const _CareShiftHero();

  @override
  ConsumerState<_CareShiftHero> createState() => _CareShiftHeroState();
}

class _CareShiftHeroState extends ConsumerState<_CareShiftHero> {
  List<CareShift>? _directShifts;
  String? _debugInfo;

  @override
  void initState() {
    super.initState();
    _fetchShiftsDirect();
  }

  /// Direct Supabase query — bypasses all provider chains
  Future<void> _fetchShiftsDirect() async {
    try {
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) {
        setState(() => _debugInfo = 'No auth user');
        return;
      }

      // Get the user's org directly
      final membership = await SupabaseService.client
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

      if (membership == null) {
        setState(() => _debugInfo = 'No org membership for $userId');
        return;
      }

      final orgId = membership['organization_id'] as String;
      final now = DateTime.now();
      final rangeStart = now.subtract(const Duration(days: 1)).toUtc().toIso8601String();
      final rangeEnd = now.add(const Duration(days: 7)).toUtc().toIso8601String();

      final List<dynamic> data = await SupabaseService.client
          .from('schedule_blocks')
          .select('*, participant_profiles(preferred_name, critical_alerts)')
          .eq('organization_id', orgId)
          .eq('technician_id', userId)
          .gte('start_time', rangeStart)
          .lte('start_time', rangeEnd)
          .neq('status', 'cancelled')
          .order('start_time');

      final shifts = data.map((s) => CareShift.fromJson(s as Map<String, dynamic>)).toList();
      setState(() {
        _directShifts = shifts;
        _debugInfo = 'org=$orgId user=$userId found=${shifts.length}';
      });
    } catch (e) {
      setState(() => _debugInfo = 'Error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final active = ref.watch(activeShiftStateProvider);

    // Use direct query results, falling back to provider
    final providerShifts = ref.watch(myTodayShiftsProvider);
    final todayShifts = providerShifts.isNotEmpty
        ? providerShifts
        : (_directShifts ?? []).where((s) {
            final local = s.scheduledStart.toLocal();
            final now = DateTime.now();
            return local.year == now.year && local.month == now.month && local.day == now.day;
          }).toList();

    // If direct fetch found shifts but provider didn't, use all direct shifts as "upcoming"
    final allUpcoming = (_directShifts ?? []).where((s) => s.scheduledEnd.isAfter(DateTime.now()) && s.status != CareShiftStatus.cancelled).toList();

    final accent = ObsidianTheme.careBlue;

    // ── State 1: Active Shift (Clocked In) ──
    if (active.hasActiveShift) {
      final startedAt = active.clockInTime ?? DateTime.now();
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.emerald,
                    boxShadow: [
                      BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 6),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text('ON SHIFT',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      letterSpacing: 1.5,
                      color: ObsidianTheme.emerald,
                      fontWeight: FontWeight.w700,
                    )),
              ],
            ),
            const SizedBox(height: 14),
            StreamBuilder<int>(
              stream: Stream.periodic(const Duration(seconds: 1), (i) => i),
              builder: (context, _) {
                final elapsed = DateTime.now().difference(startedAt);
                final h = elapsed.inHours.toString().padLeft(2, '0');
                final m = (elapsed.inMinutes % 60).toString().padLeft(2, '0');
                final s = (elapsed.inSeconds % 60).toString().padLeft(2, '0');
                return Text(
                  '$h:$m:$s',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary,
                    letterSpacing: -0.5,
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: active.shiftId == null
                  ? null
                  : () {
                      HapticFeedback.mediumImpact();
                      context.push('/care/shift/${active.shiftId}');
                    },
              child: Container(
                width: double.infinity,
                height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: ObsidianTheme.rose,
                ),
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(PhosphorIconsBold.signOut, size: 16, color: Colors.white),
                      const SizedBox(width: 8),
                      Text('Clock Out & Debrief',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          )),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ).animate()
          .fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1))
          .moveY(begin: 8, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1));
    }

    // ── State 2: Upcoming Shift ──
    // Use today's shifts if available, otherwise use any upcoming shift from direct fetch
    final effectiveUpcoming = todayShifts.isNotEmpty ? todayShifts : allUpcoming;
    if (effectiveUpcoming.isNotEmpty) {
      final now = DateTime.now();
      final upcoming = effectiveUpcoming
          .where((s) => s.scheduledEnd.isAfter(now))
          .toList()
        ..sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));

      if (upcoming.isNotEmpty) {
        final next = upcoming.first;
        final startTime = DateFormat('h:mm a').format(next.scheduledStart);
        final endTime = DateFormat('h:mm a').format(next.scheduledEnd);
        final timeUntil = next.scheduledStart.difference(now);
        final countdownLabel = timeUntil.isNegative
            ? 'Started'
            : timeUntil.inHours > 0
                ? 'In ${timeUntil.inHours}h ${timeUntil.inMinutes % 60}m'
                : 'In ${timeUntil.inMinutes}m';

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: c.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(PhosphorIconsFill.clock, size: 16, color: accent),
                  const SizedBox(width: 8),
                  Text('NEXT SHIFT',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        letterSpacing: 1.5,
                        color: accent,
                        fontWeight: FontWeight.w700,
                      )),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      countdownLabel,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: accent,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                '$startTime — $endTime',
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: c.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(PhosphorIconsLight.user, size: 14, color: c.textMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      next.participantName ?? 'Participant',
                      style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, fontWeight: FontWeight.w500),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              if ((next.serviceType ?? '').isNotEmpty) ...[
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(PhosphorIconsLight.heartbeat, size: 14, color: c.textMuted),
                    const SizedBox(width: 6),
                    Text(
                      next.serviceType!,
                      style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                    ),
                  ],
                ),
              ],
              if ((next.location ?? '').isNotEmpty) ...[
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(PhosphorIconsLight.mapPin, size: 14, color: c.textMuted),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        next.location!,
                        style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  HapticFeedback.mediumImpact();
                  context.push('/care/shift/${next.id}');
                },
                child: Container(
                  width: double.infinity,
                  height: 48,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: accent,
                  ),
                  child: Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(PhosphorIconsBold.play, size: 16, color: Colors.white),
                        const SizedBox(width: 8),
                        Text('Clock In',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            )),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ).animate()
            .fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1))
            .moveY(begin: 8, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1));
      }
    }

    // ── State 3: No Upcoming Shifts ──
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Icon(PhosphorIconsLight.sunHorizon, size: 36, color: c.textTertiary),
          const SizedBox(height: 12),
          Text(
            'You have no upcoming shifts',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: c.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Enjoy your time off. Check the roster for available shifts.',
            style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
            textAlign: TextAlign.center,
          ),
          if (_debugInfo != null) ...[
            const SizedBox(height: 8),
            Text(
              _debugInfo!,
              style: GoogleFonts.jetBrainsMono(fontSize: 9, color: c.textTertiary),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.go('/schedule');
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.borderMedium),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(PhosphorIconsLight.calendarBlank, size: 16, color: c.textSecondary),
                  const SizedBox(width: 8),
                  Text('View Roster',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: c.textSecondary,
                      )),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate()
        .fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 8, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

// ═══════════════════════════════════════════════════════════
// ── Care: Quick Actions Grid ─────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CareQuickActions extends StatelessWidget {
  const _CareQuickActions();

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    final actions = [
      _QuickActionData('Participants', PhosphorIconsFill.usersThree, ObsidianTheme.careBlue, '/participants'),
      _QuickActionData('Medications', PhosphorIconsFill.pill, ObsidianTheme.violet, '/care/medications/asclepius'),
      _QuickActionData('Incidents', PhosphorIconsFill.warningCircle, ObsidianTheme.amber, '/care/incidents'),
      _QuickActionData('Credentials', PhosphorIconsFill.certificate, ObsidianTheme.emerald, '/care/credentials'),
    ];

    return Row(
      children: actions.asMap().entries.map((entry) {
        final i = entry.key;
        final a = entry.value;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              left: i == 0 ? 0 : 4,
              right: i == actions.length - 1 ? 0 : 4,
            ),
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                context.push(a.route);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        color: a.color.withValues(alpha: 0.10),
                      ),
                      child: Icon(a.icon, size: 18, color: a.color),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      a.label,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: c.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ).animate()
              .fadeIn(delay: Duration(milliseconds: 100 + i * 50), duration: 350.ms, curve: const Cubic(0.16, 1, 0.3, 1))
              .moveY(begin: 6, delay: Duration(milliseconds: 100 + i * 50), duration: 350.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
        );
      }).toList(),
    );
  }
}

class _QuickActionData {
  final String label;
  final IconData icon;
  final Color color;
  final String route;
  const _QuickActionData(this.label, this.icon, this.color, this.route);
}

class _CareMandatoryReads extends ConsumerStatefulWidget {
  const _CareMandatoryReads();

  @override
  ConsumerState<_CareMandatoryReads> createState() => _CareMandatoryReadsState();
}

class _CareMandatoryReadsState extends ConsumerState<_CareMandatoryReads> {
  int _count = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final pending = await fetchPendingCriticalPolicies();
      if (!mounted) return;
      setState(() {
        _count = pending.length;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _count == 0) return const SizedBox.shrink();
    final c = context.iColors;
    return GestureDetector(
      onTap: () => context.push('/care/governance/policies'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: ObsidianTheme.rose.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(PhosphorIconsLight.warning, size: 16, color: ObsidianTheme.rose),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Mandatory reads pending: $_count',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: c.textPrimary,
                ),
              ),
            ),
            Icon(PhosphorIconsLight.caretRight,
                size: 14, color: c.textTertiary),
          ],
        ),
      ),
    );
  }
}

class _CareClockInCard extends ConsumerStatefulWidget {
  final WidgetRef ref;
  const _CareClockInCard({required this.ref});

  @override
  ConsumerState<_CareClockInCard> createState() => _CareClockInCardState();
}

class _CareClockInCardState extends ConsumerState<_CareClockInCard> {
  bool _loading = false;

  Future<Position?> _getPosition() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _handleClockIn() async {
    setState(() => _loading = true);
    HapticFeedback.heavyImpact();
    final pos = await _getPosition();
    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId != null) {
      await clockIn(
        organizationId: orgId,
        lat: pos?.latitude,
        lng: pos?.longitude,
      );
    }
    ref.invalidate(activeTimeEntryProvider);
    ref.invalidate(weeklyHoursProvider);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _handleClockOut() async {
    final entry = ref.read(activeTimeEntryProvider).valueOrNull;
    if (entry == null) return;
    setState(() => _loading = true);
    HapticFeedback.heavyImpact();
    final pos = await _getPosition();
    final clockInTime = DateTime.parse(entry['clock_in']).toLocal();
    final breakMins = entry['break_duration_minutes'] as int? ?? 0;
    await clockOut(
      entryId: entry['id'],
      clockInTime: clockInTime,
      lat: pos?.latitude,
      lng: pos?.longitude,
      breakMinutes: breakMins,
    );
    ref.invalidate(activeTimeEntryProvider);
    ref.invalidate(weeklyHoursProvider);
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final entryAsync = ref.watch(activeTimeEntryProvider);
    final weeklyAsync = ref.watch(weeklyHoursProvider);
    final isClockedIn = entryAsync.valueOrNull != null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(
          color: isClockedIn
              ? ObsidianTheme.careBlue.withValues(alpha: 0.3)
              : c.border,
        ),
        boxShadow: isClockedIn
            ? [BoxShadow(color: ObsidianTheme.careBlue.withValues(alpha: 0.08), blurRadius: 20)]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: (isClockedIn ? ObsidianTheme.careBlue : ObsidianTheme.textTertiary)
                      .withValues(alpha: 0.15),
                  borderRadius: ObsidianTheme.radiusMd,
                ),
                child: Icon(
                  isClockedIn ? PhosphorIconsFill.clockCountdown : PhosphorIconsLight.clockClockwise,
                  size: 20,
                  color: isClockedIn ? ObsidianTheme.careBlue : ObsidianTheme.textSecondary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isClockedIn ? 'ON SHIFT' : 'OFF SHIFT',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                        color: isClockedIn ? ObsidianTheme.careBlue : ObsidianTheme.textMuted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    if (isClockedIn && entryAsync.valueOrNull != null)
                      _ElapsedTimer(clockIn: DateTime.parse(entryAsync.value!['clock_in']).toLocal())
                    else
                      Text(
                        'Tap to start your shift',
                        style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textSecondary),
                      ),
                  ],
                ),
              ),
              // Weekly hours
              weeklyAsync.when(
                data: (hrs) => Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${hrs.toStringAsFixed(1)}h',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: ObsidianTheme.textPrimary,
                      ),
                    ),
                    Text(
                      'this week',
                      style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textMuted),
                    ),
                  ],
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Clock In / Out Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _loading ? null : (isClockedIn ? _handleClockOut : _handleClockIn),
              style: ElevatedButton.styleFrom(
                backgroundColor: isClockedIn
                    ? ObsidianTheme.rose.withValues(alpha: 0.15)
                    : ObsidianTheme.careBlue,
                foregroundColor: isClockedIn ? ObsidianTheme.rose : Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: isClockedIn
                      ? BorderSide(color: ObsidianTheme.rose.withValues(alpha: 0.3))
                      : BorderSide.none,
                ),
              ),
              child: _loading
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: isClockedIn ? ObsidianTheme.rose : Colors.white,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isClockedIn ? PhosphorIconsBold.stop : PhosphorIconsBold.play,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isClockedIn ? 'END SHIFT' : 'START SHIFT',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).moveY(begin: 10, end: 0, duration: 400.ms, curve: Curves.easeOutQuart);
  }
}

/// Live elapsed timer that ticks every second
class _ElapsedTimer extends StatefulWidget {
  final DateTime clockIn;
  const _ElapsedTimer({required this.clockIn});

  @override
  State<_ElapsedTimer> createState() => _ElapsedTimerState();
}

class _ElapsedTimerState extends State<_ElapsedTimer> {
  late final Stream<int> _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Stream.periodic(const Duration(seconds: 1), (i) => i);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<int>(
      stream: _ticker,
      builder: (context, _) {
        final elapsed = DateTime.now().difference(widget.clockIn);
        final h = elapsed.inHours.toString().padLeft(2, '0');
        final m = (elapsed.inMinutes % 60).toString().padLeft(2, '0');
        final s = (elapsed.inSeconds % 60).toString().padLeft(2, '0');
        return Text(
          '$h:$m:$s',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 22,
            fontWeight: FontWeight.w600,
            color: ObsidianTheme.careBlue,
            letterSpacing: 2,
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Care: Today's Roster ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CareTodayRoster extends ConsumerWidget {
  final WidgetRef ref;
  const _CareTodayRoster({required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final todayShifts = ref.watch(myTodayShiftsProvider);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIconsFill.calendarCheck, size: 16, color: ObsidianTheme.careBlue),
              const SizedBox(width: 8),
              Text(
                'TODAY\'S ROSTER',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: ObsidianTheme.careBlue,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => context.go('/schedule'),
                child: Text(
                  'View All →',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: c.textTertiary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Builder(builder: (_) {
              if (todayShifts.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Center(
                    child: Column(
                      children: [
                        Icon(PhosphorIconsLight.sunHorizon, size: 28, color: c.textTertiary),
                        const SizedBox(height: 8),
                        Text(
                          'No shifts scheduled today',
                          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return Column(
                children: todayShifts.take(4).indexed.map((entry) {
                  final (i, shift) = entry;
                  final status = shift.status;
                  final title = shift.serviceType ?? 'Support Shift';
                  final participantName = shift.participantName ?? '';
                  final timeStr = '${DateFormat('h:mm a').format(shift.scheduledStart)} – ${DateFormat('h:mm a').format(shift.scheduledEnd)}';

                  Color statusColor;
                  String statusLabel;
                  if (status == CareShiftStatus.inProgress) {
                    statusColor = ObsidianTheme.careBlue;
                    statusLabel = 'ACTIVE';
                  } else if (status == CareShiftStatus.completed) {
                    statusColor = ObsidianTheme.emerald;
                    statusLabel = 'DONE';
                  } else if (status == CareShiftStatus.published) {
                    statusColor = ObsidianTheme.amber;
                    statusLabel = 'UPCOMING';
                  } else {
                    statusColor = c.textTertiary;
                    statusLabel = status.label.toUpperCase();
                  }

                  return Padding(
                    padding: EdgeInsets.only(bottom: i < todayShifts.take(4).length - 1 ? 8 : 0),
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/shift/${shift.id}');
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: c.canvas,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: status == CareShiftStatus.inProgress
                                ? ObsidianTheme.careBlue.withValues(alpha: 0.25)
                                : c.border,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 4,
                              height: 40,
                              decoration: BoxDecoration(
                                color: statusColor,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: c.textPrimary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  if (participantName.isNotEmpty)
                                    Text(
                                      participantName,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: c.textSecondary,
                                      ),
                                    ),
                                  const SizedBox(height: 2),
                                  Text(
                                    timeStr,
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 11,
                                      color: c.textTertiary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.10),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                statusLabel,
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                  color: statusColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              );
            }),
        ],
      ),
    ).animate()
        .fadeIn(delay: 200.ms, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: 200.ms, duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}
