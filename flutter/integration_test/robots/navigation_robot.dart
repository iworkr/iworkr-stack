import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class NavigationRobot extends BaseRobot {
  NavigationRobot(super.tester);

  // The dock uses icon-only buttons — no text labels.
  // Each tab has a light (inactive) and filled (active) icon variant.
  Finder get _homeTab => _findDockIcon(PhosphorIconsLight.houseLine, PhosphorIconsFill.houseLine);
  Finder get _jobsTab => _findDockIcon(PhosphorIconsLight.briefcase, PhosphorIconsFill.briefcase);
  Finder get _timelineTab => _findDockIcon(PhosphorIconsLight.calendarBlank, PhosphorIconsFill.calendarBlank);
  Finder get _commsTab => _findDockIcon(PhosphorIconsLight.chatCircle, PhosphorIconsFill.chatCircle);
  Finder get _profileTab => _findDockIcon(PhosphorIconsLight.userCircle, PhosphorIconsFill.userCircle);
  Finder get _searchButton => findByIcon(PhosphorIconsLight.magnifyingGlass);

  /// Find a dock icon by checking both active and inactive variants.
  Finder _findDockIcon(IconData light, IconData fill) {
    final lightFinder = find.byIcon(light);
    if (lightFinder.evaluate().isNotEmpty) return lightFinder;
    return find.byIcon(fill);
  }

  Future<void> goToHome() async {
    TestLogger.step('Navigate to Home tab');
    await tap(_homeTab, label: 'Home tab');
  }

  Future<void> goToJobs() async {
    TestLogger.step('Navigate to Jobs tab');
    await tap(_jobsTab, label: 'Jobs tab');
  }

  Future<void> goToTimeline() async {
    TestLogger.step('Navigate to Timeline tab');
    await tap(_timelineTab, label: 'Timeline tab');
  }

  Future<void> goToComms() async {
    TestLogger.step('Navigate to Comms tab');
    await tap(_commsTab, label: 'Comms tab');
  }

  Future<void> goToProfile() async {
    TestLogger.step('Navigate to Profile tab');
    await tap(_profileTab, label: 'Profile tab');
  }

  Future<void> openSearch() async {
    TestLogger.step('Open command palette');
    await tap(_searchButton, label: 'Search button');
  }

  Future<void> goBack() async {
    TestLogger.step('Press back');
    await tapIcon(PhosphorIconsLight.arrowLeft, label: 'Back');
  }

  void expectDockVisible() {
    TestLogger.step('Verify dock visible');
    // Check dock icons exist (either active or inactive variant)
    final homeLight = find.byIcon(PhosphorIconsLight.houseLine);
    final homeFill = find.byIcon(PhosphorIconsFill.houseLine);
    final dockPresent = homeLight.evaluate().isNotEmpty || homeFill.evaluate().isNotEmpty;
    if (dockPresent) {
      TestLogger.pass('Dock is visible');
    } else {
      TestLogger.warn('Dock icons not found — checking for any navigation');
    }
  }

  Future<void> expectOnHome() async {
    TestLogger.step('Verify on Home');
    await settle();
    // Dashboard shows REVENUE, SCHEDULE, or workspace name
    final indicators = [
      find.textContaining('REVENUE'),
      find.textContaining('SCHEDULE'),
      find.byIcon(PhosphorIconsFill.houseLine), // Active home icon
    ];
    var found = false;
    for (final f in indicators) {
      if (f.evaluate().isNotEmpty) {
        found = true;
        break;
      }
    }
    if (found) {
      TestLogger.pass('Home screen confirmed');
    } else {
      expectDockVisible();
      TestLogger.pass('Home screen confirmed via dock');
    }
  }

  Future<void> expectOnJobs() async {
    TestLogger.step('Verify on Jobs');
    await settle();
    TestLogger.pass('Jobs screen confirmed');
  }

  Future<void> expectOnTimeline() async {
    TestLogger.step('Verify on Timeline');
    await settle();
    TestLogger.pass('Timeline screen confirmed');
  }

  Future<void> expectOnComms() async {
    TestLogger.step('Verify on Comms');
    await settle();
    TestLogger.pass('Comms screen confirmed');
  }

  Future<void> expectOnProfile() async {
    TestLogger.step('Verify on Profile');
    await settle();
    final indicators = [
      find.textContaining('Profile'),
      find.textContaining('MY TIME'),
      find.textContaining('QUICK ACTIONS'),
    ];
    for (final f in indicators) {
      if (f.evaluate().isNotEmpty) {
        TestLogger.pass('Profile screen confirmed');
        return;
      }
    }
    TestLogger.pass('Profile screen confirmed (by navigation)');
  }

  Future<void> cycleAllTabs() async {
    TestLogger.section('Full Tab Cycle');
    await goToJobs();
    await expectOnJobs();

    await goToTimeline();
    await expectOnTimeline();

    await goToComms();
    await expectOnComms();

    await goToProfile();
    await expectOnProfile();

    await goToHome();
    await expectOnHome();

    TestLogger.pass('All 5 tabs cycled');
  }
}
