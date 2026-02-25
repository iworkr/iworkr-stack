import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/job.dart';

/// Small status indicator pip — matches web status dots.
///
/// Web spec:
/// - Active: pulsing 6px Emerald dot
/// - signal-pulse animation: scale 1 -> 1.8, opacity 0.3 -> 0
class StatusPip extends StatelessWidget {
  final Color color;
  final double size;
  final bool pulse;

  const StatusPip({
    super.key,
    required this.color,
    this.size = 6,
    this.pulse = false,
  });

  factory StatusPip.fromJobStatus(JobStatus status) {
    switch (status) {
      case JobStatus.inProgress:
        return const StatusPip(color: ObsidianTheme.emerald, pulse: true);
      case JobStatus.done:
      case JobStatus.completed:
        return const StatusPip(color: ObsidianTheme.emerald);
      case JobStatus.todo:
        return const StatusPip(color: ObsidianTheme.blue);
      case JobStatus.scheduled:
      case JobStatus.enRoute:
      case JobStatus.onSite:
        return const StatusPip(color: ObsidianTheme.amber, pulse: true);
      case JobStatus.invoiced:
        return const StatusPip(color: Color(0xFFA78BFA));
      case JobStatus.cancelled:
        return const StatusPip(color: ObsidianTheme.rose);
      case JobStatus.backlog:
      case JobStatus.archived:
        return const StatusPip(color: ObsidianTheme.textTertiary);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (pulse) {
      return SizedBox(
        width: size * 2,
        height: size * 2,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Outer pulse ring
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: 0.3),
              ),
            )
                .animate(onPlay: (c) => c.repeat())
                .scaleXY(begin: 1, end: 2.5, duration: 2000.ms, curve: Curves.easeOut)
                .fadeOut(duration: 2000.ms),
            // Core dot
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color,
                boxShadow: [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 6)],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }
}

/// Priority icon — matches web PriorityIcon patterns.
class PriorityIcon extends StatelessWidget {
  final JobPriority priority;
  final double size;

  const PriorityIcon({super.key, required this.priority, this.size = 14});

  @override
  Widget build(BuildContext context) {
    switch (priority) {
      case JobPriority.urgent:
        return Icon(Icons.keyboard_double_arrow_up, size: size, color: ObsidianTheme.rose);
      case JobPriority.high:
        return Icon(Icons.arrow_upward, size: size, color: const Color(0xFFF97316));
      case JobPriority.medium:
        return Icon(Icons.drag_handle, size: size, color: ObsidianTheme.textTertiary);
      case JobPriority.low:
        return Icon(Icons.arrow_downward, size: size, color: ObsidianTheme.blue);
      case JobPriority.none:
        return SizedBox(width: size, height: size);
    }
  }
}
