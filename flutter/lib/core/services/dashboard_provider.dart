import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:iworkr_mobile/core/services/rbac_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Data Model ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

enum WidgetSize { small, medium, large }

class DashboardWidgetConfig {
  final String id;
  final String type;
  final WidgetSize size;

  const DashboardWidgetConfig({
    required this.id,
    required this.type,
    required this.size,
  });

  DashboardWidgetConfig copyWith({WidgetSize? size}) =>
      DashboardWidgetConfig(id: id, type: type, size: size ?? this.size);

  Map<String, dynamic> toJson() => {'id': id, 'type': type, 'size': size.name};

  factory DashboardWidgetConfig.fromJson(Map<String, dynamic> json) =>
      DashboardWidgetConfig(
        id: json['id'] as String,
        type: json['type'] as String,
        size: WidgetSize.values.byName(json['size'] as String),
      );

  /// Column span in the 2-col grid
  int get crossAxisCellCount => size == WidgetSize.small ? 1 : 2;

  /// Row span
  int get mainAxisCellCount {
    switch (size) {
      case WidgetSize.small:
        return 1;
      case WidgetSize.medium:
        return 1;
      case WidgetSize.large:
        return 2;
    }
  }
}

/// Widget type metadata for the gallery
class WidgetTypeInfo {
  final String type;
  final String label;
  final String description;
  final List<WidgetSize> supportedSizes;

  /// If set, the widget only appears in the gallery for users with this claim
  final String? requiredClaim;

  const WidgetTypeInfo({
    required this.type,
    required this.label,
    required this.description,
    required this.supportedSizes,
    this.requiredClaim,
  });
}

const widgetCatalog = <WidgetTypeInfo>[
  WidgetTypeInfo(
    type: 'revenue',
    label: 'Revenue',
    description: 'Monthly revenue with sparkline and trend',
    supportedSizes: [WidgetSize.medium, WidgetSize.large],
    requiredClaim: Claims.financeView,
  ),
  WidgetTypeInfo(
    type: 'schedule',
    label: 'Schedule',
    description: "Today's upcoming schedule blocks",
    supportedSizes: [WidgetSize.medium, WidgetSize.large],
  ),
  WidgetTypeInfo(
    type: 'quick_actions',
    label: 'Quick Actions',
    description: 'Shortcuts to common tasks',
    supportedSizes: [WidgetSize.small, WidgetSize.medium],
  ),
];

// ═══════════════════════════════════════════════════════════
// ── Default Layout ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Admin / Owner "God Mode" — Core 5 command deck
const _adminLayout = <DashboardWidgetConfig>[
  DashboardWidgetConfig(id: 'w1', type: 'revenue', size: WidgetSize.large),
  DashboardWidgetConfig(id: 'w2', type: 'schedule', size: WidgetSize.large),
  DashboardWidgetConfig(id: 'w3', type: 'quick_actions', size: WidgetSize.medium),
];

/// Technician "Operator Mode" — same Core 5 layout
const _techLayout = <DashboardWidgetConfig>[
  DashboardWidgetConfig(id: 'w1', type: 'revenue', size: WidgetSize.large),
  DashboardWidgetConfig(id: 'w2', type: 'schedule', size: WidgetSize.large),
  DashboardWidgetConfig(id: 'w3', type: 'quick_actions', size: WidgetSize.medium),
];

List<DashboardWidgetConfig> defaultLayoutForRole(UserRole role) {
  if (role.isGodMode) return _adminLayout;
  return _techLayout;
}

const _storageKey = 'dashboard_layout_v4';

// ═══════════════════════════════════════════════════════════
// ── State Notifier ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class DashboardLayoutNotifier extends StateNotifier<List<DashboardWidgetConfig>> {
  final UserRole _role;

  DashboardLayoutNotifier(this._role) : super(defaultLayoutForRole(_role)) {
    _load();
  }

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> _load() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw != null) {
        final list = (jsonDecode(raw) as List)
            .map((e) => DashboardWidgetConfig.fromJson(e as Map<String, dynamic>))
            .toList();
        if (list.isNotEmpty) state = list;
      }
    } catch (_) {
      // Fall back to role-based default layout
    }
  }

  Future<void> _save() async {
    final json = jsonEncode(state.map((w) => w.toJson()).toList());
    await _storage.write(key: _storageKey, value: json);
  }

  void reorder(int oldIndex, int newIndex) {
    final items = [...state];
    if (newIndex > oldIndex) newIndex -= 1;
    final item = items.removeAt(oldIndex);
    items.insert(newIndex, item);
    state = items;
    _save();
  }

  void resizeWidget(String id) {
    final items = state.map((w) {
      if (w.id != id) return w;
      final info = widgetCatalog.where((c) => c.type == w.type).firstOrNull;
      if (info == null) return w;
      final sizes = info.supportedSizes;
      final currentIdx = sizes.indexOf(w.size);
      final nextIdx = (currentIdx + 1) % sizes.length;
      return w.copyWith(size: sizes[nextIdx]);
    }).toList();
    state = items;
    _save();
  }

  void removeWidget(String id) {
    state = state.where((w) => w.id != id).toList();
    _save();
  }

  void addWidget(String type, WidgetSize size) {
    final id = 'w${DateTime.now().millisecondsSinceEpoch}';
    state = [...state, DashboardWidgetConfig(id: id, type: type, size: size)];
    _save();
  }

  void resetToDefault() {
    state = defaultLayoutForRole(_role);
    _save();
  }
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final dashboardLayoutProvider =
    StateNotifierProvider<DashboardLayoutNotifier, List<DashboardWidgetConfig>>(
  (ref) {
    final role = ref.watch(userRoleProvider).valueOrNull ?? UserRole.technician;
    return DashboardLayoutNotifier(role);
  },
);

final dashboardEditModeProvider = StateProvider<bool>((ref) => false);

/// Widget catalog filtered by user claims
final filteredWidgetCatalogProvider = FutureProvider<List<WidgetTypeInfo>>((ref) async {
  final claims = await ref.watch(userClaimsProvider.future);
  return widgetCatalog.where((w) {
    if (w.requiredClaim == null) return true;
    return claims.contains(w.requiredClaim);
  }).toList();
});
