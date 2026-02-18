import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/job.dart';

/// Valid job state transitions — the directed graph of allowed moves.
const Map<JobStatus, List<JobStatus>> _jobTransitions = {
  JobStatus.backlog: [JobStatus.todo, JobStatus.scheduled, JobStatus.cancelled],
  JobStatus.todo: [JobStatus.scheduled, JobStatus.inProgress, JobStatus.backlog, JobStatus.cancelled],
  JobStatus.scheduled: [JobStatus.inProgress, JobStatus.todo, JobStatus.cancelled],
  JobStatus.inProgress: [JobStatus.done, JobStatus.scheduled, JobStatus.cancelled],
  JobStatus.done: [JobStatus.invoiced, JobStatus.inProgress],
  JobStatus.invoiced: [JobStatus.done],
  JobStatus.cancelled: [JobStatus.backlog],
};

/// Valid invoice state transitions.
const Map<String, List<String>> _invoiceTransitions = {
  'draft': ['sent', 'voided'],
  'sent': ['partially_paid', 'paid', 'overdue', 'voided'],
  'partially_paid': ['paid', 'overdue', 'voided'],
  'overdue': ['partially_paid', 'paid', 'voided'],
  'paid': ['voided'],
  'voided': [],
};

/// Valid quote state transitions.
const Map<String, List<String>> _quoteTransitions = {
  'draft': ['sent'],
  'sent': ['viewed', 'accepted', 'rejected', 'expired'],
  'viewed': ['accepted', 'rejected', 'expired'],
  'accepted': [],
  'rejected': ['draft'],
  'expired': ['draft'],
};

class TransitionResult {
  final bool success;
  final String? error;
  const TransitionResult.ok() : success = true, error = null;
  const TransitionResult.fail(this.error) : success = false;
}

class StateMachine {
  /// Check if a job status transition is valid.
  static bool canTransitionJob(JobStatus from, JobStatus to) {
    return _jobTransitions[from]?.contains(to) ?? false;
  }

  /// Get all valid next states for a job.
  static List<JobStatus> nextJobStates(JobStatus current) {
    return _jobTransitions[current] ?? [];
  }

  /// Check if an invoice status transition is valid.
  static bool canTransitionInvoice(String from, String to) {
    return _invoiceTransitions[from]?.contains(to) ?? false;
  }

  /// Get all valid next states for an invoice.
  static List<String> nextInvoiceStates(String current) {
    return _invoiceTransitions[current] ?? [];
  }

  /// Check if a quote status transition is valid.
  static bool canTransitionQuote(String from, String to) {
    return _quoteTransitions[from]?.contains(to) ?? false;
  }

  /// Get all valid next states for a quote.
  static List<String> nextQuoteStates(String current) {
    return _quoteTransitions[current] ?? [];
  }

  /// Transition a job and log it to the audit trail.
  static Future<TransitionResult> transitionJob({
    required String jobId,
    required String organizationId,
    required JobStatus fromStatus,
    required JobStatus toStatus,
    String? userId,
    String? reason,
  }) async {
    if (!canTransitionJob(fromStatus, toStatus)) {
      return TransitionResult.fail(
        'Cannot move from "${fromStatus.label}" to "${toStatus.label}"',
      );
    }

    final now = DateTime.now().toIso8601String();

    await SupabaseService.client.from('jobs').update({
      'status': toStatus.value,
      'updated_at': now,
    }).eq('id', jobId);

    await _logAudit(
      organizationId: organizationId,
      userId: userId,
      action: 'status_change',
      entityType: 'job',
      entityId: jobId,
      oldData: {'status': fromStatus.value},
      newData: {
        'status': toStatus.value,
        if (reason != null) 'reason': reason,
      },
    );

    return const TransitionResult.ok();
  }

  /// Transition an invoice and log it to the audit trail.
  static Future<TransitionResult> transitionInvoice({
    required String invoiceId,
    required String organizationId,
    required String fromStatus,
    required String toStatus,
    String? userId,
    String? transactionId,
  }) async {
    if (!canTransitionInvoice(fromStatus, toStatus)) {
      return TransitionResult.fail(
        'Cannot move invoice from "$fromStatus" to "$toStatus"',
      );
    }

    if (toStatus == 'paid' && transactionId == null) {
      return const TransitionResult.fail(
        'Cannot mark as paid without a transaction ID',
      );
    }

    final now = DateTime.now().toIso8601String();
    final updates = <String, dynamic>{
      'status': toStatus,
      'updated_at': now,
    };

    if (toStatus == 'paid') {
      updates['paid_date'] = now.split('T').first;
    }

    await SupabaseService.client
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

    await _logAudit(
      organizationId: organizationId,
      userId: userId,
      action: 'status_change',
      entityType: 'invoice',
      entityId: invoiceId,
      oldData: {'status': fromStatus},
      newData: {
        'status': toStatus,
        if (transactionId != null) 'transaction_id': transactionId,
      },
    );

    return const TransitionResult.ok();
  }

  /// Transition a quote and log it to the audit trail.
  static Future<TransitionResult> transitionQuote({
    required String quoteId,
    required String organizationId,
    required String fromStatus,
    required String toStatus,
    String? userId,
  }) async {
    if (!canTransitionQuote(fromStatus, toStatus)) {
      return TransitionResult.fail(
        'Cannot move quote from "$fromStatus" to "$toStatus"',
      );
    }

    final now = DateTime.now().toIso8601String();

    await SupabaseService.client.from('quotes').update({
      'status': toStatus,
      'updated_at': now,
    }).eq('id', quoteId);

    await _logAudit(
      organizationId: organizationId,
      userId: userId,
      action: 'status_change',
      entityType: 'quote',
      entityId: quoteId,
      oldData: {'status': fromStatus},
      newData: {'status': toStatus},
    );

    return const TransitionResult.ok();
  }

  static Future<void> _logAudit({
    required String organizationId,
    String? userId,
    required String action,
    required String entityType,
    required String entityId,
    Map<String, dynamic>? oldData,
    Map<String, dynamic>? newData,
  }) async {
    await SupabaseService.client.from('audit_log').insert({
      'organization_id': organizationId,
      'user_id': userId ?? SupabaseService.auth.currentUser?.id,
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'old_data': oldData,
      'new_data': newData,
    });
  }
}

/// Pipeline stage distribution — counts jobs at each lifecycle stage.
final pipelineStatsProvider = FutureProvider.family<Map<String, int>, String>((ref, orgId) async {
  final data = await SupabaseService.client
      .from('jobs')
      .select('status')
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null);

  final counts = <String, int>{
    'backlog': 0,
    'todo': 0,
    'scheduled': 0,
    'in_progress': 0,
    'done': 0,
    'invoiced': 0,
    'cancelled': 0,
  };

  for (final row in (data as List)) {
    final s = row['status'] as String? ?? 'backlog';
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return counts;
});

/// Overdue jobs — jobs past due_date that aren't done/cancelled/invoiced.
final overdueJobsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, orgId) async {
  final now = DateTime.now().toIso8601String();
  final data = await SupabaseService.client
      .from('jobs')
      .select('id, title, display_id, status, due_date, assignee_id')
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null)
      .lt('due_date', now)
      .not('status', 'in', '(done,invoiced,cancelled)')
      .order('due_date')
      .limit(10);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Outstanding invoices — sent/overdue/partially_paid invoices.
final outstandingInvoicesProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, orgId) async {
  final data = await SupabaseService.client
      .from('invoices')
      .select('id, display_id, status, total, due_date, client_name')
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null)
      .inFilter('status', ['sent', 'overdue', 'partially_paid'])
      .order('due_date')
      .limit(20);

  final invoices = (data as List).cast<Map<String, dynamic>>();
  final totalOutstanding = invoices.fold<double>(
    0,
    (sum, inv) => sum + (double.tryParse(inv['total']?.toString() ?? '0') ?? 0),
  );
  final overdueCount = invoices.where((i) => i['status'] == 'overdue').length;

  return {
    'invoices': invoices,
    'total_outstanding': totalOutstanding,
    'count': invoices.length,
    'overdue_count': overdueCount,
  };
});

/// Recent audit log entries for the organization.
final recentAuditLogProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, orgId) async {
  final data = await SupabaseService.client
      .from('audit_log')
      .select('id, action, entity_type, entity_id, old_data, new_data, user_id, created_at')
      .eq('organization_id', orgId)
      .order('created_at', ascending: false)
      .limit(20);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Financial pulse — revenue collected vs outstanding debt.
final financialPulseProvider = FutureProvider.family<Map<String, double>, String>((ref, orgId) async {
  final paidData = await SupabaseService.client
      .from('invoices')
      .select('total')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .isFilter('deleted_at', null);

  final outstandingData = await SupabaseService.client
      .from('invoices')
      .select('total')
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null)
      .inFilter('status', ['sent', 'overdue', 'partially_paid']);

  double sumTotals(List rows) {
    return rows.fold<double>(
      0,
      (sum, r) => sum + (double.tryParse(r['total']?.toString() ?? '0') ?? 0),
    );
  }

  final collected = sumTotals(paidData as List);
  final outstanding = sumTotals(outstandingData as List);
  final total = collected + outstanding;

  return {
    'collected': collected,
    'outstanding': outstanding,
    'total': total,
    'collection_rate': total > 0 ? (collected / total) * 100 : 100,
  };
});
