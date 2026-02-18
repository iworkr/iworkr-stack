import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'tests/auth_test.dart';
import 'tests/navigation_test.dart';
import 'tests/critical_ops_test.dart';
import 'utils/test_logger.dart';
import 'utils/screenshot_helper.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  TestLogger.start('iWorkr Full QA Suite');

  ensureScreenshotDir();

  authTests(binding);
  navigationTests(binding);
  criticalOpsTests(binding);

  tearDownAll(() {
    TestLogger.finish();
  });
}
