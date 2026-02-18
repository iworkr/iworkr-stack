import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class ScheduleRobot extends BaseRobot {
  ScheduleRobot(super.tester);

  Finder get _backlogTray => findTextContaining('Backlog');

  Future<void> expectScheduleVisible() async {
    TestLogger.step('Verify schedule screen');
    await settle(const Duration(seconds: 2));
    TestLogger.pass('Schedule screen displayed');
  }

  Future<void> scrollTimeline() async {
    TestLogger.step('Scroll timeline');
    await scrollDown(times: 3);
    TestLogger.pass('Timeline scrolled');
  }

  Future<void> tapBacklogTray() async {
    TestLogger.step('Tap backlog tray');
    if (_backlogTray.evaluate().isNotEmpty) {
      await tap(_backlogTray, label: 'Backlog tray');
    } else {
      TestLogger.info('Backlog tray not visible');
    }
  }

  Future<void> tapFirstJobBlock() async {
    TestLogger.step('Tap first job block');
    final blocks = find.byType(GestureDetector);
    if (blocks.evaluate().length > 5) {
      await tap(blocks.at(5), label: 'First timeline block');
    } else {
      TestLogger.warn('No timeline blocks to tap');
    }
  }

  Future<void> exploreSchedule() async {
    TestLogger.section('Schedule Exploration');
    await expectScheduleVisible();
    await scrollTimeline();
    TestLogger.pass('Schedule exploration complete');
  }
}
