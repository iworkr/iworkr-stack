import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/job_media.dart';

/// Active timer session for a specific job
final activeTimerProvider =
    FutureProvider.family<JobTimerSession?, String>((ref, jobId) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final data = await SupabaseService.client
      .from('job_timer_sessions')
      .select()
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('started_at', ascending: false)
      .limit(1)
      .maybeSingle();

  if (data == null) return null;
  return JobTimerSession.fromJson(data);
});

/// Transition: scheduled → en_route (technician starts traveling)
Future<void> startTravel({required String jobId}) async {
  await SupabaseService.client
      .from('jobs')
      .update({
        'status': 'en_route',
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('id', jobId);
}

/// Transition: en_route → on_site (technician arrived)
Future<void> arriveOnSite({required String jobId}) async {
  await SupabaseService.client
      .from('jobs')
      .update({
        'status': 'on_site',
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('id', jobId);
}

/// Start a job timer session (on_site → in_progress)
Future<JobTimerSession?> startJobTimer({
  required String jobId,
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

  await SupabaseService.client
      .from('jobs')
      .update({
        'status': 'in_progress',
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      })
      .eq('id', jobId);

  final row = await SupabaseService.client.from('job_timer_sessions').insert({
    'organization_id': orgId,
    'job_id': jobId,
    'user_id': user.id,
    'start_lat': lat,
    'start_lng': lng,
    'status': 'active',
  }).select().single();

  return JobTimerSession.fromJson(row);
}

/// Complete the job timer session (in_progress → completed)
Future<void> completeJobTimer({
  required String sessionId,
  required String jobId,
  double? lat,
  double? lng,
}) async {
  final now = DateTime.now().toUtc();

  await SupabaseService.client
      .from('job_timer_sessions')
      .update({
        'ended_at': now.toIso8601String(),
        'end_lat': lat,
        'end_lng': lng,
        'status': 'completed',
      })
      .eq('id', sessionId);

  await SupabaseService.client
      .from('jobs')
      .update({
        'status': 'completed',
        'updated_at': now.toIso8601String(),
      })
      .eq('id', jobId);
}

/// Toggle a subtask completion
Future<void> toggleSubtask({
  required String subtaskId,
  required bool completed,
}) async {
  await SupabaseService.client
      .from('job_subtasks')
      .update({'completed': completed})
      .eq('id', subtaskId);
}

/// Job media for a specific job
final jobMediaProvider =
    FutureProvider.family<List<JobMedia>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('job_media')
      .select()
      .eq('job_id', jobId)
      .order('created_at', ascending: false);

  return (data as List)
      .map((m) => JobMedia.fromJson(m as Map<String, dynamic>))
      .toList();
});

/// Media count for a job
final jobMediaCountProvider =
    FutureProvider.family<int, String>((ref, jobId) async {
  final media = await ref.watch(jobMediaProvider(jobId).future);
  return media.length;
});

/// Record a new media entry
Future<JobMedia?> recordJobMedia({
  required String jobId,
  required String fileUrl,
  String? thumbnailUrl,
  String? caption,
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

  final row = await SupabaseService.client.from('job_media').insert({
    'organization_id': orgId,
    'job_id': jobId,
    'uploaded_by': user.id,
    'file_url': fileUrl,
    'thumbnail_url': thumbnailUrl,
    'caption': caption,
    'location_lat': lat,
    'location_lng': lng,
    'watermark_data': {
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'lat': lat,
      'lng': lng,
    },
  }).select().single();

  return JobMedia.fromJson(row);
}
