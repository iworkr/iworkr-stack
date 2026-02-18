import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/chat_poll.dart';

/// Tactical Poll Card — embedded in the chat stream.
///
/// Glass card with emerald gradient progress bars.
class PollCard extends StatelessWidget {
  final ChatPoll poll;
  final ValueChanged<int>? onVote;

  const PollCard({super.key, required this.poll, this.onVote});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: ObsidianTheme.surface1,
        border: Border.all(color: ObsidianTheme.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(PhosphorIconsLight.chartBar, size: 14, color: ObsidianTheme.emerald),
              const SizedBox(width: 8),
              Text('POLL', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
            ],
          ),
          const SizedBox(height: 10),

          // Question
          Text(
            poll.question,
            style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
          ),
          const SizedBox(height: 14),

          // Options
          ...List.generate(poll.options.length, (i) {
            final pct = poll.votePercentage(i);
            final isMyVote = poll.myVoteIndex == i;
            final count = poll.voteCounts[i] ?? 0;

            return Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
              child: GestureDetector(
                onTap: poll.isClosed || poll.myVoteIndex != null
                    ? null
                    : () {
                        HapticFeedback.selectionClick();
                        onVote?.call(i);
                      },
                child: Stack(
                  children: [
                    // Background bar
                    Container(
                      height: 40,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(
                          color: isMyVote ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.border,
                        ),
                        color: ObsidianTheme.shimmerBase,
                      ),
                    ),
                    // Fill bar
                    if (poll.myVoteIndex != null || poll.isClosed)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 600),
                        curve: Curves.easeOutQuart,
                        height: 40,
                        width: null,
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusMd,
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: pct.clamp(0.02, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: ObsidianTheme.radiusMd,
                              gradient: LinearGradient(
                                colors: [
                                  ObsidianTheme.emerald.withValues(alpha: isMyVote ? 0.2 : 0.08),
                                  ObsidianTheme.emerald.withValues(alpha: isMyVote ? 0.08 : 0.02),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    // Label
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Row(
                          children: [
                            if (isMyVote) ...[
                              Icon(PhosphorIconsLight.check, size: 14, color: ObsidianTheme.emerald),
                              const SizedBox(width: 8),
                            ],
                            Expanded(
                              child: Text(
                                poll.options[i],
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: isMyVote ? Colors.white : ObsidianTheme.textSecondary,
                                  fontWeight: isMyVote ? FontWeight.w500 : FontWeight.normal,
                                ),
                              ),
                            ),
                            if (poll.myVoteIndex != null || poll.isClosed)
                              Text(
                                '$count',
                                style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.textTertiary),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          // Footer
          const SizedBox(height: 10),
          Text(
            '${poll.totalVotes} vote${poll.totalVotes == 1 ? '' : 's'}',
            style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).moveY(begin: 10, end: 0, duration: 300.ms, curve: Curves.easeOut);
  }
}
