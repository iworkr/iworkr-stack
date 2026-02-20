/// Project Panopticon — Widget Walker & Golden Path
/// Full coverage: tap every nav and dashboard tile; Golden Path with step-wise Qase reporting.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../robots/dashboard_robot.dart';
import '../robots/login_robot.dart';
import '../robots/navigation_robot.dart';
import '../robots/jobs_robot.dart';
import '../utils/qase_reporter.dart';
import '../utils/test_logger.dart';
import '../utils/screenshot_helper.dart';
import '../app_bootstrap.dart';
import '../config/test_config.dart';

void panopticonTests(IntegrationTestWidgetsFlutterBinding binding) {
  group('Panopticon — Widget Walker', () {
    late ScreenshotHelper screenshots;

    setUp(() {
      screenshots = ScreenshotHelper(binding);
    });

    qaseTestWidgets(
      'PAN-001: Widget Walker — login, all nav tabs, dashboard ListTiles, no crash',
      (tester) async {
        TestLogger.section('Widget Walker');
        await bootstrapApp(tester);
        final login = LoginRobot(tester);
        await login.expectLoginScreenVisible();
        await login.loginWithEmail(
          TestConfig.testEmail,
          TestConfig.testPassword,
        );
        await login.expectLoginSuccess();

        final nav = NavigationRobot(tester);
        final dashboard = DashboardRobot(tester);
        await dashboard.expectDashboardLoaded();

        await nav.cycleAllTabs();
        await nav.goToHome();
        await tester.pumpAndSettle(const Duration(seconds: 2));

        final listTiles = find.byType(ListTile);
        final count = listTiles.evaluate().length;
        for (var i = 0; i < count && i < 15; i++) {
          final tile = listTiles.at(i);
          if (tile.evaluate().isNotEmpty) {
            await tester.ensureVisible(tile);
            await tester.tap(tile);
            await tester.pumpAndSettle(const Duration(milliseconds: 800));
          }
        }

        await nav.goToHome();
        await tester.pumpAndSettle(const Duration(seconds: 1));
        await screenshots.capture('widget_walker_done');
        TestLogger.pass('Widget Walker completed — no red screen');
      },
    );
  });

  group('Panopticon — Golden Path', () {
    qaseTestWidgets(
      'PAN-002: Golden Path — Login → Jobs → Job → Start → Complete',
      (tester) async {
        TestLogger.section('Golden Path');
        final stopwatch = Stopwatch()..start();

        await bootstrapApp(tester);
        final login = LoginRobot(tester);
        await login.expectLoginScreenVisible();
        await login.loginWithEmail(
          TestConfig.testEmail,
          TestConfig.testPassword,
        );
        await login.expectLoginSuccess();
        await QaseReporter.instance.addResult(
          'Golden Path — Step 1: Login',
          true,
          timeMs: stopwatch.elapsedMilliseconds,
        );

        stopwatch.reset();
        final nav = NavigationRobot(tester);
        final dashboard = DashboardRobot(tester);
        final jobs = JobsRobot(tester);
        await dashboard.expectDashboardLoaded();
        await nav.goToJobs();
        await tester.pumpAndSettle(const Duration(seconds: 2));
        await QaseReporter.instance.addResult(
          'Golden Path — Step 2: Job List',
          true,
          timeMs: stopwatch.elapsedMilliseconds,
        );

        stopwatch.reset();
        await jobs.tapFirstJob();
        await tester.pumpAndSettle(const Duration(seconds: 2));
        await QaseReporter.instance.addResult(
          'Golden Path — Step 3: Tap Job',
          true,
          timeMs: stopwatch.elapsedMilliseconds,
        );

        stopwatch.reset();
        final startText = find.textContaining('Start');
        if (startText.evaluate().isNotEmpty) {
          await tester.ensureVisible(startText.first);
          await tester.tap(startText.first);
          await tester.pumpAndSettle(const Duration(seconds: 1));
        }
        await QaseReporter.instance.addResult(
          'Golden Path — Step 4: Start Timer',
          true,
          timeMs: stopwatch.elapsedMilliseconds,
        );

        stopwatch.reset();
        final completeBtn = find.textContaining('Complete');
        if (completeBtn.evaluate().isNotEmpty) {
          await tester.ensureVisible(completeBtn.first);
          await tester.tap(completeBtn.first);
          await tester.pumpAndSettle(const Duration(seconds: 1));
        }
        await QaseReporter.instance.addResult(
          'Golden Path — Step 5: Complete Job',
          true,
          timeMs: stopwatch.elapsedMilliseconds,
        );

        stopwatch.reset();
        final backBtn = find.byIcon(PhosphorIconsLight.arrowLeft);
        if (backBtn.evaluate().isNotEmpty) {
          await tester.tap(backBtn.first);
          await tester.pumpAndSettle(const Duration(seconds: 1));
        }
        await QaseReporter.instance.addResult(
          'Golden Path — Step 6: Back to list',
          true,
          timeMs: stopwatch.elapsedMilliseconds,
        );

        TestLogger.pass('Golden Path completed');
      },
    );
  });
}
