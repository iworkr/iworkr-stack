import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/theme/brand_theme.dart';

// ============================================================================
// Project Halcyon — Internal Feedback Sheet (Negative Sentiment Absorption)
// ============================================================================
// Step 2B of the "5-Star Sieve" UX flow.
// When the user taps "Not Really", the App Store is NEVER invoked.
// Instead, this sheet slides in with a empathetic feedback form.
// The feedback is routed to the internal_feedback_logs table and
// optionally to Slack for immediate team visibility.
// ============================================================================

class InternalFeedbackSheet extends StatefulWidget {
  const InternalFeedbackSheet({
    super.key,
    required this.userId,
    required this.triggerEvent,
  });

  final String userId;
  final String triggerEvent;

  @override
  State<InternalFeedbackSheet> createState() => _InternalFeedbackSheetState();
}

class _InternalFeedbackSheetState extends State<InternalFeedbackSheet> {
  final _controller = TextEditingController();
  bool _isSubmitting = false;
  final bool _isSubmitted = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brand = context.brand;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF141414) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black;
    final subtleColor = isDark ? Colors.white38 : Colors.black38;
    final surfaceColor = isDark ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return AnimatedPadding(
      duration: const Duration(milliseconds: 200),
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Drag handle ──
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: subtleColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                const SizedBox(height: 20),

                if (_isSubmitted) ...[
                  // ── Success state ──
                  const Text('💚', style: TextStyle(fontSize: 36)),
                  const SizedBox(height: 12),
                  Text(
                    'Thank you!',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: textColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your feedback has been sent directly to our team.\nWe\'ll use it to make iWorkr better for you.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: subtleColor,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: brand.primary,
                        foregroundColor: brand.onPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ] else ...[
                  // ── Empathetic copy ──
                  Text(
                    "We're sorry to hear that.",
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: textColor,
                    ),
                  ),

                  const SizedBox(height: 6),

                  Text(
                    'What can we improve to make your day easier?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: subtleColor,
                      height: 1.4,
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── Feedback text field ──
                  Container(
                    constraints: const BoxConstraints(maxHeight: 160),
                    decoration: BoxDecoration(
                      color: surfaceColor,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark ? Colors.white10 : Colors.black12,
                      ),
                    ),
                    child: TextField(
                      controller: _controller,
                      maxLines: 5,
                      minLines: 3,
                      textCapitalization: TextCapitalization.sentences,
                      style: TextStyle(
                        fontSize: 14,
                        color: textColor,
                        height: 1.5,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Tell us what\'s on your mind...',
                        hintStyle: TextStyle(
                          color: subtleColor.withValues(alpha: 0.5),
                          fontSize: 14,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.all(14),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── Submit button ──
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      onPressed: _isSubmitting
                          ? null
                          : () async {
                              final text = _controller.text.trim();
                              if (text.isEmpty) return;

                              setState(() => _isSubmitting = true);

                              // Return the feedback text to the service
                              // (which handles Edge Function + Slack routing)
                              Navigator.of(context).pop(text);
                            },
                      icon: _isSubmitting
                          ? SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: brand.onPrimary,
                              ),
                            )
                          : const Icon(Icons.send_rounded, size: 16),
                      label: Text(
                        _isSubmitting ? 'Sending...' : 'Send to Developers',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: brand.primary,
                        foregroundColor: brand.onPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // ── Privacy note ──
                  Text(
                    'Your feedback goes directly to our team — not to the App Store.',
                    style: TextStyle(
                      fontSize: 10,
                      color: subtleColor.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
