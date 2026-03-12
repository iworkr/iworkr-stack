import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/budget_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/budget_allocation.dart';

// ═══════════════════════════════════════════════════════════
// ── Budget Dashboard — NDIS Budget Utilization ───────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale Phase 3: Real-time budget dashboard
// showing total allocation, category breakdown, and
// per-participant utilization with quarantine visibility.

class BudgetDashboardScreen extends ConsumerWidget {
  const BudgetDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final allocationsAsync = ref.watch(budgetAllocationsStreamProvider);
    final summary = ref.watch(budgetSummaryProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: false,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).maybePop();
              },
              child: Center(
                child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22),
              ),
            ),
            title: Text(
              'NDIS Budget',
              style: GoogleFonts.inter(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: c.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Content ────────────────────────────────────
          allocationsAsync.when(
            data: (allocations) => SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── Total Budget Overview Card ─────
                  _TotalBudgetCard(summary: summary),

                  const SizedBox(height: 24),

                  // ── Category Breakdown Header ──────
                  Text(
                    'CATEGORIES',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      color: c.textTertiary,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── Category Cards ─────────────────
                  _CategoryCard(
                    icon: PhosphorIconsLight.heartbeat,
                    label: 'Core Supports',
                    budget: summary.coreBudget,
                    consumed: summary.coreConsumed,
                    index: 0,
                  ),
                  const SizedBox(height: 8),
                  _CategoryCard(
                    icon: PhosphorIconsLight.trendUp,
                    label: 'Capacity Building',
                    budget: summary.capacityBudget,
                    consumed: summary.capacityConsumed,
                    index: 1,
                  ),
                  const SizedBox(height: 8),
                  _CategoryCard(
                    icon: PhosphorIconsLight.buildings,
                    label: 'Capital',
                    budget: summary.capitalBudget,
                    consumed: summary.capitalConsumed,
                    index: 2,
                  ),

                  const SizedBox(height: 24),

                  // ── Participants Header ────────────
                  Text(
                    'PARTICIPANTS',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      color: c.textTertiary,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${summary.participantCount} active budget allocations',
                    style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                  ),
                  const SizedBox(height: 12),

                  // ── Per-participant List ───────────
                  ..._buildParticipantList(allocations),
                ]),
              ),
            ),
            loading: () => SliverFillRemaining(
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: ObsidianTheme.careBlue,
                  ),
                ),
              ),
            ),
            error: (err, _) => SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(PhosphorIconsLight.warningCircle, size: 32, color: c.textTertiary),
                    const SizedBox(height: 12),
                    Text(
                      'Unable to load budgets',
                      style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      err.toString(),
                      style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildParticipantList(List<BudgetAllocation> allocations) {
    // Group allocations by participant
    final grouped = <String, List<BudgetAllocation>>{};
    for (final alloc in allocations) {
      grouped.putIfAbsent(alloc.participantId, () => []).add(alloc);
    }

    final entries = grouped.entries.toList();
    if (entries.isEmpty) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Center(
            child: Column(
              children: [
                Icon(PhosphorIconsLight.wallet, size: 36, color: ObsidianTheme.textTertiary),
                const SizedBox(height: 12),
                Text(
                  'No budget allocations yet',
                  style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textSecondary),
                ),
              ],
            ),
          ),
        ),
      ];
    }

    return entries.asMap().entries.map((entry) {
      final participantAllocations = entry.value.value;
      return _ParticipantTile(
        allocations: participantAllocations,
        index: entry.key,
      );
    }).toList();
  }
}

// ═══════════════════════════════════════════════════════════
// ── Total Budget Overview Card ───────────────────────────
// ═══════════════════════════════════════════════════════════

class _TotalBudgetCard extends StatelessWidget {
  final BudgetSummary summary;
  const _TotalBudgetCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final consumedFrac = summary.totalBudget > 0 ? summary.consumed / summary.totalBudget : 0.0;
    final quarantinedFrac = summary.totalBudget > 0 ? summary.quarantined / summary.totalBudget : 0.0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Overline
          Text(
            'TOTAL BUDGET',
            style: GoogleFonts.jetBrainsMono(
              fontSize: 10,
              color: ObsidianTheme.careBlue,
              letterSpacing: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),

          // Large monetary value
          Text(
            _formatCurrency(summary.totalBudget),
            style: GoogleFonts.jetBrainsMono(
              fontSize: 34,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -1.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Total allocated across ${summary.participantCount} participant${summary.participantCount != 1 ? 's' : ''}',
            style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
          ),
          const SizedBox(height: 20),

          // ── Utilization Bar ─────────────────────
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  // Consumed segment
                  if (consumedFrac > 0)
                    Flexible(
                      flex: (consumedFrac * 1000).round().clamp(1, 1000),
                      child: Container(
                        decoration: BoxDecoration(
                          color: ObsidianTheme.emerald,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(4),
                            bottomLeft: const Radius.circular(4),
                            topRight: quarantinedFrac > 0 ? Radius.zero : const Radius.circular(4),
                            bottomRight: quarantinedFrac > 0 ? Radius.zero : const Radius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  // Quarantined segment
                  if (quarantinedFrac > 0)
                    Flexible(
                      flex: (quarantinedFrac * 1000).round().clamp(1, 1000),
                      child: Container(color: ObsidianTheme.amber),
                    ),
                  // Available segment
                  if ((1 - consumedFrac - quarantinedFrac) > 0)
                    Flexible(
                      flex: ((1 - consumedFrac - quarantinedFrac) * 1000).round().clamp(1, 1000),
                      child: Container(
                        decoration: BoxDecoration(
                          color: c.surfaceSecondary,
                          borderRadius: BorderRadius.only(
                            topLeft: consumedFrac == 0 && quarantinedFrac == 0
                                ? const Radius.circular(4)
                                : Radius.zero,
                            bottomLeft: consumedFrac == 0 && quarantinedFrac == 0
                                ? const Radius.circular(4)
                                : Radius.zero,
                            topRight: const Radius.circular(4),
                            bottomRight: const Radius.circular(4),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // ── Stat Labels ─────────────────────────
          Row(
            children: [
              _StatLabel(
                dotColor: ObsidianTheme.emerald,
                label: 'Consumed',
                value: _formatCurrency(summary.consumed),
              ),
              const Spacer(),
              _StatLabel(
                dotColor: ObsidianTheme.amber,
                label: 'Committed',
                value: _formatCurrency(summary.quarantined),
              ),
              const Spacer(),
              _StatLabel(
                dotColor: c.textTertiary,
                label: 'Available',
                value: _formatCurrency(summary.available),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
        .moveY(begin: 12, end: 0, duration: 500.ms, curve: ObsidianTheme.easeOutExpo);
  }
}

class _StatLabel extends StatelessWidget {
  final Color dotColor;
  final String label;
  final String value;
  const _StatLabel({required this.dotColor, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(shape: BoxShape.circle, color: dotColor),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: c.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Category Breakdown Card ──────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CategoryCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final double budget;
  final double consumed;
  final int index;

  const _CategoryCard({
    required this.icon,
    required this.label,
    required this.budget,
    required this.consumed,
    required this.index,
  });

  Color _utilizationColor(double percent) {
    if (percent > 90) return ObsidianTheme.rose;
    if (percent >= 70) return ObsidianTheme.amber;
    return ObsidianTheme.emerald;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final percent = budget > 0 ? (consumed / budget * 100) : 0.0;
    final progressFrac = (percent / 100).clamp(0.0, 1.0);
    final accentColor = _utilizationColor(percent);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          // Icon badge
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: accentColor),
          ),
          const SizedBox(width: 14),

          // Label + budget
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatCurrency(budget),
                  style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textTertiary),
                ),
              ],
            ),
          ),

          // Utilization gauge
          SizedBox(
            width: 80,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${percent.toStringAsFixed(1)}%',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: accentColor,
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: SizedBox(
                    height: 4,
                    child: LinearProgressIndicator(
                      value: progressFrac,
                      backgroundColor: c.surfaceSecondary,
                      valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 200 + index * 60),
          duration: 400.ms,
          curve: ObsidianTheme.easeOutExpo,
        )
        .moveY(
          begin: 10,
          end: 0,
          delay: Duration(milliseconds: 200 + index * 60),
          duration: 400.ms,
          curve: ObsidianTheme.easeOutExpo,
        );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Per-Participant Budget Tile (Expandable) ─────────────
// ═══════════════════════════════════════════════════════════

class _ParticipantTile extends StatefulWidget {
  final List<BudgetAllocation> allocations;
  final int index;
  const _ParticipantTile({required this.allocations, required this.index});

  @override
  State<_ParticipantTile> createState() => _ParticipantTileState();
}

class _ParticipantTileState extends State<_ParticipantTile>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  late final AnimationController _chevronController;
  late final Animation<double> _chevronRotation;

  @override
  void initState() {
    super.initState();
    _chevronController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _chevronRotation = Tween<double>(begin: 0, end: 0.25).animate(
      CurvedAnimation(parent: _chevronController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _chevronController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final allocs = widget.allocations;
    final name = allocs.first.participantName ?? 'Unknown Participant';

    final totalBudget = allocs.fold(0.0, (sum, a) => sum + a.totalBudget);
    final totalConsumed = allocs.fold(0.0, (sum, a) => sum + a.consumedBudget);
    final totalQuarantined = allocs.fold(0.0, (sum, a) => sum + a.quarantinedBudget);
    final utilPercent = totalBudget > 0 ? (totalConsumed / totalBudget * 100) : 0.0;
    final isOverCommitted = (totalConsumed + totalQuarantined) > totalBudget;

    final progressFrac = (utilPercent / 100).clamp(0.0, 1.0);
    final barColor = isOverCommitted
        ? ObsidianTheme.rose
        : utilPercent >= 70
            ? ObsidianTheme.amber
            : ObsidianTheme.emerald;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          setState(() => _expanded = !_expanded);
          _expanded ? _chevronController.forward() : _chevronController.reverse();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _expanded ? c.borderMedium : c.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header Row ──────────────────────
              Row(
                children: [
                  // Avatar circle
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                    ),
                    child: Center(
                      child: Text(
                        _initials(name),
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: ObsidianTheme.careBlue,
                        ),
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
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: c.textPrimary,
                            letterSpacing: -0.3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _formatCurrency(totalBudget),
                          style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textTertiary),
                        ),
                      ],
                    ),
                  ),

                  // Percent badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: barColor.withValues(alpha: 0.10),
                    ),
                    child: Text(
                      '${utilPercent.toStringAsFixed(0)}%',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: barColor,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Chevron
                  RotationTransition(
                    turns: _chevronRotation,
                    child: Icon(
                      PhosphorIconsLight.caretRight,
                      size: 16,
                      color: c.textTertiary,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // ── Utilization Bar ─────────────────
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: SizedBox(
                  height: 4,
                  child: LinearProgressIndicator(
                    value: progressFrac,
                    backgroundColor: c.surfaceSecondary,
                    valueColor: AlwaysStoppedAnimation<Color>(barColor),
                  ),
                ),
              ),

              // ── Expanded Category Breakdown ────
              AnimatedCrossFade(
                firstChild: const SizedBox.shrink(),
                secondChild: _buildCategoryBreakdown(c, allocs),
                crossFadeState: _expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                duration: const Duration(milliseconds: 200),
                sizeCurve: Curves.easeInOut,
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 300 + widget.index * 40),
          duration: 400.ms,
          curve: ObsidianTheme.easeOutExpo,
        )
        .moveY(
          begin: 8,
          end: 0,
          delay: Duration(milliseconds: 300 + widget.index * 40),
          duration: 400.ms,
          curve: ObsidianTheme.easeOutExpo,
        );
  }

  Widget _buildCategoryBreakdown(IWorkrColors c, List<BudgetAllocation> allocs) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        children: [
          Container(height: 1, color: c.border),
          const SizedBox(height: 12),
          ...allocs.map((a) => _CategoryBreakdownRow(allocation: a)),
        ],
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return parts.first.isNotEmpty ? parts.first[0].toUpperCase() : '?';
  }
}

// ═══════════════════════════════════════════════════════════
// ── Category Breakdown Row (inside expanded participant) ─
// ═══════════════════════════════════════════════════════════

class _CategoryBreakdownRow extends StatelessWidget {
  final BudgetAllocation allocation;
  const _CategoryBreakdownRow({required this.allocation});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final percent = allocation.utilizationPercent;
    final isOver = allocation.isOverCommitted;
    final color = isOver
        ? ObsidianTheme.rose
        : percent >= 70
            ? ObsidianTheme.amber
            : ObsidianTheme.emerald;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              color: color.withValues(alpha: 0.4),
            ),
          ),
          const SizedBox(width: 12),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  allocation.categoryLabel,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: c.textSecondary,
                  ),
                ),
                const SizedBox(height: 1),
                Row(
                  children: [
                    Text(
                      '${_formatCurrency(allocation.consumedBudget)} of ${_formatCurrency(allocation.totalBudget)}',
                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                    ),
                    if (allocation.quarantinedBudget > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(3),
                          color: ObsidianTheme.amberDim,
                        ),
                        child: Text(
                          '${_formatCurrency(allocation.quarantinedBudget)} held',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            color: ObsidianTheme.amber,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          Text(
            '${percent.toStringAsFixed(0)}%',
            style: GoogleFonts.jetBrainsMono(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

String _formatCurrency(double amount) {
  final isNegative = amount < 0;
  final abs = amount.abs();
  final whole = abs.toInt();
  final cents = ((abs - whole) * 100).round();
  final formatted = whole
      .toString()
      .replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );
  return '${isNegative ? '-' : ''}\$$formatted.${cents.toString().padLeft(2, '0')}';
}
