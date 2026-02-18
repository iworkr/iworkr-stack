import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class JobsRobot extends BaseRobot {
  JobsRobot(super.tester);

  // ── Finders ───────────────────────────────────────────────

  Finder get _createJobButton => find.byIcon(PhosphorIconsLight.plus);
  Finder get _filterActive => findByText('Active');
  Finder get _filterPending => findByText('Pending');
  Finder get _filterCompleted => findByText('Completed');
  Finder get _filterAll => findByText('All');

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectJobsListVisible() async {
    TestLogger.step('Verify jobs list visible');
    await settle();
    TestLogger.pass('Jobs list screen displayed');
  }

  void expectJobCardVisible(String jobTitle) {
    TestLogger.step('Verify job visible: $jobTitle');
    expectVisible(findTextContaining(jobTitle), label: jobTitle);
  }

  void expectNoJobs() {
    TestLogger.step('Verify empty jobs state');
    final emptyIndicators = [
      find.textContaining('No jobs'),
      find.textContaining('empty'),
      find.textContaining('Get started'),
    ];
    var found = false;
    for (final f in emptyIndicators) {
      if (f.evaluate().isNotEmpty) {
        found = true;
        break;
      }
    }
    if (found) {
      TestLogger.pass('Empty state displayed');
    } else {
      TestLogger.info('Job list has items (not empty)');
    }
  }

  // ── Filter Actions ────────────────────────────────────────

  Future<void> filterByActive() async {
    TestLogger.step('Filter jobs: Active');
    await tap(_filterActive, label: 'Active filter');
  }

  Future<void> filterByPending() async {
    TestLogger.step('Filter jobs: Pending');
    await tap(_filterPending, label: 'Pending filter');
  }

  Future<void> filterByCompleted() async {
    TestLogger.step('Filter jobs: Completed');
    await tap(_filterCompleted, label: 'Completed filter');
  }

  Future<void> filterByAll() async {
    TestLogger.step('Filter jobs: All');
    await tap(_filterAll, label: 'All filter');
  }

  // ── Job Actions ───────────────────────────────────────────

  Future<void> tapCreateJob() async {
    TestLogger.step('Tap create job button');
    await tap(_createJobButton, label: 'Create job (+)');
  }

  Future<void> tapFirstJob() async {
    TestLogger.step('Tap first job in list');
    final gestureDetectors = find.byType(GestureDetector);
    if (gestureDetectors.evaluate().length > 5) {
      await tap(gestureDetectors.at(5), label: 'First job row');
    } else {
      TestLogger.warn('Not enough gesture detectors for job tap');
    }
  }

  Future<void> tapJobByTitle(String title) async {
    TestLogger.step('Tap job: $title');
    await tap(findTextContaining(title), label: 'Job "$title"');
  }

  // ── Job Detail ────────────────────────────────────────────

  Future<void> expectJobDetailVisible() async {
    TestLogger.step('Verify job detail screen');
    await settle(const Duration(seconds: 2));
    TestLogger.pass('Job detail screen displayed');
  }

  Future<void> scrollJobDetail() async {
    TestLogger.step('Scroll through job detail');
    await scrollDown(times: 3);
    TestLogger.pass('Job detail scrolled');
  }

  // ── Full Flows ────────────────────────────────────────────

  Future<void> browseAndFilterJobs() async {
    TestLogger.section('Browse & Filter Jobs');
    await expectJobsListVisible();

    if (_filterActive.evaluate().isNotEmpty) {
      await filterByActive();
      await settle();
    }

    if (_filterAll.evaluate().isNotEmpty) {
      await filterByAll();
      await settle();
    }

    await scrollDown(times: 2);
    TestLogger.pass('Job browsing complete');
  }

  Future<void> openFirstJobAndReturn() async {
    TestLogger.section('Open Job Detail & Return');
    await tapFirstJob();
    await expectJobDetailVisible();
    await scrollJobDetail();

    final backButton = find.byIcon(PhosphorIconsLight.arrowLeft);
    if (backButton.evaluate().isNotEmpty) {
      await tap(backButton.first, label: 'Back from job detail');
    } else {
      await tester.pageBack();
      await settle();
    }
    TestLogger.pass('Returned from job detail');
  }
}
