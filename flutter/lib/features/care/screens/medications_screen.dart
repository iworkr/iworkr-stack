import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/medications_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/participant_medication.dart';

// ═══════════════════════════════════════════════════════════
// ── eMAR — Medications Dashboard ─────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: View active medication profiles and
// record administration events for care participants.

class MedicationsScreen extends ConsumerStatefulWidget {
  const MedicationsScreen({super.key});

  @override
  ConsumerState<MedicationsScreen> createState() => _MedicationsScreenState();
}

class _MedicationsScreenState extends ConsumerState<MedicationsScreen> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final medsAsync = ref.watch(medicationsStreamProvider);

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
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text(
              'Medications',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Summary Cards ──────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: medsAsync.when(
                loading: () => const SizedBox(height: 56),
                error: (_, __) => const SizedBox(height: 56),
                data: (meds) => Row(
                  children: [
                    _SummaryTile(icon: PhosphorIconsLight.pill, label: 'Active', value: '${meds.length}', color: ObsidianTheme.emerald),
                    const SizedBox(width: 8),
                    _SummaryTile(icon: PhosphorIconsLight.clockAfternoon, label: 'PRN', value: '${meds.where((m) => m.isPrn).length}', color: ObsidianTheme.blue),
                    const SizedBox(width: 8),
                    _SummaryTile(icon: PhosphorIconsLight.warning, label: 'Ending Soon',
                        value: '${meds.where((m) => m.endDate != null && m.endDate!.difference(DateTime.now()).inDays <= 14 && m.endDate!.isAfter(DateTime.now())).length}',
                        color: ObsidianTheme.amber),
                  ],
                ),
              ),
            ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
          ),

          // ── Search ──────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Container(
                height: 40,
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.border),
                ),
                child: TextField(
                  onChanged: (v) => setState(() => _searchQuery = v),
                  style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Search medications...',
                    hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                    prefixIcon: Icon(PhosphorIconsLight.magnifyingGlass, size: 18, color: c.textTertiary),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ),
          ),

          // ── Medications List ────────────────────────────
          medsAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: TextStyle(color: c.textTertiary))),
            ),
            data: (meds) {
              var filtered = meds;
              if (_searchQuery.isNotEmpty) {
                filtered = filtered.where((m) =>
                    m.medicationName.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
              }

              if (filtered.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.pill, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text('No active medications', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
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
                    final med = filtered[index];
                    return _MedicationCard(medication: med)
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
}

class _SummaryTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _SummaryTile({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                Text(label, style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MedicationCard extends StatelessWidget {
  final ParticipantMedication medication;
  const _MedicationCard({required this.medication});

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
              Icon(PhosphorIconsLight.pill, size: 20, color: ObsidianTheme.emerald),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  medication.medicationName,
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                ),
              ),
              if (medication.isPrn)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.blue.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('PRN', style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: ObsidianTheme.blue)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          // Dosage + Route + Frequency
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              if (medication.dosage != null)
                _InfoChip(icon: PhosphorIconsLight.eyedropper, text: medication.dosage!),
              _InfoChip(icon: PhosphorIconsLight.path, text: medication.route.label),
              _InfoChip(icon: PhosphorIconsLight.clockCountdown, text: medication.frequency.label),
            ],
          ),
          if (medication.instructions != null && medication.instructions!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              medication.instructions!,
              style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (medication.prescriber != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(PhosphorIconsLight.stethoscope, size: 14, color: c.textTertiary),
                const SizedBox(width: 4),
                Text('Dr. ${medication.prescriber}', style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: c.textTertiary),
        const SizedBox(width: 4),
        Text(text, style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary)),
      ],
    );
  }
}
