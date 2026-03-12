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
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _RecordObservationSheet(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Record Observation Bottom Sheet ──────────────────────
// ═══════════════════════════════════════════════════════════

class _RecordObservationSheet extends ConsumerStatefulWidget {
  const _RecordObservationSheet();

  @override
  ConsumerState<_RecordObservationSheet> createState() => _RecordObservationSheetState();
}

class _RecordObservationSheetState extends ConsumerState<_RecordObservationSheet> {
  final _valueCtrl = TextEditingController();
  final _secondaryValueCtrl = TextEditingController(); // For BP diastolic
  final _notesCtrl = TextEditingController();
  final _participantIdCtrl = TextEditingController();
  ObservationType _selectedType = ObservationType.heartRate;
  bool _submitting = false;

  @override
  void dispose() {
    _valueCtrl.dispose();
    _secondaryValueCtrl.dispose();
    _notesCtrl.dispose();
    _participantIdCtrl.dispose();
    super.dispose();
  }

  String get _valueLabel => switch (_selectedType) {
    ObservationType.bloodPressure => 'Systolic (mmHg)',
    ObservationType.heartRate => 'BPM',
    ObservationType.temperature => '°C',
    ObservationType.bloodGlucose => 'mmol/L',
    ObservationType.oxygenSaturation => 'SpO2 %',
    ObservationType.weight => 'kg',
    ObservationType.painLevel => 'Level (0-10)',
    ObservationType.moodRating => 'Rating (1-5)',
    ObservationType.fluidIntake => 'ml',
    ObservationType.bowelMovement => 'Bristol Scale (1-7)',
    ObservationType.sleepQuality => 'Hours',
    ObservationType.respiration => 'Breaths/min',
    ObservationType.general => 'Summary',
  };

  String get _valueHint => switch (_selectedType) {
    ObservationType.bloodPressure => 'e.g. 120',
    ObservationType.heartRate => 'e.g. 72',
    ObservationType.temperature => 'e.g. 36.5',
    ObservationType.bloodGlucose => 'e.g. 5.5',
    ObservationType.oxygenSaturation => 'e.g. 98',
    ObservationType.weight => 'e.g. 75.0',
    ObservationType.painLevel => 'e.g. 3',
    ObservationType.moodRating => 'e.g. 4',
    ObservationType.fluidIntake => 'e.g. 250',
    ObservationType.bowelMovement => 'e.g. 4',
    ObservationType.sleepQuality => 'e.g. 7.5',
    ObservationType.respiration => 'e.g. 16',
    ObservationType.general => 'Brief summary',
  };

  Map<String, dynamic> _buildValues() {
    final raw = _valueCtrl.text.trim();
    return switch (_selectedType) {
      ObservationType.bloodPressure => {
        'systolic': num.tryParse(raw),
        'diastolic': num.tryParse(_secondaryValueCtrl.text.trim()),
      },
      ObservationType.heartRate => {'bpm': num.tryParse(raw)},
      ObservationType.temperature => {'celsius': num.tryParse(raw)},
      ObservationType.bloodGlucose => {'mmol': num.tryParse(raw)},
      ObservationType.oxygenSaturation => {'spo2': num.tryParse(raw)},
      ObservationType.weight => {'kg': num.tryParse(raw)},
      ObservationType.painLevel => {'level': int.tryParse(raw)},
      ObservationType.moodRating => {'rating': int.tryParse(raw)},
      ObservationType.fluidIntake => {'ml': num.tryParse(raw)},
      ObservationType.bowelMovement => {'type': int.tryParse(raw)},
      ObservationType.sleepQuality => {'hours': num.tryParse(raw)},
      ObservationType.respiration => {'rate': num.tryParse(raw)},
      ObservationType.general => {'summary': raw},
    };
  }

  Future<void> _submit() async {
    if (_valueCtrl.text.trim().isEmpty) return;
    if (_selectedType == ObservationType.bloodPressure && _secondaryValueCtrl.text.trim().isEmpty) return;

    setState(() => _submitting = true);
    try {
      await recordObservation(
        participantId: _participantIdCtrl.text.trim().isNotEmpty
            ? _participantIdCtrl.text.trim()
            : 'default',
        type: _selectedType,
        values: _buildValues(),
        notes: _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : null,
      );

      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_selectedType.label} recorded',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.emerald,
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
          Text('Record Observation', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 20),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                // ── Observation Type Selector ──────────────
                Text('OBSERVATION TYPE', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: ObservationType.values.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 6),
                    itemBuilder: (context, index) {
                      final type = ObservationType.values[index];
                      final isSelected = _selectedType == type;
                      return GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _selectedType = type;
                            _valueCtrl.clear();
                            _secondaryValueCtrl.clear();
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: isSelected ? ObsidianTheme.emerald.withValues(alpha: 0.15) : c.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected ? ObsidianTheme.emerald.withValues(alpha: 0.4) : c.border,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(type.icon, style: const TextStyle(fontSize: 14)),
                              const SizedBox(width: 6),
                              Text(type.label, style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isSelected ? ObsidianTheme.emerald : c.textSecondary,
                              )),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),

                // ── Value Field ───────────────────────────
                Text('VALUE', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                if (_selectedType == ObservationType.bloodPressure) ...[
                  Row(
                    children: [
                      Expanded(
                        child: _ObsidianTextField(
                          controller: _valueCtrl,
                          label: _valueLabel,
                          hint: _valueHint,
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Text('/', style: GoogleFonts.jetBrainsMono(
                            fontSize: 24, color: c.textTertiary, fontWeight: FontWeight.w300)),
                      ),
                      Expanded(
                        child: _ObsidianTextField(
                          controller: _secondaryValueCtrl,
                          label: 'Diastolic (mmHg)',
                          hint: 'e.g. 80',
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  _ObsidianTextField(
                    controller: _valueCtrl,
                    label: _valueLabel,
                    hint: _valueHint,
                    keyboardType: _selectedType == ObservationType.general
                        ? TextInputType.text
                        : TextInputType.number,
                  ),
                ],
                const SizedBox(height: 16),

                // ── Notes ─────────────────────────────────
                Text('NOTES', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _ObsidianTextField(
                  controller: _notesCtrl,
                  label: 'Notes',
                  hint: 'Additional observations...',
                  maxLines: 3,
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
                  backgroundColor: ObsidianTheme.emerald,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                    : Text('Record Observation', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ObsidianTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;
  final TextInputType keyboardType;

  const _ObsidianTextField({
    required this.controller,
    required this.label,
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
