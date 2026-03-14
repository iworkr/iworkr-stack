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
// ── Record Observation — Health Telemetry Input ──────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// Grid-based observation type selector with large numeric
// keypad for vitals entry. Automated triage for critical
// readings (e.g., BGL < 4.0 mmol/L triggers red warning).

class RecordObservationScreen extends ConsumerStatefulWidget {
  const RecordObservationScreen({super.key});

  @override
  ConsumerState<RecordObservationScreen> createState() => _RecordObservationScreenState();
}

class _RecordObservationScreenState extends ConsumerState<RecordObservationScreen> {
  ObservationType? _selectedType;
  final _valueCtrl = TextEditingController();
  final _value2Ctrl = TextEditingController(); // For BP diastolic
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _triageWarning;

  @override
  void dispose() {
    _valueCtrl.dispose();
    _value2Ctrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _checkTriage() {
    if (_selectedType == null || _valueCtrl.text.isEmpty) {
      setState(() => _triageWarning = null);
      return;
    }

    final val = double.tryParse(_valueCtrl.text) ?? 0;
    String? warning;

    switch (_selectedType!) {
      case ObservationType.bloodGlucose:
        if (val < 4.0) warning = 'CRITICAL LOW — Hypoglycemia detected (${val} mmol/L). Seek immediate assistance.';
        if (val > 15.0) warning = 'CRITICAL HIGH — Hyperglycemia detected (${val} mmol/L). Notify coordinator.';
        break;
      case ObservationType.heartRate:
        if (val < 50) warning = 'LOW HEART RATE — Bradycardia (${val.toInt()} BPM). Monitor closely.';
        if (val > 120) warning = 'HIGH HEART RATE — Tachycardia (${val.toInt()} BPM). Notify coordinator.';
        break;
      case ObservationType.temperature:
        if (val < 35.0) warning = 'LOW TEMPERATURE — Hypothermia risk (${val}°C).';
        if (val > 38.5) warning = 'HIGH TEMPERATURE — Fever detected (${val}°C). Monitor closely.';
        break;
      case ObservationType.oxygenSaturation:
        if (val < 92) warning = 'LOW SpO2 — Oxygen desaturation (${val.toInt()}%). Seek immediate assistance.';
        break;
      case ObservationType.bloodPressure:
        final systolic = val;
        final diastolic = double.tryParse(_value2Ctrl.text) ?? 0;
        if (systolic > 180 || diastolic > 120) warning = 'HYPERTENSIVE CRISIS — ${systolic.toInt()}/${diastolic.toInt()} mmHg. Call emergency services.';
        if (systolic < 90 || diastolic < 60) warning = 'LOW BLOOD PRESSURE — ${systolic.toInt()}/${diastolic.toInt()} mmHg. Monitor closely.';
        break;
      default:
        break;
    }

    setState(() => _triageWarning = warning);
  }

  Map<String, dynamic> _buildValues() {
    final val = _valueCtrl.text;
    switch (_selectedType!) {
      case ObservationType.bloodPressure:
        return {'systolic': double.tryParse(val), 'diastolic': double.tryParse(_value2Ctrl.text)};
      case ObservationType.heartRate:
        return {'bpm': double.tryParse(val)};
      case ObservationType.temperature:
        return {'celsius': double.tryParse(val)};
      case ObservationType.bloodGlucose:
        return {'mmol': double.tryParse(val)};
      case ObservationType.oxygenSaturation:
        return {'spo2': double.tryParse(val)};
      case ObservationType.weight:
        return {'kg': double.tryParse(val)};
      case ObservationType.painLevel:
        return {'level': int.tryParse(val)};
      case ObservationType.moodRating:
        return {'rating': int.tryParse(val)};
      case ObservationType.fluidIntake:
        return {'ml': double.tryParse(val)};
      case ObservationType.respiration:
        return {'rate': int.tryParse(val)};
      case ObservationType.sleepQuality:
        return {'hours': double.tryParse(val)};
      default:
        return {'summary': val};
    }
  }

  String _unitLabel() {
    return switch (_selectedType!) {
      ObservationType.bloodPressure => 'mmHg',
      ObservationType.heartRate => 'BPM',
      ObservationType.temperature => '°C',
      ObservationType.bloodGlucose => 'mmol/L',
      ObservationType.oxygenSaturation => '%',
      ObservationType.weight => 'kg',
      ObservationType.painLevel => '/10',
      ObservationType.moodRating => '/5',
      ObservationType.fluidIntake => 'ml',
      ObservationType.respiration => 'br/min',
      ObservationType.sleepQuality => 'hours',
      _ => '',
    };
  }

  Future<void> _submit() async {
    if (_selectedType == null || _valueCtrl.text.isEmpty) return;
    setState(() => _submitting = true);

    try {
      // TODO: In a real shift context, participantId comes from the active shift
      // For now, we pass a placeholder that will be set from shift context
      await recordObservation(
        participantId: '', // Set from active shift context
        type: _selectedType!,
        values: _buildValues(),
        notes: _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : null,
      );

      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Observation recorded', style: GoogleFonts.inter(color: Colors.white)), backgroundColor: ObsidianTheme.emerald, behavior: SnackBarBehavior.floating),
        );
        context.canPop() ? context.pop() : context.go('/');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e', style: GoogleFonts.inter(color: Colors.white)), backgroundColor: ObsidianTheme.rose, behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); context.canPop() ? context.pop() : context.go('/'); },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text('Record Observation', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3)),
            flexibleSpace: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24), child: Container(color: c.canvas.withValues(alpha: 0.85)))),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Type Selector Grid ────────────────────
                Text('OBSERVATION TYPE', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 10),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.85,
                  children: ObservationType.values.where((t) => t != ObservationType.general).map((type) {
                    final isSelected = _selectedType == type;
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() {
                          _selectedType = type;
                          _valueCtrl.clear();
                          _value2Ctrl.clear();
                          _triageWarning = null;
                        });
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          color: isSelected ? ObsidianTheme.careBlue.withValues(alpha: 0.12) : c.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSelected ? ObsidianTheme.careBlue.withValues(alpha: 0.4) : c.border),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(type.icon, style: const TextStyle(fontSize: 22)),
                            const SizedBox(height: 4),
                            Text(type.label, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w500, color: isSelected ? ObsidianTheme.careBlue : c.textSecondary), textAlign: TextAlign.center, maxLines: 2),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ).animate().fadeIn(duration: 300.ms),
                const SizedBox(height: 24),

                // ── Value Input ───────────────────────────
                if (_selectedType != null) ...[
                  Text('VALUE', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: c.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _valueCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.jetBrainsMono(fontSize: 36, fontWeight: FontWeight.w700, color: c.textPrimary),
                            decoration: InputDecoration(
                              hintText: _selectedType == ObservationType.bloodPressure ? 'Systolic' : '0.0',
                              hintStyle: GoogleFonts.jetBrainsMono(fontSize: 36, color: c.textDisabled),
                              border: InputBorder.none,
                            ),
                            onChanged: (_) => _checkTriage(),
                          ),
                        ),
                        if (_selectedType == ObservationType.bloodPressure) ...[
                          Text('/', style: GoogleFonts.jetBrainsMono(fontSize: 36, color: c.textTertiary)),
                          Expanded(
                            child: TextField(
                              controller: _value2Ctrl,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.jetBrainsMono(fontSize: 36, fontWeight: FontWeight.w700, color: c.textPrimary),
                              decoration: InputDecoration(
                                hintText: 'Diastolic',
                                hintStyle: GoogleFonts.jetBrainsMono(fontSize: 36, color: c.textDisabled),
                                border: InputBorder.none,
                              ),
                              onChanged: (_) => _checkTriage(),
                            ),
                          ),
                        ],
                        Text(_unitLabel(), style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textTertiary)),
                      ],
                    ),
                  ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
                  const SizedBox(height: 12),

                  // ── Triage Warning ──────────────────────
                  if (_triageWarning != null)
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: ObsidianTheme.rose.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(PhosphorIconsFill.warning, size: 20, color: ObsidianTheme.rose),
                          const SizedBox(width: 10),
                          Expanded(child: Text(_triageWarning!, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: ObsidianTheme.rose, height: 1.4))),
                        ],
                      ),
                    ).animate().fadeIn(duration: 200.ms).shakeX(hz: 3, amount: 2, duration: 400.ms),

                  const SizedBox(height: 16),

                  // ── Notes ───────────────────────────────
                  Text('NOTES', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                  const SizedBox(height: 6),
                  Container(
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: c.border),
                    ),
                    child: TextField(
                      controller: _notesCtrl,
                      maxLines: 3,
                      style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Additional notes...',
                        hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.all(14),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _selectedType != null
          ? Container(
              padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).viewPadding.bottom + 12),
              decoration: BoxDecoration(color: c.canvas, border: Border(top: BorderSide(color: c.border))),
              child: SizedBox(
                width: double.infinity,
                height: 52,
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
                      : Text('Record Observation', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
            )
          : null,
    );
  }
}
