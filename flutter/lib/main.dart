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

  try {
    await SupabaseService.initialize();
    SupabaseService.initDeepLinks();
  } catch (e) {
    // Show a helpful config error screen instead of crashing
    runApp(_ConfigErrorApp(error: e.toString()));
    return;
  }

  await RevenueCatService.instance.initialize();
  await BackgroundSyncService.instance.initialize();

  runApp(const ProviderScope(child: IWorkrApp()));
}

/// Shown when the app can't start due to missing configuration.
class _ConfigErrorApp extends StatelessWidget {
  final String error;
  const _ConfigErrorApp({required this.error});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF050505),
      ),
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFF43F5E).withValues(alpha: 0.1),
                    border: Border.all(
                      color: const Color(0xFFF43F5E).withValues(alpha: 0.2),
                    ),
                  ),
                  child: const Icon(
                    Icons.settings_outlined,
                    color: Color(0xFFF43F5E),
                    size: 32,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Configuration Required',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  error,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: Colors.white.withValues(alpha: 0.04),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HOW TO FIX',
                        style: TextStyle(
                          color: const Color(0xFF10B981),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _step('1', 'Start local Supabase:', 'supabase start'),
                      const SizedBox(height: 8),
                      _step('2', 'Run with dart-defines:', 'flutter run --dart-define-from-file=dart_defines.env'),
                      const SizedBox(height: 12),
                      Text(
                        'Edit dart_defines.env with your Supabase URL and anon key.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.35),
                          fontSize: 11,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _step(String num, String label, String code) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 18,
          height: 18,
          margin: const EdgeInsets.only(top: 1),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(5),
            color: Colors.white.withValues(alpha: 0.06),
          ),
          child: Center(
            child: Text(
              num,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.4),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5),
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: Colors.white.withValues(alpha: 0.04),
                ),
                child: Text(
                  code,
                  style: const TextStyle(
                    fontFamily: 'JetBrains Mono',
                    color: Color(0xFF10B981),
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
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
