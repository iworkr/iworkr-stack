import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'tests/auth_test.dart';
import 'tests/navigation_test.dart';
import 'tests/critical_ops_test.dart';
import 'tests/day_in_life_test.dart';
import 'tests/panopticon_test.dart';
import 'utils/qase_reporter.dart';
import 'utils/test_logger.dart';
import 'utils/screenshot_helper.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  TestLogger.start('iWorkr Full QA Suite');

  ensureScreenshotDir();

  group('iWorkr QA', () {
    setUpAll(() async {
      await QaseReporter.instance.createRun();
    });
    tearDownAll(() async {
      await QaseReporter.instance.completeRun();
    });

    authTests(binding);
    navigationTests(binding);
    criticalOpsTests(binding);
    dayInLifeTests(binding);
    panopticonTests(binding);
  });

  tearDownAll(() {
    TestLogger.finish();
  });
}
