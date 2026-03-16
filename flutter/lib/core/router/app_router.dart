import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/mobile_telemetry_engine.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/services/industry_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/auth/screens/login_screen.dart';
import 'package:iworkr_mobile/features/auth/screens/security_lock_screen.dart';
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
import 'package:iworkr_mobile/features/workspace/screens/create_workspace_screen.dart';
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
import 'package:iworkr_mobile/features/care/screens/budget_dashboard_screen.dart';
import 'package:iworkr_mobile/features/care/screens/care_hub_screen.dart';
import 'package:iworkr_mobile/features/care/screens/care_plans_screen.dart';
import 'package:iworkr_mobile/features/care/screens/credentials_screen.dart';
import 'package:iworkr_mobile/features/care/screens/medications_screen.dart';
import 'package:iworkr_mobile/features/care/screens/incident_detail_screen.dart';
import 'package:iworkr_mobile/features/care/screens/incidents_screen.dart';
import 'package:iworkr_mobile/features/care/screens/observations_screen.dart';
import 'package:iworkr_mobile/features/care/screens/progress_notes_screen.dart';
import 'package:iworkr_mobile/features/care/screens/sentinel_screen.dart';
import 'package:iworkr_mobile/features/care/screens/my_shifts_screen.dart';
import 'package:iworkr_mobile/features/care/screens/shift_detail_screen.dart';
import 'package:iworkr_mobile/features/care/screens/shift_debrief_screen.dart';
import 'package:iworkr_mobile/features/care/screens/shift_travel_screen.dart';
import 'package:iworkr_mobile/features/care/screens/shift_wallet_screen.dart';
import 'package:iworkr_mobile/features/care/screens/create_incident_screen.dart';
import 'package:iworkr_mobile/features/care/screens/record_observation_screen.dart';
import 'package:iworkr_mobile/features/care/screens/worker_timesheets_screen.dart';
import 'package:iworkr_mobile/features/care/screens/worker_credentials_screen.dart';
import 'package:iworkr_mobile/features/care/screens/shift_routines_screen.dart';
import 'package:iworkr_mobile/features/care/screens/policy_gate_screen.dart';
import 'package:iworkr_mobile/features/care/screens/fleet_checkout_screen.dart';
import 'package:iworkr_mobile/features/care/screens/participants_screen.dart';
import 'package:iworkr_mobile/features/care/screens/participant_profile_screen.dart';
import 'package:iworkr_mobile/features/care/screens/active_workspace_screen.dart';
import 'package:iworkr_mobile/features/notifications/screens/notification_center_screen.dart';
import 'package:iworkr_mobile/features/portal/screens/family_portal_screen.dart';
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
    observers: [TelemetryNavigatorObserver()],
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final isLoggedIn = SupabaseService.auth.currentUser != null;
      final isOnLogin = state.matchedLocation == '/login';
      final isOnOnboarding = state.matchedLocation == '/onboarding';
      final isOnPaywall = state.matchedLocation == '/paywall';
      final isOnInvite = state.matchedLocation == '/accept-invite';
      final isOnPortal = state.matchedLocation.startsWith('/portal');

      if (!isLoggedIn && !isOnLogin && !isOnInvite) return '/login';
      if (isLoggedIn && isOnLogin) {
        final hasPortalAccess = ref.read(portalAccessProvider).valueOrNull ?? false;
        final orgData = ref.read(organizationProvider).valueOrNull;
        if (hasPortalAccess && orgData == null) {
          return '/portal';
        }
        // Check if onboarding is needed
        final profile = ref.read(profileProvider).valueOrNull;
        if (profile != null && !profile.onboardingCompleted) {
          if (orgData == null) return '/onboarding';
        }
        return '/';
      }

      // Allow onboarding, paywall, and invite routes
      if (isOnOnboarding || isOnPaywall || isOnInvite) return null;

      // Monolith-Execution: Lock user in active workspace if shift is active
      if (isLoggedIn) {
        final shiftState = ref.read(activeShiftStateProvider);
        final isOnActiveWorkspace =
            state.matchedLocation == '/active-workspace';
        // Routes that should be accessible FROM the active workspace
        final isWorkspaceChildRoute =
            state.matchedLocation.startsWith('/care/') ||
                state.matchedLocation.startsWith('/participants/');

        if (shiftState.hasActiveShift &&
            !isOnActiveWorkspace &&
            !isWorkspaceChildRoute) {
          return '/active-workspace';
        }
      }

      // Route guard: check clearance for restricted routes
      if (isLoggedIn) {
        final hasPortalAccess = ref.read(portalAccessProvider).valueOrNull ?? false;
        final orgData = ref.read(organizationProvider).valueOrNull;

        if (hasPortalAccess && orgData == null && !isOnPortal) {
          return '/portal';
        }
        if (!hasPortalAccess && isOnPortal) {
          return '/';
        }

        final path = state.matchedLocation;

        // ── Project Aegis: Role-based route enforcement ──
        // Use the synchronous currentRoleProvider for immediate decisions.
        final role = ref.read(currentRoleProvider);
        final claims = ref.read(currentClaimsProvider);

        // Already on the lock screen — don't redirect again
        if (path == '/security-lock') return null;

        // Check restricted route prefixes against user's claims
        for (final prefix in restrictedRoutePrefixes) {
          if (path.startsWith(prefix)) {
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
              return '/security-lock';
            }
            break;
          }
        }

        // Workers (operator-level) trying to access admin-only full-screen routes
        if (role.isOperator) {
          const workerBlockedPrefixes = [
            '/finance',
            '/admin',
            '/fleet',
            '/overwatch',
            '/organization',
          ];
          for (final blocked in workerBlockedPrefixes) {
            if (path.startsWith(blocked)) {
              return '/security-lock';
            }
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
      GoRoute(
        path: '/portal',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FamilyPortalScreen(),
          transitionsBuilder: _fadeTransition,
        ),
      ),

      // ── Project Aegis: Security Lock (RBAC denied) ─────────
      GoRoute(
        path: '/security-lock',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const SecurityLockScreen(),
          transitionsBuilder: _fadeTransition,
        ),
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
            pageBuilder: (context, state) {
              final isCare = ref.read(isCareProvider);
              return CustomTransitionPage(
                child: isCare ? const MyShiftsScreen() : const ScheduleScreen(),
                transitionsBuilder: _fadeTransition,
              );
            },
          ),
          GoRoute(
            path: '/participants',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const ParticipantsScreen(),
              transitionsBuilder: _fadeTransition,
            ),
            routes: [
              GoRoute(
                path: ':participantId',
                pageBuilder: (context, state) {
                  final participantId = state.pathParameters['participantId']!;
                  return CustomTransitionPage(
                    child: ParticipantProfileScreen(participantId: participantId),
                    transitionsBuilder: _slideUpTransition,
                  );
                },
              ),
            ],
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

      // ── Active Workspace (Monolith-Execution: No dock, locked HUD) ─
      GoRoute(
        path: '/active-workspace',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ActiveWorkspaceScreen(),
          transitionsBuilder: _fadeTransition,
        ),
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
      // ── Care Sector Routes (Project Nightingale) ────────
      GoRoute(
        path: '/care',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CareHubScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/credentials',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CredentialsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/medications',
        parentNavigatorKey: _rootNavigatorKey,
            pageBuilder: (context, state) {
              final participantId = state.uri.queryParameters['participant_id'];
              final shiftId = state.uri.queryParameters['shift_id'];
              return CustomTransitionPage(
                child: MedicationsScreen(
                  participantId: participantId,
                  shiftId: shiftId,
                ),
                transitionsBuilder: _slideUpTransition,
              );
            },
      ),
      GoRoute(
        path: '/care/incidents',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const IncidentsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/incidents/:incidentId',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final incidentId = state.pathParameters['incidentId']!;
          return CustomTransitionPage(
            child: IncidentDetailScreen(incidentId: incidentId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/observations',
        parentNavigatorKey: _rootNavigatorKey,
            pageBuilder: (context, state) {
              final participantId = state.uri.queryParameters['participant_id'];
              return CustomTransitionPage(
                child: ObservationsScreen(participantId: participantId),
                transitionsBuilder: _slideUpTransition,
              );
            },
      ),
      GoRoute(
        path: '/care/progress-notes',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ProgressNotesScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      // ── Phase 3 & 4: Care Plans, Sentinel, Budget ─────────
      GoRoute(
        path: '/care/plans',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CarePlansScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/sentinel',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const SentinelScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/budget',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const BudgetDashboardScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/governance/policies',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const PolicyGateScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      // ── Field Operative Routes (Support Worker Mobile) ─────
      GoRoute(
        path: '/care/my-shifts',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MyShiftsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/shift/:shiftId',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final shiftId = state.pathParameters['shiftId']!;
          return CustomTransitionPage(
            child: ShiftDetailScreen(shiftId: shiftId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/shift/:shiftId/debrief',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final shiftId = state.pathParameters['shiftId']!;
          return CustomTransitionPage(
            child: ShiftDebriefScreen(shiftId: shiftId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/shift/:shiftId/travel',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final shiftId = state.pathParameters['shiftId']!;
          final mode = state.uri.queryParameters['mode'] ?? 'provider';
          return CustomTransitionPage(
            child: ShiftTravelScreen(shiftId: shiftId, mode: mode),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/shift/:shiftId/wallets',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final shiftId = state.pathParameters['shiftId']!;
          return CustomTransitionPage(
            child: ShiftWalletScreen(shiftId: shiftId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/shift/:shiftId/routines',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final shiftId = state.pathParameters['shiftId']!;
          return CustomTransitionPage(
            child: ShiftRoutinesScreen(shiftId: shiftId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/shift/:shiftId/vehicle-checkout',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final shiftId = state.pathParameters['shiftId']!;
          return CustomTransitionPage(
            child: FleetCheckoutScreen(shiftId: shiftId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/incidents/new',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CreateIncidentScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/observations/record',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final participantId = state.uri.queryParameters['participant_id'];
          if (participantId == null || participantId.isEmpty) {
            return CustomTransitionPage(
              child: const ObservationsScreen(),
              transitionsBuilder: _slideUpTransition,
            );
          }
          return CustomTransitionPage(
            child: RecordObservationScreen(participantId: participantId),
            transitionsBuilder: _slideUpTransition,
          );
        },
      ),
      GoRoute(
        path: '/care/timesheets',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const WorkerTimesheetsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/care/my-credentials',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const WorkerCredentialsScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
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
        path: '/notifications',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const NotificationCenterScreen(),
          transitionsBuilder: _slideUpTransition,
        ),
      ),
      GoRoute(
        path: '/workspace/create',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CreateWorkspaceScreen(),
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
