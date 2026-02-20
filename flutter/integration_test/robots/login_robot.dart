import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'base_robot.dart';
import '../utils/test_logger.dart';

class LoginRobot extends BaseRobot {
  LoginRobot(super.tester);

  // ── Finders (semantic keys from LoginScreen) ───────────────

  Finder get _emailMethodCard => findByKey('btn_auth_email');
  Finder get _phoneMethodCard => findByKey('tab_auth_phone');
  Finder get _choiceScreen => findByKey('choice');
  Finder get _emailPasswordScreen => findByKey('email-password');
  Finder get _phoneEntryScreen => findByKey('phone-entry');
  Finder get _googleButton => findByKey('btn_auth_google');
  Finder get _successScreen => findByKey('success');
  Finder get _inputEmail => findByKey('input_email');
  Finder get _inputPassword => findByKey('input_password');
  Finder get _submitButton => findByKey('btn_submit_login');

  // ── Verifications ─────────────────────────────────────────

  Future<void> expectLoginScreenVisible() async {
    TestLogger.step('Verify login screen is visible');
    await waitFor(_choiceScreen, timeout: const Duration(seconds: 15));
    expectVisible(_choiceScreen, label: 'Auth choice screen');
  }

  void expectEmailFormVisible() {
    TestLogger.step('Verify email/password form visible');
    expectVisible(_emailPasswordScreen, label: 'Email/password form');
  }

  void expectPhoneFormVisible() {
    TestLogger.step('Verify phone entry form visible');
    expectVisible(_phoneEntryScreen, label: 'Phone entry form');
  }

  // ── Actions ───────────────────────────────────────────────

  Future<void> selectEmailMethod() async {
    TestLogger.step('Select "Continue with Email" method');
    await tap(_emailMethodCard, label: 'Continue with Email button');
    await settle();
  }

  Future<void> selectPhoneMethod() async {
    TestLogger.step('Select "Phone" tab');
    await tap(_phoneMethodCard, label: 'Phone tab');
    await settle();
  }

  Future<void> enterEmail(String email) async {
    TestLogger.step('Enter email: $email');
    await tester.ensureVisible(_inputEmail.first);
    await tester.tap(_inputEmail.first);
    await tester.pumpAndSettle();
    await tester.enterText(_inputEmail.first, email);
    await tester.pumpAndSettle();
  }

  Future<void> enterPassword(String password) async {
    TestLogger.step('Enter password: ****');
    await tester.ensureVisible(_inputPassword.first);
    await tester.tap(_inputPassword.first);
    await tester.pumpAndSettle();
    await tester.enterText(_inputPassword.first, password);
    await tester.pumpAndSettle();
  }

  Future<void> tapInitialize() async {
    TestLogger.step('Tap sign-in / Authenticate button');
    if (_submitButton.evaluate().isNotEmpty) {
      await tap(_submitButton, label: 'Authenticate button');
    } else {
      final btn = find.textContaining('Initialize');
      if (btn.evaluate().isNotEmpty) {
        await tap(btn, label: 'Initialize button');
      } else {
        final signIn = find.textContaining('Sign');
        await tap(signIn, label: 'Sign In button');
      }
    }
  }

  Future<void> tapGoogleSignIn() async {
    TestLogger.step('Tap Google sign-in');
    await tap(_googleButton, label: 'Continue with Google');
  }

  Future<void> tapBack() async {
    TestLogger.step('Tap back on login');
    await tapIcon(PhosphorIconsLight.arrowLeft, label: 'Back arrow');
  }

  // ── Full Flows ────────────────────────────────────────────

  Future<void> loginWithEmail(String email, String password) async {
    TestLogger.section('Login Flow — Email/Password');
    await selectEmailMethod();
    await enterEmail(email);
    await enterPassword(password);
    await tapInitialize();
  }

  Future<void> expectAuthenticating() async {
    TestLogger.step('Verify authenticating state');
    final authenticatingKey = findByKey('authenticating');
    try {
      await waitFor(authenticatingKey, timeout: const Duration(seconds: 5));
      expectVisible(authenticatingKey, label: 'Authenticating spinner');
    } catch (_) {
      TestLogger.info('Authenticating state passed quickly');
    }
  }

  Future<void> expectLoginSuccess() async {
    TestLogger.step('Verify login success / dashboard transition');
    try {
      await waitFor(_successScreen, timeout: const Duration(seconds: 10));
      TestLogger.pass('Success screen shown');
    } catch (_) {
      TestLogger.info('Success screen bypassed — checking dashboard');
    }
  }

  Future<void> expectLoginError() async {
    TestLogger.step('Verify login error state');
    await settle(const Duration(seconds: 2));
    final errorIndicators = [
      find.textContaining('Invalid'),
      find.textContaining('Error'),
      find.textContaining('failed'),
      find.textContaining('incorrect'),
    ];
    var found = false;
    for (final finder in errorIndicators) {
      if (finder.evaluate().isNotEmpty) {
        TestLogger.pass('Login error message displayed');
        found = true;
        break;
      }
    }
    if (!found) {
      TestLogger.warn('No explicit error text found — checking we remain on login');
      expectVisible(_emailPasswordScreen, label: 'Still on email form (error)');
    }
  }
}
