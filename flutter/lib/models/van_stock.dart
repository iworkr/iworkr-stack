/// Van Stock Item — per-user inventory tracking.
///
/// Mirrors Supabase `van_stock` joined with `inventory_items`.
class VanStockItem {
  final String id;
  final String organizationId;
  final String userId;
  final String inventoryItemId;
  final int quantity;
  final int minQuantity;
  final DateTime? lastRestockedAt;

  // From joined inventory_items
  final String? itemName;
  final String? sku;
  final String? category;
  final double? unitCost;

  const VanStockItem({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.inventoryItemId,
    required this.quantity,
    this.minQuantity = 2,
    this.lastRestockedAt,
    this.itemName,
    this.sku,
    this.category,
    this.unitCost,
  });

  bool get isLowStock => quantity <= minQuantity;
  bool get isOutOfStock => quantity <= 0;

  String get stockLevelLabel {
    if (isOutOfStock) return 'OUT';
    if (isLowStock) return 'LOW';
    return 'OK';
  }

  factory VanStockItem.fromJson(Map<String, dynamic> json) {
    final inv = json['inventory_items'] as Map<String, dynamic>?;
    return VanStockItem(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      inventoryItemId: json['inventory_item_id'] as String,
      quantity: json['quantity'] as int? ?? 0,
      minQuantity: json['min_quantity'] as int? ?? 2,
      lastRestockedAt: json['last_restocked_at'] != null
          ? DateTime.tryParse(json['last_restocked_at'] as String)
          : null,
      itemName: inv?['name'] as String?,
      sku: inv?['sku'] as String?,
      category: inv?['category'] as String?,
      unitCost: (inv?['unit_cost'] as num?)?.toDouble(),
    );
  }
}

/// Stock Transfer — van-to-van or warehouse-to-van.
///
/// Mirrors Supabase `stock_transfers`.
class StockTransfer {
  final String id;
  final String organizationId;
  final String inventoryItemId;
  final String? fromUserId;
  final String toUserId;
  final int quantity;
  final String status; // pending, accepted, declined, completed
  final String? fromLocation;
  final String? toLocation;
  final String? notes;
  final DateTime requestedAt;
  final DateTime? respondedAt;
  final DateTime? completedAt;

  // Joined data
  final String? itemName;
  final String? fromUserName;
  final String? toUserName;

  const StockTransfer({
    required this.id,
    required this.organizationId,
    required this.inventoryItemId,
    this.fromUserId,
    required this.toUserId,
    required this.quantity,
    required this.status,
    this.fromLocation,
    this.toLocation,
    this.notes,
    required this.requestedAt,
    this.respondedAt,
    this.completedAt,
    this.itemName,
    this.fromUserName,
    this.toUserName,
  });

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';

  factory StockTransfer.fromJson(Map<String, dynamic> json) {
    return StockTransfer(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      inventoryItemId: json['inventory_item_id'] as String,
      fromUserId: json['from_user_id'] as String?,
      toUserId: json['to_user_id'] as String,
      quantity: json['quantity'] as int? ?? 1,
      status: json['status'] as String? ?? 'pending',
      fromLocation: json['from_location'] as String?,
      toLocation: json['to_location'] as String?,
      notes: json['notes'] as String?,
      requestedAt: DateTime.tryParse(json['requested_at'] as String? ?? '') ?? DateTime.now(),
      respondedAt: json['responded_at'] != null ? DateTime.tryParse(json['responded_at'] as String) : null,
      completedAt: json['completed_at'] != null ? DateTime.tryParse(json['completed_at'] as String) : null,
      itemName: (json['inventory_items'] as Map<String, dynamic>?)?['name'] as String?,
      fromUserName: (json['from_profile:profiles'] as Map<String, dynamic>?)?['full_name'] as String?,
      toUserName: (json['to_profile:profiles'] as Map<String, dynamic>?)?['full_name'] as String?,
    );
  }
}

/// Load Sheet Prediction — AI morning load suggestion.
class LoadSheetItem {
  final String itemName;
  final String? sku;
  final int neededQuantity;
  final int currentQuantity;
  final String reason; // e.g. "CCTV Install requires Cat6 Cable"
  final bool available;

  const LoadSheetItem({
    required this.itemName,
    this.sku,
    required this.neededQuantity,
    required this.currentQuantity,
    required this.reason,
    required this.available,
  });

  bool get isMissing => !available || currentQuantity < neededQuantity;
  int get deficit => (neededQuantity - currentQuantity).clamp(0, neededQuantity);

  factory LoadSheetItem.fromJson(Map<String, dynamic> json) {
    return LoadSheetItem(
      itemName: json['item_name'] as String? ?? '',
      sku: json['sku'] as String?,
      neededQuantity: json['needed_quantity'] as int? ?? 0,
      currentQuantity: json['current_quantity'] as int? ?? 0,
      reason: json['reason'] as String? ?? '',
      available: json['available'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'item_name': itemName,
        'sku': sku,
        'needed_quantity': neededQuantity,
        'current_quantity': currentQuantity,
        'reason': reason,
        'available': available,
      };
}
