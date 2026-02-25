import 'dart:math';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// iOS-style "Slide to Act" control for critical state transitions.
///
/// Prevents accidental pocket taps. The user must drag a thumb across
/// the full width to trigger the action. Haptic feedback ticks during
/// the drag and fires a heavy burst on completion.
class SlideToAct extends StatefulWidget {
  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback onSlideComplete;
  final bool enabled;

  const SlideToAct({
    super.key,
    required this.label,
    this.color = ObsidianTheme.emerald,
    this.icon = CupertinoIcons.chevron_right_2,
    required this.onSlideComplete,
    this.enabled = true,
  });

  @override
  State<SlideToAct> createState() => _SlideToActState();
}

class _SlideToActState extends State<SlideToAct>
    with SingleTickerProviderStateMixin {
  double _dragPosition = 0;
  double _maxDrag = 0;
  bool _triggered = false;
  int _lastHapticTick = 0;
  late AnimationController _resetCtrl;

  @override
  void initState() {
    super.initState();
    _resetCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _resetCtrl.addListener(() {
      setState(() => _dragPosition = _resetCtrl.value * _maxDrag * (1 - _resetCtrl.value / 1));
    });
  }

  @override
  void dispose() {
    _resetCtrl.dispose();
    super.dispose();
  }

  double get _progress => _maxDrag > 0 ? (_dragPosition / _maxDrag).clamp(0, 1) : 0;

  void _onDragUpdate(DragUpdateDetails details) {
    if (_triggered || !widget.enabled) return;
    setState(() {
      _dragPosition = (_dragPosition + details.delta.dx).clamp(0, _maxDrag);
    });

    final tick = (_progress * 20).floor();
    if (tick != _lastHapticTick) {
      _lastHapticTick = tick;
      HapticFeedback.selectionClick();
    }
  }

  void _onDragEnd(DragEndDetails details) {
    if (_triggered || !widget.enabled) return;
    if (_progress >= 0.9) {
      setState(() {
        _triggered = true;
        _dragPosition = _maxDrag;
      });
      HapticFeedback.heavyImpact();
      Future.delayed(const Duration(milliseconds: 200), widget.onSlideComplete);
    } else {
      _snapBack();
    }
  }

  void _snapBack() {
    final start = _dragPosition;
    _resetCtrl.reset();
    _resetCtrl.addListener(_createResetListener(start));
    _resetCtrl.forward();
  }

  VoidCallback _createResetListener(double start) {
    void listener() {
      final curve = Curves.easeOutCubic.transform(_resetCtrl.value);
      setState(() => _dragPosition = start * (1 - curve));
      if (_resetCtrl.isCompleted) {
        _resetCtrl.removeListener(listener);
      }
    }
    return listener;
  }

  @override
  Widget build(BuildContext context) {
    const thumbSize = 48.0;
    const padding = 4.0;
    const height = 56.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        _maxDrag = constraints.maxWidth - thumbSize - padding * 2;

        final c = context.iColors;

        return Opacity(
          opacity: widget.enabled ? 1.0 : 0.4,
          child: Container(
            height: height,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(height / 2),
              color: c.shimmerBase,
              border: Border.all(color: c.border),
            ),
            child: Stack(
              children: [
                // Fill track
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(height / 2),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: (_progress * 0.95 + 0.05).clamp(0, 1),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(height / 2),
                          gradient: LinearGradient(
                            colors: [
                              widget.color.withValues(alpha: 0.15),
                              widget.color.withValues(alpha: 0.05),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // Label
                Center(
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 100),
                    opacity: _triggered ? 0 : (1 - _progress * 1.5).clamp(0, 1).toDouble(),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.label,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: c.textSecondary,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Transform.translate(
                          offset: Offset(sin(DateTime.now().millisecondsSinceEpoch / 500) * 3, 0),
                          child: Icon(
                            CupertinoIcons.chevron_right_2,
                            size: 12,
                            color: c.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Thumb
                Positioned(
                  left: padding + _dragPosition,
                  top: padding,
                  child: GestureDetector(
                    onHorizontalDragUpdate: _onDragUpdate,
                    onHorizontalDragEnd: _onDragEnd,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 80),
                      width: thumbSize,
                      height: thumbSize,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _triggered ? widget.color : widget.color.withValues(alpha: 0.9),
                        boxShadow: [
                          BoxShadow(
                            color: widget.color.withValues(alpha: 0.3 + _progress * 0.3),
                            blurRadius: 12 + _progress * 8,
                          ),
                        ],
                      ),
                      child: Icon(
                        _triggered ? CupertinoIcons.checkmark : widget.icon,
                        size: 20,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
