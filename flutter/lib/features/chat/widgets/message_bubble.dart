import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/chat/widgets/rich_message_text.dart';
import 'package:iworkr_mobile/models/chat_message.dart';

/// Message bubble — "The Stealth Stream" design.
///
/// Me:   No background, right-aligned, emerald spine on right edge.
/// Them: bg-zinc-900 with white/5 border, left-aligned.
/// System: Centered monospace, dim.
class MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final bool isMe;
  final bool showSender;
  final int index;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    this.showSender = true,
    this.index = 0,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    if (message.isSystem) return _buildSystem(c);
    if (message.isDeleted) return _buildDeleted(c);

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        margin: EdgeInsets.only(
          left: isMe ? 48 : 0,
          right: isMe ? 0 : 48,
          bottom: 2,
          top: showSender ? 8 : 1,
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (showSender && !isMe)
              Padding(
                padding: const EdgeInsets.only(left: 12, bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Mini avatar
                    Container(
                      width: 18, height: 18,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(5),
                        color: c.shimmerBase,
                      ),
                      child: Center(
                        child: Text(
                          message.senderInitials,
                          style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.w600, color: c.textTertiary),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      message.senderName ?? 'Unknown',
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500, color: c.textSecondary),
                    ),
                  ],
                ),
              ),

            // Bubble
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (isMe) _buildTimestamp(c),
                if (isMe) const SizedBox(width: 6),
                Flexible(child: _buildBubbleContent(context)),
                if (!isMe) const SizedBox(width: 6),
                if (!isMe) _buildTimestamp(c),
              ],
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 200.ms, curve: Curves.easeOut)
        .moveY(begin: 8, end: 0, duration: 200.ms, curve: Curves.easeOut);
  }

  Widget _buildBubbleContent(BuildContext context) {
    final c = context.iColors;
    if (isMe) {
      // My message — no background, emerald spine on right
      return IntrinsicHeight(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child: RichMessageText.hasStructuredContent(message.content)
                    ? RichMessageText(
                        content: message.content,
                        baseStyle: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.4),
                        onMentionTap: (_) {},
                        onReferenceTap: (jobId) => context.push('/jobs/$jobId'),
                      )
                    : Text(
                        message.content,
                        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.4),
                      ),
              ),
            ),
            // Emerald spine
            Container(
              width: 2,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(1),
                color: ObsidianTheme.emerald.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      );
    } else {
      // Their message — zinc background
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: c.surface,
          border: Border.all(color: c.border),
        ),
        child: RichMessageText.hasStructuredContent(message.content)
            ? RichMessageText(
                content: message.content,
                baseStyle: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, height: 1.4),
                onMentionTap: (_) {},
                onReferenceTap: (jobId) => context.push('/jobs/$jobId'),
              )
            : Text(
                message.content,
                style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, height: 1.4),
              ),
      );
    }
  }

  Widget _buildTimestamp(IWorkrColors c) {
    return Text(
      timeago.format(message.createdAt, locale: 'en_short'),
      style: GoogleFonts.jetBrainsMono(fontSize: 9, color: c.textTertiary),
    );
  }

  Widget _buildSystem(IWorkrColors c) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
      child: Center(
        child: Text(
          '— ${message.content.toUpperCase()} —',
          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 0.5),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildDeleted(IWorkrColors c) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsLight.prohibit, size: 12, color: c.textTertiary),
            const SizedBox(width: 6),
            Text(
              'Message deleted',
              style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary, fontStyle: FontStyle.italic),
            ),
          ],
        ),
      ),
    );
  }
}
