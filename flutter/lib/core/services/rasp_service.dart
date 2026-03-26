import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:freerasp/freerasp.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

// ═══════════════════════════════════════════════════════════
// ── Aegis-Citadel: Runtime Application Self-Protection ───
// ═══════════════════════════════════════════════════════════
//
// Uses freeRASP to detect:
//   • Root/jailbreak → block app
//   • Debugger/hooking → crash immediately
//   • Emulator → block in release, allow in debug
//   • Unofficial installer → warn user
//   • App tampering → block app
//
// Integrates with MobileTelemetryEngine for remote reporting.

class RaspService {
  RaspService._();
  static final RaspService instance = RaspService._();

  bool _initialized = false;
  bool _threatDetected = false;
  String? _threatReason;

  bool get isThreatDetected => _threatDetected;
  String? get threatReason => _threatReason;

  // Must be injected at build time by CI for release artifacts.
  static const String _signingCertHash = String.fromEnvironment(
    'SIGNING_CERT_HASH',
    defaultValue: '',
  );
  static const String _iosTeamId = String.fromEnvironment(
    'IOS_TEAM_ID',
    defaultValue: '',
  );

  /// Initialize RASP checks. Call BEFORE runApp() in main.dart.
  /// In debug mode, emulator and debugger checks are relaxed.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // Skip RASP entirely in debug/profile mode for development ergonomics
    if (kDebugMode) {
      debugPrint('[RASP] Debug mode — RASP checks disabled');
      return;
    }

    try {
      final config = TalsecConfig(
        androidConfig: AndroidConfig(
          packageName: 'com.iworkr.app',
          signingCertHashes: [
            _signingCertHash,
          ],
          supportedStores: ['com.sec.android.app.samsungapps'],
        ),
        iosConfig: IOSConfig(
          bundleIds: ['com.iworkr.app'],
          teamId: _iosTeamId,
        ),
        watcherMail: 'security@iworkrapp.com',
        isProd: true,
      );

      if (_signingCertHash.isEmpty || _iosTeamId.isEmpty) {
        debugPrint('[RASP] Build defines missing: SIGNING_CERT_HASH and/or IOS_TEAM_ID');
      }

      final callback = ThreatCallback(
        onAppIntegrity: _onTamperDetected,
        onObfuscationIssues: _onObfuscationIssuesDetected,
        onDebug: _onDebuggerDetected,
        onDeviceBinding: _onDeviceBindingDetected,
        onDeviceID: _onDeviceBindingDetected,
        onHooks: _onHookDetected,
        onPrivilegedAccess: _onRootDetected,
        onSecureHardwareNotAvailable: _onTamperDetected,
        onSimulator: _onEmulatorDetected,
        onUnofficialStore: _onUnofficialStoreDetected,
      );

      Talsec.instance.attachListener(callback);
      await Talsec.instance.start(config);

      debugPrint('[RASP] Aegis-Citadel RASP initialized — monitoring active');
    } catch (e, stack) {
      // RASP init failure should NOT crash the app — log and continue
      debugPrint('[RASP] Initialization failed: $e');
      MobileTelemetryEngine.instance.captureAndReport(
        e,
        stack,
        source: 'rasp_init',
        fatal: false,
      );
    }
  }

  // ── Threat Callbacks ─────────────────────────────────────

  void _onRootDetected() {
    _reportThreat('RASP_ROOT_DETECTED', 'Device is rooted or jailbroken', fatal: true);
  }

  void _onDebuggerDetected() {
    _reportThreat('RASP_DEBUGGER_DETECTED', 'Debugger or reverse engineering tool detected', fatal: true);
  }

  void _onEmulatorDetected() {
    _reportThreat('RASP_EMULATOR_DETECTED', 'Running on emulator — potential automated attack', fatal: true);
  }

  void _onTamperDetected() {
    _reportThreat('RASP_TAMPER_DETECTED', 'Application binary has been tampered with', fatal: true);
  }

  void _onHookDetected() {
    _reportThreat('RASP_DEBUGGER_DETECTED', 'Runtime hooking detected (Frida/Xposed)', fatal: true);
  }

  void _onUnofficialStoreDetected() {
    // Warn but don't block — user may have sideloaded legitimately
    _reportThreat('RASP_TAMPER_DETECTED', 'App installed from unofficial store', fatal: false);
    debugPrint('[RASP] WARNING: Unofficial store installation detected');
  }

  void _onDeviceBindingDetected() {
    _reportThreat('RASP_TAMPER_DETECTED', 'Device binding violation', fatal: false);
  }

  void _onObfuscationIssuesDetected() {
    // Non-fatal — just log it
    debugPrint('[RASP] Obfuscation issues detected — binary may not be properly protected');
    MobileTelemetryEngine.instance.addBreadcrumb('RASP: Obfuscation issues detected');
  }

  void _reportThreat(String eventType, String reason, {required bool fatal}) {
    debugPrint('[RASP] THREAT: $reason (fatal=$fatal)');
    _threatDetected = fatal;
    _threatReason = reason;

    // Report to telemetry
    MobileTelemetryEngine.instance.addBreadcrumb('RASP THREAT: $reason');
    MobileTelemetryEngine.instance.captureAndReport(
      SecurityThreatException(reason),
      StackTrace.current,
      source: 'rasp_$eventType',
      fatal: fatal,
    );

    // Report to backend security_events table
    _reportToBackend(eventType, reason);

    if (fatal) {
      // Give telemetry a moment to flush, then terminate
      Future.delayed(const Duration(seconds: 2), () {
        // Sign out to invalidate the session
        SupabaseService.auth.signOut();
        // Force-exit the app
        if (Platform.isAndroid) {
          SystemNavigator.pop();
        }
        // iOS doesn't allow programmatic exit, but the security overlay will block all interaction
      });
    }
  }

  Future<void> _reportToBackend(String eventType, String reason) async {
    try {
      await SupabaseService.client.rpc('log_security_event', params: {
        'p_event_type': eventType,
        'p_severity': 'critical',
        'p_details': {'reason': reason, 'platform': Platform.operatingSystem},
      });
    } catch (e) {
      debugPrint('[RASP] Failed to report to backend: $e');
    }
  }

  /// Build the security violation overlay widget.
  /// Mount this in the widget tree when [isThreatDetected] is true.
  static Widget buildSecurityViolationScreen(String reason) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF050505),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.shield, size: 64, color: Color(0xFFEF4444)),
                const SizedBox(height: 24),
                const Text(
                  'Security Violation',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  reason,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF71717A),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'iWorkr cannot run on compromised devices.\nThis incident has been reported.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF52525B),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Custom exception for RASP threat detection
class SecurityThreatException implements Exception {
  final String reason;
  SecurityThreatException(this.reason);

  @override
  String toString() => 'SecurityThreatException: $reason';
}
