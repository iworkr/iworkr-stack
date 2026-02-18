import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class DashboardRobot extends BaseRobot {
  DashboardRobot(super.tester);

  // ── Finders ───────────────────────────────────────────────

  Finder get _greeting {
    final hour = DateTime.now().hour;
    final prefix =
        hour < 12 ? 'Good Morning' : (hour < 17 ? 'Good Afternoon' : 'Good Evening');
    return findTextContaining(prefix);
  }

  Finder get _notificationBell =>
      find.byIcon(PhosphorIconsLight.bell);

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectDashboardLoaded() async {
    TestLogger.step('Verify dashboard loaded');
    await waitFor(_greeting, timeout: const Duration(seconds: 15));
    expectVisible(_greeting, label: 'Greeting text');
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
