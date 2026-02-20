import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../robots/dashboard_robot.dart';
import '../robots/navigation_robot.dart';
import '../robots/jobs_robot.dart';
import '../robots/profile_robot.dart';
import '../robots/schedule_robot.dart';
import '../robots/inbox_robot.dart';
import '../robots/search_robot.dart';
import '../utils/qase_reporter.dart';
import '../utils/test_logger.dart';
import '../utils/screenshot_helper.dart';
import '../app_bootstrap.dart';

void navigationTests(IntegrationTestWidgetsFlutterBinding binding) {
  group('Navigation Suite', () {
    late ScreenshotHelper screenshots;

    setUp(() {
      screenshots = ScreenshotHelper(binding);
    });

    qaseTestWidgets('NAV-001: Full dock tab cycle', (tester) async {
      TestLogger.section('NAV-001: Dock Tab Cycle');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);

        nav.expectDockVisible();
        await nav.cycleAllTabs();
        await screenshots.capture('all_tabs_cycled');

        TestLogger.pass('NAV-001 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-001', e);
        rethrow;
      }
    });

    qaseTestWidgets('NAV-002: Dashboard -> Jobs -> Job Detail -> Back', (
      tester,
    ) async {
      TestLogger.section('NAV-002: Job Detail Navigation');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final jobs = JobsRobot(tester);

        await nav.goToJobs();
        await jobs.expectJobsListVisible();
        await screenshots.capture('jobs_list');

        await jobs.openFirstJobAndReturn();
        await jobs.expectJobsListVisible();
        await screenshots.capture('back_to_jobs');

        await nav.goToHome();
        await nav.expectOnHome();

        TestLogger.pass('NAV-002 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-002', e);
        rethrow;
      }
    });

    qaseTestWidgets('NAV-003: Profile -> Settings -> Back', (tester) async {
      TestLogger.section('NAV-003: Profile Settings Nav');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final profile = ProfileRobot(tester);

        await nav.goToProfile();
        await profile.settingsRoundTrip();
        await screenshots.capture('profile_settings_roundtrip');

        TestLogger.pass('NAV-003 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-003', e);
        rethrow;
      }
    });

    qaseTestWidgets('NAV-004: Profile -> Time Clock -> Back', (tester) async {
      TestLogger.section('NAV-004: Time Clock Nav');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final profile = ProfileRobot(tester);

        await nav.goToProfile();
        await profile.timeClockRoundTrip();
        await screenshots.capture('timeclock_roundtrip');

        TestLogger.pass('NAV-004 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-004', e);
        rethrow;
      }
    });

    qaseTestWidgets('NAV-005: Search overlay open/close', (tester) async {
      TestLogger.section('NAV-005: Search Overlay');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final search = SearchRobot(tester);

        await nav.openSearch();
        await search.expectSearchVisible();
        await screenshots.capture('search_overlay_open');

        await search.closeSearch();
        await nav.expectOnHome();

        TestLogger.pass('NAV-005 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-005', e);
        rethrow;
      }
    });

    qaseTestWidgets('NAV-006: Schedule timeline exploration', (tester) async {
      TestLogger.section('NAV-006: Schedule Exploration');
      try {
        await bootstrapAndLogin(tester);
        final nav = NavigationRobot(tester);
        final schedule = ScheduleRobot(tester);

        await nav.goToTimeline();
        await schedule.exploreSchedule();
        await screenshots.capture('schedule_explored');

        TestLogger.pass('NAV-006 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-006', e);
        rethrow;
      }
    });

    qaseTestWidgets('NAV-007: Inbox notification browsing', (tester) async {
      TestLogger.section('NAV-007: Inbox Browsing');
      try {
        await bootstrapAndLogin(tester);
        final dashboard = DashboardRobot(tester);
        final inbox = InboxRobot(tester);

        await dashboard.tapNotificationBell();
        await inbox.browseNotifications();
        await screenshots.capture('inbox_browsed');

        TestLogger.pass('NAV-007 passed');
      } catch (e) {
        await screenshots.captureOnFailure('NAV-007', e);
        rethrow;
      }
    });
  });
}
