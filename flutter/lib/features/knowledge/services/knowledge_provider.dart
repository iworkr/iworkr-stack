import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/knowledge/models/knowledge_models.dart';

// ============================================================================
// Athena SOP Knowledge Base — Riverpod Providers
// ============================================================================
// Provides knowledge library fetching, contextual SOP recommendations,
// and acknowledgement tracking for the Mission HUD and Knowledge screens.
// ============================================================================

// ── Full knowledge library (published articles) ──────────────────────────
final knowledgeLibraryProvider =
    FutureProvider<List<KnowledgeArticle>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];

  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final client = SupabaseService.client;

  final result = await client.rpc('get_knowledge_library', params: {
    'p_workspace_id': orgId,
  });

  if (result == null) return [];

  final list = result as List<dynamic>;
  return list
      .map((e) => KnowledgeArticle.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Recommended SOPs for a specific job ──────────────────────────────────
final jobRecommendedSopsProvider =
    FutureProvider.family<List<RecommendedSop>, String>((ref, jobId) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];

  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final client = SupabaseService.client;

  final result = await client.rpc('get_job_recommended_sops', params: {
    'p_workspace_id': orgId,
    'p_job_id': jobId,
  });

  if (result == null) return [];

  final list = result as List<dynamic>;
  return list
      .map((e) => RecommendedSop.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Acknowledgement service ──────────────────────────────────────────────
final acknowledgeArticleProvider =
    Provider((ref) => KnowledgeAcknowledgeService(ref));

// ============================================================================
// KnowledgeAcknowledgeService
// ============================================================================
/// Handles article acknowledgement (read receipts) and mandatory compliance
/// checks for SOPs linked to jobs.
class KnowledgeAcknowledgeService {
  final Ref _ref;
  KnowledgeAcknowledgeService(this._ref);

  /// Acknowledge that the current user has read/watched an article.
  ///
  /// [articleId] — the knowledge article to acknowledge.
  /// [jobId] — optional job context (links this read to a specific job).
  /// [watchTimeSeconds] — total seconds spent viewing/watching.
  /// [completionPercentage] — 0.0–1.0 how much of the content was consumed.
  Future<ReadReceipt?> acknowledge(
    String articleId, {
    String? jobId,
    int watchTimeSeconds = 0,
    double completionPercentage = 1.0,
  }) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) throw StateError('User not authenticated');

    final orgId = await _ref.read(organizationIdProvider.future);
    if (orgId == null) throw StateError('No active workspace');

    final client = SupabaseService.client;

    final result = await client.rpc('acknowledge_article', params: {
      'p_workspace_id': orgId,
      'p_article_id': articleId,
      'p_worker_id': user.id,
      'p_context_job_id': jobId,
      'p_watch_time_seconds': watchTimeSeconds,
      'p_completion_percentage': completionPercentage,
    });

    debugPrint(
      '[Athena] Article acknowledged: $articleId '
      '(job=$jobId, watch=${watchTimeSeconds}s, completion=${(completionPercentage * 100).toInt()}%)',
    );

    if (result == null) return null;
    return ReadReceipt.fromJson(result as Map<String, dynamic>);
  }

  /// Check if all mandatory SOPs for a given job have been acknowledged
  /// by the current user.
  ///
  /// Returns `true` if compliant (all mandatory SOPs acknowledged),
  /// `false` if there are outstanding mandatory reads.
  Future<bool> checkMandatoryCompliance(String jobId) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) return false;

    final orgId = await _ref.read(organizationIdProvider.future);
    if (orgId == null) return false;

    final client = SupabaseService.client;

    // Fetch recommended SOPs for this job
    final sops =
        await _ref.read(jobRecommendedSopsProvider(jobId).future);

    // Filter to mandatory ones
    final mandatory = sops.where((s) => s.isMandatoryRead).toList();
    if (mandatory.isEmpty) return true; // No mandatory SOPs → compliant

    // Check each mandatory SOP for an acknowledgement
    for (final sop in mandatory) {
      final receipt = await client
          .from('sop_read_receipts')
          .select('id')
          .eq('article_id', sop.id)
          .eq('worker_id', user.id)
          .not('acknowledged_at', 'is', null)
          .maybeSingle();

      if (receipt == null) {
        debugPrint(
          '[Athena] Mandatory SOP not acknowledged: ${sop.title} (${sop.id})',
        );
        return false;
      }
    }

    return true;
  }
}
