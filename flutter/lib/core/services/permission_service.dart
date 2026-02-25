import 'dart:io';

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:iworkr_mobile/core/widgets/permission_prompt.dart';

// ═══════════════════════════════════════════════════════════
// ── Permission Service — Centralized JIT Permission Gate ──
// ═══════════════════════════════════════════════════════════
//
// Every hardware permission flows through this singleton:
//   1. Check status
//   2. If undetermined → show Obsidian soft prompt
//   3. If soft prompt accepted → fire native OS request
//   4. If permanently denied → show recovery sheet with openAppSettings()
//
// This prevents the "one shot" problem where a user taps
// Deny on the native dialog and is permanently locked out.

class PermissionService {
  PermissionService._();
  static final instance = PermissionService._();

  // ── Camera ─────────────────────────────────────────────

  Future<bool> requestCamera(BuildContext context) async {
    return _request(
      context: context,
      permission: Permission.camera,
      config: const _PromptConfig(
        icon: _PromptIcon.camera,
        title: 'Enable Camera',
        body:
            'iWorkr needs your camera to scan equipment barcodes and '
            'capture mandatory photographic evidence for job completion.',
        ctaLabel: 'Allow Camera',
      ),
    );
  }

  // ── Photo Library ──────────────────────────────────────

  Future<bool> requestPhotos(BuildContext context) async {
    return _request(
      context: context,
      permission: Permission.photos,
      config: const _PromptConfig(
        icon: _PromptIcon.photos,
        title: 'Access Photo Library',
        body:
            'iWorkr needs access to your photos so you can upload '
            'existing site images and compliance documents to the job dossier.',
        ctaLabel: 'Allow Photos',
      ),
    );
  }

  // ── Location (Foreground) ──────────────────────────────

  Future<bool> requestLocationWhenInUse(BuildContext context) async {
    return _request(
      context: context,
      permission: Permission.locationWhenInUse,
      config: const _PromptConfig(
        icon: _PromptIcon.location,
        title: 'Enable Location',
        body:
            'To display nearby jobs and calculate your distance to '
            'the site, iWorkr requires your location while the app is open.',
        ctaLabel: 'Allow Location',
      ),
    );
  }

  // ── Location (Background / Always) ─────────────────────
  // Phase 2: called after foreground location is already granted.

  Future<bool> requestLocationAlways(BuildContext context) async {
    final fgStatus = await Permission.locationWhenInUse.status;
    if (!fgStatus.isGranted) {
      if (!context.mounted) return false;
      final fgGranted = await requestLocationWhenInUse(context);
      if (!fgGranted) return false;
    }

    if (!context.mounted) return false;
    return _request(
      context: context,
      permission: Permission.locationAlways,
      config: const _PromptConfig(
        icon: _PromptIcon.location,
        title: 'Enable Background Location',
        body:
            'To calculate your exact travel time and alert the client '
            'of your ETA while you drive, please upgrade location access '
            'to "Always Allow". iWorkr only tracks you while clocked in.',
        ctaLabel: 'Upgrade to Always',
      ),
    );
  }

  // ── Notifications ──────────────────────────────────────

  Future<bool> requestNotifications(BuildContext context) async {
    return _request(
      context: context,
      permission: Permission.notification,
      config: const _PromptConfig(
        icon: _PromptIcon.notifications,
        title: 'Enable Notifications',
        body:
            'Stay on top of urgent dispatches, job reassignments, '
            'and client messages with real-time push notifications.',
        ctaLabel: 'Allow Notifications',
      ),
    );
  }

  // ── Core request engine ────────────────────────────────

  Future<bool> _request({
    required BuildContext context,
    required Permission permission,
    required _PromptConfig config,
  }) async {
    var status = await permission.status;

    if (status.isGranted) return true;

    if (status.isPermanentlyDenied || (Platform.isIOS && status.isDenied && await _wasPreviouslyRequested(permission))) {
      if (!context.mounted) return false;
      await showPermissionRecoverySheet(
        context,
        title: '${config.title.replaceFirst('Enable ', '').replaceFirst('Access ', '')} Blocked',
        body:
            'You have previously denied this permission. '
            'iWorkr cannot function properly without it. '
            'Please open your device settings to enable it.',
      );
      return false;
    }

    if (!context.mounted) return false;

    final accepted = await showPermissionSoftPrompt(
      context,
      icon: config.icon,
      title: config.title,
      body: config.body,
      ctaLabel: config.ctaLabel,
    );

    if (!accepted) return false;

    final result = await permission.request();

    if (result.isGranted) return true;

    if (result.isPermanentlyDenied && context.mounted) {
      await showPermissionRecoverySheet(
        context,
        title: '${config.title.replaceFirst('Enable ', '').replaceFirst('Access ', '')} Blocked',
        body:
            'The permission was denied. Please open Settings and '
            'grant access manually to use this feature.',
      );
    }

    return false;
  }

  /// Track whether we've shown the native prompt before.
  /// On iOS, after one denial the OS will never show the prompt again.
  final Set<Permission> _requested = {};

  Future<bool> _wasPreviouslyRequested(Permission permission) async {
    if (_requested.contains(permission)) return true;
    _requested.add(permission);
    return false;
  }
}

class _PromptConfig {
  final _PromptIcon icon;
  final String title;
  final String body;
  final String ctaLabel;

  const _PromptConfig({
    required this.icon,
    required this.title,
    required this.body,
    required this.ctaLabel,
  });
}

enum _PromptIcon { camera, photos, location, notifications }
