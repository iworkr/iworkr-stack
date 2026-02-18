import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

/// All assets for the current organization.
final assetsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('assets')
      .select()
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null)
      .order('name', ascending: true);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Single asset detail.
final assetDetailProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, assetId) async {
  final data = await SupabaseService.client
      .from('assets')
      .select()
      .eq('id', assetId)
      .maybeSingle();

  return data;
});

/// Asset service history (from jobs linked to this asset via metadata or job_assets).
final assetHistoryProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, assetId) async {
  final data = await SupabaseService.client
      .from('asset_audits')
      .select()
      .eq('asset_id', assetId)
      .order('created_at', ascending: false)
      .limit(30);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Search/filter assets.
final assetSearchQueryProvider = StateProvider<String>((ref) => '');

final filteredAssetsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final assets = await ref.watch(assetsProvider.future);
  final query = ref.watch(assetSearchQueryProvider).toLowerCase();
  if (query.isEmpty) return assets;
  return assets.where((a) {
    final name = (a['name'] as String? ?? '').toLowerCase();
    final serial = (a['serial_number'] as String? ?? '').toLowerCase();
    final location = (a['location'] as String? ?? '').toLowerCase();
    final barcode = (a['barcode'] as String? ?? '').toLowerCase();
    return name.contains(query) || serial.contains(query) ||
        location.contains(query) || barcode.contains(query);
  }).toList();
});

/// Group assets by category for hierarchy view.
final assetsByCategoryProvider =
    FutureProvider<Map<String, List<Map<String, dynamic>>>>((ref) async {
  final assets = await ref.watch(filteredAssetsProvider.future);
  final grouped = <String, List<Map<String, dynamic>>>{};
  for (final a in assets) {
    final category = a['category'] as String? ?? 'other';
    grouped.putIfAbsent(category, () => []).add(a);
  }
  return grouped;
});

/// Group assets by location for hierarchy tree.
final assetsByLocationProvider =
    FutureProvider<Map<String, List<Map<String, dynamic>>>>((ref) async {
  final assets = await ref.watch(filteredAssetsProvider.future);
  final grouped = <String, List<Map<String, dynamic>>>{};
  for (final a in assets) {
    final location = a['location'] as String? ?? 'Unassigned';
    grouped.putIfAbsent(location, () => []).add(a);
  }
  return grouped;
});
