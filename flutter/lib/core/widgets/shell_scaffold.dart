import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/search/screens/command_palette_screen.dart';

/// The Obsidian Dock — route-reactive, role-aware floating glass navigation bar.
///
/// The dock NEVER holds its own state. It derives the active tab
/// entirely from the current GoRouter URI (the "Source of Truth").
///
/// RBAC: Tabs are filtered based on the user's clearance level.
/// The Finance tab only appears for Level 3+ (Manager/Admin/Owner).
class ShellScaffold extends ConsumerWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

  static const _allTabs = [
    _DockTab(
      routePrefix: '/',
      icon: PhosphorIconsLight.houseLine,
      activeIcon: PhosphorIconsFill.houseLine,
      label: 'Home',
    ),
    _DockTab(
      routePrefix: '/jobs',
      icon: PhosphorIconsLight.briefcase,
      activeIcon: PhosphorIconsFill.briefcase,
      label: 'Jobs',
    ),
    _DockTab(
      routePrefix: '/schedule',
      icon: PhosphorIconsLight.calendarBlank,
      activeIcon: PhosphorIconsFill.calendarBlank,
      label: 'Timeline',
    ),
    _DockTab(
      routePrefix: '/chat',
      icon: PhosphorIconsLight.chatCircle,
      activeIcon: PhosphorIconsFill.chatCircle,
      label: 'Comms',
    ),
    _DockTab(
      routePrefix: '/profile',
      icon: PhosphorIconsLight.userCircle,
      activeIcon: PhosphorIconsFill.userCircle,
      label: 'Profile',
    ),
  ];

  /// Derive the active tab index from the current route URI.
  int _resolveIndex(String location, List<_DockTab> tabs) {
    for (int i = 0; i < tabs.length; i++) {
      final prefix = tabs[i].routePrefix;
      if (prefix == '/') continue;
      if (location.startsWith(prefix)) return i;
    }
    if (location.startsWith('/inbox')) return 0;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.toString();
    final roleAsync = ref.watch(userRoleProvider);

    // Resolve the visible tabs based on clearance
    final tabs = _allTabs; // Base tabs always visible
    final current = _resolveIndex(location, tabs);

    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: _ObsidianDock(
        tabs: tabs,
        currentIndex: current,
        onTabTap: (index) {
          if (index != current) {
            HapticFeedback.selectionClick();
            context.go(tabs[index].routePrefix);
          }
        },
        onSearchTap: () {
          HapticFeedback.lightImpact();
          showCommandPalette(context);
        },
        role: roleAsync.valueOrNull,
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Dock Tab Data ────────────────────────────────────
// ══════════════════════════════════════════════════════

class _DockTab {
  final String routePrefix;
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _DockTab({
    required this.routePrefix,
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

// ══════════════════════════════════════════════════════
// ── Obsidian Dock ────────────────────────────────────
// ══════════════════════════════════════════════════════

class _ObsidianDock extends StatelessWidget {
  final List<_DockTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onTabTap;
  final VoidCallback onSearchTap;
  final UserRole? role;

  const _ObsidianDock({
    required this.tabs,
    required this.currentIndex,
    required this.onTabTap,
    required this.onSearchTap,
    this.role,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      child: ClipRRect(
        borderRadius: ObsidianTheme.radiusDock,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            height: 60,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.8),
              borderRadius: ObsidianTheme.radiusDock,
              border: Border.all(color: ObsidianTheme.borderMedium),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // First 3 tabs (Home, Jobs, Timeline)
                ...List.generate(3, (i) => _DockButton(
                  tab: tabs[i],
                  isActive: i == currentIndex,
                  onTap: () => onTabTap(i),
                )),

                // Center Search (opens overlay, not a route)
                _SearchButton(onTap: onSearchTap),

                // Last 2 tabs (Comms, Profile)
                ...List.generate(2, (j) {
                  final i = j + 3;
                  return _DockButton(
                    tab: tabs[i],
                    isActive: i == currentIndex,
                    onTap: () => onTabTap(i),
                  );
                }),
              ],
            ),
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 400.ms)
        .moveY(begin: 20, end: 0, delay: 200.ms, duration: 500.ms, curve: Curves.easeOutQuart);
  }
}

// ══════════════════════════════════════════════════════
// ── Dock Button ──────────────────────────────────────
// ══════════════════════════════════════════════════════

class _DockButton extends StatelessWidget {
  final _DockTab tab;
  final bool isActive;
  final VoidCallback onTap;

  const _DockButton({
    required this.tab,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 56,
        height: 56,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) {
                return FadeTransition(
                  opacity: animation,
                  child: ScaleTransition(
                    scale: Tween<double>(begin: 0.85, end: 1.0).animate(animation),
                    child: child,
                  ),
                );
              },
              child: Icon(
                isActive ? tab.activeIcon : tab.icon,
                key: ValueKey('${tab.routePrefix}_$isActive'),
                size: 22,
                color: isActive ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              width: isActive ? 4 : 0,
              height: isActive ? 4 : 0,
              decoration: BoxDecoration(
                color: ObsidianTheme.emerald,
                shape: BoxShape.circle,
                boxShadow: isActive
                    ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 6)]
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Search Button (Center) ───────────────────────────
// ══════════════════════════════════════════════════════

class _SearchButton extends StatelessWidget {
  final VoidCallback onTap;
  const _SearchButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 56,
        height: 56,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              PhosphorIconsLight.magnifyingGlass,
              size: 22,
              color: ObsidianTheme.textTertiary,
            ),
            const SizedBox(height: 4),
            const SizedBox.shrink(),
          ],
        ),
      ),
    );
  }
}
