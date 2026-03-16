import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/theme/brand_theme.dart';
import 'package:iworkr_mobile/features/feedback/services/halcyon_feedback_service.dart';

// ============================================================================
// Project Halcyon — The Sentiment Sieve Bottom Sheet
// ============================================================================
// Step 1 of the "5-Star Sieve" UX flow.
// A native-looking, frictionless bottom sheet that asks:
//   "Are you enjoying iWorkr?"
// Two equal-weight buttons:
//   [Not Really] (grey) → Routes to internal feedback absorption
//   [Yes, I love it!] (brand primary) → Routes to native OS review API
// ============================================================================

class SentimentSieveSheet extends StatelessWidget {
  const SentimentSieveSheet({
    super.key,
    required this.userName,
    this.personalMessage,
    this.triggerEvent,
  });

  final String userName;
  final String? personalMessage;
  final String? triggerEvent;

  @override
  Widget build(BuildContext context) {
    final brand = context.brand;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF141414) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black;
    final subtleColor = isDark ? Colors.white38 : Colors.black38;

    return Container(
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

              const SizedBox(height: 24),

              // ── Emoji ──
              const Text('👋', style: TextStyle(fontSize: 40)),

              const SizedBox(height: 16),

              // ── Greeting ──
              Text(
                'Hi $userName!',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: textColor,
                  letterSpacing: -0.3,
                ),
              ),

              const SizedBox(height: 8),

              // ── Personal message (context-specific) ──
              if (personalMessage != null) ...[
                Text(
                  personalMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: subtleColor,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // ── The Question ──
              Text(
                'Are you enjoying using iWorkr?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: textColor.withValues(alpha: 0.85),
                ),
              ),

              const SizedBox(height: 28),

              // ── Two equal-weight buttons ──
              Row(
                children: [
                  // "Not Really" — subtle, non-judgmental
                  Expanded(
                    child: SizedBox(
                      height: 50,
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(HalcyonSentiment.negative),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            color: isDark ? Colors.white12 : Colors.black12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'Not Really',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: subtleColor,
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(width: 12),

                  // "Yes, I love it!" — brand primary, inviting
                  Expanded(
                    child: SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(context).pop(HalcyonSentiment.positive),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: brand.primary,
                          foregroundColor: brand.onPrimary,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Yes, I love it!',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // ── Zero-guilt dismiss hint ──
              Text(
                'You can dismiss this anytime — no pressure.',
                style: TextStyle(
                  fontSize: 11,
                  color: subtleColor.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
