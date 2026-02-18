import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/inventory_provider.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/models/van_stock.dart';

/// Inventory Screen — Van stock overview + Load Sheet predictions.
class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  int _tabIndex = 0; // 0 = Van Stock, 1 = Load Sheet, 2 = Transfers

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildTabs(),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _tabIndex == 0
                    ? _VanStockTab(key: const ValueKey(0))
                    : _tabIndex == 1
                        ? _LoadSheetTab(key: const ValueKey(1))
                        : _TransfersTab(key: const ValueKey(2)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 20),
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'THE SUPPLY CHAIN',
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'Van Inventory & Load Predictions',
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildTabs() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: Colors.white.withValues(alpha: 0.03),
      ),
      child: Row(
        children: [
          _Tab(label: 'VAN STOCK', active: _tabIndex == 0, onTap: () => setState(() => _tabIndex = 0)),
          _Tab(label: 'LOAD SHEET', active: _tabIndex == 1, onTap: () => setState(() => _tabIndex = 1)),
          _Tab(label: 'TRANSFERS', active: _tabIndex == 2, onTap: () => setState(() => _tabIndex = 2)),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 300.ms);
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Tab({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: active ? Colors.white.withValues(alpha: 0.06) : Colors.transparent,
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                color: active ? Colors.white : ObsidianTheme.textTertiary,
                fontSize: 9,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                letterSpacing: 1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Van Stock Tab ────────────────────────────────────
class _VanStockTab extends ConsumerWidget {
  const _VanStockTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stockAsync = ref.watch(vanStockProvider);

    return stockAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.amber, strokeWidth: 2),
      ),
      error: (e, _) => Center(
        child: Text('Failed to load stock', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary)),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const AnimatedEmptyState(
            type: EmptyStateType.crate,
            title: 'Van Stock Empty',
            subtitle: 'Items assigned to your van\nwill appear here.',
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          itemCount: items.length,
          itemBuilder: (context, index) {
            final item = items[index];
            return _StockItemCard(item: item, index: index, ref: ref);
          },
        );
      },
    );
  }
}

class _StockItemCard extends StatelessWidget {
  final VanStockItem item;
  final int index;
  final WidgetRef ref;

  const _StockItemCard({required this.item, required this.index, required this.ref});

  Color get _stockColor {
    if (item.isOutOfStock) return ObsidianTheme.rose;
    if (item.isLowStock) return ObsidianTheme.amber;
    return ObsidianTheme.emerald;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(
          color: item.isLowStock
              ? _stockColor.withValues(alpha: 0.15)
              : Colors.white.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          // Stock level indicator
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: _stockColor.withValues(alpha: 0.1),
            ),
            child: Center(
              child: Text(
                '${item.quantity}',
                style: GoogleFonts.jetBrainsMono(
                  color: _stockColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.itemName ?? 'Unknown Item',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (item.sku != null) ...[
                      Text(
                        item.sku!,
                        style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        color: _stockColor.withValues(alpha: 0.1),
                      ),
                      child: Text(
                        item.stockLevelLabel,
                        style: GoogleFonts.jetBrainsMono(
                          color: _stockColor,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                    // Cost price — redacted for Techs (requires inventory.cost claim)
                    if (item.unitCost != null)
                      PermissionGuard(
                        claim: Claims.inventoryCost,
                        child: Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: const Color(0xFFA78BFA).withValues(alpha: 0.08),
                            ),
                            child: Text(
                              '\$${item.unitCost!.toStringAsFixed(2)}',
                              style: GoogleFonts.jetBrainsMono(
                                color: const Color(0xFFA78BFA),
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          // Use button (decrement)
          GestureDetector(
            onTap: () async {
              HapticFeedback.mediumImpact();
              await useVanStock(vanStockId: item.id);
              ref.invalidate(vanStockProvider);
              ref.invalidate(lowStockProvider);
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Colors.white.withValues(alpha: 0.05),
              ),
              child: Text(
                '-1',
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 60 * index),
          duration: 400.ms,
        )
        .moveX(
          begin: 10,
          delay: Duration(milliseconds: 60 * index),
          duration: 400.ms,
          curve: Curves.easeOutCubic,
        );
  }
}

// ── Load Sheet Tab ───────────────────────────────────
class _LoadSheetTab extends ConsumerWidget {
  const _LoadSheetTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loadAsync = ref.watch(loadSheetProvider);

    return loadAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.amber, strokeWidth: 2),
      ),
      error: (e, _) => Center(
        child: Text('Failed to generate', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary)),
      ),
      data: (items) {
        if (items.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.sparkle, color: ObsidianTheme.amber, size: 32),
                const SizedBox(height: 12),
                Text(
                  'No predictions for today',
                  style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Text(
                  'Schedule jobs to get AI load predictions',
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
                ),
              ],
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          children: [
            // AI badge
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: LinearGradient(
                  colors: [
                    ObsidianTheme.amber.withValues(alpha: 0.06),
                    ObsidianTheme.amber.withValues(alpha: 0.02),
                  ],
                ),
                border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.12)),
              ),
              child: Row(
                children: [
                  Icon(PhosphorIconsLight.sparkle, color: ObsidianTheme.amber, size: 16),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'AI analyzed today\'s ${items.length} job${items.length == 1 ? '' : 's'} and suggests these parts',
                      style: GoogleFonts.inter(color: ObsidianTheme.amber, fontSize: 12),
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms),

            // Items
            ...items.asMap().entries.map((entry) {
              final i = entry.key;
              final item = entry.value;
              return _LoadSheetItemCard(item: item, index: i);
            }),
          ],
        );
      },
    );
  }
}

class _LoadSheetItemCard extends StatelessWidget {
  final LoadSheetItem item;
  final int index;
  const _LoadSheetItemCard({required this.item, required this.index});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(
          color: item.isMissing
              ? ObsidianTheme.amber.withValues(alpha: 0.2)
              : ObsidianTheme.emerald.withValues(alpha: 0.15),
        ),
      ),
      child: Row(
        children: [
          // Status icon
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: item.isMissing
                  ? ObsidianTheme.amber.withValues(alpha: 0.1)
                  : ObsidianTheme.emerald.withValues(alpha: 0.1),
            ),
            child: Icon(
              item.isMissing ? PhosphorIconsLight.warning : PhosphorIconsBold.check,
              color: item.isMissing ? ObsidianTheme.amber : ObsidianTheme.emerald,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.itemName,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.reason,
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'Need ${item.neededQuantity}',
                style: GoogleFonts.jetBrainsMono(
                  color: item.isMissing ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (item.isMissing)
                Text(
                  'Have ${item.currentQuantity}',
                  style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.rose, fontSize: 10),
                ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 80 * index), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: 80 * index), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ── Transfers Tab ────────────────────────────────────
class _TransfersTab extends ConsumerWidget {
  const _TransfersTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transfersAsync = ref.watch(pendingTransfersProvider);

    return transfersAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.blue, strokeWidth: 2),
      ),
      error: (e, _) => const SizedBox.shrink(),
      data: (transfers) {
        if (transfers.isEmpty) {
          return const AnimatedEmptyState(
            type: EmptyStateType.team,
            title: 'No Transfers',
            subtitle: 'Van-to-van stock transfers\nwill appear here.',
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          itemCount: transfers.length,
          itemBuilder: (context, index) {
            final t = transfers[index];
            return _TransferCard(transfer: t, index: index, ref: ref);
          },
        );
      },
    );
  }
}

class _TransferCard extends StatelessWidget {
  final StockTransfer transfer;
  final int index;
  final WidgetRef ref;

  const _TransferCard({required this.transfer, required this.index, required this.ref});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIconsLight.arrowsLeftRight, color: ObsidianTheme.blue, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  transfer.itemName ?? 'Item',
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: transfer.isPending
                      ? ObsidianTheme.amber.withValues(alpha: 0.1)
                      : ObsidianTheme.emerald.withValues(alpha: 0.1),
                ),
                child: Text(
                  transfer.status.toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(
                    color: transfer.isPending ? ObsidianTheme.amber : ObsidianTheme.emerald,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Qty: ${transfer.quantity}',
            style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 11),
          ),
          if (transfer.isPending) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      HapticFeedback.mediumImpact();
                      await acceptTransfer(transfer.id);
                      ref.invalidate(pendingTransfersProvider);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                      ),
                      child: Center(
                        child: Text(
                          'Accept',
                          style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 12, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: ObsidianTheme.rose.withValues(alpha: 0.06),
                      border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.15)),
                    ),
                    child: Center(
                      child: Text(
                        'Decline',
                        style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 80 * index), duration: 400.ms)
        .moveY(begin: 8, delay: Duration(milliseconds: 80 * index), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}
