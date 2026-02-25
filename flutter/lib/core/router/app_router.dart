import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/auth/screens/login_screen.dart';
import 'package:iworkr_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:iworkr_mobile/features/inbox/screens/inbox_screen.dart';
import 'package:iworkr_mobile/features/jobs/screens/job_detail_screen.dart';
import 'package:iworkr_mobile/features/jobs/screens/jobs_screen.dart';
import 'package:iworkr_mobile/features/profile/screens/profile_screen.dart';
import 'package:iworkr_mobile/features/profile/screens/security_screen.dart';
import 'package:iworkr_mobile/features/profile/screens/settings_screen.dart';
import 'package:iworkr_mobile/features/schedule/screens/schedule_screen.dart';
import 'package:iworkr_mobile/features/chat/screens/channels_screen.dart';
import 'package:iworkr_mobile/features/chat/screens/chat_stream_screen.dart';
import 'package:iworkr_mobile/features/finance/screens/finance_screen.dart';
import 'package:iworkr_mobile/features/admin/screens/admin_dashboard_screen.dart';
import 'package:iworkr_mobile/features/admin/screens/user_management_screen.dart';
import 'package:iworkr_mobile/features/knowledge/screens/knowledge_screen.dart';
import 'package:iworkr_mobile/features/execution/screens/mission_hud_screen.dart';
import 'package:iworkr_mobile/features/routes/screens/route_screen.dart';
import 'package:iworkr_mobile/features/routes/screens/flight_path_screen.dart';
import 'package:iworkr_mobile/features/inventory/screens/inventory_screen.dart';
import 'package:iworkr_mobile/features/inventory/screens/transfer_search_screen.dart';
import 'package:iworkr_mobile/features/dispatch/screens/overwatch_screen.dart';
import 'package:iworkr_mobile/features/fleet/screens/fleet_command_screen.dart';
import 'package:iworkr_mobile/features/iot/screens/iot_telemetry_screen.dart';
import 'package:iworkr_mobile/features/ar/screens/ar_measure_screen.dart';
import 'package:iworkr_mobile/features/scout/screens/recon_screen.dart';
import 'package:iworkr_mobile/features/scout/screens/scout_results_screen.dart';
import 'package:iworkr_mobile/features/market/screens/market_index_screen.dart';
import 'package:iworkr_mobile/features/stealth/screens/stealth_demo_screen.dart';
import 'package:iworkr_mobile/features/workspace/screens/workspace_settings_screen.dart';
import 'package:iworkr_mobile/features/team/screens/team_roster_screen.dart';
import 'package:iworkr_mobile/features/organization/screens/org_settings_screen.dart';
import 'package:iworkr_mobile/features/onboarding/screens/onboarding_screen.dart';
import 'package:iworkr_mobile/features/onboarding/screens/invite_onboarding_screen.dart';
import 'package:iworkr_mobile/features/onboarding/screens/paywall_screen.dart';
import 'package:iworkr_mobile/features/hr/screens/time_clock_screen.dart';
import 'package:iworkr_mobile/features/hr/screens/leave_request_screen.dart';
import 'package:iworkr_mobile/features/assets/screens/asset_vault_screen.dart';
import 'package:iworkr_mobile/features/assets/screens/asset_detail_screen.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
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

  late final GoRouter router;
  router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final isLoggedIn = SupabaseService.auth.currentUser != null;
      final isOnLogin = state.matchedLocation == '/login';
      final isOnOnboarding = state.matchedLocation == '/onboarding';
      final isOnPaywall = state.matchedLocation == '/paywall';
      final isOnInvite = state.matchedLocation == '/accept-invite';

      if (!isLoggedIn && !isOnLogin && !isOnInvite) return '/login';
      if (isLoggedIn && isOnLogin) {
        // Check if onboarding is needed
        final profile = ref.read(profileProvider).valueOrNull;
        if (profile != null && !profile.onboardingCompleted) {
          final orgData = ref.read(organizationProvider).valueOrNull;
          if (orgData == null) return '/onboarding';
        }
        return '/';
      }

      // Allow onboarding, paywall, and invite routes
      if (isOnOnboarding || isOnPaywall || isOnInvite) return null;

      // Route guard: check clearance for restricted routes
      if (isLoggedIn) {
        final path = state.matchedLocation;
        for (final prefix in restrictedRoutePrefixes) {
          if (path.startsWith(prefix)) {
            final orgRow = ref.read(organizationProvider).valueOrNull;
            final roleStr = orgRow?['role'] as String? ?? 'technician';
            final role = UserRole.fromString(roleStr);
            final claims = claimsForRole(role);

            final requiredClaim = {
              '/finance': Claims.financeView,
              '/admin': Claims.adminView,
              '/fleet': Claims.fleetView,
              '/overwatch': Claims.dispatchView,
              '/team': Claims.adminUsers,
              '/organization': Claims.adminView,
            }.entries.firstWhere(
              (e) => path.startsWith(e.key),
              orElse: () => const MapEntry('', ''),
            );

            if (requiredClaim.value.isNotEmpty && !claims.contains(requiredClaim.value)) {
              return '/';
            }
            break;
          }
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const OnboardingScreen(),
          transitionsBuilder: _fadeTransition,
        ),
      ),
      GoRoute(
        path: '/paywall',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const PaywallScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/accept-invite',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final token = state.uri.queryParameters['token'] ?? '';
          return CustomTransitionPage(
            child: InviteOnboardingScreen(token: token),
            transitionsBuilder: _fadeTransition,
          );
        },
      ),

      // ── Deep Link Routes (workspace-scoped, no dock) ───────
      GoRoute(
        path: '/w/:workspaceId/jobs/:jobId',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final workspaceId = state.pathParameters['workspaceId']!;
          final jobId = state.pathParameters['jobId']!;
          ref.read(activeWorkspaceIdProvider.notifier).switchTo(workspaceId);
          return CustomTransitionPage(
            child: JobDetailScreen(jobId: jobId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/w/:workspaceId/finance/invoices/:invoiceId',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final workspaceId = state.pathParameters['workspaceId']!;
          final invoiceId = state.pathParameters['invoiceId']!;
          ref.read(activeWorkspaceIdProvider.notifier).switchTo(workspaceId);
          return CustomTransitionPage(
            child: FinanceScreen(invoiceId: invoiceId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/w/:workspaceId/schedule',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final workspaceId = state.pathParameters['workspaceId']!;
          ref.read(activeWorkspaceIdProvider.notifier).switchTo(workspaceId);
          return CustomTransitionPage(
            child: const ScheduleScreen(),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/w/:workspaceId/chat/:channelId',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final workspaceId = state.pathParameters['workspaceId']!;
          final channelId = state.pathParameters['channelId']!;
          ref.read(activeWorkspaceIdProvider.notifier).switchTo(workspaceId);
          return CustomTransitionPage(
            child: ChatStreamScreen(channelId: channelId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/w/:workspaceId/team',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final workspaceId = state.pathParameters['workspaceId']!;
          ref.read(activeWorkspaceIdProvider.notifier).switchTo(workspaceId);
          return CustomTransitionPage(
            child: const TeamRosterScreen(),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),

      // ── Shell Routes (Dock visible) ────────────────────────
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
            path: '/chat',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const ChannelsScreen(),
              transitionsBuilder: _fadeTransition,
            ),
            routes: [
              GoRoute(
                path: ':channelId',
                pageBuilder: (context, state) {
                  final channelId = state.pathParameters['channelId']!;
                  return CustomTransitionPage(
                    child: ChatStreamScreen(channelId: channelId),
                    transitionsBuilder: _slideUpTransition,
                  );
                },
              ),
            ],
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
            routes: [
              GoRoute(
                path: ':id',
                pageBuilder: (context, state) {
                  final jobId = state.pathParameters['id']!;
                  return CustomTransitionPage(
                    child: JobDetailScreen(jobId: jobId),
                    transitionsBuilder: _slideUpTransition,
                  );
                },
                routes: [
                  GoRoute(
                    path: 'execute',
                    pageBuilder: (context, state) {
                      final jobId = state.pathParameters['id']!;
                      return CustomTransitionPage(
                        child: JobHudScreen(jobId: jobId),
                        transitionsBuilder: _slideUpTransition,
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const ProfileScreen(),
              transitionsBuilder: _fadeTransition,
            ),
            routes: [
              GoRoute(
                path: 'settings',
                pageBuilder: (context, state) => CustomTransitionPage(
                  child: const SettingsScreen(),
                  transitionsBuilder: _slideUpTransition,
                ),
              ),
              GoRoute(
                path: 'security',
                pageBuilder: (context, state) => CustomTransitionPage(
                  child: const SecurityScreen(),
                  transitionsBuilder: _slideUpTransition,
                ),
              ),
              GoRoute(
                path: 'timeclock',
                pageBuilder: (context, state) => CustomTransitionPage(
                  child: const TimeClockScreen(),
                  transitionsBuilder: _slideUpTransition,
                ),
              ),
              GoRoute(
                path: 'leave',
                pageBuilder: (context, state) => CustomTransitionPage(
                  child: const LeaveRequestScreen(),
                  transitionsBuilder: _slideUpTransition,
                ),
              ),
            ],
          ),
        ],
      ),

      // ── Root Routes (Full-screen, no dock) ─────────────────
      GoRoute(
        path: '/finance',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FinanceScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/admin',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const AdminDashboardScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/admin/users',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const UserManagementScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/knowledge',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const KnowledgeScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/route',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const RouteScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/flight-path',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FlightPathScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/inventory',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const InventoryScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/inventory/transfer-search',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const TransferSearchScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/overwatch',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const OverwatchScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/fleet',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FleetCommandScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/iot',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const IoTTelemetryScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/ar',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ARMeasureScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/scout',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ReconScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/scout/results/:scanId',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final scanId = state.pathParameters['scanId']!;
          return CustomTransitionPage(
            child: ScoutResultsScreen(scanId: scanId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/market',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MarketIndexScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/assets',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const AssetVaultScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/assets/:id',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final assetId = state.pathParameters['id']!;
          return CustomTransitionPage(
            child: AssetDetailScreen(assetId: assetId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/stealth',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const StealthDemoScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/workspace/settings',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const WorkspaceSettingsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/team',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const TeamRosterScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/organization/settings',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const OrgSettingsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
    ],
  );

  // Wire widget deep link handler
  SupabaseService.onWidgetDeepLink = (path) {
    _handleWidgetRoute(router, path);
  };

  // Handle any pending cold-start widget deep link
  if (SupabaseService.pendingWidgetDeepLink != null) {
    final pending = SupabaseService.pendingWidgetDeepLink!;
    SupabaseService.pendingWidgetDeepLink = null;
    Future.microtask(() => _handleWidgetRoute(router, pending));
  }

  return router;
});

void _handleWidgetRoute(GoRouter router, String path) {
  // iworkr://job/JOB-882 → /job/JOB-882
  // iworkr://job/JOB-882/execute → /jobs/JOB-882 (then start execution)
  // iworkr://finance/dashboard → /finance
  // iworkr://auth/login → /login
  // iworkr://widget/dashboard → /

  if (path.startsWith('/job/')) {
    final jobId = path.replaceFirst('/job/', '').replaceAll('/execute', '');
    router.go('/jobs/$jobId');
  } else if (path.startsWith('/finance')) {
    router.go('/finance');
  } else if (path.startsWith('/auth/login')) {
    router.go('/login');
  } else {
    router.go('/');
  }
}

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
