import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/asset_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/core/widgets/stealth_text_field.dart';

class AssetVaultScreen extends ConsumerStatefulWidget {
  const AssetVaultScreen({super.key});

  @override
  ConsumerState<AssetVaultScreen> createState() => _AssetVaultScreenState();
}

class _AssetVaultScreenState extends ConsumerState<AssetVaultScreen> {
  int _viewMode = 0;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildSearchBar(),
            _buildViewToggle(),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _viewMode == 0
                    ? _AssetListView(key: const ValueKey(0))
                    : _AssetTreeView(key: const ValueKey(1)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: c.hoverBg,
                borderRadius: ObsidianTheme.radiusMd,
              ),
              child: Icon(PhosphorIconsLight.arrowLeft, color: c.textSecondary, size: 20),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'The Vault',
                  style: GoogleFonts.inter(
                    fontSize: 20, fontWeight: FontWeight.w600,
                    color: c.textPrimary, letterSpacing: -0.3,
                  ),
                ),
                Text(
                  'Asset Registry',
                  style: GoogleFonts.jetBrainsMono(fontSize: 11, color: c.textTertiary),
                ),
              ],
            ),
          ),
          Consumer(
            builder: (_, ref, __) {
              final assetsAsync = ref.watch(assetsProvider);
              final count = assetsAsync.valueOrNull?.length ?? 0;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusFull,
                  color: c.hoverBg,
                  border: Border.all(color: c.border),
                ),
                child: Text(
                  '$count',
                  style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textSecondary),
                ),
              );
            },
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 300.ms, curve: ObsidianTheme.easeOutExpo);
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: StealthTextField(
        label: 'Search',
        controller: _searchController,
        focusNode: _searchFocus,
        hintText: 'Search assets, serial numbers...',
        prefixIcon: PhosphorIconsLight.magnifyingGlass,
        onChanged: (value) {
          ref.read(assetSearchQueryProvider.notifier).state = value;
        },
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 300.ms);
  }

  Widget _buildViewToggle() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          _ViewToggleButton(
            label: 'LIST',
            icon: PhosphorIconsLight.list,
            isActive: _viewMode == 0,
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _viewMode = 0);
            },
          ),
          const SizedBox(width: 6),
          _ViewToggleButton(
            label: 'TREE',
            icon: PhosphorIconsLight.treeStructure,
            isActive: _viewMode == 1,
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _viewMode = 1);
            },
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 150.ms, duration: 300.ms);
  }
}

class _ViewToggleButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;

  const _ViewToggleButton({
    required this.label,
    required this.icon,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: isActive ? c.activeBg : Colors.transparent,
          border: Border.all(
            color: isActive ? c.borderActive : c.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isActive ? c.textPrimary : c.textTertiary),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9, fontWeight: FontWeight.w600,
                color: isActive ? c.textPrimary : c.textTertiary,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Asset List View ─────────────────────────────────

class _AssetListView extends ConsumerWidget {
  const _AssetListView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final assetsAsync = ref.watch(filteredAssetsProvider);

    return assetsAsync.when(
      data: (assets) {
        if (assets.isEmpty) {
          return const AnimatedEmptyState(
            type: EmptyStateType.crate,
            title: 'No Assets Found',
            subtitle: 'Equipment under management\nwill appear here.',
          );
        }
        return RefreshIndicator(
          color: ObsidianTheme.emerald,
          backgroundColor: c.surface,
          onRefresh: () async => ref.invalidate(assetsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
            itemCount: assets.length,
            itemBuilder: (_, i) => _AssetCard(asset: assets[i], index: i),
          ),
        );
      },
      loading: () => Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

// ── Asset Tree View ─────────────────────────────────

class _AssetTreeView extends ConsumerWidget {
  const _AssetTreeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupedAsync = ref.watch(assetsByLocationProvider);

    return groupedAsync.when(
      data: (grouped) {
        if (grouped.isEmpty) {
          return const AnimatedEmptyState(
            type: EmptyStateType.crate,
            title: 'No Assets Found',
            subtitle: 'Equipment organized by location\nwill appear here.',
          );
        }
        final locations = grouped.keys.toList()..sort();
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
          itemCount: locations.length,
          itemBuilder: (_, i) {
            final loc = locations[i];
            return _LocationTreeNode(
              location: loc,
              assets: grouped[loc]!,
              index: i,
            );
          },
        );
      },
      loading: () => Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _LocationTreeNode extends StatefulWidget {
  final String location;
  final List<Map<String, dynamic>> assets;
  final int index;

  const _LocationTreeNode({
    required this.location,
    required this.assets,
    required this.index,
  });

  @override
  State<_LocationTreeNode> createState() => _LocationTreeNodeState();
}

class _LocationTreeNodeState extends State<_LocationTreeNode> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() => _expanded = !_expanded);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            margin: const EdgeInsets.only(bottom: 4),
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusMd,
              color: c.hoverBg,
            ),
            child: Row(
              children: [
                Icon(
                  PhosphorIconsLight.mapPin,
                  size: 14,
                  color: ObsidianTheme.emerald.withValues(alpha: 0.7),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.location,
                    style: GoogleFonts.inter(
                      fontSize: 13, fontWeight: FontWeight.w500,
                      color: c.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    color: c.hoverBg,
                  ),
                  child: Text(
                    '${widget.assets.length}',
                    style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                  ),
                ),
                const SizedBox(width: 8),
                AnimatedRotation(
                  turns: _expanded ? 0.25 : 0,
                  duration: ObsidianTheme.fast,
                  child: Icon(PhosphorIconsLight.caretRight, size: 14, color: c.textTertiary),
                ),
              ],
            ),
          ),
        )
            .animate()
            .fadeIn(delay: Duration(milliseconds: 60 * widget.index), duration: 400.ms),

        AnimatedCrossFade(
          firstChild: Column(
            children: widget.assets.asMap().entries.map((e) {
              return Padding(
                padding: const EdgeInsets.only(left: 24),
                child: _AssetCard(asset: e.value, index: e.key, compact: true),
              );
            }).toList(),
          ),
          secondChild: const SizedBox.shrink(),
          crossFadeState: _expanded ? CrossFadeState.showFirst : CrossFadeState.showSecond,
          duration: const Duration(milliseconds: 200),
        ),

        const SizedBox(height: 8),
      ],
    );
  }
}

// ── Asset Card ──────────────────────────────────────

class _AssetCard extends StatelessWidget {
  final Map<String, dynamic> asset;
  final int index;
  final bool compact;

  const _AssetCard({
    required this.asset,
    required this.index,
    this.compact = false,
  });

  Color _statusColor(String status) {
    switch (status) {
      case 'available':
        return ObsidianTheme.emerald;
      case 'in_use':
        return ObsidianTheme.blue;
      case 'maintenance':
        return ObsidianTheme.amber;
      case 'retired':
        return ObsidianTheme.textTertiary;
      default:
        return ObsidianTheme.textSecondary;
    }
  }

  IconData _categoryIcon(String category) {
    switch (category) {
      case 'vehicle':
        return PhosphorIconsLight.van;
      case 'tool':
        return PhosphorIconsLight.wrench;
      case 'equipment':
        return PhosphorIconsLight.engine;
      case 'meter':
        return PhosphorIconsLight.gauge;
      case 'safety':
        return PhosphorIconsLight.hardHat;
      default:
        return PhosphorIconsLight.cube;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final name = asset['name'] as String? ?? 'Unnamed Asset';
    final serial = asset['serial_number'] as String?;
    final status = asset['status'] as String? ?? 'available';
    final category = asset['category'] as String? ?? 'other';
    final make = asset['make'] as String?;
    final model = asset['model'] as String?;
    final nextService = asset['next_service'] != null
        ? DateTime.tryParse(asset['next_service'].toString())
        : null;
    final isOverdue = nextService != null && nextService.isBefore(DateTime.now());

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/assets/${asset['id']}');
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: EdgeInsets.all(compact ? 10 : 14),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusLg,
          color: c.surface,
          border: Border.all(
            color: isOverdue
                ? ObsidianTheme.rose.withValues(alpha: 0.15)
                : c.border,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: compact ? 36 : 44,
              height: compact ? 36 : 44,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: _statusColor(status).withValues(alpha: 0.1),
              ),
              child: Center(
                child: Icon(
                  _categoryIcon(category),
                  size: compact ? 16 : 20,
                  color: _statusColor(status),
                ),
              ),
            ),
            const SizedBox(width: 12),

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: GoogleFonts.inter(
                      fontSize: compact ? 12 : 14,
                      fontWeight: FontWeight.w500,
                      color: c.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (serial != null) ...[
                        Text(
                          serial,
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (make != null || model != null)
                        Text(
                          [make, model].where((s) => s != null).join(' '),
                          style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary),
                        ),
                    ],
                  ),
                  if (isOverdue) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(PhosphorIconsLight.warning, size: 10, color: ObsidianTheme.rose),
                        const SizedBox(width: 4),
                        Text(
                          'Service overdue',
                          style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.rose),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            Container(
              width: 8, height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _statusColor(status),
                boxShadow: [BoxShadow(color: _statusColor(status).withValues(alpha: 0.4), blurRadius: 4)],
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 80 + index * 30), duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 80 + index * 30), duration: 500.ms);
  }
}
