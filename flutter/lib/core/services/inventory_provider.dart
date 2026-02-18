import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/van_stock.dart';

/// Current user's van stock with inventory details
final vanStockProvider = FutureProvider<List<VanStockItem>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('van_stock')
      .select('*, inventory_items(name, sku, category, unit_cost)')
      .eq('user_id', user.id)
      .order('updated_at', ascending: false);

  return (data as List)
      .map((s) => VanStockItem.fromJson(s as Map<String, dynamic>))
      .toList();
});

/// Low stock items only
final lowStockProvider = FutureProvider<List<VanStockItem>>((ref) async {
  final all = await ref.watch(vanStockProvider.future);
  return all.where((s) => s.isLowStock).toList();
});

/// Low stock count (for badges)
final lowStockCountProvider = FutureProvider<int>((ref) async {
  final low = await ref.watch(lowStockProvider.future);
  return low.length;
});

/// Pending transfer requests for the user
final pendingTransfersProvider = FutureProvider<List<StockTransfer>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('stock_transfers')
      .select('*, inventory_items(name)')
      .or('from_user_id.eq.${user.id},to_user_id.eq.${user.id}')
      .inFilter('status', ['pending', 'accepted'])
      .order('requested_at', ascending: false)
      .limit(20);

  return (data as List)
      .map((t) => StockTransfer.fromJson(t as Map<String, dynamic>))
      .toList();
});

/// Use (decrement) stock from the van
Future<void> useVanStock({
  required String vanStockId,
  int quantity = 1,
}) async {
  final current = await SupabaseService.client
      .from('van_stock')
      .select('quantity')
      .eq('id', vanStockId)
      .single();

  final newQty = ((current['quantity'] as int? ?? 0) - quantity).clamp(0, 99999);

  await SupabaseService.client
      .from('van_stock')
      .update({
        'quantity': newQty,
        'updated_at': DateTime.now().toIso8601String(),
      })
      .eq('id', vanStockId);
}

/// Search van stock across all users in org (for transfers)
final orgStockSearchProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, query) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null || query.length < 2) return [];

  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('van_stock')
      .select('*, inventory_items!inner(name, sku), profiles!inner(full_name)')
      .eq('organization_id', orgId)
      .neq('user_id', user.id)
      .gt('quantity', 0)
      .ilike('inventory_items.name', '%$query%')
      .limit(20);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Request a van-to-van transfer
Future<StockTransfer?> requestTransfer({
  required String inventoryItemId,
  required String fromUserId,
  required int quantity,
  String? notes,
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

  final row = await SupabaseService.client.from('stock_transfers').insert({
    'organization_id': orgId,
    'inventory_item_id': inventoryItemId,
    'from_user_id': fromUserId,
    'to_user_id': user.id,
    'quantity': quantity,
    'status': 'pending',
    'notes': notes,
  }).select().single();

  return StockTransfer.fromJson(row);
}

/// Accept a transfer request
Future<void> acceptTransfer(String transferId) async {
  await SupabaseService.client
      .from('stock_transfers')
      .update({
        'status': 'accepted',
        'responded_at': DateTime.now().toIso8601String(),
      })
      .eq('id', transferId);
}

/// Generate load sheet prediction for today's jobs
final loadSheetProvider = FutureProvider<List<LoadSheetItem>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  // Get today's assigned jobs
  final jobs = await SupabaseService.client
      .from('jobs')
      .select('title, description')
      .eq('assignee_id', user.id)
      .inFilter('status', ['todo', 'in_progress'])
      .isFilter('deleted_at', null);

  final jobList = jobs as List;
  if (jobList.isEmpty) return [];

  // Get user's van stock
  final stock = await ref.watch(vanStockProvider.future);
  final stockMap = <String, int>{};
  for (final s in stock) {
    if (s.itemName != null) {
      stockMap[s.itemName!.toLowerCase()] = s.quantity;
    }
  }

  // Keyword-based prediction engine
  final predictions = <LoadSheetItem>[];
  final seen = <String>{};

  for (final job in jobList) {
    final title = ((job['title'] as String?) ?? '').toLowerCase();
    final desc = ((job['description'] as String?) ?? '').toLowerCase();
    final text = '$title $desc';

    for (final rule in _predictionRules) {
      if (rule.keywords.any((k) => text.contains(k)) && !seen.contains(rule.itemName)) {
        seen.add(rule.itemName);
        final currentQty = stockMap[rule.itemName.toLowerCase()] ?? 0;
        predictions.add(LoadSheetItem(
          itemName: rule.itemName,
          neededQuantity: rule.defaultQty,
          currentQuantity: currentQty,
          reason: 'Job: ${job['title']}',
          available: currentQty >= rule.defaultQty,
        ));
      }
    }
  }

  return predictions;
});

/// Prediction rules — maps job keywords to required parts
class _PredictionRule {
  final List<String> keywords;
  final String itemName;
  final int defaultQty;
  const _PredictionRule(this.keywords, this.itemName, this.defaultQty);
}

const _predictionRules = [
  _PredictionRule(['cctv', 'camera', 'surveillance'], 'Cat6 Cable', 2),
  _PredictionRule(['cctv', 'camera'], 'BNC Connectors', 4),
  _PredictionRule(['cctv', 'camera'], 'Power Supply 12V', 1),
  _PredictionRule(['leak', 'plumb', 'pipe', 'tap'], 'Washers Assorted', 5),
  _PredictionRule(['leak', 'plumb', 'pipe'], 'Teflon Tape', 2),
  _PredictionRule(['leak', 'pipe', 'burst'], 'Pipe Fittings', 3),
  _PredictionRule(['electrical', 'power', 'socket', 'switch'], 'Cable Ties', 10),
  _PredictionRule(['electrical', 'power'], 'Wire Nuts', 8),
  _PredictionRule(['electrical', 'breaker'], 'Circuit Breaker', 1),
  _PredictionRule(['hvac', 'air con', 'chiller', 'heat'], 'Refrigerant', 1),
  _PredictionRule(['hvac', 'air con'], 'Air Filter', 2),
  _PredictionRule(['lock', 'door', 'access', 'gate'], 'Lock Cylinder', 1),
  _PredictionRule(['lock', 'door'], 'Screws Assorted', 10),
  _PredictionRule(['install', 'mount', 'bracket'], 'Wall Anchors', 6),
  _PredictionRule(['install', 'mount'], 'Screws Assorted', 10),
  _PredictionRule(['paint', 'patch', 'wall'], 'Filler Compound', 1),
  _PredictionRule(['test', 'inspect', 'check'], 'Test Tags', 5),
];
