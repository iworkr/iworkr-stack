import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/industry_provider.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';

// ═══════════════════════════════════════════════════════════
// ── Apple-Style Floating Dock — Icon-Only, Glass Pill ────
// ═══════════════════════════════════════════════════════════
//
// Equal-width icon tabs. Selected tab gets a glassmorphic pill
// that slides between positions with spring physics. No text.
// Clean, minimal, native iOS feel.
//
// Project Aegis: Tabs are now filtered by UserRole via
// currentRoleProvider. Workers see a reduced dock; admins
// see the full set.

class ShellScaffold extends ConsumerWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

  // ── Full tab sets (unfiltered) ─────────────────────────

  static const _tradesTabs = [
    _DockTab(routePrefix: '/', icon: PhosphorIconsLight.houseLine, activeIcon: PhosphorIconsFill.houseLine, label: 'Home', requiresClaim: null),
    _DockTab(routePrefix: '/jobs', icon: PhosphorIconsLight.briefcase, activeIcon: PhosphorIconsFill.briefcase, label: 'Jobs', requiresClaim: null),
    _DockTab(routePrefix: '/schedule', icon: PhosphorIconsLight.calendarBlank, activeIcon: PhosphorIconsFill.calendarBlank, label: 'Schedule', requiresClaim: null),
    _DockTab(routePrefix: '/chat', icon: PhosphorIconsLight.chatCircle, activeIcon: PhosphorIconsFill.chatCircle, label: 'Chat', requiresClaim: null),
    _DockTab(routePrefix: '/profile', icon: PhosphorIconsLight.userCircle, activeIcon: PhosphorIconsFill.userCircle, label: 'Profile', requiresClaim: null),
  ];

  static const _careTabs = [
    _DockTab(routePrefix: '/', icon: PhosphorIconsLight.houseLine, activeIcon: PhosphorIconsFill.houseLine, label: 'Home', requiresClaim: null),
    _DockTab(routePrefix: '/schedule', icon: PhosphorIconsLight.calendarBlank, activeIcon: PhosphorIconsFill.calendarBlank, label: 'Roster', requiresClaim: null),
    _DockTab(routePrefix: '/participants', icon: PhosphorIconsLight.usersThree, activeIcon: PhosphorIconsFill.usersThree, label: 'Participants', requiresClaim: null),
    _DockTab(routePrefix: '/profile', icon: PhosphorIconsLight.userCircle, activeIcon: PhosphorIconsFill.userCircle, label: 'Profile', requiresClaim: null),
  ];

  // ── Role-based tab filtering ───────────────────────────

  /// Filters the dock tabs based on the user's role and claims.
  /// Workers (technician, apprentice, senior_tech, subcontractor) get
  /// a reduced set. Admin+ (owner, admin, manager, office_admin) see
  /// everything. Tabs with a `requiresClaim` are only shown if the
  /// user's claims contain that value.
  static List<_DockTab> _filterTabsForRole(
    List<_DockTab> tabs,
    UserRole role,
    Set<String> claims,
  ) {
    return tabs.where((tab) {
      // If the tab requires a specific claim, check it
      if (tab.requiresClaim != null) {
        return claims.contains(tab.requiresClaim);
      }
      // All unrestricted tabs are always visible
      return true;
    }).toList();
  }

  int _resolveIndex(String location, List<_DockTab> tabs) {
    for (int i = 0; i < tabs.length; i++) {
      final prefix = tabs[i].routePrefix;
      if (prefix == '/') continue;
      if (location.startsWith(prefix)) return i;
    }
    if (location.startsWith('/inbox')) return 0;
    if (location.startsWith('/care') && !location.startsWith('/care/my-shifts')) {
      for (int i = 0; i < tabs.length; i++) {
        if (tabs[i].routePrefix == '/schedule') return i;
      }
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.toString();
    final isCare = ref.watch(isCareProvider);
    final shiftState = ref.watch(activeShiftStateProvider);
    final isInActiveWorkspace = shiftState.hasActiveShift;
    final role = ref.watch(currentRoleProvider);
    final claims = ref.watch(currentClaimsProvider);

    final rawTabs = isCare ? _careTabs : _tradesTabs;
    final tabs = _filterTabsForRole(rawTabs, role, claims);
    final current = _resolveIndex(location, tabs);
    final keyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: (isInActiveWorkspace || keyboardOpen)
          ? null
          : _GlassDock(
              tabs: tabs,
              currentIndex: current,
              onTabTap: (index) {
                if (index != current) {
                  HapticFeedback.lightImpact();
                  context.go(tabs[index].routePrefix);
                } else {
                  HapticFeedback.selectionClick();
                }
              },
            ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Tab Data ────────────────────────────────────────
// ══════════════════════════════════════════════════════

class _DockTab {
  final String routePrefix;
  final IconData icon;
  final IconData activeIcon;
  final String label;

  /// If non-null, the tab is only shown when the user's claims contain this value.
  /// Null means the tab is unrestricted (visible to all roles).
  final String? requiresClaim;

  const _DockTab({
    required this.routePrefix,
    required this.icon,
    required this.activeIcon,
    required this.label,
    this.requiresClaim,
  });
}

// ══════════════════════════════════════════════════════
// ── Glass Dock (The Floating Bar) ───────────────────
// ══════════════════════════════════════════════════════

class _GlassDock extends StatelessWidget {
  final List<_DockTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onTabTap;

  const _GlassDock({
    required this.tabs,
    required this.currentIndex,
    required this.onTabTap,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final isDark = context.isDark;

    return Padding(
      padding: EdgeInsets.only(
        bottom: bottomPad + 8,
        left: 40,
        right: 40,
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.30 : 0.08),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.15 : 0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
            child: Container(
              height: 56,
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : Colors.white.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.10)
                      : Colors.black.withValues(alpha: 0.06),
                  width: 0.5,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final tileWidth = (constraints.maxWidth - 8) / tabs.length;
                  return Stack(
                    alignment: Alignment.centerLeft,
                    children: [
                      // ── Sliding Glass Pill ──
                      AnimatedPositioned(
                        duration: const Duration(milliseconds: 350),
                        curve: Curves.easeOutCubic,
                        left: 4 + (currentIndex * tileWidth),
                        child: _GlassPill(
                          width: tileWidth,
                          isDark: isDark,
                        ),
                      ),

                      // ── Tab Icons ──
                      Row(
                        children: List.generate(tabs.length, (i) {
                          return _DockIcon(
                            tab: tabs[i],
                            isActive: i == currentIndex,
                            width: tileWidth,
                            isDark: isDark,
                            onTap: () => onTabTap(i),
                          );
                        }),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Sliding Glass Pill (The Selection Indicator) ────
// ══════════════════════════════════════════════════════

class _GlassPill extends StatelessWidget {
  final double width;
  final bool isDark;

  const _GlassPill({required this.width, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width - 4,
      height: 40,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: isDark
            ? Colors.white.withValues(alpha: 0.10)
            : Colors.white.withValues(alpha: 0.85),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.12)
              : Colors.black.withValues(alpha: 0.04),
          width: 0.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.12 : 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Dock Icon (Equal-Width, Icon Only) ──────────────
// ══════════════════════════════════════════════════════

class _DockIcon extends StatefulWidget {
  final _DockTab tab;
  final bool isActive;
  final double width;
  final bool isDark;
  final VoidCallback onTap;

  const _DockIcon({
    required this.tab,
    required this.isActive,
    required this.width,
    required this.isDark,
    required this.onTap,
  });

  @override
  State<_DockIcon> createState() => _DockIconState();
}

class _DockIconState extends State<_DockIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pressCtrl;
  late final Animation<double> _pressScale;

  @override
  void initState() {
    super.initState();
    _pressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 80),
      reverseDuration: const Duration(milliseconds: 250),
    );
    _pressScale = Tween<double>(begin: 1.0, end: 0.85).animate(
      CurvedAnimation(parent: _pressCtrl, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _pressCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Semantics(
      label: widget.tab.label,
      button: true,
      selected: widget.isActive,
      child: GestureDetector(
        onTapDown: (_) => _pressCtrl.forward(),
        onTapUp: (_) {
          _pressCtrl.reverse();
          widget.onTap();
        },
        onTapCancel: () => _pressCtrl.reverse(),
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: widget.width,
          height: 56,
          child: Center(
            child: AnimatedBuilder(
              animation: _pressScale,
              builder: (context, child) {
                return Transform.scale(
                  scale: _pressScale.value,
                  child: child,
                );
              },
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, animation) {
                  return ScaleTransition(
                    scale: animation,
                    child: FadeTransition(
                      opacity: animation,
                      child: child,
                    ),
                  );
                },
                child: Icon(
                  widget.isActive ? widget.tab.activeIcon : widget.tab.icon,
                  key: ValueKey(widget.isActive),
                  size: widget.isActive ? 22 : 21,
                  color: widget.isActive
                      ? (widget.isDark ? c.textPrimary : c.textPrimary)
                      : c.textTertiary,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
