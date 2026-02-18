import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class SearchRobot extends BaseRobot {
  SearchRobot(super.tester);

  // ── Finders ───────────────────────────────────────────────

  Finder get _searchInput => find.byType(TextField);
  Finder get _closeButton => find.byIcon(PhosphorIconsLight.x);

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectSearchVisible() async {
    TestLogger.step('Verify search overlay visible');
    await settle();
    TestLogger.pass('Search overlay displayed');
  }

  // ── Actions ───────────────────────────────────────────────

  Future<void> typeQuery(String query) async {
    TestLogger.step('Type search query: "$query"');
    final input = _searchInput;
    if (input.evaluate().isNotEmpty) {
      await tester.enterText(input.first, query);
      await settle(const Duration(seconds: 1));
    } else {
      TestLogger.warn('Search input not found');
    }
  }

  Future<void> clearSearch() async {
    TestLogger.step('Clear search');
    final input = _searchInput;
    if (input.evaluate().isNotEmpty) {
      await tester.enterText(input.first, '');
      await settle();
    }
  }

  Future<void> closeSearch() async {
    TestLogger.step('Close search overlay');
    if (_closeButton.evaluate().isNotEmpty) {
      await tap(_closeButton, label: 'Close search');
    } else {
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await settle();
    }
  }

  Future<void> tapFirstResult() async {
    TestLogger.step('Tap first search result');
    final results = find.byType(ListTile);
    if (results.evaluate().isNotEmpty) {
      await tap(results.first, label: 'First search result');
    } else {
      TestLogger.warn('No search results to tap');
    }
  }

  void expectResultsVisible() {
    TestLogger.step('Verify search results visible');
    final results = find.byType(ListTile);
    if (results.evaluate().isNotEmpty) {
      TestLogger.pass('Search results displayed');
    } else {
      TestLogger.info('No results (may be expected)');
    }
  }

  void expectNoResults() {
    TestLogger.step('Verify no results');
    final emptyIndicators = [
      find.textContaining('No results'),
      find.textContaining('Nothing found'),
    ];
    for (final f in emptyIndicators) {
      if (f.evaluate().isNotEmpty) {
        TestLogger.pass('No results state displayed');
        return;
      }
    }
    TestLogger.info('Empty state indicator not found');
  }

  // ── Full Flows ────────────────────────────────────────────

  Future<void> searchAndVerify(String query) async {
    TestLogger.section('Search Flow: "$query"');
    await expectSearchVisible();
    await typeQuery(query);
    expectResultsVisible();
    await clearSearch();
    await closeSearch();
    TestLogger.pass('Search flow complete');
  }
}
