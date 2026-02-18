import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'test_logger.dart';

extension WidgetTesterX on WidgetTester {
  Future<void> waitForWidget(
    Finder finder, {
    Duration timeout = const Duration(seconds: 10),
    Duration interval = const Duration(milliseconds: 500),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await pumpAndSettle(const Duration(milliseconds: 100));
      if (finder.evaluate().isNotEmpty) return;
      await Future<void>.delayed(interval);
      await pump();
    }
    throw TestFailure(
      'Timed out waiting for widget: $finder',
    );
  }

  Future<void> waitForNoWidget(
    Finder finder, {
    Duration timeout = const Duration(seconds: 10),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await pumpAndSettle(const Duration(milliseconds: 100));
      if (finder.evaluate().isEmpty) return;
      await Future<void>.delayed(const Duration(milliseconds: 500));
      await pump();
    }
    throw TestFailure(
      'Timed out waiting for widget to disappear: $finder',
    );
  }

  Future<void> safeTap(
    Finder finder, {
    String? description,
    bool settle = true,
  }) async {
    if (description != null) TestLogger.step('Tap: $description');
    expect(finder, findsWidgets);
    await ensureVisible(finder.first);
    await tap(finder.first);
    if (settle) {
      await pumpAndSettle();
    } else {
      await pump(const Duration(milliseconds: 300));
    }
  }

  Future<void> safeEnterText(
    Finder finder,
    String text, {
    String? description,
  }) async {
    if (description != null) TestLogger.step('Enter text: $description');
    await ensureVisible(finder.first);
    await tap(finder.first);
    await pumpAndSettle();
    await enterText(finder.first, text);
    await pumpAndSettle();
  }

  Future<void> scrollUntilVisible(
    Finder finder, {
    Finder? scrollable,
    double delta = -200,
    int maxScrolls = 30,
  }) async {
    final scroll = scrollable ?? find.byType(Scrollable).first;
    for (var i = 0; i < maxScrolls; i++) {
      if (finder.evaluate().isNotEmpty) {
        final element = finder.evaluate().first;
        final box = element.renderObject as RenderBox?;
        if (box != null && box.hasSize) {
          return;
        }
      }
      await drag(scroll, Offset(0, delta));
      await pumpAndSettle();
    }
    throw TestFailure(
      'Could not scroll to find: $finder',
    );
  }
}
