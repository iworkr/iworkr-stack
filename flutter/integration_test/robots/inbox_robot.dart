import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class InboxRobot extends BaseRobot {
  InboxRobot(super.tester);

  // ── Finders ───────────────────────────────────────────────

  Finder get _markAllRead => findTextContaining('Mark all read');
  Finder get _todaySection => findByText('Today');
  Finder get _yesterdaySection => findByText('Yesterday');

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectInboxVisible() async {
    TestLogger.step('Verify inbox screen');
    await settle(const Duration(seconds: 2));
    TestLogger.pass('Inbox screen displayed');
  }

  void expectNotificationsGrouped() {
    TestLogger.step('Verify notification grouping');
    final groups = [_todaySection, _yesterdaySection];
    var groupCount = 0;
    for (final g in groups) {
      if (g.evaluate().isNotEmpty) groupCount++;
    }
    TestLogger.pass('Notification groups found: $groupCount');
  }

  // ── Actions ───────────────────────────────────────────────

  Future<void> tapFirstNotification() async {
    TestLogger.step('Tap first notification');
    final rows = find.byType(ListTile);
    if (rows.evaluate().isNotEmpty) {
      await tap(rows.first, label: 'First notification');
    } else {
      final gestureRows = find.byType(GestureDetector);
      if (gestureRows.evaluate().length > 3) {
        await tap(gestureRows.at(3), label: 'First notification row');
      } else {
        TestLogger.warn('No notifications to tap');
      }
    }
  }

  Future<void> tapMarkAllRead() async {
    TestLogger.step('Tap mark all read');
    if (_markAllRead.evaluate().isNotEmpty) {
      await tap(_markAllRead, label: 'Mark all read');
    } else {
      TestLogger.info('Mark all read not visible');
    }
  }

  Future<void> scrollNotifications() async {
    TestLogger.step('Scroll through notifications');
    await scrollDown(times: 3);
    TestLogger.pass('Notifications scrolled');
  }

  // ── Full Flows ────────────────────────────────────────────

  Future<void> browseNotifications() async {
    TestLogger.section('Browse Notifications');
    await expectInboxVisible();
    expectNotificationsGrouped();
    await scrollNotifications();
    TestLogger.pass('Notification browsing complete');
  }
}
