import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/invoice_provider.dart';
import 'package:iworkr_mobile/core/services/payment_terminal_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/invoice.dart';

/// Opens the full-screen Terminal Mode for Tap to Pay.
void showTerminalScreen(BuildContext context, Invoice invoice) {
  HapticFeedback.mediumImpact();
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      opaque: true,
      pageBuilder: (_, __, ___) => TerminalScreen(invoice: invoice),
      transitionsBuilder: (_, animation, __, child) {
        return FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween(begin: 0.95, end: 1.0).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutQuart),
            ),
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 400),
      reverseTransitionDuration: const Duration(milliseconds: 250),
    ),
  );
}

class TerminalScreen extends ConsumerStatefulWidget {
  final Invoice invoice;
  const TerminalScreen({super.key, required this.invoice});

  @override
  ConsumerState<TerminalScreen> createState() => _TerminalScreenState();
}

class _TerminalScreenState extends ConsumerState<TerminalScreen>
    with TickerProviderStateMixin {
  TerminalState _state = TerminalState.idle;
  String? _errorMessage;
  String? _paymentIntentId;
  bool _submitting = false;

  final _emailController = TextEditingController();
  bool _receiptSending = false;
  bool _receiptSent = false;

  late AnimationController _radarController;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _radarController = AnimationController(vsync: this, duration: const Duration(milliseconds: 2500))
      ..repeat();
    _pulseController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))
      ..repeat(reverse: true);

    _emailController.text = widget.invoice.clientEmail ?? '';

    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    _startTerminal();
  }

  @override
  void dispose() {
    _radarController.dispose();
    _pulseController.dispose();
    _emailController.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _startTerminal() async {
    final orgId = ref.read(activeWorkspaceIdProvider);
    if (orgId == null) {
      _onDeclined('No active workspace');
      return;
    }

    final online = await PaymentTerminalService.isOnline;
    if (!online) {
      _onDeclined('No network connection. Tap to Pay requires internet.');
      return;
    }

    setState(() => _state = TerminalState.ready);
    HapticFeedback.lightImpact();

    try {
      // Initialize Stripe Terminal SDK
      await PaymentTerminalService.initializeSdk(orgId);

      final amountCents = (widget.invoice.total * 100).toInt();

      // Create PaymentIntent via backend
      final clientSecret = await PaymentTerminalService.createPaymentIntent(
        amountCents: amountCents,
        currency: 'usd',
        invoiceId: widget.invoice.id,
        orgId: orgId,
        customerEmail: widget.invoice.clientEmail,
      );

      if (clientSecret == null || !mounted) {
        _onDeclined('Unable to create payment intent');
        return;
      }

      if (!mounted) return;
      setState(() => _state = TerminalState.reading);
      HapticFeedback.selectionClick();

      // Collect payment via NFC — native OS payment sheet takes over here
      final result = await PaymentTerminalService.processPayment(
        clientSecret: clientSecret,
        amountCents: amountCents,
      );

      if (!mounted) return;

      if (result.success) {
        _onSuccess(result);
      } else {
        _onDeclined(result.errorMessage ?? 'Card Declined');
      }
    } catch (e) {
      if (mounted) {
        _onDeclined('Terminal error: $e');
      }
    }
  }

  void _onSuccess(PaymentResult result) async {
    setState(() {
      _state = TerminalState.success;
      _paymentIntentId = result.paymentIntentId;
    });
    HapticFeedback.heavyImpact();

    try {
      await markInvoicePaid(widget.invoice.id);
    } catch (_) {}
  }

  void _onDeclined(String message) {
    if (!mounted) return;
    setState(() {
      _state = TerminalState.declined;
      _errorMessage = message;
    });
    HapticFeedback.heavyImpact();
    Future.delayed(const Duration(milliseconds: 100), () {
      HapticFeedback.heavyImpact();
    });
  }

  void _retry() {
    setState(() { _state = TerminalState.idle; _errorMessage = null; });
    _startTerminal();
  }

  Future<void> _sendInvoiceLink() async {
    HapticFeedback.mediumImpact();
    setState(() => _submitting = true);

    try {
      final result = await SupabaseService.client.rpc(
        'mark_invoice_sent_with_link',
        params: {'p_invoice_id': widget.invoice.id},
      );

      final paymentLink = result?['payment_link'] as String?;

      if (!mounted) return;
      setState(() => _submitting = false);

      if (paymentLink != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Invoice link sent. Job marked as invoiced.',
              style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
            ),
            backgroundColor: ObsidianTheme.emerald,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }

      Navigator.of(context).pop(false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to send invoice: $e', style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.rose,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    }
  }

  void _close() {
    HapticFeedback.lightImpact();
    Navigator.of(context).pop(_state == TerminalState.success);
  }

  Future<void> _sendReceipt() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;

    setState(() => _receiptSending = true);
    HapticFeedback.mediumImpact();

    final sent = await PaymentTerminalService.sendReceipt(
      invoiceId: widget.invoice.id,
      email: email,
      paymentIntentId: _paymentIntentId,
    );

    if (mounted) {
      setState(() { _receiptSending = false; _receiptSent = sent; });
      if (sent) HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: Stack(
        children: [
          if (_state == TerminalState.success)
            Positioned.fill(
              child: Container(color: ObsidianTheme.emerald.withValues(alpha: 0.06))
                  .animate().fadeIn(duration: 200.ms).fadeOut(delay: 800.ms, duration: 400.ms),
            ),
          if (_state == TerminalState.declined)
            Positioned.fill(
              child: Container(color: ObsidianTheme.rose.withValues(alpha: 0.08))
                  .animate().fadeIn(duration: 200.ms).fadeOut(delay: 800.ms, duration: 400.ms),
            ),

          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: _close,
                        child: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: c.border,
                            border: Border.all(color: c.borderMedium),
                          ),
                          child: Center(child: Icon(PhosphorIconsLight.x, size: 16, color: c.textSecondary)),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusFull,
                          color: c.shimmerBase,
                          border: Border.all(color: c.border),
                        ),
                        child: Text(
                          widget.invoice.displayId ?? 'INV',
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 300.ms),

                const Spacer(),

                if (_state == TerminalState.ready || _state == TerminalState.idle)
                  _buildReadyState(),

                if (_state == TerminalState.reading)
                  _buildReadingState(),

                if (_state == TerminalState.processing)
                  _buildProcessingState(),

                if (_state == TerminalState.success)
                  _buildSuccessState(),

                if (_state == TerminalState.declined)
                  _buildDeclinedState(),

                const Spacer(),

                if (_state == TerminalState.ready || _state == TerminalState.reading)
                  _buildBottomInfo(),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Ready State: Pulsing NFC Radar ──────────────────

  Widget _buildReadyState() {
    final c = context.iColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 200, height: 200,
          child: AnimatedBuilder(
            animation: _radarController,
            builder: (_, __) {
              return CustomPaint(
                painter: _NfcRadarPainter(
                  progress: _radarController.value,
                  pulseValue: _pulseController.value,
                ),
                size: const Size(200, 200),
              );
            },
          ),
        ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1.0, duration: 600.ms, curve: Curves.easeOutBack),

        const SizedBox(height: 40),

        Text(
          _formatCurrency(widget.invoice.total),
          style: GoogleFonts.inter(fontSize: 56, fontWeight: FontWeight.w700, color: c.textPrimary, letterSpacing: -2),
        ).animate().fadeIn(delay: 200.ms, duration: 500.ms).moveY(begin: 10, end: 0),

        const SizedBox(height: 8),

        if (widget.invoice.clientName != null)
          Text(
            widget.invoice.clientName!,
            style: GoogleFonts.inter(fontSize: 15, color: c.textSecondary),
          ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

        const SizedBox(height: 24),

        Text(
          'Initializing terminal...',
          style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textTertiary, letterSpacing: 0.5),
        ).animate().fadeIn(delay: 400.ms, duration: 400.ms),
      ],
    );
  }

  // ── Reading State ───────────────────────────────────

  Widget _buildReadingState() {
    final c = context.iColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 200, height: 200,
          child: AnimatedBuilder(
            animation: _radarController,
            builder: (_, __) {
              return CustomPaint(
                painter: _NfcRadarPainter(
                  progress: _radarController.value,
                  pulseValue: _pulseController.value,
                ),
                size: const Size(200, 200),
              );
            },
          ),
        ),

        const SizedBox(height: 40),

        Text(
          _formatCurrency(widget.invoice.total),
          style: GoogleFonts.inter(fontSize: 56, fontWeight: FontWeight.w700, color: c.textPrimary, letterSpacing: -2),
        ),

        const SizedBox(height: 16),

        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(4, (i) {
            return Container(
              width: 8, height: 8,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emerald,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true)).fadeIn(delay: Duration(milliseconds: 200 + i * 200), duration: 600.ms);
          }),
        ),

        const SizedBox(height: 12),

        Text(
          'Hold card or device near top of phone',
          style: GoogleFonts.jetBrainsMono(fontSize: 12, color: ObsidianTheme.emerald, letterSpacing: 0.5),
        ),
      ],
    );
  }

  // ── Processing State ────────────────────────────────

  Widget _buildProcessingState() {
    final c = context.iColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 80, height: 80,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3), width: 2),
                ),
              )
                  .animate(onPlay: (c) => c.repeat())
                  .scaleXY(begin: 0.8, end: 1.4, duration: 1500.ms, curve: Curves.easeOut)
                  .fadeOut(duration: 1500.ms),
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.6), width: 2),
                ),
              )
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scaleXY(begin: 1.0, end: 1.1, duration: 1000.ms, curve: Curves.easeInOut),
            ],
          ),
        ),

        const SizedBox(height: 32),

        Text(
          'Processing Cryptogram',
          style: GoogleFonts.jetBrainsMono(fontSize: 14, fontWeight: FontWeight.w500, color: c.textTertiary, letterSpacing: 0.5),
        ),

        const SizedBox(height: 8),

        Text(
          _formatCurrency(widget.invoice.total),
          style: GoogleFonts.jetBrainsMono(fontSize: 14, color: c.textTertiary),
        ),
      ],
    );
  }

  // ── Success State ───────────────────────────────────

  Widget _buildSuccessState() {
    final c = context.iColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emeraldDim,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.4)),
            boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.2), blurRadius: 30)],
          ),
          child: const Center(child: Icon(PhosphorIconsBold.check, size: 32, color: ObsidianTheme.emerald)),
        )
            .animate()
            .scaleXY(begin: 0.5, end: 1.0, duration: 400.ms, curve: Curves.easeOutBack)
            .fadeIn(duration: 300.ms),

        const SizedBox(height: 28),

        Text(
          'Payment Successful',
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary),
        ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

        const SizedBox(height: 4),

        Text(
          _formatCurrency(widget.invoice.total),
          style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500),
        ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

        const SizedBox(height: 32),

        _buildReceiptSection(),
      ],
    );
  }

  Widget _buildReceiptSection() {
    final c = context.iColors;
    return Container(
      width: 280,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Send Receipt', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: c.textPrimary)),
          const SizedBox(height: 10),

          TextField(
            controller: _emailController,
            style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
            cursorColor: ObsidianTheme.emerald,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              hintText: 'client@email.com',
              hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textDisabled),
              prefixIcon: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Icon(PhosphorIconsLight.envelope, size: 16, color: c.textTertiary),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 24, minHeight: 0),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
            ),
          ),

          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: _receiptSent ? null : _sendReceipt,
                  child: AnimatedContainer(
                    duration: ObsidianTheme.fast,
                    height: 40,
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: _receiptSent ? ObsidianTheme.emeraldDim : Colors.white,
                      border: _receiptSent ? Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)) : null,
                    ),
                    child: Center(
                      child: _receiptSending
                          ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))
                          : Text(
                              _receiptSent ? 'Sent' : 'Send & Close',
                              style: GoogleFonts.inter(
                                fontSize: 13, fontWeight: FontWeight.w600,
                                color: _receiptSent ? ObsidianTheme.emerald : Colors.black,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _close,
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    border: Border.all(color: c.borderMedium),
                  ),
                  child: Center(child: Icon(PhosphorIconsLight.x, size: 14, color: c.textTertiary)),
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms, duration: 500.ms).moveY(begin: 10, end: 0);
  }

  // ── Declined State ──────────────────────────────────

  Widget _buildDeclinedState() {
    final c = context.iColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.roseDim,
            border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.4)),
            boxShadow: [BoxShadow(color: ObsidianTheme.rose.withValues(alpha: 0.2), blurRadius: 30)],
          ),
          child: const Center(child: Icon(PhosphorIconsBold.x, size: 32, color: ObsidianTheme.rose)),
        )
            .animate()
            .scaleXY(begin: 0.5, end: 1.0, duration: 300.ms, curve: Curves.easeOutBack)
            .then()
            .shakeX(hz: 4, amount: 3, duration: 300.ms),

        const SizedBox(height: 28),

        Text(
          'Payment Declined',
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary),
        ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

        const SizedBox(height: 6),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(
            _errorMessage ?? 'The customer\'s bank declined the transaction. Please ask for an alternative payment method.',
            style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
            textAlign: TextAlign.center,
          ).animate().fadeIn(delay: 300.ms, duration: 400.ms),
        ),

        const SizedBox(height: 28),

        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              onTap: _retry,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  color: Colors.white,
                ),
                child: Text('Try Another Card', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black)),
              ),
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: _close,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  border: Border.all(color: c.borderMedium),
                ),
                child: Text('Cancel', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary)),
              ),
            ),
          ],
        ).animate().fadeIn(delay: 400.ms, duration: 400.ms),

        const SizedBox(height: 16),

        // POS-to-Invoice pivot
        GestureDetector(
          onTap: _sendInvoiceLink,
          child: Text(
            'Send Invoice Link Instead',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: c.textTertiary,
              decoration: TextDecoration.underline,
              decorationColor: c.textTertiary.withValues(alpha: 0.3),
            ),
          ),
        ).animate().fadeIn(delay: 500.ms, duration: 400.ms),
      ],
    );
  }

  // ── Bottom Info (Card types) ────────────────────────

  Widget _buildBottomInfo() {
    final c = context.iColors;
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _cardBadge('Visa'),
            _cardBadge('Mastercard'),
            _cardBadge('Apple Pay'),
            _cardBadge('Google Pay'),
          ],
        ).animate().fadeIn(delay: 500.ms, duration: 400.ms),
        const SizedBox(height: 12),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsLight.shieldCheck, size: 12, color: c.textTertiary),
            const SizedBox(width: 4),
            Text(
              'Secured by Stripe',
              style: GoogleFonts.jetBrainsMono(fontSize: 9, color: c.textTertiary, letterSpacing: 0.5),
            ),
          ],
        ),
      ],
    );
  }

  Widget _cardBadge(String label) {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 3),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusSm,
        color: c.shimmerBase,
        border: Border.all(color: c.border),
      ),
      child: Text(label, style: GoogleFonts.inter(fontSize: 9, color: c.textTertiary, fontWeight: FontWeight.w500)),
    );
  }

  // ── Helpers ─────────────────────────────────────────

  String _formatCurrency(double amount) {
    final whole = amount.toInt();
    final cents = ((amount - whole) * 100).toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}.${'$cents'.padLeft(2, '0')}';
  }
}

// ═══════════════════════════════════════════════════════
// ── NFC Radar Painter ─────────────────────────────────
// ═══════════════════════════════════════════════════════

class _NfcRadarPainter extends CustomPainter {
  final double progress;
  final double pulseValue;

  _NfcRadarPainter({required this.progress, required this.pulseValue});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;

    // Concentric ripples radiating outward
    for (int i = 0; i < 3; i++) {
      final rippleProgress = (progress + i * 0.33) % 1.0;
      final radius = maxRadius * 0.3 + (maxRadius * 0.7 * rippleProgress);
      final opacity = (1.0 - rippleProgress) * 0.2;

      final paint = Paint()
        ..color = const Color(0xFF10B981).withValues(alpha: opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;

      canvas.drawCircle(center, radius, paint);
    }

    // Contactless icon (three arcs)
    final iconPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.6 + pulseValue * 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < 3; i++) {
      final arcRadius = 14.0 + i * 10.0;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: arcRadius),
        -pi / 4,
        pi / 2,
        false,
        iconPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _NfcRadarPainter old) =>
      old.progress != progress || old.pulseValue != pulseValue;
}
