import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Typing indicator — three emerald dots pulsing in wave sequence.
class TypingIndicator extends StatelessWidget {
  const TypingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          return Padding(
            padding: EdgeInsets.only(left: i == 0 ? 0 : 4),
            child: Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emerald.withValues(alpha: 0.6),
              ),
            )
                .animate(
                  onPlay: (c) => c.repeat(reverse: true),
                  delay: Duration(milliseconds: i * 150),
                )
                .scaleXY(begin: 0.6, end: 1.2, duration: 600.ms, curve: Curves.easeInOut)
                .fadeIn(begin: 0.3, duration: 600.ms),
          );
        }),
      ),
    );
  }
}
