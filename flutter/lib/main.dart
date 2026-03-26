import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';
import 'package:iworkr_mobile/core/router/app_router.dart';
import 'package:iworkr_mobile/core/services/brand_provider.dart';
import 'package:iworkr_mobile/core/services/native_bridge_service.dart';
import 'package:iworkr_mobile/core/services/background_sync_service.dart';
import 'package:iworkr_mobile/core/services/rasp_service.dart';
import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/notification_provider.dart';
import 'package:iworkr_mobile/core/services/revenuecat_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/theme_provider.dart';
import 'package:iworkr_mobile/core/widgets/auth_curtain.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Default to dark chrome — will be updated dynamically by AnnotatedRegion
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF050505),
      systemNavigationBarIconBrightness: Brightness.light,
    ));

    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      unawaited(MobileTelemetryEngine.instance.captureAndReport(
        details.exception,
        details.stack ?? StackTrace.current,
        source: 'flutter_error',
        fatal: true,
      ));
    };

    WidgetsBinding.instance.platformDispatcher.onError = (Object error, StackTrace stack) {
      unawaited(MobileTelemetryEngine.instance.captureAndReport(
        error,
        stack,
        source: 'platform_dispatcher',
        fatal: true,
      ));
      return true;
    };

    ErrorWidget.builder = (FlutterErrorDetails details) {
      unawaited(MobileTelemetryEngine.instance.captureAndReport(
        details.exception,
        details.stack ?? StackTrace.current,
        source: 'error_widget',
        fatal: false,
      ));
      return GracefulErrorFallback(details: details);
    };

    // Supabase ALWAYS initializes — production defaults baked in.
    // Override with --dart-define-from-file=dart_defines.env for local dev.
    await SupabaseService.initialize();
    SupabaseService.initDeepLinks();

    // Project Beacon-Recovery: Firebase + FCM pre-run initialization
    // Must run AFTER WidgetsFlutterBinding.ensureInitialized()
    // and BEFORE runApp so the background handler is registered in time.
    await Firebase.initializeApp();
    await FCMService.preRunInit();

    await RevenueCatService.instance.initialize();
    await BackgroundSyncService.instance.initialize();

    // Aegis-Citadel: Runtime Application Self-Protection
    // Detects root/jailbreak, debugger, emulator, tampering.
    // In debug mode, checks are disabled for development ergonomics.
    await RaspService.instance.initialize();

    // If a fatal RASP threat was detected, show security violation screen
    if (RaspService.instance.isThreatDetected) {
      runApp(RaspService.buildSecurityViolationScreen(
        RaspService.instance.threatReason ?? 'Device security compromised',
      ));
      return;
    }

    runApp(ProviderScope(
      observers: [TelemetryProviderObserver()],
      child: const IWorkrApp(),
    ));
  }, (Object error, StackTrace stackTrace) {
    unawaited(MobileTelemetryEngine.instance.captureAndReport(
      error,
      stackTrace,
      source: 'run_zoned_guarded',
      fatal: true,
    ));
  });
}

class IWorkrApp extends ConsumerStatefulWidget {
  const IWorkrApp({super.key});

  @override
  ConsumerState<IWorkrApp> createState() => _IWorkrAppState();
}

class _IWorkrAppState extends ConsumerState<IWorkrApp> with WidgetsBindingObserver {
  bool _bridgeInitialized = false;
  StreamSubscription<AuthState>? _authStateSub;
  StreamSubscription<String>? _pendingRouteSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    _authStateSub?.cancel();
    _pendingRouteSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _initBridgeIfNeeded() {
    if (_bridgeInitialized) return;
    _bridgeInitialized = true;
    final syncEngine = ref.read(syncEngineProvider);
    unawaited(syncEngine.drainQueue());
    MobileTelemetryEngine.instance.initialize(ref.read(appDatabaseProvider));
    MobileTelemetryEngine.instance.addBreadcrumb('App bootstrap complete');
    ref.read(nativeBridgeProvider).initialize();

    // Monolith-Execution: Rehydrate active workspace from secure storage
    unawaited(_rehydrateActiveWorkspace());

    _authStateSub?.cancel();
    _authStateSub = SupabaseService.auth.onAuthStateChange.listen((event) {
      final bridge = ref.read(nativeBridgeProvider);
      if (event.event == AuthChangeEvent.signedIn) {
        bridge.syncAll();
      } else if (event.event == AuthChangeEvent.signedOut) {
        bridge.clearAll();
      }
    });

    // Project Beacon-Recovery: Bind FCM token lifecycle to auth events
    // SIGNED_IN  → upsert device token for new user
    // SIGNED_OUT → purge token to prevent cross-account leaks
    FCMService.instance.bindToAuthStream();

    // Initialize push for the already-logged-in user (if any)
    if (SupabaseService.auth.currentUser != null) {
      unawaited(FCMService.instance.initialize());
    }

    // Check if app was cold-booted from a notification tap
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(FCMService.instance.checkInitialMessage());

      // Listen for deep-link routes dispatched by FCM payload router
      _pendingRouteSub?.cancel();
      _pendingRouteSub = FCMService.instance.pendingRouteStream.listen((path) {
        try {
          final router = ref.read(routerProvider);
          router.go(path);
        } catch (e) {
          MobileTelemetryEngine.instance.addBreadcrumb('[FCM] Router navigate failed: $e');
        }
      });
    });
  }

  Future<void> _rehydrateActiveWorkspace() async {
    try {
      final persisted = await restoreWorkspaceState();
      if (persisted != null && persisted.hasActiveShift) {
        ref.read(activeShiftStateProvider.notifier).state = persisted;
        ref.read(activeShiftTimeEntryIdProvider.notifier).state =
            persisted.timeEntryId;
        MobileTelemetryEngine.instance.addBreadcrumb(
            'Rehydrated active workspace: shift=${persisted.shiftId}');
      }
    } catch (e) {
      MobileTelemetryEngine.instance.addBreadcrumb(
          'Workspace rehydration failed: $e');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    MobileTelemetryEngine.instance.addBreadcrumb('Lifecycle state: $state');
    if (state == AppLifecycleState.resumed && _bridgeInitialized) {
      ref.read(nativeBridgeProvider).syncAll();
    }
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      BackgroundSyncService.instance.triggerImmediateSync();
      // Project Terminus: Persist workspace state + release S8 locks on app kill
      _persistAndReleaseLocks();
    }
    if (state == AppLifecycleState.detached) {
      // Final attempt — app is being killed by OS/user
      MobileTelemetryEngine.instance.addBreadcrumb('App detached — releasing locks');
      _persistAndReleaseLocks();
    }
  }

  /// Project Terminus: Serialize active shift state and release any zombie S8 locks
  void _persistAndReleaseLocks() {
    try {
      final shiftState = ref.read(activeShiftStateProvider);
      if (shiftState.hasActiveShift) {
        // Persist workspace state synchronously to SharedPreferences
        persistWorkspaceState(shiftState);
        MobileTelemetryEngine.instance.addBreadcrumb(
          'Persisted workspace state: shift=${shiftState.shiftId}',
        );
      }
      // Fire synchronous HTTP call to release any pending S8 medication locks
      _releaseS8Locks();
    } catch (e) {
      MobileTelemetryEngine.instance.addBreadcrumb(
        'Lifecycle cleanup failed: $e',
      );
    }
  }

  /// Calls the Supabase RPC to release zombie-locked S8 medication records
  Future<void> _releaseS8Locks() async {
    try {
      final user = SupabaseService.auth.currentUser;
      if (user == null) return;
      await SupabaseService.client.rpc('release_s8_medication_locks', params: {
        'p_user_id': user.id,
        'p_timeout_minutes': 15,
      });
      MobileTelemetryEngine.instance.addBreadcrumb('S8 locks released for ${user.id}');
    } catch (e) {
      MobileTelemetryEngine.instance.addBreadcrumb('S8 lock release failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final brandColor = ref.watch(brandColorProvider);
    final themeMode = ref.watch(themeProvider);

    _initBridgeIfNeeded();

    // Resolve effective brightness for AnnotatedRegion
    final platformBrightness = MediaQuery.platformBrightnessOf(context);
    final effectiveBrightness = switch (themeMode) {
      ThemeMode.light => Brightness.light,
      ThemeMode.dark => Brightness.dark,
      _ => platformBrightness,
    };
    final isDark = effectiveBrightness == Brightness.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
        systemNavigationBarColor:
            isDark ? const Color(0xFF050505) : const Color(0xFFF9FAFB),
        systemNavigationBarIconBrightness:
            isDark ? Brightness.light : Brightness.dark,
      ),
      child: MaterialApp.router(
        title: 'iWorkr',
        debugShowCheckedModeBanner: false,
        themeMode: themeMode,
        theme: ObsidianTheme.lightThemeWith(brandColor),
        darkTheme: ObsidianTheme.darkThemeWith(brandColor),
        routerConfig: router,
        builder: (context, child) {
          return RepaintBoundary(
            key: MobileTelemetryEngine.instance.repaintBoundaryKey,
            child: AuthCurtain(
              child: GestureDetector(
                onTap: () {
                  MobileTelemetryEngine.instance.addBreadcrumb('Tap to dismiss keyboard');
                  FocusManager.instance.primaryFocus?.unfocus();
                },
                behavior: HitTestBehavior.translucent,
                child: child ?? const SizedBox.shrink(),
              ),
            ),
          );
        },
      ),
    );
  }
}
