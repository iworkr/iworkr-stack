import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/quote_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/quote.dart';
import 'package:iworkr_mobile/features/quotes/widgets/signature_pad.dart';

/// Opens the full-screen Quote Presentation ("Client Mode")
void showQuotePresentation(BuildContext context, Quote quote) {
  HapticFeedback.mediumImpact();
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      opaque: true,
      pageBuilder: (_, __, ___) => QuotePresentScreen(quote: quote),
      transitionsBuilder: (_, a, __, child) {
        return FadeTransition(
          opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween(begin: 0.96, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutQuart)),
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 350),
    ),
  );
}

class QuotePresentScreen extends ConsumerStatefulWidget {
  final Quote quote;
  const QuotePresentScreen({super.key, required this.quote});

  @override
  ConsumerState<QuotePresentScreen> createState() => _QuotePresentScreenState();
}

class _QuotePresentScreenState extends ConsumerState<QuotePresentScreen> {
  bool _accepted = false;
  bool _showSuccess = false;

  void _onSlideAccept() async {
    HapticFeedback.heavyImpact();

    // Show signature pad
    final signatureSvg = await showSignaturePad(context);
    if (signatureSvg == null || !mounted) return;

    // Save acceptance
    await acceptQuote(
      quoteId: widget.quote.id,
      signatureSvg: signatureSvg,
      signedBy: widget.quote.clientName,
    );

    ref.invalidate(quotesProvider);
    if (widget.quote.jobId != null) {
      ref.invalidate(jobQuotesProvider(widget.quote.jobId!));
    }

    if (mounted) {
      setState(() { _accepted = true; _showSuccess = true; });
      HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Stack(
          children: [
            // Success flash
            if (_showSuccess)
              Positioned.fill(
                child: Container(color: ObsidianTheme.emerald.withValues(alpha: 0.06))
                    .animate().fadeIn(duration: 200.ms).fadeOut(delay: 1000.ms, duration: 600.ms),
              ),

            Column(
              children: [
                // Minimal header
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () { HapticFeedback.lightImpact(); Navigator.pop(context, _accepted); },
                        child: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle, color: ObsidianTheme.hoverBg,
                            border: Border.all(color: ObsidianTheme.border),
                          ),
                          child: const Center(child: Icon(PhosphorIconsLight.arrowLeft, size: 16, color: ObsidianTheme.textSecondary)),
                        ),
                      ),
                      const Spacer(),
                      if (widget.quote.displayId != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusFull,
                            color: ObsidianTheme.shimmerBase,
                            border: Border.all(color: ObsidianTheme.border),
                          ),
                          child: Text(widget.quote.displayId!, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                        ),
                    ],
                  ),
                ).animate().fadeIn(duration: 300.ms),

                const Spacer(),

                // ── Success State ──────────────────────
                if (_accepted) ...[
                  Container(
                    width: 88, height: 88,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ObsidianTheme.emeraldDim,
                      border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.4)),
                      boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.15), blurRadius: 40)],
                    ),
                    child: const Center(child: Icon(PhosphorIconsBold.handshake, size: 36, color: ObsidianTheme.emerald)),
                  )
                      .animate()
                      .scaleXY(begin: 0.5, end: 1.0, duration: 500.ms, curve: Curves.easeOutBack)
                      .fadeIn(duration: 300.ms),

                  const SizedBox(height: 24),

                  Text('Quote Accepted', style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w600, color: Colors.white))
                      .animate().fadeIn(delay: 200.ms, duration: 400.ms),

                  const SizedBox(height: 8),
                  Text(
                    _formatCurrency(widget.quote.total),
                    style: GoogleFonts.inter(fontSize: 16, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500),
                  ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

                  const SizedBox(height: 32),

                  GestureDetector(
                    onTap: () => Navigator.pop(context, true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.borderMedium),
                      ),
                      child: Text('Done', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary)),
                    ),
                  ).animate().fadeIn(delay: 500.ms, duration: 400.ms),
                ]

                // ── Presentation State ─────────────────
                else ...[
                  // Hero total
                  Text(
                    _formatCurrency(widget.quote.total),
                    style: GoogleFonts.inter(fontSize: 56, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -2),
                  ).animate().fadeIn(duration: 500.ms).moveY(begin: 10, end: 0),

                  if (widget.quote.title != null) ...[
                    const SizedBox(height: 6),
                    Text(widget.quote.title!, style: GoogleFonts.inter(fontSize: 15, color: ObsidianTheme.textSecondary))
                        .animate().fadeIn(delay: 100.ms, duration: 400.ms),
                  ],

                  const SizedBox(height: 32),

                  // Clean line items
                  Container(
                    width: 300,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusLg,
                      color: ObsidianTheme.surface1,
                      border: Border.all(color: ObsidianTheme.border),
                    ),
                    child: Column(
                      children: [
                        ...widget.quote.lineItems.asMap().entries.map((e) {
                          final item = e.value;
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                Expanded(child: Text(item.description, style: GoogleFonts.inter(fontSize: 13, color: Colors.white))),
                                Text('\$${item.lineTotal.toStringAsFixed(2)}', style: GoogleFonts.jetBrainsMono(fontSize: 12, color: ObsidianTheme.textSecondary)),
                              ],
                            ),
                          ).animate().fadeIn(delay: Duration(milliseconds: 200 + e.key * 60), duration: 400.ms);
                        }),
                        const Divider(color: ObsidianTheme.border, height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Tax (${widget.quote.taxRate.toStringAsFixed(0)}%)', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                            Text('\$${widget.quote.tax.toStringAsFixed(2)}', style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.textTertiary)),
                          ],
                        ),
                      ],
                    ),
                  ).animate().fadeIn(delay: 200.ms, duration: 500.ms),

                  const SizedBox(height: 40),

                  // Slide to Accept
                  _SlideToAccept(onAccepted: _onSlideAccept),
                ],

                const Spacer(),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatCurrency(double amount) {
    final whole = amount.toInt();
    final cents = ((amount - whole) * 100).toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}.${'$cents'.padLeft(2, '0')}';
  }
}

// ═══════════════════════════════════════════════════════
// ── Slide to Accept ───────────────────────────────────
// ═══════════════════════════════════════════════════════

class _SlideToAccept extends StatefulWidget {
  final VoidCallback onAccepted;
  const _SlideToAccept({required this.onAccepted});

  @override
  State<_SlideToAccept> createState() => _SlideToAcceptState();
}

class _SlideToAcceptState extends State<_SlideToAccept> {
  double _position = 0;
  bool _triggered = false;
  static const double _trackWidth = 280;
  static const double _thumbWidth = 52;
  static const double _maxSlide = _trackWidth - _thumbWidth - 8;

  void _onPanUpdate(DragUpdateDetails details) {
    if (_triggered) return;
    setState(() {
      _position = (_position + details.delta.dx).clamp(0, _maxSlide);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    if (_triggered) return;
    if (_position > _maxSlide * 0.85) {
      setState(() { _triggered = true; _position = _maxSlide; });
      HapticFeedback.heavyImpact();
      widget.onAccepted();
    } else {
      setState(() => _position = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = _position / _maxSlide;

    return Container(
      width: _trackWidth,
      height: 60,
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusXl,
        color: ObsidianTheme.surface1,
        border: Border.all(color: Color.lerp(ObsidianTheme.borderMedium, ObsidianTheme.emerald.withValues(alpha: 0.3), progress)!),
      ),
      child: Stack(
        alignment: Alignment.centerLeft,
        children: [
          // Track fill
          Positioned(
            left: 4, top: 4, bottom: 4,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 50),
              width: _position + _thumbWidth,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusXl,
                color: ObsidianTheme.emerald.withValues(alpha: progress * 0.15),
              ),
            ),
          ),

          // Label
          Center(
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 100),
              opacity: (1 - progress * 2).clamp(0, 1),
              child: Text(
                'Slide to Accept',
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textTertiary),
              ),
            ),
          ),

          // Thumb
          Positioned(
            left: 4 + _position,
            child: GestureDetector(
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: AnimatedContainer(
                duration: _triggered ? const Duration(milliseconds: 300) : const Duration(milliseconds: 50),
                width: _thumbWidth,
                height: 52,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusXl,
                  color: _triggered ? ObsidianTheme.emerald : Colors.white,
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(2, 0))],
                ),
                child: Center(
                  child: Icon(
                    _triggered ? PhosphorIconsBold.check : PhosphorIconsBold.caretRight,
                    size: 18,
                    color: _triggered ? Colors.white : Colors.black,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms, duration: 500.ms).moveY(begin: 10, end: 0);
  }
}
