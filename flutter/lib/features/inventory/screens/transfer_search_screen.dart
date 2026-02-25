import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/inventory_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Van-to-Van transfer search — find parts across the org.
class TransferSearchScreen extends ConsumerStatefulWidget {
  const TransferSearchScreen({super.key});

  @override
  ConsumerState<TransferSearchScreen> createState() => _TransferSearchScreenState();
}

class _TransferSearchScreenState extends ConsumerState<TransferSearchScreen> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final resultsAsync = ref.watch(orgStockSearchProvider(_query));

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: c.border,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(PhosphorIconsLight.arrowLeft, color: c.textSecondary, size: 20),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FIND PARTS',
                        style: GoogleFonts.jetBrainsMono(
                          color: c.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                        ),
                      ),
                      Text(
                        'Search nearby vans & warehouse',
                        style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms),

            // Search bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: c.activeBg,
                  border: Border.all(color: c.borderMedium),
                ),
                child: Row(
                  children: [
                    Icon(PhosphorIconsLight.magnifyingGlass, color: c.textTertiary, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Search item name...',
                          hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onChanged: (v) => setState(() => _query = v.trim()),
                      ),
                    ),
                    if (_query.isNotEmpty)
                      GestureDetector(
                        onTap: () {
                          _controller.clear();
                          setState(() => _query = '');
                        },
                        child: Icon(PhosphorIconsLight.x, color: c.textTertiary, size: 16),
                      ),
                  ],
                ),
              ),
            )
                .animate()
                .fadeIn(delay: 100.ms, duration: 300.ms),

            // Results
            Expanded(
              child: _query.length < 2
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(PhosphorIconsLight.magnifyingGlass, color: c.textTertiary, size: 28),
                          const SizedBox(height: 12),
                          Text(
                            'Search for a part to find\nnearby availability',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  : resultsAsync.when(
                      loading: () => const Center(
                        child: CircularProgressIndicator(color: ObsidianTheme.blue, strokeWidth: 2),
                      ),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (results) {
                        if (results.isEmpty) {
                          return Center(
                            child: Text(
                              'No results for "$_query"',
                              style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                            ),
                          );
                        }

                        return ListView.builder(
                          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                          itemCount: results.length,
                          itemBuilder: (context, index) {
                            final r = results[index];
                            final inv = r['inventory_items'] as Map<String, dynamic>?;
                            final prof = r['profiles'] as Map<String, dynamic>?;
                            final qty = r['quantity'] as int? ?? 0;
                            final userName = prof?['full_name'] as String? ?? 'Unknown';
                            final itemName = inv?['name'] as String? ?? 'Item';

                            return _ResultCard(
                              itemName: itemName,
                              userName: userName,
                              quantity: qty,
                              index: index,
                              onRequest: () async {
                                HapticFeedback.heavyImpact();
                                final invItemId = r['inventory_item_id'] as String;
                                final fromUserId = r['user_id'] as String;
                                await requestTransfer(
                                  inventoryItemId: invItemId,
                                  fromUserId: fromUserId,
                                  quantity: 1,
                                  notes: 'Requested from transfer search',
                                );
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Transfer requested from $userName'),
                                      backgroundColor: ObsidianTheme.emerald,
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              },
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final String itemName;
  final String userName;
  final int quantity;
  final int index;
  final VoidCallback onRequest;

  const _ResultCard({
    required this.itemName,
    required this.userName,
    required this.quantity,
    required this.index,
    required this.onRequest,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          // Van icon
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: ObsidianTheme.blue.withValues(alpha: 0.1),
            ),
            child: const Icon(PhosphorIconsLight.van, color: ObsidianTheme.blue, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  userName,
                  style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      '$quantity available',
                      style: GoogleFonts.jetBrainsMono(
                        color: quantity > 2 ? ObsidianTheme.emerald : ObsidianTheme.amber,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onRequest,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: ObsidianTheme.blue.withValues(alpha: 0.1),
                border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.2)),
              ),
              child: Text(
                'Request',
                style: GoogleFonts.inter(color: ObsidianTheme.blue, fontSize: 12, fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 60 * index), duration: 400.ms)
        .moveY(begin: 8, delay: Duration(milliseconds: 60 * index), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}
