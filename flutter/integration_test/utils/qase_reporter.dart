import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

/// Qase API client for reporting Flutter integration test results.
/// Reads QASE_API_TOKEN from environment. Set QASE_MODE=testops to enable.
class QaseReporter {
  QaseReporter._();
  static final QaseReporter instance = QaseReporter._();

  static const _baseUrl = 'https://api.qase.io/v1';
  static const _projectCode = 'IWORKR';
  static const _suiteTitle = 'Mobile / Integration';

  String? _token;
  int? _runId;

  bool get isEnabled {
    _token ??=
        Platform.environment['QASE_API_TOKEN'] ??
        Platform.environment['qase_api_token'];
    return _token != null && _token!.isNotEmpty;
  }

  /// Create a new test run. Call in setUpAll.
  Future<void> createRun() async {
    if (!isEnabled) return;
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/run/$_projectCode'),
        headers: {'Token': _token!, 'Content-Type': 'application/json'},
        body: jsonEncode({
          'title':
              Platform.environment['QASE_RUN_TITLE'] ??
              'iWorkr Mobile Integration',
          'is_autotest': true,
        }),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final result = data['result'] as Map<String, dynamic>?;
        _runId = result?['id'] as int?;
      }
    } catch (_) {}
  }

  /// Add a test result. Call after each test (pass or fail).
  Future<void> addResult(
    String title,
    bool passed, {
    int? timeMs,
    String? stackTrace,
  }) async {
    if (!isEnabled || _runId == null) return;
    try {
      await http.post(
        Uri.parse('$_baseUrl/result/$_projectCode/$_runId'),
        headers: {'Token': _token!, 'Content-Type': 'application/json'},
        body: jsonEncode({
          'case': {'title': title, 'suite_title': _suiteTitle},
          'status': passed ? 'passed' : 'failed',
          if (timeMs != null) 'time_ms': timeMs,
          if (stackTrace != null && !passed) 'stacktrace': stackTrace,
        }),
      );
    } catch (_) {}
  }

  /// Complete the run. Call in tearDownAll.
  Future<void> completeRun() async {
    if (!isEnabled || _runId == null) return;
    try {
      await http.post(
        Uri.parse('$_baseUrl/run/$_projectCode/$_runId/complete'),
        headers: {'Token': _token!},
      );
    } catch (_) {}
  }
}

/// Wraps testWidgets to report results to Qase.
void qaseTestWidgets(
  String description,
  Future<void> Function(WidgetTester) fn,
) {
  testWidgets(description, (tester) async {
    final stopwatch = Stopwatch()..start();
    try {
      await fn(tester);
      await QaseReporter.instance.addResult(
        description,
        true,
        timeMs: stopwatch.elapsedMilliseconds,
      );
    } catch (e, st) {
      await QaseReporter.instance.addResult(
        description,
        false,
        timeMs: stopwatch.elapsedMilliseconds,
        stackTrace: st.toString(),
      );
      rethrow;
    }
  });
}
