import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

/// Subscription data model
class SubscriptionInfo {
  final String planKey;
  final String status;
  final DateTime? periodEnd;
  final bool cancelAtPeriodEnd;
  final String? polarSubscriptionId;

  const SubscriptionInfo({
    required this.planKey,
    required this.status,
    this.periodEnd,
    this.cancelAtPeriodEnd = false,
    this.polarSubscriptionId,
  });

  bool get isPro => planKey == 'pro' || planKey == 'business';
  bool get isActive => status == 'active' || status == 'trialing';
  bool get isCanceling => cancelAtPeriodEnd;

  factory SubscriptionInfo.free() {
    return const SubscriptionInfo(planKey: 'starter', status: 'free');
  }

  factory SubscriptionInfo.fromJson(Map<String, dynamic> json) {
    return SubscriptionInfo(
      planKey: json['plan_key'] as String? ?? 'starter',
      status: json['status'] as String? ?? 'incomplete',
      periodEnd: json['current_period_end'] != null
          ? DateTime.tryParse(json['current_period_end'] as String)
          : null,
      cancelAtPeriodEnd: json['cancel_at_period_end'] as bool? ?? false,
      polarSubscriptionId: json['polar_subscription_id'] as String?,
    );
  }
}

/// Fetch subscription for the current user's organization
final subscriptionProvider = FutureProvider<SubscriptionInfo>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return SubscriptionInfo.free();

  try {
    final data = await SupabaseService.client
        .from('subscriptions')
        .select()
        .eq('organization_id', orgId)
        .inFilter('status', ['active', 'trialing', 'past_due'])
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();

    if (data == null) return SubscriptionInfo.free();
    return SubscriptionInfo.fromJson(data);
  } catch (_) {
    return SubscriptionInfo.free();
  }
});

/// Quick boolean: is the current workspace on a Pro plan?
final isProProvider = FutureProvider<bool>((ref) async {
  final sub = await ref.watch(subscriptionProvider.future);
  return sub.isPro && sub.isActive;
});

/// Features gated behind Pro
abstract class ProFeatures {
  static const fleetMap = 'fleet_map';
  static const aiScout = 'ai_scout';
  static const marketIndex = 'market_index';
  static const unlimitedJobs = 'unlimited_jobs';
  static const advancedRoutes = 'advanced_routes';
  static const iotTelemetry = 'iot_telemetry';
  static const arMeasure = 'ar_measure';

  static const all = {
    fleetMap,
    aiScout,
    marketIndex,
    unlimitedJobs,
    advancedRoutes,
    iotTelemetry,
    arMeasure,
  };
}

/// Seat count for the organization
final seatCountProvider = FutureProvider<int>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return 0;

  try {
    final data = await SupabaseService.client
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'active');

    return (data as List).length;
  } catch (_) {
    return 0;
  }
});
