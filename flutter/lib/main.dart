import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/router/app_router.dart';
import 'package:iworkr_mobile/core/services/brand_provider.dart';
import 'package:iworkr_mobile/core/services/native_bridge_service.dart';
import 'package:iworkr_mobile/core/services/background_sync_service.dart';
import 'package:iworkr_mobile/core/services/revenuecat_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/theme_provider.dart';
import 'package:iworkr_mobile/core/widgets/auth_curtain.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Default to dark chrome — will be updated dynamically by AnnotatedRegion
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFF050505),
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  await SupabaseService.initialize();
  SupabaseService.initDeepLinks();

  await RevenueCatService.instance.initialize();
  await BackgroundSyncService.instance.initialize();

  runApp(const ProviderScope(child: IWorkrApp()));
}

class IWorkrApp extends ConsumerStatefulWidget {
  const IWorkrApp({super.key});

  @override
  ConsumerState<IWorkrApp> createState() => _IWorkrAppState();
}

class _IWorkrAppState extends ConsumerState<IWorkrApp> with WidgetsBindingObserver {
  bool _bridgeInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _initBridgeIfNeeded() {
    if (_bridgeInitialized) return;
    _bridgeInitialized = true;
    ref.read(nativeBridgeProvider).initialize();

    SupabaseService.auth.onAuthStateChange.listen((event) {
      final bridge = ref.read(nativeBridgeProvider);
      if (event.event == AuthChangeEvent.signedIn) {
        bridge.syncAll();
      } else if (event.event == AuthChangeEvent.signedOut) {
        bridge.clearAll();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _bridgeInitialized) {
      ref.read(nativeBridgeProvider).syncAll();
    }
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      BackgroundSyncService.instance.triggerImmediateSync();
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
            isDark ? const Color(0xFF050505) : const Color(0xFFFAFAFA),
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
          return AuthCurtain(
            child: GestureDetector(
              onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
              behavior: HitTestBehavior.translucent,
              child: child ?? const SizedBox.shrink(),
            ),
          );
        },
      ),
    );
  }
}
