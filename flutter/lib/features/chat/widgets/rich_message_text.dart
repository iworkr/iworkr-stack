import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Parses message content containing structured mentions and references
/// and renders them as interactive inline chips.
///
/// Syntax:
///   @[user:uuid]  →  renders as "@UserName" chip (brand colored)
///   #[job:uuid]   →  renders as "#JOB-xxx" chip (brand colored)
///
/// For display, the parser resolves UUIDs against a lookup map.
class RichMessageText extends StatelessWidget {
  final String content;
  final Map<String, String> userNames;
  final Map<String, String> jobDisplayIds;
  final Color brandColor;
  final TextStyle? baseStyle;
  final void Function(String userId)? onMentionTap;
  final void Function(String jobId)? onReferenceTap;

  const RichMessageText({
    super.key,
    required this.content,
    this.userNames = const {},
    this.jobDisplayIds = const {},
    this.brandColor = const Color(0xFF10B981),
    this.baseStyle,
    this.onMentionTap,
    this.onReferenceTap,
  });

  static final _combinedRegex = RegExp(r'@\[user:([a-zA-Z0-9\-]+)\]|#\[job:([a-zA-Z0-9\-]+)\]');

  /// Check if a message contains any structured mentions or references.
  static bool hasStructuredContent(String content) {
    return _combinedRegex.hasMatch(content);
  }

  @override
  Widget build(BuildContext context) {
    final style = baseStyle ?? GoogleFonts.inter(fontSize: 14, color: Colors.white, height: 1.4);
    final spans = _buildSpans(style);
    return RichText(text: TextSpan(children: spans));
  }

  List<InlineSpan> _buildSpans(TextStyle baseStyle) {
    final spans = <InlineSpan>[];
    int lastEnd = 0;

    for (final match in _combinedRegex.allMatches(content)) {
      // Plain text before this match
      if (match.start > lastEnd) {
        spans.add(TextSpan(text: content.substring(lastEnd, match.start), style: baseStyle));
      }

      final userUuid = match.group(1);
      final jobUuid = match.group(2);

      if (userUuid != null) {
        final displayName = userNames[userUuid] ?? 'Unknown';
        spans.add(
          TextSpan(
            text: '@$displayName',
            style: baseStyle.copyWith(
              color: brandColor,
              fontWeight: FontWeight.w600,
              backgroundColor: brandColor.withValues(alpha: 0.1),
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                HapticFeedback.selectionClick();
                onMentionTap?.call(userUuid);
              },
          ),
        );
      } else if (jobUuid != null) {
        final displayId = jobDisplayIds[jobUuid] ?? 'JOB';
        spans.add(
          TextSpan(
            text: '#$displayId',
            style: baseStyle.copyWith(
              color: brandColor,
              fontWeight: FontWeight.w600,
              backgroundColor: brandColor.withValues(alpha: 0.1),
              fontFamily: GoogleFonts.jetBrainsMono().fontFamily,
              fontSize: (baseStyle.fontSize ?? 14) - 1,
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                HapticFeedback.selectionClick();
                onReferenceTap?.call(jobUuid);
              },
          ),
        );
      }

      lastEnd = match.end;
    }

    // Trailing text
    if (lastEnd < content.length) {
      spans.add(TextSpan(text: content.substring(lastEnd), style: baseStyle));
    }

    return spans;
  }
}
