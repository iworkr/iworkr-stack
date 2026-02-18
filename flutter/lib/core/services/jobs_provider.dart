import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/models/job.dart';

/// Provides the list of jobs for the organization
final jobsProvider = FutureProvider<List<Job>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('jobs')
      .select('*, clients(name), profiles!jobs_assignee_id_fkey(full_name)')
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null)
      .order('created_at', ascending: false)
      .limit(50);

  return (data as List).map((j) => Job.fromJson(j as Map<String, dynamic>)).toList();
});

/// Provides a single job by ID
final jobDetailProvider = FutureProvider.family<Job?, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('jobs')
      .select('*, clients(name), profiles!jobs_assignee_id_fkey(full_name)')
      .eq('id', jobId)
      .maybeSingle();

  if (data == null) return null;
  return Job.fromJson(data);
});

/// Provides job subtasks
final jobSubtasksProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('job_subtasks')
      .select()
      .eq('job_id', jobId)
      .order('sort_order');

  return (data as List).cast<Map<String, dynamic>>();
});

/// Provides job activity
final jobActivityProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('job_activity')
      .select()
      .eq('job_id', jobId)
      .order('created_at', ascending: false)
      .limit(20);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Active jobs count (for dashboard)
final activeJobsCountProvider = FutureProvider<int>((ref) async {
  final jobs = await ref.watch(jobsProvider.future);
  return jobs.where((j) =>
    j.status == JobStatus.inProgress ||
    j.status == JobStatus.todo ||
    j.status == JobStatus.scheduled,
  ).length;
});

/// Revenue stats (for dashboard)
final revenueStatsProvider = FutureProvider<Map<String, double>>((ref) async {
  final jobs = await ref.watch(jobsProvider.future);
  final completed = jobs.where((j) => j.status == JobStatus.done);
  final totalRevenue = completed.fold<double>(0, (sum, j) => sum + j.revenue);
  return {
    'totalRevenue': totalRevenue,
    'jobsCompleted': completed.length.toDouble(),
    'activeJobs': jobs.where((j) => j.status == JobStatus.inProgress).length.toDouble(),
  };
});
