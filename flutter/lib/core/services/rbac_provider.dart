import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Clearance Levels ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Maps to the `org_role` enum in Supabase.
enum UserRole {
  owner,
  admin,
  manager,
  seniorTech,
  technician,
  apprentice,
  subcontractor,
  officeAdmin;

  static UserRole fromString(String s) {
    switch (s) {
      case 'owner':
        return UserRole.owner;
      case 'admin':
        return UserRole.admin;
      case 'manager':
        return UserRole.manager;
      case 'senior_tech':
        return UserRole.seniorTech;
      case 'technician':
        return UserRole.technician;
      case 'apprentice':
        return UserRole.apprentice;
      case 'subcontractor':
        return UserRole.subcontractor;
      case 'office_admin':
        return UserRole.officeAdmin;
      default:
        return UserRole.technician;
    }
  }

  /// Numeric clearance level (higher = more access)
  int get clearanceLevel {
    switch (this) {
      case UserRole.owner:
        return 5;
      case UserRole.admin:
        return 5;
      case UserRole.manager:
        return 3;
      case UserRole.officeAdmin:
        return 3;
      case UserRole.seniorTech:
        return 2;
      case UserRole.technician:
        return 1;
      case UserRole.apprentice:
        return 1;
      case UserRole.subcontractor:
        return 1;
    }
  }

  String get label {
    switch (this) {
      case UserRole.owner:
        return 'Owner';
      case UserRole.admin:
        return 'Admin';
      case UserRole.manager:
        return 'Manager';
      case UserRole.officeAdmin:
        return 'Office Admin';
      case UserRole.seniorTech:
        return 'Senior Tech';
      case UserRole.technician:
        return 'Technician';
      case UserRole.apprentice:
        return 'Apprentice';
      case UserRole.subcontractor:
        return 'Subcontractor';
    }
  }

  bool get isGodMode => clearanceLevel >= 5;
  bool get isManager => clearanceLevel >= 3;
  bool get isOperator => clearanceLevel <= 2;
}

// ═══════════════════════════════════════════════════════════
// ── Permission Claims ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

abstract class Claims {
  // Finance
  static const financeView = 'finance.view';
  static const financeManage = 'finance.manage';

  // Admin
  static const adminView = 'admin.view';
  static const adminUsers = 'admin.users';
  static const adminBilling = 'admin.billing';
  static const adminIntegrations = 'admin.integrations';

  // Fleet & Dispatch
  static const fleetView = 'fleet.view';
  static const dispatchView = 'dispatch.view';

  // Inventory
  static const inventoryCost = 'inventory.cost';

  // Jobs
  static const jobsAll = 'jobs.all';
  static const jobsAssigned = 'jobs.assigned';

  // Quotes
  static const quoteApprove = 'quote.approve';
}

/// Returns the set of permission claims for a [UserRole].
Set<String> claimsForRole(UserRole role) {
  switch (role) {
    case UserRole.owner:
    case UserRole.admin:
      return {
        Claims.financeView,
        Claims.financeManage,
        Claims.adminView,
        Claims.adminUsers,
        Claims.adminBilling,
        Claims.adminIntegrations,
        Claims.fleetView,
        Claims.dispatchView,
        Claims.inventoryCost,
        Claims.jobsAll,
        Claims.quoteApprove,
      };
    case UserRole.manager:
    case UserRole.officeAdmin:
      return {
        Claims.financeView,
        Claims.adminView,
        Claims.fleetView,
        Claims.dispatchView,
        Claims.inventoryCost,
        Claims.jobsAll,
        Claims.quoteApprove,
      };
    case UserRole.seniorTech:
      return {
        Claims.inventoryCost,
        Claims.jobsAll,
      };
    case UserRole.technician:
    case UserRole.apprentice:
    case UserRole.subcontractor:
      return {
        Claims.jobsAssigned,
      };
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Current user's role — derived from organization_members
final userRoleProvider = FutureProvider<UserRole>((ref) async {
  final orgData = await ref.watch(organizationProvider.future);
  final roleStr = orgData?['role'] as String? ?? 'technician';
  return UserRole.fromString(roleStr);
});

/// Current user's permission claims
final userClaimsProvider = FutureProvider<Set<String>>((ref) async {
  final role = await ref.watch(userRoleProvider.future);
  return claimsForRole(role);
});

/// Check a single claim
final hasClaimProvider = FutureProvider.family<bool, String>((ref, claim) async {
  final claims = await ref.watch(userClaimsProvider.future);
  return claims.contains(claim);
});

/// Restricted routes that require specific claims
const _routeClaimMap = <String, String>{
  '/finance': Claims.financeView,
  '/admin': Claims.adminView,
  '/admin/users': Claims.adminUsers,
  '/fleet': Claims.fleetView,
  '/overwatch': Claims.dispatchView,
  '/team': Claims.adminUsers,
  '/organization': Claims.adminView,
};

/// Check if a route is allowed for the current user
Future<bool> isRouteAllowed(WidgetRef ref, String path) async {
  final claims = await ref.read(userClaimsProvider.future);

  for (final entry in _routeClaimMap.entries) {
    if (path.startsWith(entry.key)) {
      return claims.contains(entry.value);
    }
  }
  return true; // Routes not in the map are unrestricted
}

/// The list of routes that require higher clearance
Set<String> get restrictedRoutePrefixes => _routeClaimMap.keys.toSet();

// ═══════════════════════════════════════════════════════════
// ── PermissionGuard Widget ───────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Wraps sensitive UI — renders [child] only if the user has [claim].
/// Otherwise renders [fallback] (default: nothing).
class PermissionGuard extends ConsumerWidget {
  final String claim;
  final Widget child;
  final Widget? fallback;

  const PermissionGuard({
    super.key,
    required this.claim,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final claimsAsync = ref.watch(userClaimsProvider);

    return claimsAsync.when(
      data: (claims) {
        if (claims.contains(claim)) return child;
        return fallback ?? const SizedBox.shrink();
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => fallback ?? const SizedBox.shrink(),
    );
  }
}

/// Wraps UI that should only be visible at a minimum clearance level.
class ClearanceGuard extends ConsumerWidget {
  final int minLevel;
  final Widget child;
  final Widget? fallback;

  const ClearanceGuard({
    super.key,
    required this.minLevel,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roleAsync = ref.watch(userRoleProvider);

    return roleAsync.when(
      data: (role) {
        if (role.clearanceLevel >= minLevel) return child;
        return fallback ?? const SizedBox.shrink();
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => fallback ?? const SizedBox.shrink(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Clearance Toast ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Shows a "Clearance Level Insufficient" toast when a restricted route is blocked.
void showClearanceDeniedToast(BuildContext context) {
  HapticFeedback.heavyImpact();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          const Icon(PhosphorIconsBold.lockSimple, size: 16, color: Colors.white),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Clearance Level Insufficient',
              style: GoogleFonts.jetBrainsMono(
                color: Colors.white,
                fontSize: 12,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: ObsidianTheme.rose.withValues(alpha: 0.9),
      duration: const Duration(seconds: 3),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 80),
    ),
  );
}

/// Navigate to a route only if the user has the required clearance.
/// Shows the denial toast if blocked.
void guardedPush(BuildContext context, WidgetRef ref, String path) {
  final claims = ref.read(userClaimsProvider).valueOrNull ?? <String>{};

  String? requiredClaim;
  for (final entry in const {
    '/finance': Claims.financeView,
    '/admin': Claims.adminView,
    '/fleet': Claims.fleetView,
    '/overwatch': Claims.dispatchView,
    '/team': Claims.adminUsers,
    '/organization': Claims.adminView,
  }.entries) {
    if (path.startsWith(entry.key)) {
      requiredClaim = entry.value;
      break;
    }
  }

  if (requiredClaim != null && !claims.contains(requiredClaim)) {
    showClearanceDeniedToast(context);
    return;
  }

  GoRouter.of(context).push(path);
}
