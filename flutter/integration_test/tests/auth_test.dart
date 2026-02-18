import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../robots/login_robot.dart';
import '../robots/dashboard_robot.dart';
import '../robots/navigation_robot.dart';
import '../robots/profile_robot.dart';
import '../utils/test_logger.dart';
import '../utils/screenshot_helper.dart';
import '../config/test_config.dart';
import '../app_bootstrap.dart';

void authTests(IntegrationTestWidgetsFlutterBinding binding) {
  group('Authentication Suite', () {
    late ScreenshotHelper screenshots;

    setUp(() {
      screenshots = ScreenshotHelper(binding);
    });

    testWidgets('AUTH-001: Login screen displays correctly', (tester) async {
      TestLogger.section('AUTH-001: Login Screen Display');
      try {
        await bootstrapApp(tester);
        final login = LoginRobot(tester);

        await login.expectLoginScreenVisible();
        await screenshots.capture('login_screen_loaded');

        TestLogger.pass('AUTH-001 passed');
      } catch (e) {
        await screenshots.captureOnFailure('AUTH-001', e);
        rethrow;
      }
    });

    testWidgets('AUTH-002: Email method selection', (tester) async {
      TestLogger.section('AUTH-002: Email Method Selection');
      try {
        await bootstrapApp(tester);
        final login = LoginRobot(tester);

        await login.expectLoginScreenVisible();
        await login.selectEmailMethod();
        login.expectEmailFormVisible();
        await screenshots.capture('email_form_visible');

        TestLogger.pass('AUTH-002 passed');
      } catch (e) {
        await screenshots.captureOnFailure('AUTH-002', e);
        rethrow;
      }
    });

    testWidgets('AUTH-003: Email login — invalid credentials', (tester) async {
      TestLogger.section('AUTH-003: Invalid Credentials');
      try {
        await bootstrapApp(tester);
        final login = LoginRobot(tester);

        await login.expectLoginScreenVisible();
        await login.loginWithEmail('bad@invalid.com', 'wrongpassword');
        await login.expectLoginError();
        await screenshots.capture('login_error_state');

        TestLogger.pass('AUTH-003 passed');
      } catch (e) {
        await screenshots.captureOnFailure('AUTH-003', e);
        rethrow;
      }
    });

    testWidgets('AUTH-004: Email login — valid credentials', (tester) async {
      TestLogger.section('AUTH-004: Valid Login');
      try {
        await bootstrapApp(tester);
        final login = LoginRobot(tester);
        final dashboard = DashboardRobot(tester);

        await login.expectLoginScreenVisible();
        await login.loginWithEmail(
          TestConfig.testEmail,
          TestConfig.testPassword,
        );
        await login.expectLoginSuccess();

        await dashboard.expectDashboardLoaded();
        await screenshots.capture('dashboard_after_login');

        TestLogger.pass('AUTH-004 passed');
      } catch (e) {
        await screenshots.captureOnFailure('AUTH-004', e);
        rethrow;
      }
    });

    testWidgets('AUTH-005: Back navigation on login', (tester) async {
      TestLogger.section('AUTH-005: Login Back Navigation');
      try {
        await bootstrapApp(tester);
        final login = LoginRobot(tester);

        await login.expectLoginScreenVisible();
        await login.selectEmailMethod();
        login.expectEmailFormVisible();

        await login.tapBack();
        await login.expectLoginScreenVisible();
        await screenshots.capture('back_to_choice');

        TestLogger.pass('AUTH-005 passed');
      } catch (e) {
        await screenshots.captureOnFailure('AUTH-005', e);
        rethrow;
      }
    });

    testWidgets('AUTH-006: Logout flow', (tester) async {
      TestLogger.section('AUTH-006: Logout Flow');
      try {
        await bootstrapApp(tester);
        final login = LoginRobot(tester);
        final dashboard = DashboardRobot(tester);
        final nav = NavigationRobot(tester);
        final profile = ProfileRobot(tester);

        await login.expectLoginScreenVisible();
        await login.loginWithEmail(
          TestConfig.testEmail,
          TestConfig.testPassword,
        );
        await dashboard.expectDashboardLoaded();

        await nav.goToProfile();
        await profile.expectProfileVisible();
        await profile.tapSignOut();

        await login.expectLoginScreenVisible();
        await screenshots.capture('logged_out');

        TestLogger.pass('AUTH-006 passed');
      } catch (e) {
        await screenshots.captureOnFailure('AUTH-006', e);
        rethrow;
      }
    });
  });
}
