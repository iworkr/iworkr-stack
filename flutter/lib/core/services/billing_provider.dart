import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Billing Provider — Reactive Plan Tier ────────────────
// ═══════════════════════════════════════════════════════════
//
// Streams the workspace's plan_tier from Supabase Realtime
// so that feature gates update instantly when an admin
// upgrades via the web dashboard.

final planTierProvider = StreamProvider<String>((ref) {
  final orgIdAsync = ref.watch(activeWorkspaceIdProvider);
  final orgId = orgIdAsync;
  if (orgId == null) return Stream.value('free');

  final client = SupabaseService.client;
  final controller = StreamController<String>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('organizations')
          .select('plan_tier')
          .eq('id', orgId)
          .single();

      if (!controller.isClosed) {
        controller.add((data['plan_tier'] as String?) ?? 'free');
      }
    } catch (_) {
      if (!controller.isClosed) controller.add('free');
    }
  }

  fetch();

  final sub = client
      .channel('plan-tier-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.update,
        schema: 'public',
        table: 'organizations',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'id',
          value: orgId,
        ),
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Subscription status (for past_due banner)
final subscriptionStatusProvider = StreamProvider<String?>((ref) {
  final orgIdAsync = ref.watch(activeWorkspaceIdProvider);
  final orgId = orgIdAsync;
  if (orgId == null) return Stream.value(null);

  final client = SupabaseService.client;
  final controller = StreamController<String?>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('subscriptions')
          .select('status')
          .eq('organization_id', orgId)
          .inFilter('status', ['active', 'trialing', 'past_due'])
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (!controller.isClosed) {
        controller.add(data?['status'] as String?);
      }
    } catch (_) {
      if (!controller.isClosed) controller.add(null);
    }
  }

  fetch();

  final sub = client
      .channel('sub-status-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'subscriptions',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Helper: check if the current tier meets a requirement
final tierMeetsProvider = Provider.family<bool, String>((ref, requiredTier) {
  const tierOrder = ['free', 'starter', 'pro', 'business'];
  final current = ref.watch(planTierProvider).valueOrNull ?? 'free';
  return tierOrder.indexOf(current) >= tierOrder.indexOf(requiredTier);
});

/// Seat limit check for the current plan
final seatLimitProvider = FutureProvider<({int current, int max})>((ref) async {
  final orgIdAsync = ref.watch(activeWorkspaceIdProvider);
  final orgId = orgIdAsync;
  if (orgId == null) return (current: 0, max: 1);

  final tier = ref.watch(planTierProvider).valueOrNull ?? 'free';

  final maxSeats = switch (tier) {
    'free' => 1,
    'starter' => 5,
    'pro' => 25,
    _ => 999,
  };

  final countData = await SupabaseService.client
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('status', 'active');

  return (current: (countData as List).length, max: maxSeats);
});
