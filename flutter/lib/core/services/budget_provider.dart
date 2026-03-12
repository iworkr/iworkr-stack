import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/budget_allocation.dart';

// ═══════════════════════════════════════════════════════════
// ── NDIS Budget — Allocations & Claims ───────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale Phase 3: Real-time budget tracking
// with quarantine, consumption, and claim line visibility.

/// All budget allocations for the organization (Realtime)
final budgetAllocationsStreamProvider =
    StreamProvider<List<BudgetAllocation>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<BudgetAllocation>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('budget_allocations')
          .select('*, participant_profiles(full_name, preferred_name)')
          .eq('organization_id', orgId)
          .order('updated_at', ascending: false)
          .limit(200);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) =>
                  BudgetAllocation.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('budget-alloc-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'budget_allocations',
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

/// Budget allocations for a specific participant
final participantBudgetProvider =
    Provider.family<List<BudgetAllocation>, String>((ref, participantId) {
  final all = ref.watch(budgetAllocationsStreamProvider).valueOrNull ?? [];
  return all.where((a) => a.participantId == participantId).toList();
});

/// Budget summary across all participants
final budgetSummaryProvider = Provider<BudgetSummary>((ref) {
  final all = ref.watch(budgetAllocationsStreamProvider).valueOrNull ?? [];
  return BudgetSummary(
    totalBudget: all.fold(0, (sum, a) => sum + a.totalBudget),
    consumed: all.fold(0, (sum, a) => sum + a.consumedBudget),
    quarantined: all.fold(0, (sum, a) => sum + a.quarantinedBudget),
    coreBudget: all.where((a) => a.category == 'core').fold(0.0, (sum, a) => sum + a.totalBudget),
    coreConsumed: all.where((a) => a.category == 'core').fold(0.0, (sum, a) => sum + a.consumedBudget),
    capacityBudget: all.where((a) => a.category == 'capacity_building').fold(0.0, (sum, a) => sum + a.totalBudget),
    capacityConsumed: all.where((a) => a.category == 'capacity_building').fold(0.0, (sum, a) => sum + a.consumedBudget),
    capitalBudget: all.where((a) => a.category == 'capital').fold(0.0, (sum, a) => sum + a.totalBudget),
    capitalConsumed: all.where((a) => a.category == 'capital').fold(0.0, (sum, a) => sum + a.consumedBudget),
    participantCount: all.map((a) => a.participantId).toSet().length,
  );
});

class BudgetSummary {
  final double totalBudget;
  final double consumed;
  final double quarantined;
  final double coreBudget;
  final double coreConsumed;
  final double capacityBudget;
  final double capacityConsumed;
  final double capitalBudget;
  final double capitalConsumed;
  final int participantCount;

  const BudgetSummary({
    this.totalBudget = 0,
    this.consumed = 0,
    this.quarantined = 0,
    this.coreBudget = 0,
    this.coreConsumed = 0,
    this.capacityBudget = 0,
    this.capacityConsumed = 0,
    this.capitalBudget = 0,
    this.capitalConsumed = 0,
    this.participantCount = 0,
  });

  double get available => totalBudget - consumed - quarantined;
  double get utilizationPercent => totalBudget > 0 ? (consumed / totalBudget * 100) : 0;
  double get committedPercent => totalBudget > 0 ? ((consumed + quarantined) / totalBudget * 100) : 0;
}

/// All claim line items for the organization (Realtime)
final claimLineItemsStreamProvider =
    StreamProvider<List<ClaimLineItem>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ClaimLineItem>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('claim_line_items')
          .select('*, participant_profiles(full_name), profiles(full_name)')
          .eq('organization_id', orgId)
          .order('created_at', ascending: false)
          .limit(200);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) =>
                  ClaimLineItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('claim-lines-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'claim_line_items',
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

/// Claim summary stats
final claimStatsProvider = Provider<ClaimStats>((ref) {
  final all = ref.watch(claimLineItemsStreamProvider).valueOrNull ?? [];
  return ClaimStats(
    total: all.length,
    draft: all.where((c) => c.status == 'draft').length,
    approved: all.where((c) => c.status == 'approved').length,
    submitted: all.where((c) => c.status == 'submitted').length,
    paid: all.where((c) => c.status == 'paid').length,
    rejected: all.where((c) => c.status == 'rejected').length,
    totalSubmitted: all.where((c) => c.status == 'submitted').fold(0.0, (sum, c) => sum + c.totalAmount),
    totalPaid: all.where((c) => c.status == 'paid').fold(0.0, (sum, c) => sum + c.totalAmount),
    totalRejected: all.where((c) => c.status == 'rejected').fold(0.0, (sum, c) => sum + c.totalAmount),
  );
});

class ClaimStats {
  final int total;
  final int draft;
  final int approved;
  final int submitted;
  final int paid;
  final int rejected;
  final double totalSubmitted;
  final double totalPaid;
  final double totalRejected;
  const ClaimStats({
    this.total = 0,
    this.draft = 0,
    this.approved = 0,
    this.submitted = 0,
    this.paid = 0,
    this.rejected = 0,
    this.totalSubmitted = 0,
    this.totalPaid = 0,
    this.totalRejected = 0,
  });
}
