import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/observations_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/health_observation.dart';

// ═══════════════════════════════════════════════════════════
// ── Health Observations Dashboard ────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: View and record health observations
// / vital signs for care participants.

class ObservationsScreen extends ConsumerStatefulWidget {
  const ObservationsScreen({super.key});

  @override
  ConsumerState<ObservationsScreen> createState() => _ObservationsScreenState();
}

class _ObservationsScreenState extends ConsumerState<ObservationsScreen> {
  ObservationType? _filterType;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final obsAsync = ref.watch(observationsStreamProvider);
    final todaysObs = ref.watch(todaysObservationsProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showRecordSheet(context),
        backgroundColor: ObsidianTheme.emerald,
        child: const Icon(PhosphorIconsFill.plus, color: Colors.black, size: 24),
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
              'Health Observations',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Today Summary ──────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: c.border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: ObsidianTheme.emerald.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(PhosphorIconsLight.heartbeat, size: 24, color: ObsidianTheme.emerald),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Today's Observations", style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        Text('${todaysObs.length} recorded', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
                      ],
                    ),
                  ],
                ),
              ),
            ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
          ),

          // ── Type Filter Chips ──────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _TypeChip(
                      label: 'All',
                      emoji: '📋',
                      isActive: _filterType == null,
                      onTap: () => setState(() => _filterType = null),
                    ),
                    ...ObservationType.values.map((type) => Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: _TypeChip(
                        label: type.label,
                        emoji: type.icon,
                        isActive: _filterType == type,
                        onTap: () => setState(() {
                          _filterType = _filterType == type ? null : type;
                        }),
                      ),
                    )),
                  ],
                ),
              ),
            ),
          ),

          // ── Observations List ──────────────────────────
          obsAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: TextStyle(color: c.textTertiary))),
            ),
            data: (observations) {
              var filtered = observations;
              if (_filterType != null) {
                filtered = filtered.where((o) => o.observationType == _filterType).toList();
              }

              if (filtered.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.heartbeat, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text('No observations recorded', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
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
                    final obs = filtered[index];
                    return _ObservationCard(observation: obs)
                        .animate()
                        .fadeIn(delay: (index * 30).ms, duration: 300.ms)
                        .moveY(begin: 12, end: 0);
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showRecordSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    // TODO: Implement observation recording sheet
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Record observation — coming soon')),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final String emoji;
  final bool isActive;
  final VoidCallback onTap;
  const _TypeChip({required this.label, required this.emoji, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.12) : c.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : c.border,
          ),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
            Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500,
                color: isActive ? ObsidianTheme.emerald : c.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _ObservationCard extends StatelessWidget {
  final HealthObservation observation;
  const _ObservationCard({required this.observation});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(observation.observationType.icon, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  observation.observationType.label,
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                ),
              ),
              Text(
                observation.displayValue,
                style: GoogleFonts.jetBrainsMono(fontSize: 16, fontWeight: FontWeight.w700, color: ObsidianTheme.emerald),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (observation.recorderName != null) ...[
                Icon(PhosphorIconsLight.user, size: 14, color: c.textTertiary),
                const SizedBox(width: 4),
                Text(observation.recorderName!, style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
                const SizedBox(width: 12),
              ],
              Icon(PhosphorIconsLight.clock, size: 14, color: c.textTertiary),
              const SizedBox(width: 4),
              Text(
                _formatTime(observation.recordedAt),
                style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
              ),
            ],
          ),
          if (observation.notes != null && observation.notes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              observation.notes!,
              style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    if (dt.day == now.day && dt.month == now.month && dt.year == now.year) {
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
    return '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
