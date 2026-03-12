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
                    _SummaryTile(icon: PhosphorIconsLight.pill, label: 'Active', value: '${meds.length}', color: ObsidianTheme.careBlue),
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

    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _RecordMARSheet(medication: medication),
        );
      },
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
            Row(
              children: [
                Icon(PhosphorIconsLight.pill, size: 20, color: ObsidianTheme.careBlue),
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
            // Tap hint
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(PhosphorIconsLight.notepad, size: 14, color: c.textDisabled),
                const SizedBox(width: 4),
                Text('Tap to record administration', style: GoogleFonts.inter(fontSize: 11, color: c.textDisabled)),
              ],
            ),
          ],
        ),
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

// ═══════════════════════════════════════════════════════════
// ── Record MAR Entry Bottom Sheet ────────────────────────
// ═══════════════════════════════════════════════════════════

class _RecordMARSheet extends ConsumerStatefulWidget {
  final ParticipantMedication medication;
  const _RecordMARSheet({required this.medication});

  @override
  ConsumerState<_RecordMARSheet> createState() => _RecordMARSheetState();
}

class _RecordMARSheetState extends ConsumerState<_RecordMARSheet> {
  final _notesCtrl = TextEditingController();
  final _witnessCtrl = TextEditingController();
  final _refusalReasonCtrl = TextEditingController();
  MAROutcome _selectedOutcome = MAROutcome.given;
  bool _submitting = false;

  // Only show outcomes that are actionable (not pending)
  static const _selectableOutcomes = [
    MAROutcome.given,
    MAROutcome.refused,
    MAROutcome.withheld,
    MAROutcome.notAvailable,
  ];

  @override
  void dispose() {
    _notesCtrl.dispose();
    _witnessCtrl.dispose();
    _refusalReasonCtrl.dispose();
    super.dispose();
  }

  IconData _outcomeIcon(MAROutcome outcome) => switch (outcome) {
    MAROutcome.given => PhosphorIconsLight.checkCircle,
    MAROutcome.refused => PhosphorIconsLight.prohibit,
    MAROutcome.withheld => PhosphorIconsLight.pause,
    MAROutcome.notAvailable => PhosphorIconsLight.questionMark,
    MAROutcome.pending => PhosphorIconsLight.clock,
  };

  Color _outcomeColor(MAROutcome outcome) => switch (outcome) {
    MAROutcome.given => ObsidianTheme.careBlue,
    MAROutcome.refused => ObsidianTheme.rose,
    MAROutcome.withheld => ObsidianTheme.amber,
    MAROutcome.notAvailable => ObsidianTheme.textTertiary,
    MAROutcome.pending => ObsidianTheme.textTertiary,
  };

  Future<void> _submit() async {
    if (_selectedOutcome == MAROutcome.refused && _refusalReasonCtrl.text.trim().isEmpty) return;

    setState(() => _submitting = true);
    try {
      await recordAdministration(
        medicationId: widget.medication.id,
        scheduledTime: DateTime.now(),
        outcome: _selectedOutcome,
        notes: _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : null,
        witnessedBy: _witnessCtrl.text.trim().isNotEmpty ? _witnessCtrl.text.trim() : null,
        refusalReason: _selectedOutcome == MAROutcome.refused
            ? _refusalReasonCtrl.text.trim()
            : null,
      );

      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Administration recorded — ${_selectedOutcome.label}',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: _outcomeColor(_selectedOutcome),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to record: $e', style: GoogleFonts.inter(color: Colors.white)),
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
    final med = widget.medication;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
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
          Text('Record Administration', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 20),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                // ── Medication Info (read-only) ───────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: ObsidianTheme.careBlue.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(PhosphorIconsLight.pill, size: 20, color: ObsidianTheme.careBlue),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(med.medicationName, style: GoogleFonts.inter(
                                fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                            const SizedBox(height: 2),
                            Text(
                              [
                                if (med.dosage != null) med.dosage!,
                                med.route.label,
                                med.frequency.label,
                              ].join(' · '),
                              style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Outcome Selector ──────────────────────
                Text('OUTCOME', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Row(
                  children: _selectableOutcomes.map((outcome) {
                    final isSelected = _selectedOutcome == outcome;
                    final color = _outcomeColor(outcome);
                    return Expanded(
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _selectedOutcome = outcome);
                        },
                        child: Container(
                          margin: const EdgeInsets.only(right: 6),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? color.withValues(alpha: 0.15) : c.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected ? color.withValues(alpha: 0.4) : c.border,
                            ),
                          ),
                          child: Column(
                            children: [
                              Icon(_outcomeIcon(outcome), size: 20, color: isSelected ? color : c.textTertiary),
                              const SizedBox(height: 4),
                              Text(
                                outcome.label,
                                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500,
                                    color: isSelected ? color : c.textSecondary),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),

                // ── Refusal Reason (conditional) ──────────
                if (_selectedOutcome == MAROutcome.refused) ...[
                  Text('REFUSAL REASON', style: GoogleFonts.jetBrainsMono(
                      fontSize: 11, fontWeight: FontWeight.w600, color: ObsidianTheme.rose, letterSpacing: 0.8)),
                  const SizedBox(height: 6),
                  _MARTextField(
                    controller: _refusalReasonCtrl,
                    hint: 'Why was the medication refused?',
                    maxLines: 2,
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Notes ─────────────────────────────────
                Text('NOTES', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _MARTextField(
                  controller: _notesCtrl,
                  hint: 'Additional notes...',
                  maxLines: 3,
                ),
                const SizedBox(height: 16),

                // ── Witness Name ──────────────────────────
                Text('WITNESS NAME', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 4),
                Text('Optional — required for S8 medications', style: GoogleFonts.inter(
                    fontSize: 12, color: c.textDisabled)),
                const SizedBox(height: 6),
                _MARTextField(
                  controller: _witnessCtrl,
                  hint: 'Full name of witness',
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),

          // ── Submit Button ──────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 20),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _outcomeColor(_selectedOutcome),
                  foregroundColor: _selectedOutcome == MAROutcome.given ? Colors.black : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: _selectedOutcome == MAROutcome.given ? Colors.black : Colors.white,
                        ),
                      )
                    : Text('Record — ${_selectedOutcome.label}', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MARTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final int maxLines;

  const _MARTextField({
    required this.controller,
    required this.hint,
    this.maxLines = 1,
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
        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
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
