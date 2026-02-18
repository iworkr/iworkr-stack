import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/safety_assessment.dart';

/// Safety assessment for a specific job (returns null if none exists)
final jobSafetyProvider =
    FutureProvider.family<SafetyAssessment?, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('safety_assessments')
      .select()
      .eq('job_id', jobId)
      .order('created_at', ascending: false)
      .limit(1)
      .maybeSingle();

  if (data == null) return null;
  return SafetyAssessment.fromJson(data);
});

/// Whether job safety is cleared (true = can start timer)
final isJobSafetyClearedProvider =
    FutureProvider.family<bool, String>((ref, jobId) async {
  final assessment = await ref.watch(jobSafetyProvider(jobId).future);
  return assessment?.isCleared ?? false;
});

/// Recent safety assessments for org
final recentAssessmentsProvider =
    FutureProvider<List<SafetyAssessment>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('safety_assessments')
      .select()
      .eq('organization_id', orgId)
      .order('created_at', ascending: false)
      .limit(20);

  return (data as List)
      .map((s) => SafetyAssessment.fromJson(s as Map<String, dynamic>))
      .toList();
});

/// Create a safety assessment (blocking workflow start)
Future<SafetyAssessment?> createSafetyAssessment({
  required String jobId,
  required List<HazardEntry> hazards,
  required List<ControlMeasure> controlMeasures,
  required bool siteSafe,
  bool loneWorkerEnabled = false,
  String? notes,
  double? lat,
  double? lng,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

  if (orgRow == null) return null;
  final orgId = orgRow['organization_id'] as String;

  final status = siteSafe ? 'cleared' : (hazards.any((h) => h.selected) ? 'cleared' : 'pending');

  final row = await SupabaseService.client.from('safety_assessments').insert({
    'organization_id': orgId,
    'job_id': jobId,
    'assessed_by': user.id,
    'status': status,
    'hazards': hazards.map((h) => h.toJson()).toList(),
    'control_measures': controlMeasures.map((c) => c.toJson()).toList(),
    'site_safe': siteSafe,
    'lone_worker_enabled': loneWorkerEnabled,
    'location_lat': lat,
    'location_lng': lng,
    'signed_at': DateTime.now().toIso8601String(),
    'notes': notes,
  }).select().single();

  return SafetyAssessment.fromJson(row);
}
