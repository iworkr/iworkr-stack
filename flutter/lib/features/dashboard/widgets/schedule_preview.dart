import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/empty_state.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

/// Dashboard schedule preview — glass blocks with status spine.
///
/// Matches web ScheduleBlock.tsx:
/// - bg-[#1A1A1A] / surface-1
/// - border border-white/5
/// - 3px status spine on left
class SchedulePreview extends StatelessWidget {
  final List<ScheduleBlock> blocks;
  const SchedulePreview({super.key, required this.blocks});

  Color _statusColor(ScheduleBlockStatus status) {
    switch (status) {
      case ScheduleBlockStatus.inProgress:
        return ObsidianTheme.emerald;
      case ScheduleBlockStatus.enRoute:
        return ObsidianTheme.amber;
      case ScheduleBlockStatus.complete:
        return ObsidianTheme.textTertiary;
      case ScheduleBlockStatus.cancelled:
        return ObsidianTheme.rose;
      default:
        return ObsidianTheme.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (blocks.isEmpty) {
      return const EmptyState(
        icon: PhosphorIconsRegular.calendarBlank,
        title: 'Clear schedule today',
        subtitle: 'No jobs scheduled. Enjoy the downtime.',
      );
    }

    return Column(
      children: List.generate(blocks.length, (i) {
        final block = blocks[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusLg,
            color: ObsidianTheme.surface1,
            border: Border.all(color: ObsidianTheme.border),
          ),
          child: ClipRRect(
            borderRadius: ObsidianTheme.radiusLg,
            child: Row(
              children: [
                // Status spine (3px)
                Container(
                  width: 3,
                  height: 56,
                  color: _statusColor(block.status),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          block.title,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: ObsidianTheme.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          block.location ?? block.clientName ?? '',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: ObsidianTheme.textTertiary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 14),
                  child: Text(
                    block.timeRange,
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      color: ObsidianTheme.textTertiary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        )
            .animate()
            .fadeIn(delay: Duration(milliseconds: 500 + i * 40), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
            .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 500 + i * 40), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
      }),
    );
  }
}
