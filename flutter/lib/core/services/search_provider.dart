import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';

// ── Search Result Types ──────────────────────────────

enum SearchResultType { job, client, asset, team, action }

class SearchResult {
  final String id;
  final SearchResultType type;
  final String title;
  final String subtitle;
  final String? route;
  final String? mono;

  const SearchResult({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    this.route,
    this.mono,
  });
}

// ── Quick Actions (always available) ─────────────────

const quickActions = [
  SearchResult(id: 'action-new-job', type: SearchResultType.action, title: 'New Job', subtitle: 'Create a new job', route: '/jobs'),
  SearchResult(id: 'action-schedule', type: SearchResultType.action, title: 'My Schedule', subtitle: 'View today\'s timeline', route: '/schedule'),
  SearchResult(id: 'action-inbox', type: SearchResultType.action, title: 'Inbox', subtitle: 'View notifications', route: '/inbox'),
  SearchResult(id: 'action-chat', type: SearchResultType.action, title: 'Comms', subtitle: 'Open team chat', route: '/chat'),
];

// ── Search Query Provider ────────────────────────────

final searchQueryProvider = StateProvider<String>((ref) => '');

/// Unified search provider — queries Jobs, Clients, Assets, Team in parallel
final searchResultsProvider = FutureProvider<List<SearchResult>>((ref) async {
  final query = ref.watch(searchQueryProvider).trim().toLowerCase();
  if (query.isEmpty) return [];

  final orgId = await ref.read(organizationIdProvider.future);
  if (orgId == null) return [];

  final results = <SearchResult>[];

  // Search actions first (local, instant)
  for (final action in quickActions) {
    if (action.title.toLowerCase().contains(query)) {
      results.add(action);
    }
  }

  // Parallel Supabase queries
  final futures = await Future.wait([
    _searchJobs(orgId, query),
    _searchClients(orgId, query),
    _searchAssets(orgId, query),
    _searchTeam(orgId, query),
  ]);

  for (final batch in futures) {
    results.addAll(batch);
  }

  return results;
});

Future<List<SearchResult>> _searchJobs(String orgId, String query) async {
  try {
    final data = await SupabaseService.client
        .from('jobs')
        .select('id, display_id, title, status, clients(name)')
        .eq('organization_id', orgId)
        .isFilter('deleted_at', null)
        .or('title.ilike.%$query%,display_id.ilike.%$query%,location.ilike.%$query%')
        .order('created_at', ascending: false)
        .limit(8);

    return (data as List).map((j) {
      final m = j as Map<String, dynamic>;
      final clientName = (m['clients'] as Map<String, dynamic>?)?['name'] as String?;
      return SearchResult(
        id: m['id'] as String,
        type: SearchResultType.job,
        title: m['title'] as String,
        subtitle: clientName ?? m['status'] as String? ?? '',
        route: '/jobs/${m['id']}',
        mono: m['display_id'] as String?,
      );
    }).toList();
  } catch (_) {
    return [];
  }
}

Future<List<SearchResult>> _searchClients(String orgId, String query) async {
  try {
    final data = await SupabaseService.client
        .from('clients')
        .select('id, name, address, phone')
        .eq('organization_id', orgId)
        .isFilter('deleted_at', null)
        .or('name.ilike.%$query%,address.ilike.%$query%,phone.ilike.%$query%')
        .order('name')
        .limit(6);

    return (data as List).map((c) {
      final m = c as Map<String, dynamic>;
      return SearchResult(
        id: m['id'] as String,
        type: SearchResultType.client,
        title: m['name'] as String,
        subtitle: m['address'] as String? ?? m['phone'] as String? ?? '',
      );
    }).toList();
  } catch (_) {
    return [];
  }
}

Future<List<SearchResult>> _searchAssets(String orgId, String query) async {
  try {
    final data = await SupabaseService.client
        .from('assets')
        .select('id, name, serial_number, category, status')
        .eq('organization_id', orgId)
        .or('name.ilike.%$query%,serial_number.ilike.%$query%')
        .order('name')
        .limit(6);

    return (data as List).map((a) {
      final m = a as Map<String, dynamic>;
      return SearchResult(
        id: m['id'] as String,
        type: SearchResultType.asset,
        title: m['name'] as String,
        subtitle: m['category'] as String? ?? '',
        mono: m['serial_number'] as String?,
      );
    }).toList();
  } catch (_) {
    return [];
  }
}

Future<List<SearchResult>> _searchTeam(String orgId, String query) async {
  try {
    // Get org member IDs first, then search profiles
    final members = await SupabaseService.client
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId)
        .eq('status', 'active');

    final memberIds = (members as List).map((m) => (m as Map<String, dynamic>)['user_id'] as String).toList();
    if (memberIds.isEmpty) return [];

    final data = await SupabaseService.client
        .from('profiles')
        .select('id, full_name, email')
        .inFilter('id', memberIds)
        .or('full_name.ilike.%$query%,email.ilike.%$query%')
        .limit(5);

    return (data as List).map((p) {
      final m = p as Map<String, dynamic>;
      return SearchResult(
        id: m['id'] as String,
        type: SearchResultType.team,
        title: m['full_name'] as String? ?? 'Unknown',
        subtitle: m['email'] as String? ?? '',
      );
    }).toList();
  } catch (_) {
    return [];
  }
}
