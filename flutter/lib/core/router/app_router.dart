import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/auth/screens/login_screen.dart';
import 'package:iworkr_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:iworkr_mobile/features/inbox/screens/inbox_screen.dart';
import 'package:iworkr_mobile/features/jobs/screens/job_detail_screen.dart';
import 'package:iworkr_mobile/features/jobs/screens/jobs_screen.dart';
import 'package:iworkr_mobile/features/profile/screens/profile_screen.dart';
import 'package:iworkr_mobile/features/profile/screens/security_screen.dart';
import 'package:iworkr_mobile/features/schedule/screens/schedule_screen.dart';
import 'package:iworkr_mobile/core/widgets/shell_scaffold.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// Listenable that notifies GoRouter when auth state changes
class AuthStateNotifier extends ChangeNotifier {
  AuthStateNotifier() {
    SupabaseService.auth.onAuthStateChange.listen((data) {
      notifyListeners();
    });
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = AuthStateNotifier();

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final isLoggedIn = SupabaseService.auth.currentUser != null;
      final isOnLogin = state.matchedLocation == '/login';

      if (!isLoggedIn && !isOnLogin) return '/login';
      if (isLoggedIn && isOnLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => ShellScaffold(child: child),
        routes: [
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const DashboardScreen(),
              transitionsBuilder: _fadeTransition,
            ),
          ),
          GoRoute(
            path: '/inbox',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const InboxScreen(),
              transitionsBuilder: _fadeTransition,
            ),
          ),
          GoRoute(
            path: '/schedule',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const ScheduleScreen(),
              transitionsBuilder: _fadeTransition,
            ),
          ),
          GoRoute(
            path: '/jobs',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const JobsScreen(),
              transitionsBuilder: _fadeTransition,
            ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const ProfileScreen(),
              transitionsBuilder: _fadeTransition,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/profile/security',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const SecurityScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/jobs/:id',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final jobId = state.pathParameters['id']!;
          return CustomTransitionPage(
            child: JobDetailScreen(jobId: jobId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
    ],
  );
});

Widget _fadeTransition(
  BuildContext context,
  Animation<double> animation,
  Animation<double> secondaryAnimation,
  Widget child,
) {
  return FadeTransition(opacity: animation, child: child);
}

Widget _slideUpTransition(
  BuildContext context,
  Animation<double> animation,
  Animation<double> secondaryAnimation,
  Widget child,
) {
  final tween = Tween(begin: const Offset(0, 0.05), end: Offset.zero)
      .chain(CurveTween(curve: Curves.easeOutQuart));
  return SlideTransition(
    position: animation.drive(tween),
    child: FadeTransition(opacity: animation, child: child),
  );
}
