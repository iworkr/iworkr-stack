import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../robots/dashboard_robot.dart';
import '../robots/navigation_robot.dart';
import '../robots/jobs_robot.dart';
import '../robots/profile_robot.dart';
import '../robots/search_robot.dart';
import '../utils/qase_reporter.dart';
import '../utils/test_logger.dart';
import '../utils/screenshot_helper.dart';
import '../app_bootstrap.dart';

void criticalOpsTests(IntegrationTestWidgetsFlutterBinding binding) {
  group('Critical Operations Suite', () {
    late ScreenshotHelper screenshots;

    setUp(() {
      screenshots = ScreenshotHelper(binding);
    });

    qaseTestWidgets('OPS-001: Dashboard pull-to-refresh', (tester) async {
      TestLogger.section('OPS-001: Dashboard Refresh');
      try {
        await bootstrapAndLogin(tester);
        final dashboard = DashboardRobot(tester);

        await dashboard.expectDashboardLoaded();
        await dashboard.refreshDashboard();
        await dashboard.expectDashboardLoaded();
        await screenshots.capture('dashboard_refreshed');

        TestLogger.pass('OPS-001 passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-001', e);
        rethrow;
      }
    });

    qaseTestWidgets('OPS-002: Dashboard scroll exploration', (tester) async {
      TestLogger.section('OPS-002: Dashboard Scroll');
      try {
        await bootstrapAndLogin(tester);
        final dashboard = DashboardRobot(tester);

        await dashboard.expectDashboardLoaded();
        await dashboard.scrollDashboard();
        await screenshots.capture('dashboard_scrolled');

        TestLogger.pass('OPS-002 passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-002', e);
        rethrow;
      }
    });

    qaseTestWidgets('OPS-003: Job list filtering', (tester) async {
      TestLogger.section('OPS-003: Job Filtering');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final jobs = JobsRobot(tester);

        await nav.goToJobs();
        await jobs.browseAndFilterJobs();
        await screenshots.capture('jobs_filtered');

        TestLogger.pass('OPS-003 passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-003', e);
        rethrow;
      }
    });

    qaseTestWidgets('OPS-004: Job list scroll + tap last', (tester) async {
      TestLogger.section('OPS-004: Job Scroll & Tap');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final jobs = JobsRobot(tester);

        await nav.goToJobs();
        await jobs.expectJobsListVisible();
        await jobs.scrollDown(times: 5);
        await screenshots.capture('jobs_scrolled_to_bottom');

        TestLogger.pass('OPS-004 passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-004', e);
        rethrow;
      }
    });

    qaseTestWidgets('OPS-005: Search and filter results', (tester) async {
      TestLogger.section('OPS-005: Global Search');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final search = SearchRobot(tester);

        await nav.openSearch();
        await search.searchAndVerify('plumbing');
        await screenshots.capture('search_completed');

        TestLogger.pass('OPS-005 passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-005', e);
        rethrow;
      }
    });

    qaseTestWidgets('OPS-006: Profile sections exploration', (tester) async {
      TestLogger.section('OPS-006: Profile Exploration');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final profile = ProfileRobot(tester);

        await nav.goToProfile();
        await profile.exploreProfileSections();
        await screenshots.capture('profile_explored');

        TestLogger.pass('OPS-006 passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-006', e);
        rethrow;
      }
    });

    qaseTestWidgets('OPS-007: Full critical path — Login to Logout', (
      tester,
    ) async {
      TestLogger.section('OPS-007: Full Critical Path');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final dashboard = DashboardRobot(tester);
        final jobs = JobsRobot(tester);
        final profile = ProfileRobot(tester);

        // Dashboard
        await dashboard.expectDashboardLoaded();
        await dashboard.scrollDashboard();

        // Jobs
        await nav.goToJobs();
        await jobs.expectJobsListVisible();
        await jobs.scrollDown(times: 2);

        // Timeline
        await nav.goToTimeline();
        await tester.pumpAndSettle(const Duration(seconds: 1));

        // Comms
        await nav.goToComms();
        await tester.pumpAndSettle(const Duration(seconds: 1));

        // Profile
        await nav.goToProfile();
        await profile.expectProfileVisible();

        // Settings round trip
        await profile.settingsRoundTrip();

        // Back to home
        await nav.goToHome();
        await dashboard.expectDashboardLoaded();

        await screenshots.capture('full_critical_path_complete');
        TestLogger.pass('OPS-007: Full critical path passed');
      } catch (e) {
        await screenshots.captureOnFailure('OPS-007', e);
        rethrow;
      }
    });
  });
}
