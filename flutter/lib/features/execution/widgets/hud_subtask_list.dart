import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// HUD Subtask List — high-velocity checklist with haptic confirmation.
///
/// Pending tasks show white text + zinc checkbox.
/// Completed tasks dim + emerald checkbox with strikethrough animation.
/// Critical tasks have an amber dot and block job completion.
/// Long-press on a task to add a note/photo.
class HudSubtaskList extends StatelessWidget {
  final List<Map<String, dynamic>> subtasks;
  final ValueChanged<Map<String, dynamic>> onToggle;
  final ValueChanged<Map<String, dynamic>>? onAddNote;

  const HudSubtaskList({
    super.key,
    required this.subtasks,
    required this.onToggle,
    this.onAddNote,
  });

  @override
  Widget build(BuildContext context) {
    if (subtasks.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
          color: Colors.white.withValues(alpha: 0.02),
        ),
        child: Column(
          children: [
            Icon(PhosphorIconsLight.listChecks, color: ObsidianTheme.textTertiary, size: 28),
            const SizedBox(height: 12),
            Text(
              'No subtasks',
              style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return Column(
      children: List.generate(subtasks.length, (i) {
        final task = subtasks[i];
        return _SubtaskRow(
          task: task,
          index: i,
          onToggle: () => onToggle(task),
          onLongPress: onAddNote != null ? () => onAddNote!(task) : null,
        );
      }),
    );
  }
}

class _SubtaskRow extends StatefulWidget {
  final Map<String, dynamic> task;
  final int index;
  final VoidCallback onToggle;
  final VoidCallback? onLongPress;

  const _SubtaskRow({
    required this.task,
    required this.index,
    required this.onToggle,
    this.onLongPress,
  });

  @override
  State<_SubtaskRow> createState() => _SubtaskRowState();
}

class _SubtaskRowState extends State<_SubtaskRow>
    with SingleTickerProviderStateMixin {
  late AnimationController _strikethrough;
  bool _justToggled = false;

  @override
  void initState() {
    super.initState();
    _strikethrough = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    if (widget.task['completed'] == true) {
      _strikethrough.value = 1.0;
    }
  }

  @override
  void dispose() {
    _strikethrough.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _SubtaskRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    final wasCompleted = oldWidget.task['completed'] == true;
    final isCompleted = widget.task['completed'] == true;
    if (wasCompleted != isCompleted) {
      if (isCompleted) {
        _strikethrough.forward();
      } else {
        _strikethrough.reverse();
      }
    }
  }

  void _handleTap() {
    HapticFeedback.mediumImpact();
    setState(() => _justToggled = true);
    widget.onToggle();
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _justToggled = false);
    });
  }

  void _handleLongPress() {
    if (widget.onLongPress != null) {
      HapticFeedback.heavyImpact();
      widget.onLongPress!();
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = widget.task['completed'] as bool? ?? false;
    final title = widget.task['title'] as String? ?? '';
    final isCritical = widget.task['is_critical'] as bool? ?? false;

    return GestureDetector(
      onTap: _handleTap,
      onLongPress: _handleLongPress,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: ObsidianTheme.standard,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Colors.white.withValues(alpha: 0.04)),
          ),
          color: _justToggled
              ? ObsidianTheme.emerald.withValues(alpha: 0.04)
              : Colors.transparent,
        ),
        child: Row(
          children: [
            // Checkbox
            AnimatedContainer(
              duration: ObsidianTheme.fast,
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                color: done
                    ? ObsidianTheme.emerald.withValues(alpha: 0.15)
                    : Colors.transparent,
                border: Border.all(
                  color: done
                      ? ObsidianTheme.emerald
                      : ObsidianTheme.textTertiary.withValues(alpha: 0.5),
                  width: done ? 1.5 : 1,
                ),
              ),
              child: done
                  ? Icon(PhosphorIconsBold.check, size: 13, color: ObsidianTheme.emerald)
                      .animate()
                      .scale(
                        begin: const Offset(0.5, 0.5),
                        duration: 250.ms,
                        curve: Curves.easeOutBack,
                      )
                  : null,
            ),

            const SizedBox(width: 14),

            // Critical amber dot
            if (isCritical && !done) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.amber,
                  boxShadow: [
                    BoxShadow(
                      color: ObsidianTheme.amber.withValues(alpha: 0.4),
                      blurRadius: 4,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
            ],

            // Title with strikethrough animation
            Expanded(
              child: AnimatedBuilder(
                animation: _strikethrough,
                builder: (context, child) {
                  return Stack(
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: done
                              ? ObsidianTheme.textTertiary
                              : ObsidianTheme.textPrimary,
                          fontWeight: done ? FontWeight.w400 : FontWeight.w500,
                        ),
                      ),
                      if (_strikethrough.value > 0)
                        Positioned(
                          left: 0,
                          top: 0,
                          bottom: 0,
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                return Container(
                                  width: constraints.maxWidth * _strikethrough.value,
                                  height: 1.5,
                                  color: ObsidianTheme.emerald.withValues(alpha: 0.4),
                                );
                              },
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),

            // Note hint on long-press capable items
            if (widget.onLongPress != null && !done)
              Icon(
                PhosphorIconsLight.notepad,
                size: 13,
                color: ObsidianTheme.textTertiary.withValues(alpha: 0.3),
              ),

            // Completed icon
            if (done)
              Icon(
                PhosphorIconsLight.checkCircle,
                size: 14,
                color: ObsidianTheme.emerald.withValues(alpha: 0.5),
              ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 100 + widget.index * 40),
          duration: 400.ms,
        )
        .moveX(
          begin: -6,
          delay: Duration(milliseconds: 100 + widget.index * 40),
          duration: 400.ms,
          curve: Curves.easeOutCubic,
        );
  }
}
