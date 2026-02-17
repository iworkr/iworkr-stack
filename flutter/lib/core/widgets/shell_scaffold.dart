import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// The Floating Glass Dock — bottom navigation shell.
///
/// Web spec (matching iOS Dynamic Island / Linear Mobile):
/// - Rounded rectangle (Radius 30), floating 24px from bottom
/// - Colors.black.withOpacity(0.8) + BackdropFilter(blur: 20)
/// - 1px ring of white/10 opacity
class ShellScaffold extends StatelessWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

  static const _tabs = [
    _DockTab(
      path: '/',
      icon: PhosphorIconsRegular.house,
      activeIcon: PhosphorIconsFill.house,
      label: 'Home',
    ),
    _DockTab(
      path: '/jobs',
      icon: PhosphorIconsRegular.briefcase,
      activeIcon: PhosphorIconsFill.briefcase,
      label: 'Jobs',
    ),
    _DockTab(
      path: '/schedule',
      icon: PhosphorIconsRegular.calendarBlank,
      activeIcon: PhosphorIconsFill.calendarBlank,
      label: 'Timeline',
    ),
    _DockTab(
      path: '/inbox',
      icon: PhosphorIconsRegular.tray,
      activeIcon: PhosphorIconsFill.tray,
      label: 'Triage',
    ),
    _DockTab(
      path: '/profile',
      icon: PhosphorIconsRegular.userCircle,
      activeIcon: PhosphorIconsFill.userCircle,
      label: 'Profile',
    ),
  ];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (int i = 0; i < _tabs.length; i++) {
      if (location == _tabs[i].path) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final current = _currentIndex(context);

    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: Padding(
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
                children: List.generate(_tabs.length, (i) {
                  final tab = _tabs[i];
                  final isActive = i == current;
                  return _DockButton(
                    tab: tab,
                    isActive: isActive,
                    onTap: () {
                      if (i != current) {
                        HapticFeedback.selectionClick();
                        context.go(tab.path);
                      }
                    },
                  );
                }),
              ),
            ),
          ),
        ),
      )
          .animate()
          .fadeIn(delay: 200.ms, duration: 400.ms)
          .moveY(begin: 20, end: 0, delay: 200.ms, duration: 500.ms, curve: Curves.easeOutQuart),
    );
  }
}

class _DockTab {
  final String path;
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _DockTab({
    required this.path,
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

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
              duration: ObsidianTheme.fast,
              child: Icon(
                isActive ? tab.activeIcon : tab.icon,
                key: ValueKey(isActive),
                size: 22,
                color: isActive ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: ObsidianTheme.fast,
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
