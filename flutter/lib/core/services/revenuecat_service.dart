import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── RevenueCat Service — Native IAP Singleton ────────────
// ═══════════════════════════════════════════════════════════
//
// Manages RevenueCat SDK lifecycle. The appUserID is bound to
// the workspace_id so that subscriptions apply to the entire
// business, not individual users.

const _kRcAppleKey = String.fromEnvironment(
  'REVENUECAT_APPLE_KEY',
  defaultValue: '',
);
const _kRcGoogleKey = String.fromEnvironment(
  'REVENUECAT_GOOGLE_KEY',
  defaultValue: '',
);

class RevenueCatService {
  RevenueCatService._();
  static final instance = RevenueCatService._();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    final apiKey = Platform.isIOS ? _kRcAppleKey : _kRcGoogleKey;

    final config = PurchasesConfiguration(apiKey)
      ..appUserID = null;

    await Purchases.configure(config);

    if (kDebugMode) {
      await Purchases.setLogLevel(LogLevel.debug);
    }

    _initialized = true;
  }

  /// Bind RevenueCat identity to the active workspace.
  Future<void> identifyWorkspace(String workspaceId) async {
    if (!_initialized) return;

    try {
      final info = await Purchases.getCustomerInfo();
      if (info.originalAppUserId != workspaceId) {
        await Purchases.logIn(workspaceId);
      }
    } catch (e) {
      debugPrint('[RevenueCat] Identity bind failed: $e');
    }
  }

  /// Fetch the current offering (contains pricing from App Store Connect).
  Future<Offering?> fetchCurrentOffering() async {
    if (!_initialized) return null;

    try {
      final offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (e) {
      debugPrint('[RevenueCat] Offerings fetch failed: $e');
      return null;
    }
  }

  /// Purchase a package (triggers native FaceID/biometric payment sheet).
  Future<bool> purchase(Package package) async {
    try {
      // ignore: deprecated_member_use
      await Purchases.purchasePackage(package);
      return true;
    } on PurchasesErrorCode catch (e) {
      if (e == PurchasesErrorCode.purchaseCancelledError) return false;
      rethrow;
    }
  }

  /// Restore purchases (required for App Store compliance).
  Future<CustomerInfo> restorePurchases() async {
    return Purchases.restorePurchases();
  }

  /// Check if the user has an active entitlement.
  Future<bool> hasActiveEntitlement(String entitlementId) async {
    if (!_initialized) return false;
    try {
      final info = await Purchases.getCustomerInfo();
      return info.entitlements.active.containsKey(entitlementId);
    } catch (_) {
      return false;
    }
  }

  /// Get the customer info for checking entitlements.
  Future<CustomerInfo?> getCustomerInfo() async {
    if (!_initialized) return null;
    try {
      return await Purchases.getCustomerInfo();
    } catch (_) {
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ── Riverpod Providers ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Current RevenueCat offering (prices pulled from App Store Connect).
final rcOfferingProvider = FutureProvider<Offering?>((ref) async {
  return RevenueCatService.instance.fetchCurrentOffering();
});

/// The billing provider for the active workspace ('free', 'stripe', 'apple', 'google').
final billingProviderProvider = FutureProvider<String>((ref) async {
  final orgId = ref.watch(activeWorkspaceIdProvider);
  if (orgId == null) return 'free';

  try {
    final data = await SupabaseService.client
        .from('organizations')
        .select('billing_provider')
        .eq('id', orgId)
        .single();
    return (data['billing_provider'] as String?) ?? 'free';
  } catch (_) {
    return 'free';
  }
});

/// Whether the workspace is billed through Stripe (web-managed).
/// If true, the IAP paywall must NOT be shown.
final isBilledViaStripeProvider = Provider<bool>((ref) {
  final provider = ref.watch(billingProviderProvider).valueOrNull ?? 'free';
  return provider == 'stripe';
});
