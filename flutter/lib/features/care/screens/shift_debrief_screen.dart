import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/progress_notes_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/slide_to_act.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

// ═══════════════════════════════════════════════════════════
// ── Shift Debrief — Mandatory End-of-Shift Report ────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// 5-step mandatory debrief before clock-out:
// 1. Goal Tracking  2. Participant Mood  3. Narrative Note
// 4. Mileage/Expenses  5. Client Signature (optional)

class ShiftDebriefScreen extends ConsumerStatefulWidget {
  final String shiftId;
  const ShiftDebriefScreen({super.key, required this.shiftId});

  @override
  ConsumerState<ShiftDebriefScreen> createState() => _ShiftDebriefScreenState();
}

class _ShiftDebriefScreenState extends ConsumerState<ShiftDebriefScreen> {
  CareShift? _shift;
  bool _loading = true;
  bool _submitting = false;

  // Step 1: Goals
  final Set<String> _selectedGoals = {};
  final List<String> _availableGoals = [
    'Improve community access',
    'Develop daily living skills',
    'Manage personal care routine',
    'Build social connections',
    'Improve communication skills',
    'Maintain physical health',
    'Support emotional wellbeing',
  ];

  // Step 2: Mood
  String _mood = 'neutral';

  // Step 3: Notes
  final _notesCtrl = TextEditingController();
  final _stt = stt.SpeechToText();
  bool _isListening = false;

  // Step 4: Mileage
  final _kmCtrl = TextEditingController();

  // Step 5: Signature
  final List<Offset?> _signaturePoints = [];

  @override
  void initState() {
    super.initState();
    _loadShift();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _kmCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadShift() async {
    try {
      final data = await SupabaseService.client
          .from('shifts')
          .select('*, participant_profiles(preferred_name, avatar_url, critical_alerts), clients(name)')
          .eq('id', widget.shiftId)
          .maybeSingle();

      if (data != null && mounted) {
        setState(() {
          _shift = CareShift.fromJson(data);
          _loading = false;
        });
      } else {
        final fallback = await SupabaseService.client
            .from('schedule_blocks')
            .select()
            .eq('id', widget.shiftId)
            .maybeSingle();
        if (fallback != null && mounted) {
          setState(() { _shift = CareShift.fromJson(fallback); _loading = false; });
        } else if (mounted) {
          setState(() => _loading = false);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleVoice() async {
    if (_isListening) {
      _stt.stop();
      setState(() => _isListening = false);
      return;
    }

    final available = await _stt.initialize();
    if (!available) return;

    setState(() => _isListening = true);
    _stt.listen(
      onResult: (result) {
        setState(() {
          _notesCtrl.text = result.recognizedWords;
          if (result.finalResult) _isListening = false;
        });
      },
      listenFor: const Duration(minutes: 2),
      pauseFor: const Duration(seconds: 5),
    );
  }

  Future<void> _submitDebrief() async {
    if (_shift == null || _submitting) return;
    if (_notesCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please enter a progress note before completing the shift.',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.amber,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      // Get GPS for clock-out
      Position position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
        );
      } catch (_) {
        position = Position(latitude: 0, longitude: 0, timestamp: DateTime.now(), accuracy: 0, altitude: 0, altitudeAccuracy: 0, heading: 0, headingAccuracy: 0, speed: 0, speedAccuracy: 0);
      }

      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      // 1. Create progress note
      await createProgressNote(
        jobId: _shift!.id,
        participantId: _shift!.participantId,
        summary: _notesCtrl.text.trim(),
        goalsAddressed: _selectedGoals.join(', '),
        participantMood: _mood,
        clockOutLat: position.latitude,
        clockOutLng: position.longitude,
      );

      // 2. Clock out the shift
      final entries = await SupabaseService.client
          .from('time_entries')
          .select('id, clock_in')
          .eq('job_id', _shift!.id)
          .eq('status', 'active')
          .order('clock_in', ascending: false)
          .limit(1);

      if ((entries as List).isNotEmpty) {
        final entry = entries[0];
        final clockIn = DateTime.parse(entry['clock_in'] as String);
        final km = double.tryParse(_kmCtrl.text) ?? 0;

        await clockOutOfShift(
          shiftId: _shift!.id,
          timeEntryId: entry['id'] as String,
          clockInTime: clockIn,
          lat: position.latitude,
          lng: position.longitude,
          kilometersTravelled: km > 0 ? km : null,
        );
      } else {
        // Fallback: just update shift status
        await SupabaseService.client.from('shifts').update({
          'status': 'completed',
          'actual_end': DateTime.now().toUtc().toIso8601String(),
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        }).eq('id', _shift!.id);
      }

      HapticFeedback.heavyImpact();

      if (mounted) {
        // Show success and navigate back
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Shift completed successfully!', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.emerald,
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    if (_loading) {
      return Scaffold(backgroundColor: c.canvas, body: const Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }

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
            title: Text('Shift Report', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3)),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Step 1: Goal Tracking ─────────────────
                _StepHeader(step: 1, title: 'Goal Tracking', subtitle: 'Which goals were addressed during this shift?'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _availableGoals.map((goal) {
                    final isSelected = _selectedGoals.contains(goal);
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() {
                          isSelected ? _selectedGoals.remove(goal) : _selectedGoals.add(goal);
                        });
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelected ? ObsidianTheme.careBlue.withValues(alpha: 0.15) : c.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected ? ObsidianTheme.careBlue.withValues(alpha: 0.4) : c.border,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isSelected ? PhosphorIconsFill.checkCircle : PhosphorIconsLight.circle,
                              size: 18,
                              color: isSelected ? ObsidianTheme.careBlue : c.textTertiary,
                            ),
                            const SizedBox(width: 8),
                            Flexible(child: Text(goal, style: GoogleFonts.inter(fontSize: 13, color: isSelected ? ObsidianTheme.careBlue : c.textSecondary))),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ).animate().fadeIn(duration: 300.ms),
                const SizedBox(height: 24),

                // ── Step 2: Participant Mood ──────────────
                _StepHeader(step: 2, title: 'Participant Mood', subtitle: 'How was the participant during the shift?'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _MoodOption(emoji: '😊', label: 'Happy', value: 'happy', selected: _mood, onTap: (v) => setState(() => _mood = v)),
                    const SizedBox(width: 8),
                    _MoodOption(emoji: '😐', label: 'Neutral', value: 'neutral', selected: _mood, onTap: (v) => setState(() => _mood = v)),
                    const SizedBox(width: 8),
                    _MoodOption(emoji: '😤', label: 'Agitated', value: 'agitated', selected: _mood, onTap: (v) => setState(() => _mood = v)),
                    const SizedBox(width: 8),
                    _MoodOption(emoji: '🤒', label: 'Unwell', value: 'unwell', selected: _mood, onTap: (v) => setState(() => _mood = v)),
                  ],
                ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
                const SizedBox(height: 24),

                // ── Step 3: Narrative Note ────────────────
                _StepHeader(step: 3, title: 'Progress Note', subtitle: 'Describe what happened during the shift'),
                const SizedBox(height: 10),
                Container(
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    children: [
                      TextField(
                        controller: _notesCtrl,
                        maxLines: 6,
                        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.6),
                        decoration: InputDecoration(
                          hintText: 'Describe the shift activities, participant engagement, and any observations...',
                          hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.all(14),
                        ),
                      ),
                      Divider(height: 1, color: c.border),
                      GestureDetector(
                        onTap: _toggleVoice,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _isListening ? PhosphorIconsFill.microphone : PhosphorIconsLight.microphone,
                                size: 20,
                                color: _isListening ? ObsidianTheme.rose : ObsidianTheme.careBlue,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _isListening ? 'Listening... Tap to stop' : 'Tap to dictate',
                                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: _isListening ? ObsidianTheme.rose : ObsidianTheme.careBlue),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 200.ms, duration: 300.ms),
                const SizedBox(height: 24),

                // ── Step 4: Mileage / Expenses ────────────
                _StepHeader(step: 4, title: 'Travel & Expenses', subtitle: 'Did you use your personal vehicle?'),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border),
                  ),
                  child: Row(
                    children: [
                      Icon(PhosphorIconsLight.car, size: 22, color: c.textTertiary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _kmCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: GoogleFonts.jetBrainsMono(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary),
                          decoration: InputDecoration(
                            hintText: '0.0',
                            hintStyle: GoogleFonts.jetBrainsMono(fontSize: 18, color: c.textDisabled),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                        ),
                      ),
                      Text('km', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textTertiary)),
                    ],
                  ),
                ).animate().fadeIn(delay: 300.ms, duration: 300.ms),
                const SizedBox(height: 24),

                // ── Step 5: Client Signature (Optional) ───
                _StepHeader(step: 5, title: 'Client Signature', subtitle: 'Optional — participant acknowledgement'),
                const SizedBox(height: 10),
                Container(
                  height: 150,
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border),
                  ),
                  child: Stack(
                    children: [
                      GestureDetector(
                        onPanUpdate: (details) {
                          setState(() {
                            final localPosition = details.localPosition;
                            _signaturePoints.add(localPosition);
                          });
                        },
                        onPanEnd: (_) => setState(() => _signaturePoints.add(null)),
                        child: CustomPaint(
                          painter: _SignaturePainter(points: _signaturePoints, color: c.textPrimary),
                          size: Size.infinite,
                        ),
                      ),
                      if (_signaturePoints.isEmpty)
                        Center(
                          child: Text('Sign here', style: GoogleFonts.inter(fontSize: 14, color: c.textDisabled)),
                        ),
                      Positioned(
                        top: 8,
                        right: 8,
                        child: GestureDetector(
                          onTap: () => setState(() => _signaturePoints.clear()),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: c.canvas,
                              shape: BoxShape.circle,
                              border: Border.all(color: c.border),
                            ),
                            child: Icon(PhosphorIconsLight.eraser, size: 16, color: c.textTertiary),
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 400.ms, duration: 300.ms),
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).viewPadding.bottom + 12),
        decoration: BoxDecoration(
          color: c.canvas,
          border: Border(top: BorderSide(color: c.border)),
        ),
        child: _submitting
            ? const Center(child: SizedBox(height: 56, child: Center(child: CircularProgressIndicator(strokeWidth: 2))))
            : SlideToAct(
                label: 'Slide to Complete Shift',
                color: ObsidianTheme.emerald,
                icon: PhosphorIconsLight.checkCircle,
                onSlideComplete: _submitDebrief,
              ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Helper Widgets ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StepHeader extends StatelessWidget {
  final int step;
  final String title;
  final String subtitle;
  const _StepHeader({required this.step, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text('$step', style: GoogleFonts.jetBrainsMono(fontSize: 13, fontWeight: FontWeight.w700, color: ObsidianTheme.careBlue)),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
              Text(subtitle, style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
            ],
          ),
        ),
      ],
    );
  }
}

class _MoodOption extends StatelessWidget {
  final String emoji;
  final String label;
  final String value;
  final String selected;
  final ValueChanged<String> onTap;
  const _MoodOption({required this.emoji, required this.label, required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isSelected = value == selected;
    return Expanded(
      child: GestureDetector(
        onTap: () { HapticFeedback.selectionClick(); onTap(value); },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected ? ObsidianTheme.careBlue.withValues(alpha: 0.12) : c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? ObsidianTheme.careBlue.withValues(alpha: 0.4) : c.border,
            ),
          ),
          child: Column(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 24)),
              const SizedBox(height: 4),
              Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500, color: isSelected ? ObsidianTheme.careBlue : c.textTertiary)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  final Color color;
  _SignaturePainter({required this.points, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.0;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
