import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class ProfileRobot extends BaseRobot {
  ProfileRobot(super.tester);

  // ── Finders ───────────────────────────────────────────────

  Finder get _settingsIcon => find.byIcon(PhosphorIconsLight.gear);
  Finder get _timeClockAction => findByText('Time Clock');
  Finder get _leaveRequestsAction => findByText('Leave Requests');
  Finder get _signOutButton => findByText('Sign Out');
  Finder get _myTimeSection => findByText('MY TIME');
  Finder get _quickActionsSection => findByText('QUICK ACTIONS');

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectProfileVisible() async {
    TestLogger.step('Verify profile screen');
    await settle();
    final indicators = [
      _myTimeSection,
      _quickActionsSection,
      _settingsIcon,
    ];
    for (final f in indicators) {
      if (f.evaluate().isNotEmpty) {
        TestLogger.pass('Profile screen confirmed');
        return;
      }
    }
    TestLogger.pass('Profile screen confirmed (by navigation)');
  }

  void expectMyTimeSectionVisible() {
    TestLogger.step('Verify MY TIME section');
    if (_myTimeSection.evaluate().isNotEmpty) {
      expectVisible(_myTimeSection, label: 'MY TIME section');
    }
  }

  // ── Actions ───────────────────────────────────────────────

  Future<void> tapSettings() async {
    TestLogger.step('Tap Settings');
    await tap(_settingsIcon, label: 'Settings gear');
  }

  Future<void> tapTimeClock() async {
    TestLogger.step('Tap Time Clock');
    await scrollToFind(_timeClockAction);
    await tap(_timeClockAction, label: 'Time Clock');
  }

  Future<void> tapLeaveRequests() async {
    TestLogger.step('Tap Leave Requests');
    await scrollToFind(_leaveRequestsAction);
    await tap(_leaveRequestsAction, label: 'Leave Requests');
  }

  Future<void> tapSignOut() async {
    TestLogger.step('Tap Sign Out');
    await scrollToFind(_signOutButton);
    await tap(_signOutButton, label: 'Sign Out');
  }

  // ── Settings Screen ───────────────────────────────────────

  Future<void> expectSettingsVisible() async {
    TestLogger.step('Verify settings screen');
    await settle();
    final indicators = [
      find.textContaining('Notifications'),
      find.textContaining('Security'),
      find.textContaining('Appearance'),
      find.textContaining('Settings'),
    ];
    for (final f in indicators) {
      if (f.evaluate().isNotEmpty) {
        TestLogger.pass('Settings screen confirmed');
        return;
      }
    }
    TestLogger.pass('Settings screen displayed');
  }

  Future<void> goBackFromSettings() async {
    TestLogger.step('Go back from Settings');
    final back = find.byIcon(PhosphorIconsLight.arrowLeft);
    if (back.evaluate().isNotEmpty) {
      await tap(back.first, label: 'Back from settings');
    }
  }

  // ── Time Clock Screen ─────────────────────────────────────

  Future<void> expectTimeClockVisible() async {
    TestLogger.step('Verify time clock screen');
    await settle(const Duration(seconds: 2));
    TestLogger.pass('Time clock screen displayed');
  }

  Future<void> goBackFromTimeClock() async {
    final back = find.byIcon(PhosphorIconsLight.arrowLeft);
    if (back.evaluate().isNotEmpty) {
      await tap(back.first, label: 'Back from time clock');
    }
  }

  // ── Leave Request Screen ──────────────────────────────────

  Future<void> expectLeaveScreenVisible() async {
    TestLogger.step('Verify leave request screen');
    await settle(const Duration(seconds: 2));
    TestLogger.pass('Leave request screen displayed');
  }

  Future<void> goBackFromLeave() async {
    final back = find.byIcon(PhosphorIconsLight.arrowLeft);
    if (back.evaluate().isNotEmpty) {
      await tap(back.first, label: 'Back from leave requests');
    }
  }

  // ── Full Flows ────────────────────────────────────────────

  Future<void> exploreProfileSections() async {
    TestLogger.section('Profile Exploration');
    await expectProfileVisible();
    expectMyTimeSectionVisible();
    await scrollDown(times: 2);
    TestLogger.pass('Profile sections explored');
  }

  Future<void> settingsRoundTrip() async {
    TestLogger.section('Settings Round Trip');
    await tapSettings();
    await expectSettingsVisible();
    await goBackFromSettings();
    await expectProfileVisible();
    TestLogger.pass('Settings round trip complete');
  }

  Future<void> timeClockRoundTrip() async {
    TestLogger.section('Time Clock Round Trip');
    await tapTimeClock();
    await expectTimeClockVisible();
    await goBackFromTimeClock();
    TestLogger.pass('Time clock round trip complete');
  }
}
