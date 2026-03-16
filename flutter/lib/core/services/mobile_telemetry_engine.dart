import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

class MobileTelemetryEngine {
  MobileTelemetryEngine._();
  static final MobileTelemetryEngine instance = MobileTelemetryEngine._();

  final GlobalKey repaintBoundaryKey = GlobalKey(debugLabel: 'telemetry-root');
  final List<String> _breadcrumbs = <String>[];
  final List<String> _routeTrail = <String>[];
  final Battery _battery = Battery();
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  AppDatabase? _db;
  bool _initialized = false;
  bool _capturing = false;
  String _currentRoute = '/';

  static const int _maxBreadcrumbs = 50;
  static const String _burstCountKey = 'panopticon_fatal_burst_count';
  static const String _burstAtKey = 'panopticon_fatal_burst_at_ms';
  static const List<String> _secureRoutePrefixes = <String>[
    '/care/medications',
    '/care/credentials',
    '/care/shift',
  ];

  void initialize(AppDatabase db) {
    _db = db;
    _initialized = true;
    addBreadcrumb('Telemetry engine initialized');
  }

  void updateCurrentRoute(String route) {
    _currentRoute = route;
    _routeTrail.add(route);
    while (_routeTrail.length > _maxBreadcrumbs) {
      _routeTrail.removeAt(0);
    }
    addBreadcrumb('Navigated to $route');
  }

  void addBreadcrumb(String message) {
    final stamp = DateTime.now().toUtc().toIso8601String();
    _breadcrumbs.add('[$stamp] $message');
    while (_breadcrumbs.length > _maxBreadcrumbs) {
      _breadcrumbs.removeAt(0);
    }
  }

  Future<void> captureAndReport(
    Object error,
    StackTrace stackTrace, {
    String source = 'global',
    bool fatal = true,
    Map<String, dynamic> extra = const <String, dynamic>{},
  }) async {
    if (!_initialized || _capturing) return;
    _capturing = true;
    try {
      if (fatal && !await _allowFatalCapture()) {
        return;
      }

      final currentUser = SupabaseService.auth.currentUser;
      final orgId = await _resolveOrganizationId(currentUser?.id);
      final packageInfo = await PackageInfo.fromPlatform();
      final connectivity = await Connectivity().checkConnectivity();
      final hasNetwork = connectivity.any((c) => c != ConnectivityResult.none);
      final batteryLevel = await _readBatteryLevel();
      final gps = await _readGps();
      final screenshot = await _captureScreenshotIfAllowed();
      final device = await _readDeviceModel();
      final memoryMb = ProcessInfo.currentRss ~/ (1024 * 1024);

      final payload = <String, dynamic>{
        'event_id': _uuid.v4(),
        'timestamp_utc': DateTime.now().toUtc().toIso8601String(),
        'severity': fatal ? 'fatal' : 'warning',
        'identity': <String, dynamic>{
          'user_id': currentUser?.id,
          'email': currentUser?.email,
          'organization_id': orgId,
          'role': extra['role'],
        },
        'environment': <String, dynamic>{
          'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'mobile_ios' : 'mobile_android',
          'os_version': '${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
          'app_version': '${packageInfo.version}+${packageInfo.buildNumber}',
          'device_model': device,
        },
        'telemetry': <String, dynamic>{
          'network_type': connectivity.map((e) => e.name).join(','),
          'effective_bandwidth': 'unknown',
          'is_offline_mode': !hasNetwork,
          'battery_level': batteryLevel,
          'memory_usage_mb': memoryMb,
          'gps_location': gps,
        },
        'context': <String, dynamic>{
          'current_route': _currentRoute,
          'last_action': _breadcrumbs.isNotEmpty ? _breadcrumbs.last : null,
          'console_buffer': _breadcrumbs
              .map((entry) => <String, dynamic>{
                    'level': fatal ? 'error' : 'warn',
                    'message': entry,
                    'timestamp': DateTime.now().toUtc().toIso8601String(),
                  })
              .toList(growable: false),
          'breadcrumbs': List<String>.from(_breadcrumbs),
          'route_trail': List<String>.from(_routeTrail),
          'source': source,
          'extra': extra,
        },
        'error_details': <String, dynamic>{
          'name': error.runtimeType.toString(),
          'message': error.toString(),
          'stack_trace': stackTrace.toString(),
        },
        if (screenshot != null)
          'visual_evidence': <String, dynamic>{
            'screenshot_base64': screenshot,
          },
      };

      if (!hasNetwork) {
        await _enqueueForSync(payload, error.toString());
        return;
      }

      final response = await SupabaseService.client.functions.invoke(
        'ingest-telemetry',
        body: payload,
      );
      if (response.status < 200 || response.status >= 300) {
        await _enqueueForSync(payload, 'Ingest failed: ${response.status}');
      }
    } catch (telemetryError) {
      try {
        await _enqueueForSync(
          <String, dynamic>{
            'event_id': _uuid.v4(),
            'timestamp_utc': DateTime.now().toUtc().toIso8601String(),
            'severity': 'warning',
            'context': <String, dynamic>{
              'current_route': _currentRoute,
              'breadcrumbs': List<String>.from(_breadcrumbs),
              'telemetry_error': telemetryError.toString(),
            },
            'error_details': <String, dynamic>{
              'name': error.runtimeType.toString(),
              'message': error.toString(),
              'stack_trace': stackTrace.toString(),
            },
          },
          telemetryError.toString(),
        );
      } catch (_) {
        // Never crash the app from telemetry itself.
      }
    } finally {
      _capturing = false;
    }
  }

  Future<void> _enqueueForSync(Map<String, dynamic> payload, String reason) async {
    final db = _db;
    if (db == null) return;
    await db.enqueue(
      SyncQueueCompanion(
        id: Value(_uuid.v4()),
        entityType: const Value('telemetry_event'),
        entityId: Value(_uuid.v4()),
        action: const Value('INSERT'),
        payload: Value(jsonEncode(payload)),
        createdAt: Value(DateTime.now().toUtc()),
        errorMessage: Value(reason),
      ),
    );
  }

  Future<String?> _captureScreenshotIfAllowed() async {
    if (_secureRoutePrefixes.any((prefix) => _currentRoute.startsWith(prefix))) {
      return null;
    }
    final boundaryContext = repaintBoundaryKey.currentContext;
    if (boundaryContext == null) return null;
    final boundary = boundaryContext.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return null;

    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final image = await boundary.toImage(pixelRatio: min(1.0, view.devicePixelRatio));
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) return null;
    final bytes = data.buffer.asUint8List();
    return base64Encode(bytes);
  }

  Future<int?> _readBatteryLevel() async {
    try {
      return await _battery.batteryLevel;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, double>?> _readGps() async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return null;
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 3),
        ),
      );
      return <String, double>{
        'lat': position.latitude,
        'lng': position.longitude,
      };
    } catch (_) {
      return null;
    }
  }

  Future<String> _readDeviceModel() async {
    try {
      if (Platform.isIOS) {
        final info = await _deviceInfo.iosInfo;
        return '${info.name} ${info.model}';
      }
      if (Platform.isAndroid) {
        final info = await _deviceInfo.androidInfo;
        return '${info.manufacturer} ${info.model}';
      }
    } catch (_) {
      return 'unknown';
    }
    return 'unknown';
  }

  Future<String?> _resolveOrganizationId(String? userId) async {
    if (userId == null) return null;
    try {
      final row = await SupabaseService.client
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
      return row?['organization_id'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<bool> _allowFatalCapture() async {
    final prefs = await SharedPreferences.getInstance();
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final burstAt = prefs.getInt(_burstAtKey) ?? nowMs;
    var count = prefs.getInt(_burstCountKey) ?? 0;

    if (nowMs - burstAt > 10000) {
      await prefs.setInt(_burstAtKey, nowMs);
      await prefs.setInt(_burstCountKey, 1);
      return true;
    }
    count += 1;
    await prefs.setInt(_burstCountKey, count);
    return count <= 3;
  }
}

class TelemetryNavigatorObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    final name = route.settings.name ?? route.runtimeType.toString();
    MobileTelemetryEngine.instance.updateCurrentRoute(name);
    super.didPush(route, previousRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    final name = previousRoute?.settings.name ?? previousRoute?.runtimeType.toString() ?? '/';
    MobileTelemetryEngine.instance.updateCurrentRoute(name);
    super.didPop(route, previousRoute);
  }
}

class TelemetryProviderObserver extends ProviderObserver {
  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    MobileTelemetryEngine.instance.addBreadcrumb(
      'Provider update: ${provider.name ?? provider.runtimeType}',
    );
    super.didUpdateProvider(provider, previousValue, newValue, container);
  }
}

class GracefulErrorFallback extends StatelessWidget {
  final FlutterErrorDetails details;

  const GracefulErrorFallback({super.key, required this.details});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0A0A0A),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF141414),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 28),
                  const SizedBox(height: 12),
                  const Text(
                    'We encountered a glitch displaying this information.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '(Error code logged to IT)',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.tonal(
                    onPressed: () {
                      (context as Element).markNeedsBuild();
                    },
                    child: const Text('Tap to Refresh'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

