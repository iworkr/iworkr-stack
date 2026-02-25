import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/asset_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';

class AssetDetailScreen extends ConsumerWidget {
  final String assetId;
  const AssetDetailScreen({super.key, required this.assetId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final assetAsync = ref.watch(assetDetailProvider(assetId));
    final historyAsync = ref.watch(assetHistoryProvider(assetId));

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: assetAsync.when(
          data: (asset) {
            if (asset == null) {
              return Center(
                child: Text('Asset not found', style: GoogleFonts.inter(color: c.textTertiary)),
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
              children: [
                _buildHeader(context, asset),
                const SizedBox(height: 20),
                _buildInfoCard(context, asset),
                const SizedBox(height: 16),
                _buildSpecsGrid(context, asset),
                const SizedBox(height: 24),
                _buildActionButton(context, asset),
                const SizedBox(height: 28),
                _buildHistorySection(context, historyAsync),
              ],
            );
          },
          loading: () => Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                ShimmerLoading(height: 80, borderRadius: ObsidianTheme.radiusLg),
                const SizedBox(height: 16),
                ShimmerLoading(height: 200, borderRadius: ObsidianTheme.radiusLg),
              ],
            ),
          ),
          error: (e, _) => Center(
            child: Text('Error: $e', style: TextStyle(color: ObsidianTheme.rose)),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, Map<String, dynamic> asset) {
    final c = context.iColors;
    final name = asset['name'] as String? ?? 'Asset';
    final status = asset['status'] as String? ?? 'available';
    final category = asset['category'] as String? ?? 'other';

    return Row(
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
                name,
                style: GoogleFonts.inter(
                  fontSize: 20, fontWeight: FontWeight.w600,
                  color: c.textPrimary, letterSpacing: -0.3,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Row(
                children: [
                  Text(
                    category.toUpperCase(),
                    style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 6, height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: status == 'available'
                          ? ObsidianTheme.emerald
                          : status == 'maintenance'
                              ? ObsidianTheme.amber
                              : c.textTertiary,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    status.toUpperCase(),
                    style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (asset['barcode'] != null)
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              _showQRDialog(context, asset['barcode'] as String);
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                border: Border.all(color: c.border),
              ),
              child: Icon(PhosphorIconsLight.qrCode, size: 18, color: c.textSecondary),
            ),
          ),
      ],
    )
        .animate()
        .fadeIn(duration: 300.ms, curve: ObsidianTheme.easeOutExpo);
  }

  Widget _buildInfoCard(BuildContext context, Map<String, dynamic> asset) {
    final serial = asset['serial_number'] as String?;
    final make = asset['make'] as String?;
    final model = asset['model'] as String?;
    final year = asset['year'] as int?;
    final location = asset['location'] as String?;

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          if (serial != null) _InfoRow('Serial Number', serial, PhosphorIconsLight.barcode),
          if (make != null) _InfoRow('Make', make, PhosphorIconsLight.factory),
          if (model != null) _InfoRow('Model', model, PhosphorIconsLight.tag),
          if (year != null) _InfoRow('Year', year.toString(), PhosphorIconsLight.calendar),
          if (location != null) _InfoRow('Location', location, PhosphorIconsLight.mapPin),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
        .moveY(begin: 10, end: 0, delay: 100.ms, duration: 500.ms);
  }

  Widget _buildSpecsGrid(BuildContext context, Map<String, dynamic> asset) {
    final c = context.iColors;
    final purchaseDate = asset['purchase_date'] != null
        ? DateTime.tryParse(asset['purchase_date'].toString())
        : null;
    final purchaseCost = asset['purchase_cost'] as num?;
    final lastService = asset['last_service'] != null
        ? DateTime.tryParse(asset['last_service'].toString())
        : null;
    final nextService = asset['next_service'] != null
        ? DateTime.tryParse(asset['next_service'].toString())
        : null;
    final warrantyExpiry = asset['warranty_expiry'] != null
        ? DateTime.tryParse(asset['warranty_expiry'].toString())
        : null;

    final specs = <_SpecItem>[];
    if (purchaseDate != null) {
      specs.add(_SpecItem('Purchased', DateFormat('d MMM yyyy').format(purchaseDate), PhosphorIconsLight.shoppingCart));
    }
    if (purchaseCost != null) {
      specs.add(_SpecItem('Cost', '\$${purchaseCost.toStringAsFixed(2)}', PhosphorIconsLight.currencyDollar));
    }
    if (lastService != null) {
      specs.add(_SpecItem('Last Service', DateFormat('d MMM yyyy').format(lastService), PhosphorIconsLight.wrench));
    }
    if (nextService != null) {
      final isOverdue = nextService.isBefore(DateTime.now());
      specs.add(_SpecItem(
        'Next Service',
        DateFormat('d MMM yyyy').format(nextService),
        PhosphorIconsLight.calendarCheck,
        isOverdue ? ObsidianTheme.rose : null,
      ));
    }
    if (warrantyExpiry != null) {
      final expired = warrantyExpiry.isBefore(DateTime.now());
      specs.add(_SpecItem(
        'Warranty',
        expired ? 'Expired' : DateFormat('d MMM yyyy').format(warrantyExpiry),
        PhosphorIconsLight.shieldCheck,
        expired ? ObsidianTheme.amber : null,
      ));
    }

    if (specs.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SPECIFICATIONS',
          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5),
        ),
        const SizedBox(height: 10),
        ...specs.asMap().entries.map((e) {
          final i = e.key;
          final s = e.value;
          return Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusMd,
              color: c.surface,
              border: Border.all(color: s.alertColor != null
                  ? s.alertColor!.withValues(alpha: 0.2)
                  : c.border),
            ),
            child: Row(
              children: [
                Icon(s.icon, size: 14, color: s.alertColor ?? c.textTertiary),
                const SizedBox(width: 10),
                Text(s.label,
                    style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
                const Spacer(),
                Text(s.value,
                    style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w500,
                        color: s.alertColor ?? c.textPrimary)),
              ],
            ),
          )
              .animate()
              .fadeIn(delay: Duration(milliseconds: 200 + i * 40), duration: 400.ms)
              .moveY(begin: 6, end: 0, delay: Duration(milliseconds: 200 + i * 40), duration: 400.ms);
        }),
      ],
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 500.ms);
  }

  Widget _buildActionButton(BuildContext context, Map<String, dynamic> asset) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        context.push('/jobs');
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
          color: ObsidianTheme.emeraldDim,
        ),
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(PhosphorIconsLight.plus, size: 16, color: ObsidianTheme.emerald),
              const SizedBox(width: 8),
              Text(
                'Create Job for Asset',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.emerald),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 300.ms, duration: 400.ms);
  }

  Widget _buildHistorySection(BuildContext context, AsyncValue<List<Map<String, dynamic>>> historyAsync) {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SERVICE HISTORY',
          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5),
        )
            .animate()
            .fadeIn(delay: 350.ms, duration: 300.ms),
        const SizedBox(height: 12),
        historyAsync.when(
          data: (history) {
            if (history.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusLg,
                  color: c.surface,
                  border: Border.all(color: c.border),
                ),
                child: Center(
                  child: Column(
                    children: [
                      Icon(PhosphorIconsLight.clockCounterClockwise, size: 24, color: c.textTertiary),
                      const SizedBox(height: 8),
                      Text(
                        'No service history yet',
                        style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                      ),
                    ],
                  ),
                ),
              );
            }
            return Column(
              children: history.asMap().entries.map((e) {
                final i = e.key;
                final audit = e.value;
                return _HistoryEntry(audit: audit, index: i, isLast: i == history.length - 1);
              }).toList(),
            );
          },
          loading: () => ShimmerLoading(height: 100, borderRadius: ObsidianTheme.radiusLg),
          error: (_, __) => const SizedBox.shrink(),
        ),
      ],
    );
  }

  void _showQRDialog(BuildContext context, String barcode) {
    final c = context.iColors;
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: c.surface,
        shape: RoundedRectangleBorder(borderRadius: ObsidianTheme.radiusLg),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Barcode',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  color: Colors.white,
                ),
                child: Text(
                  barcode,
                  style: GoogleFonts.jetBrainsMono(fontSize: 18, color: Colors.black),
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: barcode));
                  HapticFeedback.lightImpact();
                  Navigator.of(context).pop();
                },
                child: Text(
                  'Copy to clipboard',
                  style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.emerald),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _InfoRow(this.label, this.value, this.icon);

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 14, color: c.textTertiary),
          const SizedBox(width: 10),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
          ),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w500, color: c.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _SpecItem {
  final String label;
  final String value;
  final IconData icon;
  final Color? alertColor;
  const _SpecItem(this.label, this.value, this.icon, [this.alertColor]);
}

class _HistoryEntry extends StatelessWidget {
  final Map<String, dynamic> audit;
  final int index;
  final bool isLast;

  const _HistoryEntry({required this.audit, required this.index, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final action = audit['action'] as String? ?? 'updated';
    final details = audit['notes'] as String?;
    final performedBy = audit['user_name'] as String?;
    final createdAt = DateTime.tryParse(audit['created_at']?.toString() ?? '');

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 24,
          child: Column(
            children: [
              Container(
                width: 8, height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald.withValues(alpha: 0.3),
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.5)),
                ),
              ),
              if (!isLast)
                Container(
                  width: 1, height: 40,
                  color: c.border,
                ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                action,
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: c.textPrimary),
              ),
              if (details != null) ...[
                const SizedBox(height: 2),
                Text(
                  details,
                  style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 2),
              Row(
                children: [
                  if (performedBy != null) ...[
                    Text(
                      performedBy,
                      style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary),
                    ),
                    const SizedBox(width: 6),
                  ],
                  if (createdAt != null)
                    Text(
                      DateFormat('d MMM yyyy').format(createdAt),
                      style: GoogleFonts.jetBrainsMono(fontSize: 9, color: c.textTertiary),
                    ),
                ],
              ),
              SizedBox(height: isLast ? 0 : 16),
            ],
          ),
        ),
      ],
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 400 + index * 50), duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 400 + index * 50), duration: 500.ms);
  }
}
