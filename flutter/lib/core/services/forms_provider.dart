import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/form_template.dart';

/// All active form templates for the org.
final formTemplatesProvider = FutureProvider<List<FormTemplate>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('form_templates')
      .select()
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('title');

  return (data as List)
      .map((e) => FormTemplate.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Form templates for a specific stage.
final stageFormsProvider = FutureProvider.family<List<FormTemplate>, String>((ref, stage) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('form_templates')
      .select()
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('stage', stage)
      .order('title');

  return (data as List)
      .map((e) => FormTemplate.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Form responses for a specific job.
final jobFormResponsesProvider = FutureProvider.family<List<FormResponse>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('form_responses')
      .select()
      .eq('job_id', jobId)
      .order('created_at', ascending: false);

  return (data as List)
      .map((e) => FormResponse.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Check if all pre-job forms are completed for a job.
final preJobFormsCompleteProvider = FutureProvider.family<bool, String>((ref, jobId) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return true;

  final templates = await ref.watch(stageFormsProvider('pre_job').future);
  if (templates.isEmpty) return true;

  final responses = await ref.watch(jobFormResponsesProvider(jobId).future);
  final submittedTemplateIds = responses
      .where((r) => r.isSubmitted)
      .map((r) => r.formTemplateId)
      .toSet();

  return templates.every((t) => submittedTemplateIds.contains(t.id));
});

/// Check if all post-job forms are completed for a job.
final postJobFormsCompleteProvider = FutureProvider.family<bool, String>((ref, jobId) async {
  final templates = await ref.watch(stageFormsProvider('post_job').future);
  if (templates.isEmpty) return true;

  final responses = await ref.watch(jobFormResponsesProvider(jobId).future);
  final submittedTemplateIds = responses
      .where((r) => r.isSubmitted)
      .map((r) => r.formTemplateId)
      .toSet();

  return templates.every((t) => submittedTemplateIds.contains(t.id));
});

/// Submit a form response.
Future<FormResponse?> submitFormResponse({
  required String formTemplateId,
  required String jobId,
  required Map<String, dynamic> data,
  String? signatureSvg,
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

  final row = await SupabaseService.client.from('form_responses').insert({
    'organization_id': orgId,
    'form_template_id': formTemplateId,
    'job_id': jobId,
    'submitted_by': user.id,
    'data': data,
    'signature_svg': signatureSvg,
    'status': 'submitted',
    'submitted_at': DateTime.now().toUtc().toIso8601String(),
  }).select().single();

  return FormResponse.fromJson(row);
}
