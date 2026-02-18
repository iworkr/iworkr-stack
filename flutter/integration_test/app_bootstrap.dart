import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iworkr_mobile/core/router/app_router.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/auth_curtain.dart';

import 'robots/login_robot.dart';
import 'robots/dashboard_robot.dart';
import 'config/test_config.dart';
import 'utils/test_logger.dart';

bool _supabaseInitialized = false;

Future<void> bootstrapApp(WidgetTester tester) async {
  TestLogger.step('Bootstrapping app');

  if (!_supabaseInitialized) {
    try {
      await SupabaseService.initialize();
      _supabaseInitialized = true;
      TestLogger.info('Supabase initialized');
    } catch (e) {
      TestLogger.warn('Supabase init skipped (may already be initialized): $e');
      _supabaseInitialized = true;
    }
  }

  await tester.pumpWidget(
    const ProviderScope(child: _TestApp()),
  );

  await tester.pumpAndSettle(const Duration(seconds: 3));
  TestLogger.pass('App bootstrapped');
}

Future<void> bootstrapAndLogin(WidgetTester tester) async {
  await bootstrapApp(tester);

  final isLoggedIn = SupabaseService.auth.currentUser != null;
  if (isLoggedIn) {
    TestLogger.info('Already authenticated — skipping login');
    final dashboard = DashboardRobot(tester);
    await dashboard.expectDashboardLoaded();
    return;
  }

  TestLogger.step('Performing login for test setup');
  final login = LoginRobot(tester);
  await login.expectLoginScreenVisible();
  await login.loginWithEmail(TestConfig.testEmail, TestConfig.testPassword);

  final dashboard = DashboardRobot(tester);
  try {
    await dashboard.expectDashboardLoaded();
  } catch (_) {
    TestLogger.warn('Dashboard not immediately loaded — waiting extra');
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  }
}

class _TestApp extends ConsumerWidget {
  const _TestApp();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'iWorkr QA',
      debugShowCheckedModeBanner: false,
      theme: ObsidianTheme.darkTheme,
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
    );
  }
}
