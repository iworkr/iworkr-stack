import 'dart:io';
import 'package:integration_test/integration_test.dart';
import 'test_logger.dart';

class ScreenshotHelper {
  final IntegrationTestWidgetsFlutterBinding binding;
  int _counter = 0;

  ScreenshotHelper(this.binding);

  Future<void> capture(String name) async {
    _counter++;
    final sanitized = name.replaceAll(RegExp(r'[^\w\-]'), '_').toLowerCase();
    final filename = '${_counter.toString().padLeft(3, '0')}_$sanitized';
    TestLogger.info('Capturing screenshot: $filename');
    try {
      await binding.takeScreenshot(filename);
    } catch (e) {
      TestLogger.warn(
        'Screenshot capture failed (plugin not available on this platform): $e',
      );
    }
  }

  Future<void> captureOnFailure(String testName, Object error) async {
    TestLogger.error('Test failed: $testName — $error');
    try {
      await capture('FAILURE_$testName');
    } catch (e) {
      TestLogger.warn('Screenshot capture failed: $e');
    }
  }
}

Future<void> ensureScreenshotDir() async {
  final dir = Directory('screenshots');
  if (!dir.existsSync()) {
    dir.createSync(recursive: true);
  }
}
