import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Public Entry Point ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Shows the Workspace Switcher sheet. Returns `true` if a
/// workspace switch was triggered (to fire the Wormhole transition).
Future<bool> showWorkspaceSwitcher(BuildContext context) async {
  HapticFeedback.selectionClick();
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black54,
    builder: (_) => const _WorkspaceSwitcherSheet(),
  );
  return result ?? false;
}

// ═══════════════════════════════════════════════════════════
// ── The Switcher Sheet ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _WorkspaceSwitcherSheet extends ConsumerStatefulWidget {
  const _WorkspaceSwitcherSheet();

  @override
  ConsumerState<_WorkspaceSwitcherSheet> createState() =>
      _WorkspaceSwitcherSheetState();
}

class _WorkspaceSwitcherSheetState
    extends ConsumerState<_WorkspaceSwitcherSheet> {
  bool _switching = false;

  Future<void> _onWorkspaceTap(Workspace ws) async {
    final activeId = ref.read(activeWorkspaceIdProvider);
    if (ws.organizationId == activeId) {
      Navigator.of(context).pop(false);
      return;
    }

    HapticFeedback.heavyImpact();
    setState(() => _switching = true);

    await ref
        .read(activeWorkspaceIdProvider.notifier)
        .switchTo(ws.organizationId);

    // Invalidate all workspace-scoped providers to force a refetch
    ref.invalidate(allWorkspacesProvider);

    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final workspacesAsync = ref.watch(allWorkspacesProvider);
    final activeId = ref.watch(activeWorkspaceIdProvider);
    final unreadAsync = ref.watch(workspaceUnreadProvider);
    final unreads = unreadAsync.valueOrNull ?? {};
    final mq = MediaQuery.of(context);
    final c = context.iColors;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: mq.size.height * 0.65,
          ),
          decoration: BoxDecoration(
            color: c.surface.withValues(alpha: 0.92),
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: c.borderMedium),
          ),
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 200),
            opacity: _switching ? 0.4 : 1.0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Drag Handle ──
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: c.textTertiary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // ── Header ──
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Icon(PhosphorIconsLight.planet,
                          size: 16, color: c.textMuted),
                      const SizedBox(width: 8),
                      Text(
                        'SWITCH CONTEXT',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: c.textMuted,
                          letterSpacing: 1.8,
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 300.ms, curve: Curves.easeOutCubic),

                const SizedBox(height: 4),

                // ── Workspaces Section ──
                Padding(
                  padding: const EdgeInsets.only(left: 20, bottom: 8),
                  child: Text(
                    'Workspaces',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: c.textSecondary,
                    ),
                  ),
                ),

                // ── Horizontal Workspace Cards ──
                SizedBox(
                  height: 140,
                  child: workspacesAsync.when(
                    data: (workspaces) => ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: workspaces.length + 1,
                      itemBuilder: (context, index) {
                        if (index == workspaces.length) {
                          return _AddWorkspaceCard()
                              .animate()
                              .fadeIn(
                                delay: Duration(
                                    milliseconds: 100 + index * 60),
                                duration: 400.ms,
                              )
                              .moveX(
                                begin: 20,
                                delay: Duration(
                                    milliseconds: 100 + index * 60),
                                duration: 400.ms,
                                curve: Curves.easeOutCubic,
                              );
                        }
                        final ws = workspaces[index];
                        final isActive =
                            ws.organizationId == activeId;
                        final unread =
                            unreads[ws.organizationId] ?? 0;

                        return _WorkspaceCard(
                          workspace: ws,
                          isActive: isActive,
                          unreadCount: unread,
                          onTap: () => _onWorkspaceTap(ws),
                        )
                            .animate()
                            .fadeIn(
                              delay: Duration(
                                  milliseconds: 80 + index * 60),
                              duration: 400.ms,
                            )
                            .moveX(
                              begin: 20,
                              delay: Duration(
                                  milliseconds: 80 + index * 60),
                              duration: 400.ms,
                              curve: Curves.easeOutCubic,
                            );
                      },
                    ),
                    loading: () => const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: ObsidianTheme.emerald,
                        ),
                      ),
                    ),
                    error: (_, __) => Center(
                      child: Text(
                        'Failed to load workspaces',
                        style: GoogleFonts.inter(
                            fontSize: 13, color: ObsidianTheme.rose),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // ── Quick Info ──
                _buildActiveInfo(workspacesAsync, activeId),

                SizedBox(height: mq.padding.bottom + 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActiveInfo(
      AsyncValue<List<Workspace>> workspacesAsync, String? activeId) {
    return workspacesAsync.when(
      data: (workspaces) {
        final active = workspaces
            .where((w) => w.organizationId == activeId)
            .firstOrNull;
        if (active == null) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: ObsidianTheme.emerald.withValues(alpha: 0.06),
              border: Border.all(
                  color: ObsidianTheme.emerald.withValues(alpha: 0.12)),
            ),
            child: Row(
              children: [
                Icon(PhosphorIconsLight.checkCircle,
                    size: 16, color: ObsidianTheme.emerald),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Active: ${active.name}',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: context.iColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Role: ${active.role.toUpperCase()} ${active.trade != null ? '  •  ${active.trade}' : ''}',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: context.iColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        )
            .animate()
            .fadeIn(delay: 200.ms, duration: 400.ms)
            .moveY(begin: 8, delay: 200.ms, duration: 400.ms);
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Workspace Card ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _WorkspaceCard extends StatefulWidget {
  final Workspace workspace;
  final bool isActive;
  final int unreadCount;
  final VoidCallback onTap;

  const _WorkspaceCard({
    required this.workspace,
    required this.isActive,
    required this.unreadCount,
    required this.onTap,
  });

  @override
  State<_WorkspaceCard> createState() => _WorkspaceCardState();
}

class _WorkspaceCardState extends State<_WorkspaceCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final ws = widget.workspace;
    final c = context.iColors;

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        width: 120,
        margin: const EdgeInsets.only(right: 10),
        transform: _pressed
            ? Matrix4.diagonal3Values(0.95, 0.95, 1)
            : Matrix4.identity(),
        transformAlignment: Alignment.center,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: widget.isActive
              ? ObsidianTheme.emerald.withValues(alpha: 0.08)
              : c.surfaceSecondary,
          border: Border.all(
            color: widget.isActive
                ? ObsidianTheme.emerald.withValues(alpha: 0.5)
                : c.border,
            width: widget.isActive ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Logo / Avatar
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: widget.isActive
                        ? ObsidianTheme.emerald.withValues(alpha: 0.15)
                        : c.surface,
                    border: Border.all(
                      color: widget.isActive
                          ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                          : c.borderMedium,
                    ),
                    image: ws.logoUrl != null
                        ? DecorationImage(
                            image: NetworkImage(ws.logoUrl!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: ws.logoUrl == null
                      ? Center(
                          child: Text(
                            ws.initials,
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: widget.isActive
                                  ? ObsidianTheme.emerald
                                  : c.textSecondary,
                            ),
                          ),
                        )
                      : null,
                ),

                // Live indicator
                if (widget.isActive)
                  Positioned(
                    top: -3,
                    right: -3,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.emerald,
                        border: Border.all(
                            color: c.surface, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color:
                                ObsidianTheme.emerald.withValues(alpha: 0.5),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    ),
                  ),

                // Unread badge
                if (widget.unreadCount > 0 && !widget.isActive)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.rose,
                        border: Border.all(
                            color: c.surface, width: 2),
                      ),
                      child: Center(
                        child: Text(
                          widget.unreadCount > 9
                              ? '9+'
                              : '${widget.unreadCount}',
                          style: GoogleFonts.inter(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            const Spacer(),

            // Name
            Text(
              ws.name,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: widget.isActive
                    ? c.textPrimary
                    : c.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 3),

            // Role badge
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: _roleColor(ws.role).withValues(alpha: 0.1),
              ),
              child: Text(
                ws.role.toUpperCase(),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 8,
                  fontWeight: FontWeight.w600,
                  color: _roleColor(ws.role),
                  letterSpacing: 0.8,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _roleColor(String role) {
    switch (role) {
      case 'owner':
        return const Color(0xFFA78BFA);
      case 'admin':
        return ObsidianTheme.amber;
      case 'manager':
        return ObsidianTheme.blue;
      default:
        return ObsidianTheme.emerald;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ── Add Workspace (Ghost Card) ───────────────────────────
// ═══════════════════════════════════════════════════════════

class _AddWorkspaceCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        // INCOMPLETE:TODO — Workspace join/create flow not implemented; tapping "Add workspace" does nothing. Done when tapping navigates to a create-workspace or join-by-invite screen.
      },
      child: Container(
        width: 120,
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: c.textTertiary.withValues(alpha: 0.3),
            style: BorderStyle.solid,
          ),
          color: Colors.transparent,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: c.textTertiary.withValues(alpha: 0.4),
                ),
              ),
              child: Icon(
                PhosphorIconsLight.plus,
                size: 20,
                color: c.textTertiary,
              ),
            ),
            const Spacer(),
            Text(
              'Add Account',
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: c.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Wormhole Transition Widget ───────────────────────────
// ═══════════════════════════════════════════════════════════

/// Wraps the main app content to provide the "Wormhole" scale/fade
/// transition when workspaces are switched.
class WormholeTransition extends StatefulWidget {
  final Widget child;
  final bool trigger;
  final VoidCallback? onComplete;

  const WormholeTransition({
    super.key,
    required this.child,
    required this.trigger,
    this.onComplete,
  });

  @override
  State<WormholeTransition> createState() => _WormholeTransitionState();
}

class _WormholeTransitionState extends State<WormholeTransition>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scaleOut;
  late Animation<double> _fadeOut;
  late Animation<double> _scaleIn;
  late Animation<double> _fadeIn;
  bool _phase2 = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _scaleOut = Tween(begin: 1.0, end: 0.9).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOutQuart),
    );
    _fadeOut = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOutQuart),
    );
    _scaleIn = Tween(begin: 1.1, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOutQuart),
    );
    _fadeIn = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOutQuart),
    );

    _ctrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        if (!_phase2) {
          setState(() => _phase2 = true);
          _ctrl.reverse();
        } else {
          setState(() => _phase2 = false);
          widget.onComplete?.call();
        }
      }
    });
  }

  @override
  void didUpdateWidget(WormholeTransition old) {
    super.didUpdateWidget(old);
    if (widget.trigger && !old.trigger) {
      _phase2 = false;
      _ctrl.forward(from: 0);
    }
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
        final scale = _phase2 ? _scaleIn.value : _scaleOut.value;
        final opacity = _phase2 ? _fadeIn.value : _fadeOut.value;

        return Transform.scale(
          scale: scale,
          child: Opacity(
            opacity: opacity.clamp(0, 1),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}
