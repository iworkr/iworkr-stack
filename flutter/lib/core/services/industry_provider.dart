import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

// ═══════════════════════════════════════════════════════════
// ── Industry Toggle & Nomenclature Layer ─────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Morphs iWorkr from trades-only to
// multi-sector by translating UI labels and gating features
// based on organization.industry_type.
//
// For "trades" orgs, this is a no-op pass-through.
// For "care" orgs, labels are translated and care features unlocked.

/// The industry type for the current organization
final industryTypeProvider = FutureProvider<String>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return 'trades';

  final data = await SupabaseService.client
      .from('organizations')
      .select('industry_type')
      .eq('id', orgId)
      .maybeSingle();

  return data?['industry_type'] as String? ?? 'trades';
});

/// Whether the current org is a care org
final isCareProvider = Provider<bool>((ref) {
  return ref.watch(industryTypeProvider).valueOrNull == 'care';
});

// ── Nomenclature Mapping ────────────────────────────────

/// Care-sector label overrides (trades term → care term)
const _careLexicon = <String, String>{
  'Job': 'Shift',
  'Jobs': 'Shifts',
  'Client': 'Participant',
  'Clients': 'Participants',
  'Technician': 'Support Worker',
  'Technicians': 'Support Workers',
  'Quote': 'Support Category',
  'Quotes': 'Support Categories',
  'Install': 'In-Home Support',
  'Callout': 'Urgent Support',
  'Service': 'Support',
  'Schedule': 'Roster',
  'Invoice': 'Claim',
  'Invoices': 'Claims',
  'Site': 'Location',
  'Work Order': 'Support Plan',
  'Dispatch': 'Coordination',
  'Pipeline': 'Shift Board',
  'Backlog': 'Unrostered',
  'Equipment': 'Aids & Equipment',
  'Fleet': 'Transport',
  'Inventory': 'Supplies',
  // ── Extended care nomenclature ──
  'Team': 'Support Team',
  'Revenue': 'Funding',
  'Revenue MTD': 'Funding MTD',
  'REVENUE MTD': 'FUNDING MTD',
  'LIVE DISPATCH': 'LIVE COORDINATION',
  'NEW JOB': 'LOG UNSCHEDULED SUPPORT',
  'CLOCK IN': 'START SHIFT',
  'COMPLETE JOB': 'COMPLETE SHIFT',
  'JOB DEBRIEF': 'SHIFT DEBRIEF',
  'SUBMIT JOB REPORT': 'SUBMIT SHIFT REPORT',
  'SCOPE OF WORK': 'SUPPORT PLAN',
  'job': 'shift',
  'client': 'participant',
  'Active Jobs': 'Active Shifts',
  'No jobs yet': 'No shifts yet',
  'Create Job': 'Log Unscheduled Support',
  'New Job': 'Log Unscheduled Support',
  'My Jobs': 'My Shifts',
  'Assets': 'Aids & Equipment',
  'Sales Pipeline': 'Referral Pipeline',
  'REVENUE': 'FUNDING',
  'Overdue': 'Overdue',
  'Outstanding': 'Outstanding',
  'Invoiced': 'Processed',
};

/// Translate a UI label based on org industry type
String translateLabel(String label, {bool isCare = false}) {
  if (!isCare) return label;
  return _careLexicon[label] ?? label;
}

/// Riverpod-powered label translator
final labelTranslatorProvider = Provider<String Function(String)>((ref) {
  final isCare = ref.watch(isCareProvider);
  return (label) => translateLabel(label, isCare: isCare);
});
