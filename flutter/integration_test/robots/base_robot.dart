import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../utils/test_logger.dart';
import '../utils/test_helpers.dart';

abstract class BaseRobot {
  final WidgetTester tester;

  BaseRobot(this.tester);

  // ── Finders ───────────────────────────────────────────────

  Finder findByText(String text) => find.text(text);
  Finder findByKey(String key) => find.byKey(ValueKey(key));
  Finder findByType(Type type) => find.byType(type);
  Finder findByIcon(IconData icon) => find.byIcon(icon);

  Finder findTextContaining(String pattern) => find.textContaining(pattern);

  // ── Core Actions ──────────────────────────────────────────

  Future<void> tap(Finder finder, {String? label}) async {
    await tester.safeTap(finder, description: label);
  }

  Future<void> tapText(String text, {String? label}) async {
    await tester.safeTap(
      findByText(text),
      description: label ?? 'Tap "$text"',
    );
  }

  Future<void> tapIcon(IconData icon, {String? label}) async {
    await tester.safeTap(
      findByIcon(icon),
      description: label ?? 'Tap icon',
    );
  }

  Future<void> enterText(Finder finder, String text, {String? label}) async {
    await tester.safeEnterText(
      finder,
      text,
      description: label ?? 'Enter "$text"',
    );
  }

  Future<void> longPress(Finder finder, {String? label}) async {
    if (label != null) TestLogger.step('Long press: $label');
    await tester.ensureVisible(finder.first);
    await tester.longPress(finder.first);
    await tester.pumpAndSettle();
  }

  Future<void> swipeLeft(Finder finder, {String? label}) async {
    if (label != null) TestLogger.step('Swipe left: $label');
    await tester.ensureVisible(finder.first);
    await tester.drag(finder.first, const Offset(-300, 0));
    await tester.pumpAndSettle();
  }

  Future<void> swipeDown(Finder finder, {String? label}) async {
    if (label != null) TestLogger.step('Swipe down: $label');
    await tester.drag(finder.first, const Offset(0, 300));
    await tester.pumpAndSettle();
  }

  // ── Waits ─────────────────────────────────────────────────

  Future<void> waitFor(Finder finder, {Duration? timeout}) async {
    await tester.waitForWidget(
      finder,
      timeout: timeout ?? const Duration(seconds: 10),
    );
  }

  Future<void> waitForText(String text, {Duration? timeout}) async {
    TestLogger.info('Waiting for: "$text"');
    await waitFor(findByText(text), timeout: timeout);
  }

  Future<void> waitForDisappear(Finder finder, {Duration? timeout}) async {
    await tester.waitForNoWidget(
      finder,
      timeout: timeout ?? const Duration(seconds: 10),
    );
  }

  Future<void> settle([Duration? duration]) async {
    if (duration != null) {
      await tester.pump(duration);
    }
    await tester.pumpAndSettle();
  }

  Future<void> pause([Duration duration = const Duration(seconds: 1)]) async {
    await tester.pump(duration);
  }

  // ── Verification ──────────────────────────────────────────

  void expectVisible(Finder finder, {String? label}) {
    if (label != null) TestLogger.pass('Visible: $label');
    expect(finder, findsWidgets);
  }

  void expectTextVisible(String text) {
    TestLogger.pass('Visible: "$text"');
    expect(findByText(text), findsWidgets);
  }

  void expectNotVisible(Finder finder, {String? label}) {
    if (label != null) TestLogger.pass('Not visible: $label');
    expect(finder, findsNothing);
  }

  void expectTextNotVisible(String text) {
    TestLogger.pass('Not visible: "$text"');
    expect(findByText(text), findsNothing);
  }

  void expectWidgetCount(Finder finder, int count, {String? label}) {
    if (label != null) TestLogger.pass('Count($count): $label');
    expect(finder, findsNWidgets(count));
  }

  // ── Scroll ────────────────────────────────────────────────

  Future<void> scrollDown({double delta = -300, int times = 1}) async {
    TestLogger.step('Scroll down ($times×)');
    for (var i = 0; i < times; i++) {
      await tester.drag(
        find.byType(Scrollable).first,
        Offset(0, delta),
      );
      await tester.pumpAndSettle();
    }
  }

  Future<void> scrollToFind(Finder target) async {
    TestLogger.step('Scrolling to find target widget');
    final scrollable = find.byType(Scrollable).first;
    for (var i = 0; i < 30; i++) {
      if (target.evaluate().isNotEmpty) return;
      await tester.drag(scrollable, const Offset(0, -200));
      await tester.pumpAndSettle();
    }
  }

  // ── Pull to Refresh ───────────────────────────────────────

  Future<void> pullToRefresh() async {
    TestLogger.step('Pull to refresh');
    final scrollable = find.byType(Scrollable).first;
    await tester.drag(scrollable, const Offset(0, 400));
    await tester.pumpAndSettle();
  }
}
