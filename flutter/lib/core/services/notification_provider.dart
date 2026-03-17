import 'dart:async';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ═══════════════════════════════════════════════════════════
// ── Project Beacon-Recovery: FCM Push Notification Engine ─
// ═══════════════════════════════════════════════════════════
//
// Manages notification state, realtime subscriptions, and the
// full FCM device registration lifecycle including:
//   - Permission gating (iOS/Android)
//   - APNs delay-trap workaround for iOS
//   - Token upsert → Supabase user_devices via RPC
//   - Token rotation stream subscription
//   - Foreground / background / terminated payload routing
//   - Secure token purge on user logout

// ── Background Handler ─────────────────────────────────────
// MUST be a top-level function annotated with @pragma
// This runs in an isolated Dart context when the app is killed.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Minimal work only — this isolate has no UI or Riverpod context.
  // Routing happens in main.dart via getInitialMessage() when the user
  // taps the notification and the app cold-boots.
  debugPrint('[FCM Background] Received: ${message.messageId} | type=${message.data['type']}');
}

// ── Local Notification Channel ─────────────────────────────
const _androidChannel = AndroidNotificationChannel(
  'iworkr_high_importance',
  'iWorkr Alerts',
  description: 'Critical shift, compliance, and medical alerts',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
);

final _localNotifications = FlutterLocalNotificationsPlugin();

/// Initialize local notification channel (call once in FCMService.initialize)
Future<void> _initLocalNotifications() async {
  const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
  const iosSettings = DarwinInitializationSettings(
    requestAlertPermission: false, // handled separately
    requestBadgePermission: false,
    requestSoundPermission: false,
  );
  await _localNotifications.initialize(
    const InitializationSettings(android: androidSettings, iOS: iosSettings),
  );
  if (Platform.isAndroid) {
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);
  }
}

// ── FCM Service (Singleton) ────────────────────────────────

/// Singleton service that manages the full FCM push lifecycle.
/// Call [FCMService.initialize()] once during app bootstrap, then
/// bind [FCMService.bindToAuthStream()] to react to sign-in/sign-out events.
class FCMService {
  FCMService._();
  static final FCMService instance = FCMService._();

  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<AuthState>? _authSub;
  String? _cachedToken;

  /// Bootstrap: registers background handler, creates local channel,
  /// and sets foreground notification presentation options.
  /// Call BEFORE runApp() in main().
  static Future<void> preRunInit() async {
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await _initLocalNotifications();
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  /// Full initialization: request permissions, resolve APNs, get FCM token,
  /// register with Supabase, subscribe to rotation stream.
  /// Safe to call multiple times — re-upserts if token is already known.
  Future<void> initialize() async {
    try {
      final hasPermission = await _requestPermissions();
      if (!hasPermission) {
        MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Permissions denied — push disabled');
        return;
      }

      // iOS: wait for APNs token before calling getToken()
      await _waitForAPNSToken();

      // THE FIX: Restore line 204 — protected by permission + APNs guards
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        _cachedToken = token;
        await _registerTokenWithSupabase(token);
        MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Token registered (${token.substring(0, 16)}…)');
      }

      // Subscribe to token rotations (Firebase rotates tokens periodically)
      _tokenRefreshSub?.cancel();
      _tokenRefreshSub = FirebaseMessaging.instance.onTokenRefresh.listen(
        (newToken) async {
          _cachedToken = newToken;
          await _registerTokenWithSupabase(newToken);
          MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Token rotated (${newToken.substring(0, 16)}…)');
        },
        onError: (e) {
          MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Token refresh stream error: $e');
        },
      );

      // Foreground message handler → in-app snackbar
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Background-tapped handler → deep link routing
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

    } catch (e, st) {
      MobileTelemetryEngine.instance.captureAndReport(e, st, source: 'fcm_init', fatal: false);
    }
  }

  /// Check if the app was launched from a terminated state via notification tap.
  /// Call this AFTER the router is ready (i.e., after runApp completes first frame).
  Future<void> checkInitialMessage() async {
    try {
      final message = await FirebaseMessaging.instance.getInitialMessage();
      if (message != null) {
        MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Cold-boot from notification: ${message.data}');
        _routeFromPayload(message.data, coldBoot: true);
      }
    } catch (e) {
      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] getInitialMessage error: $e');
    }
  }

  /// Bind FCM init/purge to Supabase auth state changes.
  /// SIGNED_IN → initialize (registers token for new user)
  /// SIGNED_OUT → purge (deletes token to prevent cross-account leaks)
  void bindToAuthStream() {
    _authSub?.cancel();
    _authSub = SupabaseService.auth.onAuthStateChange.listen((event) async {
      if (event.event == AuthChangeEvent.signedIn) {
        MobileTelemetryEngine.instance.addBreadcrumb('[FCM] SIGNED_IN — initializing push');
        await initialize();
      } else if (event.event == AuthChangeEvent.signedOut) {
        MobileTelemetryEngine.instance.addBreadcrumb('[FCM] SIGNED_OUT — purging token');
        await _purgeTokenOnLogout();
      }
    });
  }

  /// Purge the FCM token from Supabase AND Firebase on logout.
  /// This prevents the next user on this device from receiving
  /// the previous user's private shift / medical notifications.
  /// Made accessible (not private) so AuthNotifier can call it before sign-out.
  Future<void> purgeTokenOnLogout() => _purgeTokenOnLogout();

  Future<void> _purgeTokenOnLogout() async {
    try {
      final token = _cachedToken ?? await FirebaseMessaging.instance.getToken();
      if (token != null) {
        // 1. Delete from Supabase device registry
        await SupabaseService.client
            .from('user_devices')
            .delete()
            .eq('fcm_token', token);

        // 2. Invalidate token at Firebase (forces fresh token on next login)
        await FirebaseMessaging.instance.deleteToken();
        _cachedToken = null;
        MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Token purged on logout');
      }
    } catch (e) {
      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Token purge failed: $e');
    }

    // Cancel rotation subscription (user has logged out)
    _tokenRefreshSub?.cancel();
    _tokenRefreshSub = null;
  }

  // ── Private Helpers ──────────────────────────────────────

  /// Request OS-level notification permissions.
  Future<bool> _requestPermissions() async {
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: true, // Required for shift emergency / medical alerts
      provisional: false,
      sound: true,
    );
    final granted = settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
    MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Permission: ${settings.authorizationStatus}');
    return granted;
  }

  /// iOS APNs delay-trap: FCM's getToken() will hang if the APNs token hasn't
  /// been resolved yet. Retry up to 5 times with 1-second intervals.
  Future<void> _waitForAPNSToken() async {
    if (!Platform.isIOS) return;
    String? apnsToken = await FirebaseMessaging.instance.getAPNSToken();
    int retries = 0;
    while (apnsToken == null && retries < 5) {
      await Future.delayed(const Duration(seconds: 1));
      apnsToken = await FirebaseMessaging.instance.getAPNSToken();
      retries++;
      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] APNs retry $retries/5 — token=${apnsToken != null}');
    }
    if (apnsToken == null) {
      // Non-fatal: log and continue. getToken() may still succeed on
      // physical devices with proper push entitlements configured.
      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Warning: APNs token not resolved after 5 retries');
    }
  }

  /// Upsert FCM token into Supabase user_devices via secure RPC.
  Future<void> _registerTokenWithSupabase(String token) async {
    final user = SupabaseService.auth.currentUser;
    if (user == null) {
      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Skipping token upsert — no auth user');
      return;
    }

    final platform = Platform.isIOS ? 'ios' : 'android';

    // Gather optional device metadata
    String? deviceModel;
    String? appVersion;
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await deviceInfo.iosInfo;
        deviceModel = '${ios.model} ${ios.systemVersion}';
      } else {
        final android = await deviceInfo.androidInfo;
        deviceModel = '${android.manufacturer} ${android.model} (Android ${android.version.release})';
      }
      final pkg = await PackageInfo.fromPlatform();
      appVersion = '${pkg.version}+${pkg.buildNumber}';
    } catch (_) {
      // Metadata is optional — never block token registration
    }

    await SupabaseService.client.rpc('upsert_device_token', params: {
      'p_fcm_token': token,
      'p_platform': platform,
      'p_device_model': deviceModel,
      'p_app_version': appVersion,
    });
  }

  /// Foreground message handler: show an in-app local notification banner.
  void _handleForegroundMessage(RemoteMessage message) {
    MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Foreground message: ${message.notification?.title}');
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: _buildRoutePayload(message.data),
    );
  }

  /// Background-tapped handler: parse data payload and deep-link via GoRouter.
  void _handleMessageOpenedApp(RemoteMessage message) {
    MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Background tap: ${message.data}');
    _routeFromPayload(message.data, coldBoot: false);
  }

  /// Parse the FCM data payload and push the appropriate route.
  /// Payload contract (from dispatch-outbound Edge Function):
  /// {
  ///   "route": "/shift/123",          — direct GoRouter path
  ///   "entity_id": "uuid",            — optional entity UUID
  ///   "type": "EMERGENCY_DROP"        — notification type for telemetry
  /// }
  void _routeFromPayload(Map<String, dynamic> data, {required bool coldBoot}) {
    try {
      final route = data['route'] as String?;
      final entityId = data['entity_id'] as String?;
      final type = data['type'] as String? ?? 'unknown';

      if (route == null || route.isEmpty) return;

      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Route: $route | id=$entityId | type=$type | cold=$coldBoot');

      // Build final path (append ?id= param if entity_id provided)
      final path = entityId != null && entityId.isNotEmpty
          ? '$route?id=$entityId'
          : route;

      // Use a post-frame callback to ensure the router is mounted
      // (critical for cold-boot scenario)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          _pendingRoute = path;
          _pendingRouteController.add(path);
        } catch (e) {
          MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Route dispatch failed: $e');
        }
      });
    } catch (e) {
      MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Payload parse error: $e');
    }
  }

  String? _pendingRoute;
  final _pendingRouteController = StreamController<String>.broadcast();

  /// Stream of pending deep-link routes from FCM notifications.
  /// Listen to this in your router initialization to handle cold-boot routing.
  Stream<String> get pendingRouteStream => _pendingRouteController.stream;

  /// Consume and clear the pending cold-boot route (call after router is ready).
  String? consumePendingRoute() {
    final r = _pendingRoute;
    _pendingRoute = null;
    return r;
  }

  String? buildRoutePayloadForTest(Map<String, dynamic> data) => _buildRoutePayload(data);

  String? _buildRoutePayload(Map<String, dynamic> data) {
    final route = data['route'] as String?;
    final entityId = data['entity_id'] as String?;
    if (route == null) return null;
    return entityId != null ? '$route?id=$entityId' : route;
  }

  void dispose() {
    _tokenRefreshSub?.cancel();
    _authSub?.cancel();
    _pendingRouteController.close();
  }
}

// ── Riverpod Providers ─────────────────────────────────────

// ── NotificationItem Model ─────────────────────────────────

class NotificationItem {
  final String id;
  final String organizationId;
  final String userId;
  final String type;
  final String title;
  final String body;
  final String? senderName;
  final Map<String, dynamic>? context;
  final bool read;
  final bool archived;
  final DateTime? snoozedUntil;
  final String? actionUrl;
  final String? actionLink;
  final String priority;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;

  const NotificationItem({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.type,
    required this.title,
    required this.body,
    this.senderName,
    this.context,
    this.read = false,
    this.archived = false,
    this.snoozedUntil,
    this.actionUrl,
    this.actionLink,
    this.priority = 'normal',
    this.metadata = const {},
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String? ?? '',
      userId: json['user_id'] as String,
      type: json['type'] as String? ?? 'system',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      senderName: json['sender_name'] as String?,
      context: json['context'] as Map<String, dynamic>?,
      read: json['read'] as bool? ?? false,
      archived: json['archived'] as bool? ?? false,
      snoozedUntil: json['snoozed_until'] != null
          ? DateTime.tryParse(json['snoozed_until'] as String)
          : null,
      actionUrl: json['action_url'] as String?,
      actionLink: json['action_link'] as String?,
      priority: json['priority'] as String? ?? 'normal',
      metadata: (json['metadata'] as Map<String, dynamic>?) ?? {},
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  bool get isSnoozed =>
      snoozedUntil != null && snoozedUntil!.isAfter(DateTime.now());

  bool get isHighPriority => priority == 'high' || priority == 'urgent';
}

/// Streams all non-archived notifications for the current user.
final notificationsProvider =
    StreamProvider.autoDispose<List<NotificationItem>>((ref) async* {
  final orgId = await ref.watch(organizationIdProvider.future);
  final user = SupabaseService.auth.currentUser;
  if (user == null || orgId == null) {
    yield [];
    return;
  }

  final initial = await SupabaseService.client
      .from('notifications')
      .select()
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', ascending: false)
      .limit(100);

  var items =
      (initial as List).map((e) => NotificationItem.fromJson(e)).toList();
  yield items;

  final controller = StreamController<List<NotificationItem>>();

  final channel = SupabaseService.client
      .channel('notifications:${user.id}')
      .onPostgresChanges(
        event: PostgresChangeEvent.insert,
        schema: 'public',
        table: 'notifications',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'user_id',
          value: user.id,
        ),
        callback: (payload) {
          final newItem = NotificationItem.fromJson(payload.newRecord);
          if (!newItem.archived) {
            items = [newItem, ...items];
            if (items.length > 100) items = items.sublist(0, 100);
            controller.add(List.unmodifiable(items));
          }
        },
      )
      .subscribe();

  ref.onDispose(() {
    SupabaseService.client.removeChannel(channel);
    controller.close();
  });

  yield* controller.stream;
});

/// Count of unread, non-archived notifications.
final unreadCountProvider = Provider.autoDispose<int>((ref) {
  final async = ref.watch(notificationsProvider);
  return async.maybeWhen(
    data: (items) => items.where((n) => !n.read && !n.archived).length,
    orElse: () => 0,
  );
});

// ── Mutation Helpers ───────────────────────────────────────

Future<void> markNotificationRead(String id) async {
  await SupabaseService.client.from('notifications').update({
    'read': true,
    'read_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', id);
}

Future<void> markAllNotificationsRead() async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return;
  await SupabaseService.client
      .from('notifications')
      .update({
        'read': true,
        'read_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('user_id', user.id)
      .eq('read', false);
}

Future<void> archiveNotification(String id) async {
  await SupabaseService.client.from('notifications').update({
    'archived': true,
  }).eq('id', id);
}

Future<void> toggleNotificationRead(String id, {required bool currentlyRead}) async {
  await SupabaseService.client.from('notifications').update({
    'read': !currentlyRead,
    if (!currentlyRead) 'read_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', id);
}

// ── Legacy compatibility shim ─────────────────────────────
// The old registerDevice() is now replaced by FCMService.initialize()
// This stub is kept to avoid breaking any callers during migration.
@Deprecated('Use FCMService.instance.initialize() instead')
Future<void> registerDevice() async {
  await FCMService.instance.initialize();
}
