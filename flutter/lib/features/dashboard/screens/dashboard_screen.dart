import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/dashboard_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/services/state_machine_provider.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/grid_widgets.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/widget_gallery.dart';
import 'package:iworkr_mobile/features/workspace/widgets/workspace_switcher_sheet.dart';

/// "The Command Center" — a dynamic, personalizable dashboard
/// with glassmorphic widgets in a staggered grid.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _wormholeTrigger = false;

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  Future<void> _openSwitcher() async {
    final switched = await showWorkspaceSwitcher(context);
    if (switched && mounted) {
      setState(() => _wormholeTrigger = true);

      // Invalidate workspace-scoped providers
      ref.invalidate(profileProvider);
      ref.invalidate(revenueStatsProvider);
      ref.invalidate(myTodayBlocksProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);
    final roleAsync = ref.watch(userRoleProvider);
    final wsAsync = ref.watch(activeWorkspaceProvider);
    final layout = ref.watch(dashboardLayoutProvider);
    final editMode = ref.watch(dashboardEditModeProvider);

    final claims = ref.watch(userClaimsProvider).valueOrNull ?? <String>{};
    final filteredLayout = layout.where((w) {
      final info = widgetCatalog.where((c) => c.type == w.type).firstOrNull;
      if (info?.requiredClaim == null) return true;
      return claims.contains(info!.requiredClaim);
    }).toList();

    return WormholeTransition(
      trigger: _wormholeTrigger,
      onComplete: () => setState(() => _wormholeTrigger = false),
      child: Scaffold(
        backgroundColor: ObsidianTheme.void_,
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              if (editMode) const _GridOverlay(),

              RefreshIndicator(
                color: ObsidianTheme.emerald,
                backgroundColor: ObsidianTheme.surface1,
                onRefresh: () async {
                  HapticFeedback.mediumImpact();
                  ref.invalidate(revenueStatsProvider);
                  ref.invalidate(myTodayBlocksProvider);
                  ref.invalidate(profileProvider);
                  ref.invalidate(allWorkspacesProvider);
                  ref.invalidate(pipelineStatsProvider);
                  ref.invalidate(overdueJobsProvider);
                  ref.invalidate(outstandingInvoicesProvider);
                  ref.invalidate(financialPulseProvider);
                  ref.invalidate(recentAuditLogProvider);
                },
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverToBoxAdapter(
                      child: _DashboardHeader(
                        greeting: _greeting(),
                        profileAsync: profileAsync,
                        roleAsync: roleAsync,
                        workspaceAsync: wsAsync,
                        editMode: editMode,
                        onAvatarTap: _openSwitcher,
                        onToggleEdit: () {
                          HapticFeedback.mediumImpact();
                          ref.read(dashboardEditModeProvider.notifier).state = !editMode;
                        },
                        onAddWidget: () async {
                          final config = await showWidgetGallery(context, ref);
                          if (config != null) {
                            ref.read(dashboardLayoutProvider.notifier).addWidget(config.type, config.size);
                          }
                        },
                        onReset: () {
                          HapticFeedback.heavyImpact();
                          ref.read(dashboardLayoutProvider.notifier).resetToDefault();
                        },
                      ),
                    ),

                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 120),
                      sliver: SliverMasonryGrid.count(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childCount: filteredLayout.length,
                        itemBuilder: (context, index) {
                          final config = filteredLayout[index];
                          return _LivingGridTile(
                            key: ValueKey(config.id),
                            config: config,
                            editMode: editMode,
                            index: index,
                            ref: ref,
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Dashboard Header ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _DashboardHeader extends StatelessWidget {
  final String greeting;
  final AsyncValue profileAsync;
  final AsyncValue<UserRole> roleAsync;
  final AsyncValue<Workspace?> workspaceAsync;
  final bool editMode;
  final VoidCallback onAvatarTap;
  final VoidCallback onToggleEdit;
  final VoidCallback onAddWidget;
  final VoidCallback onReset;

  const _DashboardHeader({
    required this.greeting,
    required this.profileAsync,
    required this.roleAsync,
    required this.workspaceAsync,
    required this.editMode,
    required this.onAvatarTap,
    required this.onToggleEdit,
    required this.onAddWidget,
    required this.onReset,
  });

  Color _accentForRole(UserRole role) {
    if (role.isGodMode) return const Color(0xFFA78BFA);
    if (role.isManager) return ObsidianTheme.amber;
    return ObsidianTheme.emerald;
  }

  @override
  Widget build(BuildContext context) {
    final role = roleAsync.valueOrNull;
    final ws = workspaceAsync.valueOrNull;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // ── Workspace Avatar Trigger ──
              GestureDetector(
                onTap: onAvatarTap,
                child: _WorkspaceAvatar(workspace: ws),
              ),
              const SizedBox(width: 12),

              Expanded(
                child: profileAsync.when(
                  data: (profile) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            greeting,
                            style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textMuted),
                          ),
                          if (role != null) ...[
                            const SizedBox(width: 8),
                            _ClearanceBadge(role: role),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        profile?.displayName ?? 'Operator',
                        style: GoogleFonts.inter(
                          fontSize: 22, fontWeight: FontWeight.w600,
                          color: ObsidianTheme.textPrimary, letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                  loading: () => const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ShimmerLoading(width: 100, height: 14),
                      SizedBox(height: 8),
                      ShimmerLoading(width: 200, height: 24),
                    ],
                  ),
                  error: (_, __) => Text(
                    'Command Center',
                    style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                ),
              ),

              if (editMode) ...[
                _HeaderButton(
                  icon: PhosphorIconsLight.plus,
                  color: role != null ? _accentForRole(role) : ObsidianTheme.emerald,
                  onTap: onAddWidget,
                ),
                const SizedBox(width: 6),
                _HeaderButton(
                  icon: PhosphorIconsLight.arrowCounterClockwise,
                  color: ObsidianTheme.amber,
                  onTap: onReset,
                ),
                const SizedBox(width: 6),
              ],
              _HeaderButton(
                icon: editMode ? PhosphorIconsBold.checkCircle : PhosphorIconsLight.squaresFour,
                color: editMode ? ObsidianTheme.emerald : ObsidianTheme.textSecondary,
                onTap: onToggleEdit,
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Workspace Avatar (Switcher Trigger) ──────────────────
// ═══════════════════════════════════════════════════════════

class _WorkspaceAvatar extends StatelessWidget {
  final Workspace? workspace;
  const _WorkspaceAvatar({this.workspace});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: ObsidianTheme.surface2,
        border: Border.all(
          color: ObsidianTheme.emerald.withValues(alpha: 0.3),
        ),
        image: workspace?.logoUrl != null
            ? DecorationImage(
                image: NetworkImage(workspace!.logoUrl!),
                fit: BoxFit.cover,
              )
            : null,
        boxShadow: [
          BoxShadow(
            color: ObsidianTheme.emerald.withValues(alpha: 0.08),
            blurRadius: 12,
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (workspace?.logoUrl == null)
            Center(
              child: Text(
                workspace?.initials ?? 'iW',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: ObsidianTheme.emerald,
                ),
              ),
            ),

          // Chevron indicator
          Positioned(
            bottom: -2,
            right: -2,
            child: Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.surface1,
                border: Border.all(color: ObsidianTheme.borderMedium),
              ),
              child: const Center(
                child: Icon(
                  PhosphorIconsBold.caretDown,
                  size: 8,
                  color: ObsidianTheme.textMuted,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Clearance level badge — visually indicates "God Mode" vs "Operator"
class _ClearanceBadge extends StatelessWidget {
  final UserRole role;
  const _ClearanceBadge({required this.role});

  @override
  Widget build(BuildContext context) {
    final Color accent;
    final String label;
    final IconData icon;

    if (role.isGodMode) {
      accent = const Color(0xFFA78BFA); // Violet
      label = 'GOD MODE';
      icon = PhosphorIconsBold.crown;
    } else if (role.isManager) {
      accent = ObsidianTheme.amber;
      label = 'DISPATCH';
      icon = PhosphorIconsBold.shieldStar;
    } else {
      accent = ObsidianTheme.emerald;
      label = 'OPERATOR';
      icon = PhosphorIconsBold.wrench;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: accent.withValues(alpha: 0.1),
        border: Border.all(color: accent.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: accent),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 8,
              fontWeight: FontWeight.w600,
              color: accent,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 300.ms, duration: 400.ms)
        .scale(begin: const Offset(0.8, 0.8), end: const Offset(1, 1), delay: 300.ms, duration: 400.ms, curve: Curves.easeOutBack);
  }
}

class _HeaderButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _HeaderButton({required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Icon(icon, size: 16, color: color),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Living Grid Tile ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _LivingGridTile extends StatefulWidget {
  final DashboardWidgetConfig config;
  final bool editMode;
  final int index;
  final WidgetRef ref;

  const _LivingGridTile({
    super.key,
    required this.config,
    required this.editMode,
    required this.index,
    required this.ref,
  });

  @override
  State<_LivingGridTile> createState() => _LivingGridTileState();
}

class _LivingGridTileState extends State<_LivingGridTile>
    with SingleTickerProviderStateMixin {
  late AnimationController _jiggleCtrl;

  @override
  void initState() {
    super.initState();
    _jiggleCtrl = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 150 + Random().nextInt(100)),
    );
  }

  @override
  void didUpdateWidget(_LivingGridTile old) {
    super.didUpdateWidget(old);
    if (widget.editMode && !_jiggleCtrl.isAnimating) {
      _jiggleCtrl.repeat(reverse: true);
    } else if (!widget.editMode && _jiggleCtrl.isAnimating) {
      _jiggleCtrl.stop();
      _jiggleCtrl.reset();
    }
  }

  @override
  void dispose() {
    _jiggleCtrl.dispose();
    super.dispose();
  }

  double _tileHeight() {
    switch (widget.config.size) {
      case WidgetSize.small:
        return 120;
      case WidgetSize.medium:
        return 140;
      case WidgetSize.large:
        return 260;
    }
  }

  @override
  Widget build(BuildContext context) {
    final crossSpan = widget.config.crossAxisCellCount;

    Widget tile = AnimatedContainer(
      duration: ObsidianTheme.medium,
      curve: Curves.easeOutCubic,
      height: _tileHeight(),
      child: GestureDetector(
        onLongPress: () {
          HapticFeedback.mediumImpact();
          widget.ref.read(dashboardEditModeProvider.notifier).state = true;
        },
        child: _GlassWidgetContainer(
          config: widget.config,
          editMode: widget.editMode,
          onRemove: () {
            HapticFeedback.heavyImpact();
            widget.ref.read(dashboardLayoutProvider.notifier).removeWidget(widget.config.id);
          },
          onResize: () {
            HapticFeedback.selectionClick();
            widget.ref.read(dashboardLayoutProvider.notifier).resizeWidget(widget.config.id);
          },
          child: buildGridWidget(widget.config, widget.ref),
        ),
      ),
    );

    // Jiggle in edit mode
    if (widget.editMode) {
      tile = AnimatedBuilder(
        animation: _jiggleCtrl,
        builder: (_, child) {
          final angle = (_jiggleCtrl.value - 0.5) * 0.015; // ±0.75 degrees
          return Transform.rotate(angle: angle, child: child);
        },
        child: tile,
      );
    }

    // Entry animation
    tile = tile
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 80 + widget.index * 60),
          duration: 500.ms,
          curve: const Cubic(0.16, 1, 0.3, 1),
        )
        .moveY(
          begin: 12,
          delay: Duration(milliseconds: 80 + widget.index * 60),
          duration: 500.ms,
          curve: const Cubic(0.16, 1, 0.3, 1),
        );

    // For medium/large widgets, span 2 columns
    if (crossSpan == 2) {
      return StaggeredGridTile.fit(
        crossAxisCellCount: 2,
        child: tile,
      );
    }

    return StaggeredGridTile.fit(
      crossAxisCellCount: 1,
      child: tile,
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Glass Widget Container ───────────────────────────────
// ═══════════════════════════════════════════════════════════

class _GlassWidgetContainer extends StatelessWidget {
  final DashboardWidgetConfig config;
  final bool editMode;
  final Widget child;
  final VoidCallback onRemove;
  final VoidCallback onResize;

  const _GlassWidgetContainer({
    required this.config,
    required this.editMode,
    required this.child,
    required this.onRemove,
    required this.onResize,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: const Color(0xFF18181B).withValues(alpha: 0.4),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 20,
              ),
            ],
          ),
          child: Stack(
            children: [
              // Widget content
              Positioned.fill(child: child),

              // Edit mode overlays
              if (editMode) ...[
                // Remove button (top-left)
                Positioned(
                  top: -4,
                  left: -4,
                  child: GestureDetector(
                    onTap: onRemove,
                    child: Container(
                      width: 24, height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.rose.withValues(alpha: 0.9),
                        boxShadow: [BoxShadow(color: ObsidianTheme.rose.withValues(alpha: 0.3), blurRadius: 8)],
                      ),
                      child: const Icon(PhosphorIconsBold.minus, size: 12, color: Colors.white),
                    ),
                  ),
                ),

                // Resize handle (bottom-right)
                Positioned(
                  bottom: -4,
                  right: -4,
                  child: GestureDetector(
                    onTap: onResize,
                    child: Container(
                      width: 24, height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.blue.withValues(alpha: 0.9),
                        boxShadow: [BoxShadow(color: ObsidianTheme.blue.withValues(alpha: 0.3), blurRadius: 8)],
                      ),
                      child: const Icon(PhosphorIconsBold.arrowsOutSimple, size: 12, color: Colors.white),
                    ),
                  ),
                ),

                // Size label (bottom-left)
                Positioned(
                  bottom: 0,
                  left: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                    child: Text(
                      config.size.name.toUpperCase(),
                      style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Grid Overlay (Edit Mode Background) ──────────────────
// ═══════════════════════════════════════════════════════════

class _GridOverlay extends StatelessWidget {
  const _GridOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: CustomPaint(painter: _DottedGridPainter())
          .animate()
          .fadeIn(duration: 300.ms),
    );
  }
}

class _DottedGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..strokeWidth = 1;

    const spacing = 48.0;
    const dashLen = 4.0;
    const gap = 8.0;

    // Vertical dashed lines
    for (double x = spacing; x < size.width; x += spacing) {
      double y = 0;
      while (y < size.height) {
        canvas.drawLine(Offset(x, y), Offset(x, y + dashLen), paint);
        y += dashLen + gap;
      }
    }

    // Horizontal dashed lines
    for (double y = spacing; y < size.height; y += spacing) {
      double x = 0;
      while (x < size.width) {
        canvas.drawLine(Offset(x, y), Offset(x + dashLen, y), paint);
        x += dashLen + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
