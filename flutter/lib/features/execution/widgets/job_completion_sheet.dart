import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/job_execution_provider.dart';
import 'package:iworkr_mobile/core/services/telemetry_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/telemetry_event.dart';

/// Job Completion Debrief — summary sheet with validation.
///
/// Shows total time, tasks completed, photos taken.
/// Blocks completion if critical tasks are unfinished.
/// Includes signature pad for sign-off.
Future<bool> showJobCompletionSheet(
  BuildContext context, {
  required String jobId,
  required String sessionId,
  required Duration elapsed,
  required List<Map<String, dynamic>> subtasks,
  required int photoCount,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _CompletionSheet(
      jobId: jobId,
      sessionId: sessionId,
      elapsed: elapsed,
      subtasks: subtasks,
      photoCount: photoCount,
    ),
  );
  return result ?? false;
}

class _CompletionSheet extends ConsumerStatefulWidget {
  final String jobId;
  final String sessionId;
  final Duration elapsed;
  final List<Map<String, dynamic>> subtasks;
  final int photoCount;

  const _CompletionSheet({
    required this.jobId,
    required this.sessionId,
    required this.elapsed,
    required this.subtasks,
    required this.photoCount,
  });

  @override
  ConsumerState<_CompletionSheet> createState() => _CompletionSheetState();
}

class _CompletionSheetState extends ConsumerState<_CompletionSheet>
    with SingleTickerProviderStateMixin {
  bool _submitting = false;
  bool _shaking = false;
  bool _showSignature = false;
  bool _hasSigned = false;
  late AnimationController _flyOut;

  // Signature points
  final List<List<Offset>> _signatureStrokes = [];
  List<Offset>? _currentStroke;

  @override
  void initState() {
    super.initState();
    _flyOut = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
  }

  @override
  void dispose() {
    _flyOut.dispose();
    super.dispose();
  }

  int get _totalTasks => widget.subtasks.length;
  int get _completedTasks => widget.subtasks.where((t) => t['completed'] == true).length;

  List<Map<String, dynamic>> get _criticalIncomplete {
    return widget.subtasks.where((t) {
      final isCritical = t['is_critical'] as bool? ?? false;
      final completed = t['completed'] as bool? ?? false;
      return isCritical && !completed;
    }).toList();
  }

  bool get _canComplete => _criticalIncomplete.isEmpty;

  String get _elapsedFormatted {
    final hours = widget.elapsed.inHours;
    final minutes = widget.elapsed.inMinutes.remainder(60);
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }

  Future<void> _submit() async {
    if (!_canComplete) {
      HapticFeedback.heavyImpact();
      setState(() => _shaking = true);
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) setState(() => _shaking = false);
      return;
    }

    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    await completeJobTimer(
      sessionId: widget.sessionId,
      jobId: widget.jobId,
    );

    await logTelemetryEvent(
      jobId: widget.jobId,
      eventType: TelemetryEventType.jobCompleted,
      eventData: {
        'total_time_seconds': widget.elapsed.inSeconds,
        'tasks_completed': _completedTasks,
        'total_tasks': _totalTasks,
        'photos': widget.photoCount,
        'signed': _hasSigned,
      },
    );

    if (!mounted) return;

    _flyOut.forward();
    await Future.delayed(const Duration(milliseconds: 900));

    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return AnimatedBuilder(
      animation: _flyOut,
      builder: (context, child) {
        if (_flyOut.value > 0) {
          return Transform.scale(
            scale: 1.0 - _flyOut.value * 0.6,
            child: Opacity(
              opacity: 1.0 - _flyOut.value,
              child: Transform.translate(
                offset: Offset(0, -200 * _flyOut.value),
                child: child,
              ),
            ),
          );
        }
        return child!;
      },
      child: Container(
        margin: EdgeInsets.only(top: mq.size.height * 0.15),
        decoration: BoxDecoration(
          color: const Color(0xF8080808),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 24),

                // Shield icon
                Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _canComplete
                        ? ObsidianTheme.emerald.withValues(alpha: 0.1)
                        : ObsidianTheme.amber.withValues(alpha: 0.1),
                    border: Border.all(
                      color: _canComplete
                          ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                          : ObsidianTheme.amber.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Icon(
                    _canComplete ? PhosphorIconsLight.flagCheckered : PhosphorIconsLight.warning,
                    color: _canComplete ? ObsidianTheme.emerald : ObsidianTheme.amber,
                    size: 28,
                  ),
                )
                    .animate()
                    .fadeIn(duration: 400.ms)
                    .scale(begin: const Offset(0.8, 0.8), duration: 400.ms, curve: Curves.easeOutBack),

                const SizedBox(height: 16),

                Text(
                  _canComplete ? 'JOB DEBRIEF' : 'INCOMPLETE TASKS',
                  style: GoogleFonts.jetBrainsMono(
                    color: _canComplete ? ObsidianTheme.emerald : ObsidianTheme.amber,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2,
                  ),
                )
                    .animate()
                    .fadeIn(delay: 100.ms, duration: 400.ms),

                const SizedBox(height: 24),

                // Stats row
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    children: [
                      _StatBlock(
                        label: 'TIME',
                        value: _elapsedFormatted,
                        icon: PhosphorIconsLight.timer,
                        color: ObsidianTheme.emerald,
                        delay: 0,
                      ),
                      _StatBlock(
                        label: 'TASKS',
                        value: '$_completedTasks/$_totalTasks',
                        icon: PhosphorIconsLight.checkSquare,
                        color: _completedTasks == _totalTasks ? ObsidianTheme.emerald : ObsidianTheme.amber,
                        delay: 1,
                      ),
                      _StatBlock(
                        label: 'PHOTOS',
                        value: '${widget.photoCount}',
                        icon: PhosphorIconsLight.camera,
                        color: ObsidianTheme.textSecondary,
                        delay: 2,
                      ),
                    ],
                  ),
                ),

                // Critical incomplete warning
                if (_criticalIncomplete.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: ObsidianTheme.rose.withValues(alpha: 0.06),
                      border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.15)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(PhosphorIconsLight.warning, color: ObsidianTheme.rose, size: 14),
                            const SizedBox(width: 8),
                            Text(
                              'Critical tasks must be completed',
                              style: GoogleFonts.inter(
                                color: ObsidianTheme.rose,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ...(_criticalIncomplete.map((t) => Padding(
                          padding: const EdgeInsets.only(left: 22, bottom: 4),
                          child: Row(
                            children: [
                              Container(
                                width: 5, height: 5,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: ObsidianTheme.amber,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                t['title'] as String? ?? '',
                                style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 12),
                              ),
                            ],
                          ),
                        ))),
                      ],
                    ),
                  )
                      .animate()
                      .fadeIn(delay: 200.ms, duration: 400.ms)
                      .shake(delay: 200.ms, hz: 4, rotation: 0.01),
                ],

                // Signature section
                if (_canComplete) ...[
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _showSignature = !_showSignature);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white.withValues(alpha: 0.03),
                          border: Border.all(
                            color: _hasSigned
                                ? ObsidianTheme.emerald.withValues(alpha: 0.2)
                                : Colors.white.withValues(alpha: 0.06),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _hasSigned ? PhosphorIconsBold.checkCircle : PhosphorIconsLight.signature,
                              size: 16,
                              color: _hasSigned ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _hasSigned ? 'Signature captured' : 'Add signature (optional)',
                                style: GoogleFonts.inter(
                                  color: _hasSigned ? ObsidianTheme.emerald : ObsidianTheme.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            Icon(
                              _showSignature ? PhosphorIconsLight.caretUp : PhosphorIconsLight.caretDown,
                              size: 14,
                              color: ObsidianTheme.textTertiary,
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(delay: 250.ms, duration: 400.ms),

                  // Signature pad
                  if (_showSignature)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 10, 24, 0),
                      child: Column(
                        children: [
                          Container(
                            height: 140,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.white.withValues(alpha: 0.04),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                            ),
                            child: GestureDetector(
                              onPanStart: (d) {
                                setState(() {
                                  _currentStroke = [d.localPosition];
                                });
                              },
                              onPanUpdate: (d) {
                                setState(() {
                                  _currentStroke?.add(d.localPosition);
                                });
                              },
                              onPanEnd: (_) {
                                if (_currentStroke != null && _currentStroke!.length > 2) {
                                  setState(() {
                                    _signatureStrokes.add(List.from(_currentStroke!));
                                    _currentStroke = null;
                                    _hasSigned = true;
                                  });
                                }
                              },
                              child: CustomPaint(
                                painter: _SignaturePainter(
                                  strokes: _signatureStrokes,
                                  currentStroke: _currentStroke,
                                ),
                                size: Size.infinite,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Sign on glass',
                                style: GoogleFonts.jetBrainsMono(
                                  color: ObsidianTheme.textTertiary,
                                  fontSize: 9,
                                  letterSpacing: 1,
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _signatureStrokes.clear();
                                    _currentStroke = null;
                                    _hasSigned = false;
                                  });
                                },
                                child: Text(
                                  'Clear',
                                  style: GoogleFonts.inter(
                                    color: ObsidianTheme.textTertiary,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    )
                        .animate()
                        .fadeIn(duration: 300.ms)
                        .moveY(begin: 8, duration: 300.ms, curve: Curves.easeOutCubic),
                ],

                const SizedBox(height: 28),

                // Submit button
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: SizedBox(
                    width: double.infinity,
                    child: _shaking
                        ? Container(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              color: ObsidianTheme.rose.withValues(alpha: 0.15),
                              border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.3)),
                            ),
                            child: Center(
                              child: Text(
                                'COMPLETE CRITICAL TASKS FIRST',
                                style: GoogleFonts.jetBrainsMono(
                                  color: ObsidianTheme.rose,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                          )
                            .animate()
                            .shake(hz: 8, rotation: 0.02, duration: 500.ms)
                        : ElevatedButton(
                            onPressed: _submitting ? null : _submit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _canComplete
                                  ? ObsidianTheme.emerald
                                  : ObsidianTheme.amber.withValues(alpha: 0.2),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              elevation: 0,
                            ),
                            child: _submitting
                                ? const SizedBox(
                                    width: 20, height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        _canComplete ? PhosphorIconsBold.flagCheckered : PhosphorIconsLight.warning,
                                        size: 18,
                                      ),
                                      const SizedBox(width: 10),
                                      Text(
                                        _canComplete ? 'SUBMIT JOB REPORT' : 'REVIEW TASKS',
                                        style: GoogleFonts.jetBrainsMono(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 1.5,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                  ),
                )
                    .animate()
                    .fadeIn(delay: 300.ms, duration: 400.ms)
                    .moveY(begin: 8, delay: 300.ms, duration: 400.ms, curve: Curves.easeOutCubic),

                SizedBox(height: mq.padding.bottom + 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatBlock extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final int delay;

  const _StatBlock({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: EdgeInsets.only(left: delay > 0 ? 8 : 0),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: Colors.white.withValues(alpha: 0.03),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(
              value,
              style: GoogleFonts.jetBrainsMono(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                color: ObsidianTheme.textTertiary,
                fontSize: 9,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
      )
          .animate()
          .fadeIn(
            delay: Duration(milliseconds: 150 + delay * 80),
            duration: 400.ms,
          )
          .moveY(
            begin: 10,
            delay: Duration(milliseconds: 150 + delay * 80),
            duration: 400.ms,
            curve: Curves.easeOutCubic,
          ),
    );
  }
}

/// Sign-on-glass painter for the signature pad.
class _SignaturePainter extends CustomPainter {
  final List<List<Offset>> strokes;
  final List<Offset>? currentStroke;

  _SignaturePainter({required this.strokes, this.currentStroke});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final stroke in strokes) {
      if (stroke.length < 2) continue;
      final path = Path()..moveTo(stroke[0].dx, stroke[0].dy);
      for (int i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }

    if (currentStroke != null && currentStroke!.length >= 2) {
      final path = Path()..moveTo(currentStroke![0].dx, currentStroke![0].dy);
      for (int i = 1; i < currentStroke!.length; i++) {
        path.lineTo(currentStroke![i].dx, currentStroke![i].dy);
      }
      canvas.drawPath(path, paint..color = Colors.white.withValues(alpha: 0.7));
    }

    // Baseline
    final basePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 0.5;
    canvas.drawLine(
      Offset(16, size.height * 0.75),
      Offset(size.width - 16, size.height * 0.75),
      basePaint,
    );

    // "X" mark
    if (strokes.isEmpty && currentStroke == null) {
      final textPainter = TextPainter(
        text: TextSpan(
          text: 'X',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.08),
            fontSize: 18,
            fontWeight: FontWeight.w400,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(20, size.height * 0.75 - textPainter.height - 4));
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter old) => true;
}
