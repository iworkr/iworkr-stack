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
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/jobs/screens/create_job_sheet.dart';
import 'package:iworkr_mobile/features/scan/screens/scanner_screen.dart';
import 'package:iworkr_mobile/features/search/screens/command_palette_screen.dart';
import 'package:iworkr_mobile/features/workspace/widgets/workspace_switcher_sheet.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

// ═══════════════════════════════════════════════════════════
// ── The Command Deck — Dashboard ─────────────────────────
// ═══════════════════════════════════════════════════════════

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _wormholeTrigger = false;
  bool _scrolled = false;

  Future<void> _openSwitcher() async {
    final switched = await showWorkspaceSwitcher(context);
    if (switched && mounted) {
      setState(() => _wormholeTrigger = true);
      ref.invalidate(profileProvider);
      ref.invalidate(jobsStreamProvider);
      ref.invalidate(myTodayBlocksProvider);
    }
  }

  Future<void> _refresh() async {
    HapticFeedback.mediumImpact();
    ref.invalidate(jobsStreamProvider);
    ref.invalidate(myTodayBlocksProvider);
    ref.invalidate(profileProvider);
    ref.invalidate(allWorkspacesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final wsAsync = ref.watch(activeWorkspaceProvider);

    return WormholeTransition(
      trigger: _wormholeTrigger,
      onComplete: () => setState(() => _wormholeTrigger = false),
      child: Scaffold(
        backgroundColor: ObsidianTheme.void_,
        body: NotificationListener<ScrollNotification>(
          onNotification: (n) {
            final scrolled = n.metrics.pixels > 4;
            if (scrolled != _scrolled) setState(() => _scrolled = scrolled);
            return false;
          },
          child: Stack(
            children: [
              RefreshIndicator(
                color: ObsidianTheme.emerald,
                backgroundColor: ObsidianTheme.surface1,
                onRefresh: _refresh,
                edgeOffset: 100,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    const SliverToBoxAdapter(child: SizedBox(height: 100)),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                      sliver: SliverList.list(
                        children: [
                          _RevenueCard(ref: ref),
                          const SizedBox(height: 12),
                          _DispatchCard(),
                          const SizedBox(height: 12),
                          _ScheduleCard(ref: ref),
                          const SizedBox(height: 12),
                          _TriageCard(ref: ref),
                          const SizedBox(height: 16),
                          _QuickActionsRow(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              _GlassAppBar(
                workspace: wsAsync.valueOrNull,
                scrolled: _scrolled,
                onWorkspaceTap: _openSwitcher,
                onSearchTap: () => showCommandPalette(context),
                onNotificationTap: () => context.push('/inbox'),
              ),
            ],
          ),
        ),
      ),
    );
  }
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

  const _GlassAppBar({
    required this.workspace,
    required this.scrolled,
    required this.onWorkspaceTap,
    required this.onSearchTap,
    required this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: EdgeInsets.fromLTRB(16, topPad + 10, 16, 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.6),
            border: Border(
              bottom: BorderSide(
                color: scrolled
                    ? Colors.white.withValues(alpha: 0.05)
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
                    Text(
                      workspace?.name ?? 'iWorkr',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      PhosphorIconsBold.caretDown,
                      size: 10,
                      color: ObsidianTheme.textMuted,
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
    );
  }
}

class _SyncStatusIndicator extends ConsumerWidget {
  const _SyncStatusIndicator();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(syncStatusProvider);

    if (status == SyncStatus.synced) return const SizedBox.shrink();

    final icon = switch (status) {
      SyncStatus.offline => PhosphorIconsLight.cloudSlash,
      SyncStatus.syncing => PhosphorIconsLight.arrowsClockwise,
      SyncStatus.failed => PhosphorIconsLight.warning,
      _ => PhosphorIconsLight.cloud,
    };

    final color = switch (status) {
      SyncStatus.offline => ObsidianTheme.textMuted,
      SyncStatus.syncing => ObsidianTheme.emerald,
      SyncStatus.failed => ObsidianTheme.amber,
      _ => ObsidianTheme.textMuted,
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
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: ObsidianTheme.surface2,
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
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
          color: Colors.white.withValues(alpha: 0.04),
        ),
        child: Icon(icon, size: 17, color: ObsidianTheme.textSecondary),
      ),
    );
  }
}

class _NotificationButton extends StatelessWidget {
  final VoidCallback onTap;
  const _NotificationButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
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
          color: Colors.white.withValues(alpha: 0.04),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(CupertinoIcons.bell, size: 17, color: ObsidianTheme.textSecondary),
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
    final statsAsync = ref.watch(revenueStatsProvider);

    return _TapCard(
      onTap: () => context.push('/finance'),
      child: statsAsync.when(
        loading: () => const SizedBox(height: 80, child: Center(child: CupertinoActivityIndicator())),
        error: (_, __) => SizedBox(
          height: 80,
          child: Center(child: Text('Revenue unavailable', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12))),
        ),
        data: (stats) {
          final revenue = stats['totalRevenue'] ?? 0;
          final formatted = NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(revenue);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'REVENUE MTD',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 9,
                      color: ObsidianTheme.textTertiary,
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
                  Text('vs last month', style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary)),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                formatted,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
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

class _DispatchCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
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
                  'LIVE DISPATCH',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 9,
                    color: ObsidianTheme.textTertiary,
                    letterSpacing: 1.5,
                  ),
                ),
                const Spacer(),
                Text(
                  'View Map →',
                  style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textMuted),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
            child: SizedBox(
              height: 180,
              width: double.infinity,
              child: CustomPaint(painter: _DarkEarthMapPainter()),
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
                  color: ObsidianTheme.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Text('View all →', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textMuted)),
            ],
          ),
          const SizedBox(height: 12),
          blocksAsync.when(
            loading: () => const SizedBox(height: 60, child: Center(child: CupertinoActivityIndicator())),
            error: (_, __) => SizedBox(
              height: 60,
              child: Center(child: Text('Schedule unavailable', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12))),
            ),
            data: (blocks) {
              if (blocks.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      'Clear day ahead',
                      style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
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
                color: isLive ? ObsidianTheme.emerald : ObsidianTheme.textMuted,
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 42,
              child: Text(
                time,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 12,
                  color: ObsidianTheme.textMuted,
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
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (block.location != null || block.clientName != null)
                    Text(
                      block.location ?? block.clientName ?? '',
                      style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
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
    return _TapCard(
      onTap: () => context.push('/inbox'),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: Colors.white.withValues(alpha: 0.04),
            ),
            child: const Icon(PhosphorIconsLight.tray, size: 18, color: ObsidianTheme.textSecondary),
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
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Priority messages & alerts',
                  style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
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
          const Icon(PhosphorIconsLight.caretRight, size: 14, color: ObsidianTheme.textMuted),
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

class _QuickActionsRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final actions = [
      _QA(icon: PhosphorIconsLight.barcode, label: 'SCAN', onTap: () {
        Navigator.of(context).push(CupertinoPageRoute(builder: (_) => const ScannerScreen()));
      }),
      _QA(icon: PhosphorIconsLight.plus, label: 'NEW JOB', onTap: () => showCreateJobSheet(context)),
      _QA(icon: PhosphorIconsLight.magnifyingGlass, label: 'SEARCH', onTap: () => showCommandPalette(context)),
      _QA(icon: PhosphorIconsLight.timer, label: 'CLOCK IN', onTap: () {
        HapticFeedback.mediumImpact();
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
          color: Colors.white.withValues(alpha: _pressed ? 0.06 : 0.03),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(widget.action.icon, size: 20, color: Colors.white),
            const SizedBox(height: 6),
            Text(
              widget.action.label,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 8,
                color: ObsidianTheme.textMuted,
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
              ? const Color(0xFF09090B).withValues(alpha: 0.95)
              : const Color(0xFF09090B),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        foregroundDecoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: _pressed ? Colors.white.withValues(alpha: 0.02) : Colors.transparent,
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
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF050508),
    );

    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.025)
      ..strokeWidth = 0.5;
    for (double y = 0; y < size.height; y += 20) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 20) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    // Simulated roads
    final roadPaint = Paint()
      ..color = const Color(0xFF18181B)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(size.width * 0.1, size.height * 0.5), Offset(size.width * 0.9, size.height * 0.3), roadPaint);
    canvas.drawLine(Offset(size.width * 0.3, size.height * 0.1), Offset(size.width * 0.4, size.height * 0.9), roadPaint);
    canvas.drawLine(Offset(size.width * 0.6, size.height * 0.2), Offset(size.width * 0.8, size.height * 0.8), roadPaint);

    // Emerald tech dots
    final dots = [
      Offset(size.width * 0.25, size.height * 0.35),
      Offset(size.width * 0.55, size.height * 0.45),
      Offset(size.width * 0.70, size.height * 0.30),
      Offset(size.width * 0.40, size.height * 0.65),
      Offset(size.width * 0.80, size.height * 0.60),
    ];

    for (final dot in dots) {
      canvas.drawCircle(dot, 6, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.15));
      canvas.drawCircle(dot, 4, Paint()..color = ObsidianTheme.emerald);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ═══════════════════════════════════════════════════════════
// ── Wormhole Transition (Workspace Switch) ──────────────
// ═══════════════════════════════════════════════════════════

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
