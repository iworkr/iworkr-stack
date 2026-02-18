import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

const _kBiometricEnabledKey = 'biometric_enabled';
const _kAppLockEnabledKey = 'app_lock_enabled';
const _kPinCodeKey = 'pin_code';
const _kGracePeriodKey = 'app_last_background';

/// Biometric service — manages FaceID/TouchID enrollment and authentication.
class BiometricService {
  static final _auth = LocalAuthentication();
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  /// Check if device supports biometrics
  static Future<bool> get isAvailable async {
    try {
      final canAuth = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canAuth && isDeviceSupported;
    } catch (_) {
      return false;
    }
  }

  /// Get available biometric types (fingerprint, face, iris)
  static Future<List<BiometricType>> get availableTypes async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (_) {
      return [];
    }
  }

  /// Check if biometrics are enrolled
  static Future<bool> get isEnabled async {
    final value = await _storage.read(key: _kBiometricEnabledKey);
    return value == 'true';
  }

  /// Check if app lock is enabled
  static Future<bool> get isAppLockEnabled async {
    final value = await _storage.read(key: _kAppLockEnabledKey);
    return value == 'true';
  }

  /// Enroll biometrics — triggers OS prompt
  static Future<bool> enroll() async {
    try {
      final success = await _auth.authenticate(
        localizedReason: 'Authenticate to enable biometric login',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
      if (success) {
        await _storage.write(key: _kBiometricEnabledKey, value: 'true');
      }
      return success;
    } on PlatformException {
      return false;
    }
  }

  /// Disable biometrics
  static Future<void> disable() async {
    await _storage.delete(key: _kBiometricEnabledKey);
    await _storage.delete(key: _kAppLockEnabledKey);
  }

  /// Enable/disable app lock
  static Future<void> setAppLock(bool enabled) async {
    await _storage.write(key: _kAppLockEnabledKey, value: enabled ? 'true' : 'false');
  }

  /// Authenticate with biometrics — used for app lock and module gating
  static Future<bool> authenticate({String reason = 'Verify your identity'}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }

  // ── PIN Code ──────────────────────────────────────

  static Future<bool> get hasPinCode async {
    final pin = await _storage.read(key: _kPinCodeKey);
    return pin != null && pin.isNotEmpty;
  }

  static Future<void> setPin(String pin) async {
    await _storage.write(key: _kPinCodeKey, value: pin);
  }

  static Future<bool> verifyPin(String pin) async {
    final stored = await _storage.read(key: _kPinCodeKey);
    return stored == pin;
  }

  static Future<void> clearPin() async {
    await _storage.delete(key: _kPinCodeKey);
  }

  // ── Grace Period ──────────────────────────────────

  static Future<void> recordBackground() async {
    await _storage.write(
      key: _kGracePeriodKey,
      value: DateTime.now().toUtc().toIso8601String(),
    );
  }

  /// Returns true if within the 30-second grace window.
  static Future<bool> isWithinGracePeriod() async {
    final raw = await _storage.read(key: _kGracePeriodKey);
    if (raw == null) return false;
    final lastBg = DateTime.tryParse(raw);
    if (lastBg == null) return false;
    return DateTime.now().toUtc().difference(lastBg).inSeconds < 30;
  }
}

// ── Riverpod Providers ────────────────────────────────

final biometricAvailableProvider = FutureProvider<bool>((ref) async {
  return BiometricService.isAvailable;
});

final biometricEnabledProvider = FutureProvider<bool>((ref) async {
  return BiometricService.isEnabled;
});

final appLockEnabledProvider = FutureProvider<bool>((ref) async {
  return BiometricService.isAppLockEnabled;
});
