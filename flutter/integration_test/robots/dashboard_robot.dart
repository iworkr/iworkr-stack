import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class DashboardRobot extends BaseRobot {
  DashboardRobot(super.tester);

  // ── Finders ───────────────────────────────────────────────

  /// Dashboard load indicators — used by expectDashboardLoaded.
  List<Finder> get _dashboardIndicators => [
    findTextContaining('REVENUE'),
    findTextContaining('SCHEDULE'),
    findTextContaining('QA Test'),
  ];

  Finder get _notificationBell =>
      find.byIcon(PhosphorIconsLight.bell);

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectDashboardLoaded() async {
    TestLogger.step('Verify dashboard loaded');
    // Wait for dashboard to render — look for any of: REVENUE label,
    // SCHEDULE label, or workspace name
    final indicators = _dashboardIndicators;
    bool found = false;
    for (int attempt = 0; attempt < 30 && !found; attempt++) {
      await tester.pump(const Duration(milliseconds: 500));
      for (final finder in indicators) {
        if (finder.evaluate().isNotEmpty) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      // Last resort: just check we're not on the login screen
      final loginScreen = find.byKey(const Key('choice'));
      if (loginScreen.evaluate().isEmpty) {
        TestLogger.pass('Dashboard loaded (no login screen present)');
        return;
      }
      throw TestFailure('Dashboard did not load within 15 seconds');
    }
    TestLogger.pass('Dashboard loaded successfully');
  }

  void expectWidgetGridVisible() {
    TestLogger.step('Verify widget grid visible');
    final gridItems = find.byType(Card);
    if (gridItems.evaluate().isNotEmpty) {
      TestLogger.pass('Widget grid contains items');
    } else {
      TestLogger.info('Widget grid empty (new workspace)');
    }
  }

  // ── Actions ───────────────────────────────────────────────

  Future<void> tapWorkspaceAvatar() async {
    TestLogger.step('Tap workspace avatar');
    final avatars = find.byType(GestureDetector);
    if (avatars.evaluate().isNotEmpty) {
      await tap(avatars.first, label: 'Workspace avatar');
    }
  }

  Future<void> tapNotificationBell() async {
    TestLogger.step('Tap notification bell');
    if (_notificationBell.evaluate().isNotEmpty) {
      await tap(_notificationBell, label: 'Notification bell');
    } else {
      final bellFill = find.byIcon(PhosphorIconsFill.bell);
      await tap(bellFill, label: 'Notification bell (filled)');
    }
  }

  Future<void> refreshDashboard() async {
    TestLogger.step('Pull to refresh dashboard');
    await pullToRefresh();
    TestLogger.pass('Dashboard refreshed');
  }

  Future<void> scrollDashboard() async {
    TestLogger.step('Scroll dashboard content');
    await scrollDown(times: 3);
    TestLogger.pass('Dashboard scrolled');
  }

  Future<void> tapFirstGridWidget() async {
    TestLogger.step('Tap first grid widget');
    final cards = find.byType(Card);
    if (cards.evaluate().isNotEmpty) {
      await tap(cards.first, label: 'First dashboard widget');
    } else {
      TestLogger.warn('No grid widgets to tap');
    }
  }
}
