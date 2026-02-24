import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/router/app_router.dart';
import 'package:iworkr_mobile/core/services/brand_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/auth_curtain.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Force dark status bar
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFF050505),
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  // Initialize Supabase
  await SupabaseService.initialize();

  // Listen for auth deep links (magic link / OAuth callbacks)
  SupabaseService.initDeepLinks();

  runApp(const ProviderScope(child: IWorkrApp()));
}

class IWorkrApp extends ConsumerWidget {
  const IWorkrApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final brandColor = ref.watch(brandColorProvider);

    return MaterialApp.router(
      title: 'iWorkr',
      debugShowCheckedModeBanner: false,
      theme: ObsidianTheme.darkThemeWith(brandColor),
      routerConfig: router,
      builder: (context, child) {
        // Global tap-to-dismiss keyboard — tapping outside any text field
        // unfocuses it and closes the keyboard on every screen.
        return AuthCurtain(
          child: GestureDetector(
            onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
            behavior: HitTestBehavior.translucent,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
