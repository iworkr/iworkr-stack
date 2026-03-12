import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/care_plans_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/care_plan.dart';

// ═══════════════════════════════════════════════════════════
// ── Care Plans — Structured Plan Management ──────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale Phase 4: Full-screen care plan
// management with goal tracking, status filtering,
// and drill-down detail sheets.

class CarePlansScreen extends ConsumerStatefulWidget {
  const CarePlansScreen({super.key});

  @override
  ConsumerState<CarePlansScreen> createState() => _CarePlansScreenState();
}

class _CarePlansScreenState extends ConsumerState<CarePlansScreen> {
  CarePlanStatus? _selectedStatus;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final plansAsync = ref.watch(carePlansStreamProvider);
    final stats = ref.watch(carePlanStatsProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreatePlanSheet(context),
        backgroundColor: ObsidianTheme.careBlue,
        child: const Icon(PhosphorIconsFill.plus, color: Colors.white, size: 24),
      ),
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
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text(
              'Care Plans',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Stats Row ──────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  _StatCard(label: 'Active Plans', value: '${stats.active}', color: ObsidianTheme.careBlue),
                  const SizedBox(width: 10),
                  _StatCard(label: 'Active Goals', value: '${stats.activeGoals}', color: ObsidianTheme.emerald),
                  const SizedBox(width: 10),
                  _StatCard(label: 'Needs Review', value: '${stats.needsReview}', color: ObsidianTheme.amber),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
          ),

          // ── Status Filter Chips ────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _FilterChip(
                      label: 'All',
                      isActive: _selectedStatus == null,
                      onTap: () => setState(() => _selectedStatus = null),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Active',
                      isActive: _selectedStatus == CarePlanStatus.active,
                      onTap: () => setState(() {
                        _selectedStatus = _selectedStatus == CarePlanStatus.active ? null : CarePlanStatus.active;
                      }),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Draft',
                      isActive: _selectedStatus == CarePlanStatus.draft,
                      onTap: () => setState(() {
                        _selectedStatus = _selectedStatus == CarePlanStatus.draft ? null : CarePlanStatus.draft;
                      }),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Under Review',
                      isActive: _selectedStatus == CarePlanStatus.underReview,
                      onTap: () => setState(() {
                        _selectedStatus = _selectedStatus == CarePlanStatus.underReview ? null : CarePlanStatus.underReview;
                      }),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Plans List ─────────────────────────────────
          plansAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: ObsidianTheme.careBlue)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 14))),
            ),
            data: (plans) {
              var filtered = plans;
              if (_selectedStatus != null) {
                filtered = filtered.where((p) => p.status == _selectedStatus).toList();
              }

              if (filtered.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.clipboard, size: 48, color: c.textTertiary),
                        const SizedBox(height: 12),
                        Text('No care plans found', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
                        const SizedBox(height: 4),
                        Text(
                          _selectedStatus != null ? 'Try a different filter' : 'Tap + to create the first plan',
                          style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                sliver: SliverList.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final plan = filtered[index];
                    return _CarePlanCard(
                      plan: plan,
                      onTap: () => _openDetail(plan),
                    )
                        .animate()
                        .fadeIn(delay: (index * 50).ms, duration: 300.ms)
                        .moveY(begin: 10, end: 0);
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  void _openDetail(CarePlan plan) {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CarePlanDetailSheet(plan: plan),
    );
  }

  void _showCreatePlanSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _CreatePlanSheet(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Stat Card ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: GoogleFonts.jetBrainsMono(fontSize: 22, fontWeight: FontWeight.w700, color: color),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary, letterSpacing: -0.2),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Filter Chip ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: isActive ? ObsidianTheme.careBlue.withValues(alpha: 0.12) : c.surface,
          border: Border.all(
            color: isActive ? ObsidianTheme.careBlue.withValues(alpha: 0.3) : c.border,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
            color: isActive ? ObsidianTheme.careBlue : c.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Care Plan Card ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CarePlanCard extends StatelessWidget {
  final CarePlan plan;
  final VoidCallback onTap;
  const _CarePlanCard({required this.plan, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final goalTotal = plan.goals.length;
    final goalActive = plan.activeGoalCount;
    final goalProgress = goalTotal > 0 ? goalActive / goalTotal : 0.0;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title + Status
            Row(
              children: [
                Expanded(
                  child: Text(
                    plan.title,
                    style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _StatusPill(status: plan.status),
              ],
            ),
            const SizedBox(height: 6),

            // Participant name
            if (plan.participantName != null)
              Row(
                children: [
                  Icon(PhosphorIconsLight.user, size: 14, color: c.textTertiary),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      plan.participantName!,
                      style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),

            if (goalTotal > 0) ...[
              const SizedBox(height: 10),
              // Goals progress
              Row(
                children: [
                  Icon(PhosphorIconsLight.target, size: 14, color: c.textTertiary),
                  const SizedBox(width: 5),
                  Text(
                    '$goalActive of $goalTotal goals active',
                    style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: goalProgress,
                  minHeight: 4,
                  backgroundColor: c.border,
                  color: ObsidianTheme.careBlue,
                ),
              ),
            ],

            // Next review date
            if (plan.nextReviewDate != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    PhosphorIconsLight.calendarCheck,
                    size: 14,
                    color: plan.isOverdueReview ? ObsidianTheme.rose : c.textTertiary,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'Review: ${_formatDate(plan.nextReviewDate!)}',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: plan.isOverdueReview ? ObsidianTheme.rose : c.textTertiary,
                      fontWeight: plan.isOverdueReview ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  if (plan.isOverdueReview) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: ObsidianTheme.rose.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'OVERDUE',
                        style: GoogleFonts.jetBrainsMono(fontSize: 8, fontWeight: FontWeight.w700, color: ObsidianTheme.rose, letterSpacing: 0.5),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }
}

// ═══════════════════════════════════════════════════════════
// ── Status Pill ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StatusPill extends StatelessWidget {
  final CarePlanStatus status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final (Color color, String label) = switch (status) {
      CarePlanStatus.active => (ObsidianTheme.careBlue, 'ACTIVE'),
      CarePlanStatus.draft => (const Color(0xFFA1A1AA), 'DRAFT'),
      CarePlanStatus.underReview => (ObsidianTheme.amber, 'REVIEW'),
      CarePlanStatus.archived => (const Color(0xFF71717A), 'ARCHIVED'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Text(
        label,
        style: GoogleFonts.jetBrainsMono(fontSize: 9, fontWeight: FontWeight.w700, color: color, letterSpacing: 0.8),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Care Plan Detail Sheet ───────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CarePlanDetailSheet extends ConsumerWidget {
  final CarePlan plan;
  const _CarePlanDetailSheet({required this.plan});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: BoxDecoration(
        color: c.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Handle ──
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: c.borderMedium, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),

          // ── Header ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        plan.title,
                        style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary, letterSpacing: -0.4),
                      ),
                    ),
                    const SizedBox(width: 12),
                    _StatusPill(status: plan.status),
                  ],
                ),
                if (plan.participantName != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(PhosphorIconsLight.user, size: 15, color: c.textTertiary),
                      const SizedBox(width: 6),
                      Text(plan.participantName!, style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary)),
                    ],
                  ),
                ],
                if (plan.assessorName != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(PhosphorIconsLight.sealCheck, size: 15, color: c.textTertiary),
                      const SizedBox(width: 6),
                      Text('Assessor: ${plan.assessorName!}', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 16),
          Divider(height: 1, color: c.border),

          // ── Scrollable Content ──
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                // ── Domains Section ──
                if (plan.domains.isNotEmpty) ...[
                  Text('DOMAINS', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: c.border),
                    ),
                    child: Column(
                      children: plan.domains.entries.map((entry) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 110,
                                child: Text(
                                  _domainLabel(entry.key),
                                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: c.textSecondary),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  '${entry.value}',
                                  style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Notes ──
                if (plan.notes != null && plan.notes!.isNotEmpty) ...[
                  Text('NOTES', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: c.border),
                    ),
                    child: Text(plan.notes!, style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary, height: 1.5)),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Goals Section ──
                Row(
                  children: [
                    Text('GOALS', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                        _showAddGoalDialog(context, plan);
                      },
                      child: Row(
                        children: [
                          Icon(PhosphorIconsLight.plus, size: 14, color: ObsidianTheme.careBlue),
                          const SizedBox(width: 4),
                          Text('Add Goal', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: ObsidianTheme.careBlue)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                if (plan.goals.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: c.border),
                    ),
                    child: Center(
                      child: Text('No goals added yet', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
                    ),
                  )
                else
                  ...plan.goals.asMap().entries.map((entry) {
                    final i = entry.key;
                    final goal = entry.value;
                    return Padding(
                      padding: EdgeInsets.only(bottom: i < plan.goals.length - 1 ? 8 : 0),
                      child: _GoalRow(goal: goal),
                    );
                  }),

                const SizedBox(height: 20),

                // ── Activate Button (if draft) ──
                if (plan.status == CarePlanStatus.draft) ...[
                  GestureDetector(
                    onTap: () async {
                      HapticFeedback.mediumImpact();
                      await updateCarePlanStatus(planId: plan.id, status: CarePlanStatus.active);
                      if (context.mounted) Navigator.pop(context);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: ObsidianTheme.careBlue,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text('Activate Plan', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                      ),
                    ),
                  ),
                ],

                // ── Submit for Review (if active) ──
                if (plan.status == CarePlanStatus.active) ...[
                  GestureDetector(
                    onTap: () async {
                      HapticFeedback.mediumImpact();
                      await updateCarePlanStatus(planId: plan.id, status: CarePlanStatus.underReview);
                      if (context.mounted) Navigator.pop(context);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.border),
                      ),
                      child: Center(
                        child: Text('Submit for Review', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _domainLabel(String key) {
    // Convert snake_case keys to Title Case labels
    return key.split('_').map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
  }

  void _showAddGoalDialog(BuildContext context, CarePlan plan) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddGoalSheet(plan: plan),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Goal Row ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _GoalRow extends StatelessWidget {
  final CareGoal goal;
  const _GoalRow({required this.goal});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final (Color statusColor, String statusLabel) = switch (goal.status) {
      GoalStatus.inProgress => (ObsidianTheme.careBlue, 'IN PROGRESS'),
      GoalStatus.achieved => (ObsidianTheme.emerald, 'ACHIEVED'),
      GoalStatus.onHold => (ObsidianTheme.amber, 'ON HOLD'),
      GoalStatus.abandoned => (ObsidianTheme.rose, 'ABANDONED'),
      GoalStatus.notStarted => (const Color(0xFFA1A1AA), 'NOT STARTED'),
    };

    final milestoneTotal = goal.milestones.length;
    final milestoneAchieved = goal.milestones.where((m) => m.achieved).length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  goal.title,
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: statusColor.withValues(alpha: 0.15)),
                ),
                child: Text(
                  statusLabel,
                  style: GoogleFonts.jetBrainsMono(fontSize: 8, fontWeight: FontWeight.w700, color: statusColor, letterSpacing: 0.5),
                ),
              ),
            ],
          ),
          if (goal.description != null) ...[
            const SizedBox(height: 4),
            Text(
              goal.description!,
              style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (milestoneTotal > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  '$milestoneAchieved/$milestoneTotal milestones',
                  style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: goal.milestoneProgress,
                      minHeight: 3,
                      backgroundColor: c.border,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Add Goal Sheet ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _AddGoalSheet extends ConsumerStatefulWidget {
  final CarePlan plan;
  const _AddGoalSheet({required this.plan});

  @override
  ConsumerState<_AddGoalSheet> createState() => _AddGoalSheetState();
}

class _AddGoalSheetState extends ConsumerState<_AddGoalSheet> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _outcomeCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _outcomeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) return;

    setState(() => _submitting = true);
    try {
      await createCareGoal(
        carePlanId: widget.plan.id,
        participantId: widget.plan.participantId,
        title: title,
        description: _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : null,
        targetOutcome: _outcomeCtrl.text.trim().isNotEmpty ? _outcomeCtrl.text.trim() : null,
      );

      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Goal added', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.careBlue,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
      decoration: BoxDecoration(
        color: c.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: c.borderMedium, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Text('Add Goal', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 20),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                Text('TITLE', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _titleCtrl, hint: 'e.g. Improve mobility'),
                const SizedBox(height: 16),

                Text('DESCRIPTION', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _descCtrl, hint: 'Details about this goal...', maxLines: 3),
                const SizedBox(height: 16),

                Text('TARGET OUTCOME', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _outcomeCtrl, hint: 'What does success look like?', maxLines: 2),
                const SizedBox(height: 24),
              ],
            ),
          ),

          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 20),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ObsidianTheme.careBlue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('Add Goal', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Create Plan Sheet ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _CreatePlanSheet extends ConsumerStatefulWidget {
  const _CreatePlanSheet();

  @override
  ConsumerState<_CreatePlanSheet> createState() => _CreatePlanSheetState();
}

class _CreatePlanSheetState extends ConsumerState<_CreatePlanSheet> {
  final _titleCtrl = TextEditingController();
  final _participantCtrl = TextEditingController();
  final _assessorCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _participantCtrl.dispose();
    _assessorCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleCtrl.text.trim();
    final participantId = _participantCtrl.text.trim();
    if (title.isEmpty || participantId.isEmpty) return;

    setState(() => _submitting = true);
    try {
      await createCarePlan(
        participantId: participantId,
        title: title,
        assessorName: _assessorCtrl.text.trim().isNotEmpty ? _assessorCtrl.text.trim() : null,
        notes: _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : null,
      );

      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Care plan created', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.careBlue,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
      decoration: BoxDecoration(
        color: c.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: c.borderMedium, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Text('New Care Plan', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 20),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                Text('TITLE', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _titleCtrl, hint: 'e.g. Daily Living Support Plan'),
                const SizedBox(height: 16),

                Text('PARTICIPANT ID', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _participantCtrl, hint: 'Participant UUID'),
                const SizedBox(height: 16),

                Text('ASSESSOR', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _assessorCtrl, hint: 'Name of assessing coordinator'),
                const SizedBox(height: 16),

                Text('NOTES', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _SheetTextField(controller: _notesCtrl, hint: 'Initial notes...', maxLines: 3),
                const SizedBox(height: 24),
              ],
            ),
          ),

          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 20),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ObsidianTheme.careBlue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('Create Plan', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Shared TextField ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _SheetTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final int maxLines;
  final TextInputType keyboardType;

  const _SheetTextField({
    required this.controller,
    required this.hint,
    this.maxLines = 1,
    this.keyboardType = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.border),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
        cursorColor: ObsidianTheme.careBlue,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }
}
