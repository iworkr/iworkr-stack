import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import '../robots/dashboard_robot.dart';
import '../robots/navigation_robot.dart';
import '../utils/qase_reporter.dart';
import '../utils/test_logger.dart';
import '../app_bootstrap.dart';

void dayInLifeTests(IntegrationTestWidgetsFlutterBinding binding) {
  group('Day in the Life Suite', () {
    qaseTestWidgets('DAY-001: Login → Refresh → Jobs → Job detail → Back', (tester) async {
      TestLogger.section('DAY-001: Full flow');
      await bootstrapAndLogin(tester);
      final dashboard = DashboardRobot(tester);
      final nav = NavigationRobot(tester);

      await dashboard.expectDashboardLoaded();
      await dashboard.refreshDashboard();
      await dashboard.expectDashboardLoaded();

      await nav.goToJobs();
      await tester.pumpAndSettle(const Duration(seconds: 2));

      final listView = find.byType(ListView);
      if (listView.evaluate().isNotEmpty) {
        final firstRow = find.descendant(of: listView.first, matching: find.byType(GestureDetector)).first;
        if (firstRow.evaluate().isNotEmpty) {
          await tester.ensureVisible(firstRow);
          await tester.tap(firstRow);
          await tester.pumpAndSettle(const Duration(seconds: 2));
          await nav.goBack();
          await tester.pumpAndSettle();
        }
      }

      TestLogger.pass('DAY-001 passed');
    });

    qaseTestWidgets('DAY-002: Background and resume preserves navigation', (tester) async {
      TestLogger.section('DAY-002: Lifecycle');
      await bootstrapAndLogin(tester);
      final nav = NavigationRobot(tester);

      await nav.goToJobs();
      await tester.pumpAndSettle(const Duration(seconds: 2));

      binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(milliseconds: 100));
      binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(find.text('Jobs'), findsWidgets);
      TestLogger.pass('DAY-002 passed');
    });
  });
}
