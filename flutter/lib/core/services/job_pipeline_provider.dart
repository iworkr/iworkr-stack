import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/services/forms_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/models/job.dart';

/// Result of a pipeline transition attempt.
class PipelineResult {
  final bool success;
  final String? error;
  final String? gate;

  const PipelineResult({required this.success, this.error, this.gate});
  const PipelineResult.ok() : success = true, error = null, gate = null;
  const PipelineResult.blocked(this.gate) : success = false, error = null;
  const PipelineResult.failed(this.error) : success = false, gate = null;
}

/// Gates that must be cleared before certain transitions.
enum PipelineGate {
  swmsRequired,
  photoRequired,
  invoiceOutstanding,
}

/// Manages job state transitions with hard gates.
class JobPipelineNotifier extends Notifier<void> {
  @override
  void build() {}

  /// Attempt to transition a job to a new status.
  /// Returns a PipelineResult indicating success or what gate blocked it.
  Future<PipelineResult> transition(String jobId, JobStatus target) async {
    try {
      final job = await ref.read(jobDetailProvider(jobId).future);
      if (job == null) return const PipelineResult.failed('Job not found');

      // Validate transition is allowed
      if (!job.status.validTransitions.contains(target)) {
        return PipelineResult.failed(
          'Cannot move from ${job.status.label} to ${target.label}',
        );
      }

      // Gate: in_progress requires SWMS completion
      if (target == JobStatus.inProgress) {
        final preJobForms = await ref.read(stageFormsProvider('pre_job').future);
        if (preJobForms.isNotEmpty) {
          final cleared = await ref.read(preJobFormsCompleteProvider(jobId).future);
          if (!cleared) {
            return const PipelineResult.blocked('swmsRequired');
          }
        }
      }

      // Gate: done/completed requires at least 1 photo
      if (target == JobStatus.done || target == JobStatus.completed) {
        final photoCount = await ref.read(jobMediaCountProvider(jobId).future);
        if (photoCount < 1) {
          return const PipelineResult.blocked('photoRequired');
        }
      }

      // Execute the transition
      await SupabaseService.client
          .from('jobs')
          .update({
            'status': target.value,
            'updated_at': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('id', jobId);

      ref.invalidate(jobDetailProvider(jobId));
      return const PipelineResult.ok();
    } catch (e) {
      return PipelineResult.failed('$e');
    }
  }

  /// Convenience: Start travel (scheduled -> en_route)
  Future<PipelineResult> startTravel(String jobId) =>
      transition(jobId, JobStatus.enRoute);

  /// Convenience: Arrive on site (en_route -> on_site)
  Future<PipelineResult> arriveOnSite(String jobId) =>
      transition(jobId, JobStatus.onSite);

  /// Convenience: Start work (on_site/scheduled -> in_progress)
  Future<PipelineResult> startWork(String jobId) =>
      transition(jobId, JobStatus.inProgress);

  /// Convenience: Complete job (in_progress -> completed)
  Future<PipelineResult> completeJob(String jobId) =>
      transition(jobId, JobStatus.completed);
}

final jobPipelineProvider = NotifierProvider<JobPipelineNotifier, void>(
  JobPipelineNotifier.new,
);
