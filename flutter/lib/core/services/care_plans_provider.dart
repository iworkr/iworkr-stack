import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/care_plan.dart';

// ═══════════════════════════════════════════════════════════
// ── Care Plans & Goals — Structured Care Planning ────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale Phase 4: Care plan management with
// goal tracking and goal-to-shift linkage via progress notes.

/// All care plans for the organization (Realtime)
final carePlansStreamProvider = StreamProvider<List<CarePlan>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<CarePlan>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('care_plans')
          .select('*, care_goals(*), participant_profiles!care_plans_participant_id_fkey(full_name, preferred_name)')
          .eq('organization_id', orgId)
          .order('updated_at', ascending: false)
          .limit(100);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) => CarePlan.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('care-plans-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'care_plans',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetch(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'care_goals',
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Active care plans only
final activeCarePlansProvider = Provider<List<CarePlan>>((ref) {
  final all = ref.watch(carePlansStreamProvider).valueOrNull ?? [];
  return all.where((p) => p.isActive).toList();
});

/// Plans for a specific participant
final participantCarePlansProvider =
    Provider.family<List<CarePlan>, String>((ref, participantId) {
  final all = ref.watch(carePlansStreamProvider).valueOrNull ?? [];
  return all.where((p) => p.participantId == participantId).toList();
});

/// All active goals across all plans (for shift report goal picker)
final activeGoalsProvider = Provider<List<CareGoal>>((ref) {
  final plans = ref.watch(activeCarePlansProvider);
  return plans.expand((p) => p.goals.where((g) => g.isActive)).toList();
});

/// Active goals for a specific participant (for shift report)
final participantActiveGoalsProvider =
    Provider.family<List<CareGoal>, String>((ref, participantId) {
  final plans = ref.watch(participantCarePlansProvider(participantId));
  return plans.expand((p) => p.goals.where((g) => g.isActive)).toList();
});

/// Care plan stats
final carePlanStatsProvider = Provider<CarePlanStats>((ref) {
  final all = ref.watch(carePlansStreamProvider).valueOrNull ?? [];
  return CarePlanStats(
    total: all.length,
    active: all.where((p) => p.status == CarePlanStatus.active).length,
    draft: all.where((p) => p.status == CarePlanStatus.draft).length,
    underReview: all.where((p) => p.status == CarePlanStatus.underReview).length,
    needsReview: all.where((p) => p.needsReview).length,
    totalGoals: all.fold(0, (sum, p) => sum + p.goals.length),
    activeGoals: all.fold(0, (sum, p) => sum + p.activeGoalCount),
    achievedGoals: all.fold(0, (sum, p) => sum + p.achievedGoalCount),
  );
});

class CarePlanStats {
  final int total;
  final int active;
  final int draft;
  final int underReview;
  final int needsReview;
  final int totalGoals;
  final int activeGoals;
  final int achievedGoals;
  const CarePlanStats({
    this.total = 0,
    this.active = 0,
    this.draft = 0,
    this.underReview = 0,
    this.needsReview = 0,
    this.totalGoals = 0,
    this.activeGoals = 0,
    this.achievedGoals = 0,
  });
}

// ── Mutations ────────────────────────────────────────────

Future<CarePlan?> createCarePlan({
  required String participantId,
  required String title,
  String? assessorName,
  String? assessorRole,
  String? notes,
  DateTime? startDate,
  DateTime? nextReviewDate,
  Map<String, dynamic>? domains,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;

  final data = await SupabaseService.client
      .from('care_plans')
      .insert({
        'organization_id': orgRow['organization_id'],
        'participant_id': participantId,
        'title': title,
        'status': 'draft',
        if (assessorName != null) 'assessor_name': assessorName,
        if (assessorRole != null) 'assessor_role': assessorRole,
        if (notes != null) 'notes': notes,
        if (startDate != null) 'start_date': startDate.toIso8601String().split('T').first,
        if (nextReviewDate != null) 'next_review_date': nextReviewDate.toIso8601String().split('T').first,
        'domains': domains ?? {},
      })
      .select('*, care_goals(*), participant_profiles!care_plans_participant_id_fkey(full_name, preferred_name)')
      .single();

  return CarePlan.fromJson(data);
}

Future<void> updateCarePlanStatus({
  required String planId,
  required CarePlanStatus status,
}) async {
  final updates = <String, dynamic>{
    'status': status.value,
  };
  if (status == CarePlanStatus.active) {
    updates['approved_by'] = SupabaseService.auth.currentUser?.id;
    updates['approved_at'] = DateTime.now().toUtc().toIso8601String();
  }

  await SupabaseService.client
      .from('care_plans')
      .update(updates)
      .eq('id', planId);
}

Future<CareGoal?> createCareGoal({
  required String carePlanId,
  required String participantId,
  required String title,
  String? description,
  String? targetOutcome,
  String? supportCategory,
  int priority = 0,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;

  final data = await SupabaseService.client
      .from('care_goals')
      .insert({
        'care_plan_id': carePlanId,
        'organization_id': orgRow['organization_id'],
        'participant_id': participantId,
        'title': title,
        'status': 'not_started',
        'priority': priority,
        'milestones': [],
        if (description != null) 'description': description,
        if (targetOutcome != null) 'target_outcome': targetOutcome,
        if (supportCategory != null) 'support_category': supportCategory,
      })
      .select()
      .single();

  return CareGoal.fromJson(data);
}

Future<void> updateGoalStatus({
  required String goalId,
  required GoalStatus status,
}) async {
  final updates = <String, dynamic>{
    'status': status.value,
  };
  if (status == GoalStatus.inProgress) {
    updates['started_at'] = DateTime.now().toUtc().toIso8601String();
  }
  if (status == GoalStatus.achieved) {
    updates['achieved_at'] = DateTime.now().toUtc().toIso8601String();
  }

  await SupabaseService.client
      .from('care_goals')
      .update(updates)
      .eq('id', goalId);
}

/// Link a goal to a progress note (called during shift report submission)
Future<void> linkGoalToProgressNote({
  required String goalId,
  required String progressNoteId,
  String? contributionSummary,
}) async {
  await SupabaseService.client
      .from('goal_progress_links')
      .insert({
        'goal_id': goalId,
        'progress_note_id': progressNoteId,
        if (contributionSummary != null) 'contribution_summary': contributionSummary,
      });
}
