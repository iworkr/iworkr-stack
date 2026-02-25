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

  double get _maxDrag {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return 200;
    return box.size.width - _thumbSize - 8;
  }

  double get _progress => (_dragPosition / _maxDrag).clamp(0.0, 1.0);

  void _onDragUpdate(DragUpdateDetails details) {
    if (_completed || !widget.enabled) return;

    setState(() {
      _dragPosition = (_dragPosition + details.delta.dx).clamp(0.0, _maxDrag);
    });

    // Rising haptic intensity
    if (_progress > 0.25 && _progress < 0.5) {
      HapticFeedback.selectionClick();
    } else if (_progress > 0.5 && _progress < 0.75) {
      HapticFeedback.lightImpact();
    } else if (_progress > 0.75) {
      HapticFeedback.mediumImpact();
    }
  }

  void _onDragEnd(DragEndDetails details) {
    if (_completed) return;

    if (_progress > 0.85) {
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
                  width: _dragPosition + _thumbSize + 8,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(31),
                    gradient: LinearGradient(
                      colors: [
                        ObsidianTheme.emerald.withValues(alpha: 0.08 * _progress),
                        ObsidianTheme.emerald.withValues(alpha: 0.15 * _progress),
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
                  left: _completed ? constraints.maxWidth - _thumbSize - 4 : _dragPosition + 4,
                  top: (_trackHeight - _thumbSize) / 2,
                  child: GestureDetector(
                    onHorizontalDragUpdate: _onDragUpdate,
                    onHorizontalDragEnd: _onDragEnd,
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
                                _progress,
                              ),
                        border: Border.all(
                          color: _completed
                              ? ObsidianTheme.emerald
                              : Color.lerp(
                                  c.borderHover,
                                  ObsidianTheme.emerald.withValues(alpha: 0.6),
                                  _progress,
                                )!,
                          width: 1.5,
                        ),
                        boxShadow: [
                          if (_progress > 0.3)
                            BoxShadow(
                              color: ObsidianTheme.emerald.withValues(alpha: 0.2 * _progress),
                              blurRadius: 12 * _progress,
                              spreadRadius: 2 * _progress,
                            ),
                        ],
                      ),
                      child: Icon(
                        _completed
                            ? PhosphorIconsBold.lockKey
                            : PhosphorIconsLight.caretDoubleRight,
                        color: _completed ? Colors.white : Colors.white.withValues(alpha: 0.6 + _progress * 0.4),
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
