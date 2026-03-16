import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Slide-to-Engage — replaces a standard "Start" button.
///
/// Glass track with shimmering chevrons. Haptic intensity increases
/// as the user drags. On completion, triggers a "Lock" callback.
class SlideToEngage extends StatefulWidget {
  final VoidCallback onEngaged;
  final bool enabled;
  final String label;

  const SlideToEngage({
    super.key,
    required this.onEngaged,
    this.enabled = true,
    this.label = 'SLIDE TO START JOB',
  });

  @override
  State<SlideToEngage> createState() => _SlideToEngageState();
}

class _SlideToEngageState extends State<SlideToEngage>
    with SingleTickerProviderStateMixin {
  double _dragPosition = 0;
  bool _completed = false;
  late AnimationController _shimmer;

  static const double _thumbSize = 56;
  static const double _trackHeight = 62;

  @override
  void initState() {
    super.initState();
    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmer.dispose();
    super.dispose();
  }

  double _maxDragForWidth(double width) {
    final safeWidth = width.isFinite ? width : 260;
    return (safeWidth - _thumbSize - 8).clamp(32.0, 4096.0);
  }

  double _progressFor(double maxDrag) =>
      (_dragPosition / maxDrag).clamp(0.0, 1.0);

  void _onDragUpdate(DragUpdateDetails details, double maxDrag) {
    if (_completed || !widget.enabled) return;

    setState(() {
      _dragPosition = (_dragPosition + details.delta.dx).clamp(0.0, maxDrag);
    });

    // Rising haptic intensity
    final progress = _progressFor(maxDrag);
    if (progress > 0.25 && progress < 0.5) {
      HapticFeedback.selectionClick();
    } else if (progress > 0.5 && progress < 0.75) {
      HapticFeedback.lightImpact();
    } else if (progress > 0.75) {
      HapticFeedback.mediumImpact();
    }
  }

  void _onDragEnd(DragEndDetails details, double maxDrag) {
    if (_completed) return;

    if (_progressFor(maxDrag) > 0.85) {
      setState(() => _completed = true);
      HapticFeedback.heavyImpact();
      widget.onEngaged();
    } else {
      setState(() => _dragPosition = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return AnimatedOpacity(
      opacity: widget.enabled ? 1.0 : 0.4,
      duration: ObsidianTheme.standard,
      child: SizedBox(
        height: _trackHeight,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final maxDrag = _maxDragForWidth(constraints.maxWidth);
            final progress = _progressFor(maxDrag);
            final progressWidth =
                (_dragPosition + _thumbSize + 8).clamp(0.0, constraints.maxWidth);
            final completedLeft =
                (constraints.maxWidth - _thumbSize - 4).clamp(4.0, maxDrag + 4);
            return Stack(
              alignment: Alignment.centerLeft,
              children: [
                // Track background
                Container(
                  height: _trackHeight,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(31),
                    color: c.hoverBg,
                    border: Border.all(
                      color: _completed
                          ? ObsidianTheme.emerald.withValues(alpha: 0.4)
                          : c.borderMedium,
                    ),
                  ),
                ),

                // Progress fill
                AnimatedContainer(
                  duration: _completed ? ObsidianTheme.standard : Duration.zero,
                  height: _trackHeight,
                  width: progressWidth,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(31),
                    gradient: LinearGradient(
                      colors: [
                        ObsidianTheme.emerald.withValues(alpha: 0.08 * progress),
                        ObsidianTheme.emerald.withValues(alpha: 0.15 * progress),
                      ],
                    ),
                  ),
                ),

                // Shimmer chevrons (>>>) in the track
                if (!_completed)
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _shimmer,
                      builder: (_, __) {
                        return ShaderMask(
                          shaderCallback: (bounds) {
                            return LinearGradient(
                              begin: Alignment(-1 + _shimmer.value * 3, 0),
                              end: Alignment(-0.5 + _shimmer.value * 3, 0),
                              colors: [
                                Colors.transparent,
                                c.borderHover,
                                Colors.transparent,
                              ],
                            ).createShader(bounds);
                          },
                          blendMode: BlendMode.srcIn,
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.only(left: 64),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    '› › ›  ',
                                    style: GoogleFonts.jetBrainsMono(
                                      color: Colors.white.withValues(alpha: 0.25),
                                      fontSize: 18,
                                      letterSpacing: 6,
                                    ),
                                  ),
                                  Text(
                                    widget.label,
                                    style: GoogleFonts.jetBrainsMono(
                                      color: Colors.white.withValues(alpha: 0.25),
                                      fontSize: 11,
                                      letterSpacing: 2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                // Completed text
                if (_completed)
                  Center(
                    child: Text(
                      'JOB STARTED',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.emerald,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 3,
                      ),
                    )
                        .animate()
                        .fadeIn(duration: 300.ms)
                        .scale(begin: const Offset(0.8, 0.8), duration: 300.ms, curve: Curves.easeOutBack),
                  ),

                // Draggable thumb
                AnimatedPositioned(
                  duration: _completed ? ObsidianTheme.standard : Duration.zero,
                  left: _completed ? completedLeft : _dragPosition + 4,
                  top: (_trackHeight - _thumbSize) / 2,
                  child: GestureDetector(
                    onHorizontalDragUpdate: (details) =>
                        _onDragUpdate(details, maxDrag),
                    onHorizontalDragEnd: (details) => _onDragEnd(details, maxDrag),
                    child: AnimatedContainer(
                      duration: ObsidianTheme.fast,
                      width: _thumbSize,
                      height: _thumbSize,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _completed
                            ? ObsidianTheme.emerald
                            : Color.lerp(
                                c.borderMedium,
                                ObsidianTheme.emerald.withValues(alpha: 0.3),
                                progress,
                              ),
                        border: Border.all(
                          color: _completed
                              ? ObsidianTheme.emerald
                              : Color.lerp(
                                  c.borderHover,
                                  ObsidianTheme.emerald.withValues(alpha: 0.6),
                                  progress,
                                )!,
                          width: 1.5,
                        ),
                        boxShadow: [
                          if (progress > 0.3)
                            BoxShadow(
                              color: ObsidianTheme.emerald.withValues(alpha: 0.2 * progress),
                              blurRadius: 12 * progress,
                              spreadRadius: 2 * progress,
                            ),
                        ],
                      ),
                      child: Icon(
                        _completed
                            ? PhosphorIconsBold.lockKey
                            : PhosphorIconsLight.caretDoubleRight,
                        color: _completed
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.6 + progress * 0.4),
                        size: 20,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 300.ms, duration: 500.ms)
        .moveY(begin: 12, delay: 300.ms, duration: 500.ms, curve: Curves.easeOutCubic);
  }
}
