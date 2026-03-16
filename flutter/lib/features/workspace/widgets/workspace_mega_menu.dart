import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Project Seamless Context — Workspace Mega Menu v2 ────
// ═══════════════════════════════════════════════════════════
//
// A lightweight, theme-native overlay dropdown anchored flush
// below the AppBar. Zero hardcoded colors. Zero backdrop blur.
// Uses Flutter's Theme.of(context) for full Light/Dark parity.
//
// Replaces the heavy "Obsidian Mega Menu" (v1) with a clean,
// native-feeling context switcher that acts as a window-blind
// extension of the AppBar surface.

/// Controller that manages the OverlayEntry lifecycle,
/// animation state, and race-condition guards.
class WorkspaceMegaMenuController {
  final TickerProvider vsync;
  final LayerLink layerLink;

  late final AnimationController _animCtrl;
  OverlayEntry? _overlayEntry;
  OverlayEntry? _backdropEntry;
  bool _isOpen = false;
  bool _isSwitching = false;

  /// Callbacks
  VoidCallback? onOpened;
  VoidCallback? onClosed;
  VoidCallback? onWorkspaceSwitched;

  WorkspaceMegaMenuController({
    required this.vsync,
    LayerLink? link,
  }) : layerLink = link ?? LayerLink() {
    _animCtrl = AnimationController(
      vsync: vsync,
      duration: const Duration(milliseconds: 220),
    );
    _animCtrl.addStatusListener(_onAnimStatus);
  }

  AnimationController get animation => _animCtrl;
  bool get isOpen => _isOpen;

  void _onAnimStatus(AnimationStatus status) {
    if (status == AnimationStatus.dismissed) {
      _removeOverlays();
      _isOpen = false;
      onClosed?.call();
    }
  }

  void open(BuildContext context, WidgetRef ref) {
    if (_isOpen) {
      close();
      return;
    }

    HapticFeedback.selectionClick();
    _isOpen = true;
    _isSwitching = false;

    final overlay = Overlay.of(context);

    // 1. Lightweight scrim (no blur)
    _backdropEntry = OverlayEntry(
      builder: (ctx) => _SeamlessScrim(
        animation: _animCtrl,
        onDismiss: close,
      ),
    );

    // 2. The dropdown menu
    _overlayEntry = OverlayEntry(
      builder: (ctx) => _SeamlessDropdown(
        layerLink: layerLink,
        animation: _animCtrl,
        onDismiss: close,
        onSwitch: (ws) => _handleSwitch(context, ref, ws),
      ),
    );

    overlay.insert(_backdropEntry!);
    overlay.insert(_overlayEntry!);
    _animCtrl.forward(from: 0);
    onOpened?.call();
  }

  void close() {
    if (!_isOpen) return;
    _animCtrl.reverse();
  }

  Future<void> _handleSwitch(
    BuildContext context,
    WidgetRef ref,
    Workspace ws,
  ) async {
    // Race condition guard — only process first tap
    if (_isSwitching) return;
    _isSwitching = true;

    HapticFeedback.heavyImpact();

    // 1. Close the menu immediately
    close();

    // 2. Switch workspace
    await ref
        .read(activeWorkspaceIdProvider.notifier)
        .switchTo(ws.organizationId);

    // 3. Invalidate all workspace-scoped providers
    ref.invalidate(allWorkspacesProvider);
    ref.invalidate(profileProvider);
    ref.invalidate(jobsStreamProvider);
    ref.invalidate(myTodayBlocksProvider);
    ref.invalidate(activeWorkspaceProvider);

    // 4. Notify parent to trigger wormhole
    onWorkspaceSwitched?.call();

    _isSwitching = false;
  }

  void _removeOverlays() {
    _backdropEntry?.remove();
    _backdropEntry?.dispose();
    _backdropEntry = null;
    _overlayEntry?.remove();
    _overlayEntry?.dispose();
    _overlayEntry = null;
  }

  void dispose() {
    _removeOverlays();
    _animCtrl.removeStatusListener(_onAnimStatus);
    _animCtrl.dispose();
  }
}

// ═══════════════════════════════════════════════════════════
// ── Lightweight Scrim (No Blur) ─────────────────────────
// ═══════════════════════════════════════════════════════════

class _SeamlessScrim extends StatelessWidget {
  final AnimationController animation;
  final VoidCallback onDismiss;

  const _SeamlessScrim({
    required this.animation,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    final appBarBottom = topPad + 54;
    final isLight = Theme.of(context).brightness == Brightness.light;

    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        return Positioned.fill(
          top: appBarBottom,
          child: GestureDetector(
            onTap: onDismiss,
            behavior: HitTestBehavior.opaque,
            child: Container(
              color: Colors.black.withValues(
                alpha: (isLight ? 0.10 : 0.40) * animation.value,
              ),
            ),
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Seamless Dropdown (The Flush Accordion) ──────────────
// ═══════════════════════════════════════════════════════════

class _SeamlessDropdown extends ConsumerWidget {
  final LayerLink layerLink;
  final AnimationController animation;
  final VoidCallback onDismiss;
  final void Function(Workspace ws) onSwitch;

  const _SeamlessDropdown({
    required this.layerLink,
    required this.animation,
    required this.onDismiss,
    required this.onSwitch,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final topPad = MediaQuery.of(context).padding.top;
    final screenHeight = MediaQuery.of(context).size.height;
    final appBarBottom = topPad + 54;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final workspacesAsync = ref.watch(allWorkspacesProvider);
    final activeId = ref.watch(activeWorkspaceIdProvider);

    return Positioned(
      top: appBarBottom,
      left: 0,
      right: 0,
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, child) {
          return ClipRect(
            child: Align(
              alignment: Alignment.topCenter,
              heightFactor: CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutQuart,
              ).value,
              child: child,
            ),
          );
        },
        child: Material(
          color: Colors.transparent,
          child: Container(
            constraints: BoxConstraints(
              maxHeight: screenHeight * 0.50,
            ),
            decoration: BoxDecoration(
              // Inherit scaffold background — seamless with AppBar
              color: theme.scaffoldBackgroundColor,
              borderRadius: BorderRadius.zero,
              border: Border(
                bottom: BorderSide(
                  color: theme.dividerColor,
                  width: 1.0,
                ),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Icon(
                        PhosphorIconsLight.buildings,
                        size: 14,
                        color: colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'WORKSPACES',
                        style: theme.textTheme.labelSmall?.copyWith(
                          letterSpacing: 1.2,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Workspace Tiles ──
                Flexible(
                  child: workspacesAsync.when(
                    data: (workspaces) {
                      final itemCount = workspaces.length + 1;

                      return ListView.builder(
                        padding: const EdgeInsets.only(bottom: 8),
                        shrinkWrap: true,
                        physics: const BouncingScrollPhysics(),
                        itemCount: itemCount,
                        itemBuilder: (context, index) {
                          if (index == workspaces.length) {
                            return _CreateJoinTile(onDismiss: onDismiss);
                          }

                          final ws = workspaces[index];
                          final isActive = ws.organizationId == activeId;

                          return _WorkspaceTile(
                            workspace: ws,
                            isActive: isActive,
                            onTap: () {
                              if (isActive) {
                                onDismiss();
                                return;
                              }
                              onSwitch(ws);
                            },
                          );
                        },
                      );
                    },
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: SizedBox(
                          width: 24,
                          height: 24,
                          child: CupertinoActivityIndicator(),
                        ),
                      ),
                    ),
                    error: (_, __) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: Text(
                          'Failed to load workspaces',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.error,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // ── Bottom safe padding ──
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Workspace Tile (Clean & Native) ─────────────────────
// ═══════════════════════════════════════════════════════════

class _WorkspaceTile extends StatefulWidget {
  final Workspace workspace;
  final bool isActive;
  final VoidCallback onTap;

  const _WorkspaceTile({
    required this.workspace,
    required this.isActive,
    required this.onTap,
  });

  @override
  State<_WorkspaceTile> createState() => _WorkspaceTileState();
}

class _WorkspaceTileState extends State<_WorkspaceTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final ws = widget.workspace;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isLight = theme.brightness == Brightness.light;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap();
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        height: 64,
        // Full-width tiles — no outer horizontal margin
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
        decoration: BoxDecoration(
          color: _pressed
              ? colorScheme.onSurface.withValues(alpha: 0.04)
              : widget.isActive
                  ? colorScheme.primary.withValues(alpha: 0.08)
                  : Colors.transparent,
          // No border radius — flush with container
          borderRadius: BorderRadius.zero,
        ),
        child: Row(
          children: [
            // ── Left: Workspace Avatar ──
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: widget.isActive
                    ? colorScheme.primary.withValues(alpha: 0.12)
                    : colorScheme.onSurface.withValues(alpha: isLight ? 0.06 : 0.08),
                border: Border.all(
                  color: widget.isActive
                      ? colorScheme.primary.withValues(alpha: 0.25)
                      : colorScheme.outline.withValues(alpha: 0.15),
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
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: widget.isActive
                              ? colorScheme.primary
                              : colorScheme.onSurface,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 14),

            // ── Center: Name + Role ──
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ws.name,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${ws.role.toUpperCase()}${ws.trade != null ? '  •  ${ws.trade!.toUpperCase()}' : ''}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      fontFamily: GoogleFonts.jetBrainsMono().fontFamily,
                      color: colorScheme.onSurfaceVariant,
                      letterSpacing: 0.5,
                      fontSize: 10,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            // ── Right: Active Indicator ──
            if (widget.isActive)
              Icon(
                Icons.check_circle_rounded,
                color: colorScheme.primary,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── "Create or Join Workspace" Action Tile ───────────────
// ═══════════════════════════════════════════════════════════

class _CreateJoinTile extends StatefulWidget {
  final VoidCallback onDismiss;

  const _CreateJoinTile({required this.onDismiss});

  @override
  State<_CreateJoinTile> createState() => _CreateJoinTileState();
}

class _CreateJoinTileState extends State<_CreateJoinTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onDismiss();
        context.push('/workspace/create');
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        height: 64,
        // Full-width — no outer margin
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: _pressed
              ? colorScheme.onSurface.withValues(alpha: 0.04)
              : Colors.transparent,
          borderRadius: BorderRadius.zero,
        ),
        child: Row(
          children: [
            // ── Left: Plus Icon ──
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: colorScheme.onSurface.withValues(alpha: 0.06),
                border: Border.all(
                  color: colorScheme.outline.withValues(alpha: 0.15),
                ),
              ),
              child: Icon(
                PhosphorIconsLight.plus,
                size: 18,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: 14),

            // ── Text ──
            Text(
              'Create or Join Workspace',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
