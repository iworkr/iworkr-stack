import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/progress_notes_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Shift Report Sheet — care-sector pre-completion debrief.
///
/// Collects structured shift data (mood, summary, goals, observations,
/// incidents, EVV GPS coordinates) before handing off to the standard
/// job completion sheet.
///
/// Returns `true` if submitted successfully, `false` if cancelled.
Future<bool> showShiftReportSheet(
  BuildContext context, {
  required String jobId,
  required String participantId,
  required Duration elapsed,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ShiftReportSheet(
      jobId: jobId,
      participantId: participantId,
      elapsed: elapsed,
    ),
  );
  return result ?? false;
}

// ═══════════════════════════════════════════════════════════
// ── Mood Options ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

const _moodOptions = <String>[
  'Happy',
  'Calm',
  'Anxious',
  'Upset',
  'Agitated',
  'Unresponsive',
];

IconData _moodIcon(String mood) {
  switch (mood) {
    case 'Happy':
      return PhosphorIconsLight.smiley;
    case 'Calm':
      return PhosphorIconsLight.peace;
    case 'Anxious':
      return PhosphorIconsLight.heartBreak;
    case 'Upset':
      return PhosphorIconsLight.smileyMeh;
    case 'Agitated':
      return PhosphorIconsLight.warning;
    case 'Unresponsive':
      return PhosphorIconsLight.minusCircle;
    default:
      return PhosphorIconsLight.smiley;
  }
}

// ═══════════════════════════════════════════════════════════
// ── Sheet Widget ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ShiftReportSheet extends ConsumerStatefulWidget {
  final String jobId;
  final String participantId;
  final Duration elapsed;

  const _ShiftReportSheet({
    required this.jobId,
    required this.participantId,
    required this.elapsed,
  });

  @override
  ConsumerState<_ShiftReportSheet> createState() => _ShiftReportSheetState();
}

class _ShiftReportSheetState extends ConsumerState<_ShiftReportSheet> {
  String? _selectedMood;
  bool _participantPresent = true;
  bool _incidentOccurred = false;
  bool _submitting = false;

  final _summaryCtrl = TextEditingController();
  final _goalsCtrl = TextEditingController();
  final _observationsCtrl = TextEditingController();
  final _incidentTitleCtrl = TextEditingController();
  final _incidentDescCtrl = TextEditingController();

  double? _evvLat;
  double? _evvLng;
  bool _fetchingLocation = true;

  @override
  void initState() {
    super.initState();
    _captureEVV();
  }

  @override
  void dispose() {
    _summaryCtrl.dispose();
    _goalsCtrl.dispose();
    _observationsCtrl.dispose();
    _incidentTitleCtrl.dispose();
    _incidentDescCtrl.dispose();
    super.dispose();
  }

  Future<void> _captureEVV() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted) setState(() => _fetchingLocation = false);
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      if (mounted) {
        setState(() {
          _evvLat = position.latitude;
          _evvLng = position.longitude;
          _fetchingLocation = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _fetchingLocation = false);
    }
  }

  bool get _isValid =>
      _selectedMood != null && _summaryCtrl.text.trim().isNotEmpty;

  String get _elapsedFormatted {
    final hours = widget.elapsed.inHours;
    final minutes = widget.elapsed.inMinutes.remainder(60);
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }

  Future<void> _submit() async {
    if (!_isValid) {
      HapticFeedback.heavyImpact();
      return;
    }

    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    try {
      await createProgressNote(
        jobId: widget.jobId,
        participantId: widget.participantId.isNotEmpty ? widget.participantId : null,
        summary: _summaryCtrl.text.trim(),
        goalsAddressed: _goalsCtrl.text.trim().isNotEmpty ? _goalsCtrl.text.trim() : null,
        participantMood: _selectedMood,
        observations: _observationsCtrl.text.trim().isNotEmpty ? _observationsCtrl.text.trim() : null,
        participantPresent: _participantPresent,
        clockOutLat: _evvLat,
        clockOutLng: _evvLng,
        clockOutTime: DateTime.now(),
      );

      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to submit shift report: ${e.toString().split('\n').first}'),
          backgroundColor: const Color(0xFFF43F5E),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
          duration: const Duration(seconds: 4),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Container(
      margin: EdgeInsets.only(top: mq.size.height * 0.08),
      decoration: BoxDecoration(
        color: const Color(0xF80A0A0A),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: SingleChildScrollView(
          padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              // Drag handle
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: c.borderHover,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // ── Header ──────────────────────────────
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                  border: Border.all(
                    color: ObsidianTheme.emerald.withValues(alpha: 0.3),
                  ),
                ),
                child: const Icon(
                  PhosphorIconsLight.clipboardText,
                  color: ObsidianTheme.emerald,
                  size: 24,
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .scale(begin: const Offset(0.8, 0.8), duration: 400.ms, curve: Curves.easeOutBack),

              const SizedBox(height: 14),

              Text(
                'SHIFT REPORT',
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.emerald,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2,
                ),
              ).animate().fadeIn(delay: 100.ms, duration: 400.ms),

              const SizedBox(height: 4),

              Text(
                'Duration: $_elapsedFormatted',
                style: GoogleFonts.jetBrainsMono(
                  color: c.textTertiary,
                  fontSize: 11,
                  letterSpacing: 0.5,
                ),
              ).animate().fadeIn(delay: 150.ms, duration: 400.ms),

              const SizedBox(height: 24),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Participant Mood (required) ─────────
                    _buildSectionLabel('PARTICIPANT MOOD', required_: true),
                    const SizedBox(height: 8),
                    _buildMoodSelector(c),
                    const SizedBox(height: 20),

                    // ── Participant Present ─────────────────
                    _buildToggleRow(
                      c,
                      label: 'Participant Present',
                      icon: PhosphorIconsLight.user,
                      value: _participantPresent,
                      onChanged: (v) => setState(() => _participantPresent = v),
                    ),
                    const SizedBox(height: 20),

                    // ── Summary (required) ──────────────────
                    _buildSectionLabel('SUMMARY', required_: true),
                    const SizedBox(height: 8),
                    _buildTextField(
                      c,
                      controller: _summaryCtrl,
                      hint: 'Describe what happened during the shift',
                      maxLines: 4,
                    ),
                    const SizedBox(height: 20),

                    // ── Goals Addressed ─────────────────────
                    _buildSectionLabel('GOALS ADDRESSED'),
                    const SizedBox(height: 8),
                    _buildTextField(
                      c,
                      controller: _goalsCtrl,
                      hint: 'What goals were worked on?',
                      maxLines: 3,
                    ),
                    const SizedBox(height: 20),

                    // ── Observations ────────────────────────
                    _buildSectionLabel('OBSERVATIONS'),
                    const SizedBox(height: 8),
                    _buildTextField(
                      c,
                      controller: _observationsCtrl,
                      hint: 'Any health or behavioral observations?',
                      maxLines: 3,
                    ),
                    const SizedBox(height: 20),

                    // ── Incidents Toggle ────────────────────
                    _buildToggleRow(
                      c,
                      label: 'Did any incidents occur?',
                      icon: PhosphorIconsLight.warning,
                      value: _incidentOccurred,
                      onChanged: (v) => setState(() => _incidentOccurred = v),
                      accentColor: ObsidianTheme.amber,
                    ),

                    if (_incidentOccurred) ...[
                      const SizedBox(height: 12),
                      _buildTextField(
                        c,
                        controller: _incidentTitleCtrl,
                        hint: 'Incident title',
                        maxLines: 1,
                      ),
                      const SizedBox(height: 10),
                      _buildTextField(
                        c,
                        controller: _incidentDescCtrl,
                        hint: 'Describe the incident in detail',
                        maxLines: 3,
                      ),
                    ],

                    const SizedBox(height: 20),

                    // ── EVV Verification ────────────────────
                    _buildSectionLabel('EVV VERIFICATION'),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: const Color(0xFF141414),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                            ),
                            child: _fetchingLocation
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: ObsidianTheme.emerald,
                                      ),
                                    ),
                                  )
                                : Icon(
                                    _evvLat != null
                                        ? PhosphorIconsBold.mapPinArea
                                        : PhosphorIconsLight.mapPinLine,
                                    color: _evvLat != null
                                        ? ObsidianTheme.emerald
                                        : c.textTertiary,
                                    size: 18,
                                  ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _evvLat != null
                                      ? 'GPS CAPTURED'
                                      : _fetchingLocation
                                          ? 'ACQUIRING GPS...'
                                          : 'GPS UNAVAILABLE',
                                  style: GoogleFonts.jetBrainsMono(
                                    color: _evvLat != null
                                        ? ObsidianTheme.emerald
                                        : c.textTertiary,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 1,
                                  ),
                                ),
                                if (_evvLat != null) ...[
                                  const SizedBox(height: 3),
                                  Text(
                                    '${_evvLat!.toStringAsFixed(6)}, ${_evvLng!.toStringAsFixed(6)}',
                                    style: GoogleFonts.jetBrainsMono(
                                      color: c.textTertiary,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 28),

                    // ── Submit Button ────────────────────────
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _submitting
                            ? null
                            : _isValid
                                ? _submit
                                : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isValid
                              ? ObsidianTheme.emerald
                              : ObsidianTheme.emerald.withValues(alpha: 0.2),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor:
                              ObsidianTheme.emerald.withValues(alpha: 0.15),
                          disabledForegroundColor: Colors.white38,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 0,
                        ),
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(PhosphorIconsBold.paperPlaneTilt,
                                      size: 18),
                                  const SizedBox(width: 10),
                                  Text(
                                    'SUBMIT SHIFT REPORT',
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    )
                        .animate()
                        .fadeIn(delay: 300.ms, duration: 400.ms)
                        .moveY(
                          begin: 8,
                          delay: 300.ms,
                          duration: 400.ms,
                          curve: Curves.easeOutCubic,
                        ),

                    SizedBox(height: mq.padding.bottom + 24),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── Builders ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildSectionLabel(String label, {bool required_ = false}) {
    return Row(
      children: [
        Text(
          label,
          style: GoogleFonts.jetBrainsMono(
            color: Colors.white54,
            fontSize: 10,
            fontWeight: FontWeight.w500,
            letterSpacing: 1.5,
          ),
        ),
        if (required_) ...[
          const SizedBox(width: 4),
          Text(
            '*',
            style: GoogleFonts.inter(
              color: ObsidianTheme.rose,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildMoodSelector(IWorkrColors c) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _moodOptions.map((mood) {
        final isSelected = _selectedMood == mood;
        return GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() => _selectedMood = mood);
          },
          child: AnimatedContainer(
            duration: ObsidianTheme.fast,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: isSelected
                  ? ObsidianTheme.emerald.withValues(alpha: 0.12)
                  : const Color(0xFF141414),
              border: Border.all(
                color: isSelected
                    ? ObsidianTheme.emerald.withValues(alpha: 0.4)
                    : Colors.white.withValues(alpha: 0.06),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _moodIcon(mood),
                  size: 14,
                  color: isSelected ? ObsidianTheme.emerald : c.textTertiary,
                ),
                const SizedBox(width: 6),
                Text(
                  mood,
                  style: GoogleFonts.inter(
                    color: isSelected ? ObsidianTheme.emerald : c.textSecondary,
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildToggleRow(
    IWorkrColors c, {
    required String label,
    required IconData icon,
    required bool value,
    required ValueChanged<bool> onChanged,
    Color? accentColor,
  }) {
    final accent = accentColor ?? ObsidianTheme.emerald;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141414),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: c.textTertiary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(
                color: c.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
          SizedBox(
            width: 44,
            height: 24,
            child: Switch.adaptive(
              value: value,
              onChanged: (v) {
                HapticFeedback.selectionClick();
                onChanged(v);
              },
              activeThumbColor: accent,
              activeTrackColor: accent.withValues(alpha: 0.3),
              inactiveThumbColor: c.textTertiary,
              inactiveTrackColor: c.borderHover,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(
    IWorkrColors c, {
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141414),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: GoogleFonts.inter(color: Colors.white, fontSize: 13, height: 1.5),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
}
