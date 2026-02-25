import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/payment_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';

// ═══════════════════════════════════════════════════════════
// ── Collect Payment Sheet — Obsidian Tap-to-Pay ──────────
// ═══════════════════════════════════════════════════════════

class CollectPaymentSheet extends ConsumerStatefulWidget {
  final int amountCents;
  final String currency;
  final String? invoiceId;
  final String clientName;
  final VoidCallback? onSuccess;

  const CollectPaymentSheet({
    super.key,
    required this.amountCents,
    this.currency = 'usd',
    this.invoiceId,
    this.clientName = 'Client',
    this.onSuccess,
  });

  static Future<bool?> show(
    BuildContext context, {
    required int amountCents,
    String currency = 'usd',
    String? invoiceId,
    String clientName = 'Client',
    VoidCallback? onSuccess,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      builder: (_) => CollectPaymentSheet(
        amountCents: amountCents,
        currency: currency,
        invoiceId: invoiceId,
        clientName: clientName,
        onSuccess: onSuccess,
      ),
    );
  }

  @override
  ConsumerState<CollectPaymentSheet> createState() => _CollectPaymentSheetState();
}

class _CollectPaymentSheetState extends ConsumerState<CollectPaymentSheet> with TickerProviderStateMixin {
  late final AnimationController _pulseController;
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  String _formatAmount(int cents, String currency) {
    final amount = cents / 100;
    final symbol = currency.toUpperCase() == 'USD' ? '\$' : currency.toUpperCase();
    return '$symbol${amount.toStringAsFixed(2)}';
  }

  Future<void> _collect() async {
    if (_processing) return;
    setState(() => _processing = true);

    final success = await ref.read(paymentProvider.notifier).collectPayment(
      amountCents: widget.amountCents,
      currency: widget.currency,
      invoiceId: widget.invoiceId,
    );

    if (success) {
      widget.onSuccess?.call();
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) Navigator.of(context).pop(true);
    } else {
      setState(() => _processing = false);
    }
  }

  void _sendInvoiceLink() {
    ref.read(paymentProvider.notifier).reset();
    Navigator.of(context).pop(false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final paymentStatus = ref.watch(paymentProvider);

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: c.border),
          left: BorderSide(color: c.border),
          right: BorderSide(color: c.border),
        ),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 24),

          _buildContent(paymentStatus),
        ],
      ),
    );
  }

  Widget _buildContent(PaymentStatus status) {
    switch (status.state) {
      case PaymentState.succeeded:
        return _buildSuccess();
      case PaymentState.failed:
        return _buildError(status.message ?? 'Payment failed');
      case PaymentState.readyForTap:
        return _buildTapPrompt();
      case PaymentState.processing:
      case PaymentState.initializing:
        return _buildProcessing(status.message ?? 'Processing...');
      case PaymentState.idle:
        return _buildIdle();
    }
  }

  Widget _buildIdle() {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.2)),
            ),
            child: const Icon(PhosphorIconsLight.contactlessPayment, size: 32, color: Color(0xFF10B981)),
          ),
          const SizedBox(height: 20),
          Text(
            'Collect ${_formatAmount(widget.amountCents, widget.currency)}',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'From ${widget.clientName}',
            style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: Colors.white.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 32),

          // Tap to Pay button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: CupertinoButton(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              onPressed: _processing ? null : _collect,
              child: _processing
                  ? const CupertinoActivityIndicator()
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(PhosphorIconsBold.contactlessPayment, size: 18, color: Colors.black),
                        const SizedBox(width: 8),
                        Text(
                          'Tap to Pay',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.black,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 12),

          // Send Invoice fallback
          CupertinoButton(
            onPressed: _sendInvoiceLink,
            child: Text(
              'Send Invoice Link Instead',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: Colors.white.withValues(alpha: 0.4),
                letterSpacing: -0.2,
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildTapPrompt() {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              final scale = 1.0 + (_pulseController.value * 0.05);
              return Transform.scale(
                scale: scale,
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3), width: 2),
                  ),
                  child: const Icon(PhosphorIconsLight.contactlessPayment, size: 44, color: Color(0xFF10B981)),
                ),
              );
            },
          ),
          const SizedBox(height: 24),
          Text(
            'Hold Card Near Device',
            style: TextStyle(fontFamily: 'Inter', fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            'The client should tap their card or phone against the back of your device.',
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: Colors.white.withValues(alpha: 0.5), height: 1.5),
          ),
          const SizedBox(height: 32),
          CupertinoButton(
            onPressed: () {
              ref.read(paymentProvider.notifier).reset();
              setState(() => _processing = false);
            },
            child: const Text(
              'Cancel',
              style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: Color(0xFFF43F5E)),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildProcessing(String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          const CupertinoActivityIndicator(radius: 18),
          const SizedBox(height: 20),
          Text(
            message,
            style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: Colors.white.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(PhosphorIconsBold.check, size: 36, color: Color(0xFF10B981)),
          ),
          const SizedBox(height: 20),
          Text(
            'Payment Received',
            style: TextStyle(fontFamily: 'Inter', fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary),
          ),
          const SizedBox(height: 6),
          Text(
            _formatAmount(widget.amountCents, widget.currency),
            style: const TextStyle(
              fontFamily: 'JetBrains Mono',
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: Color(0xFF10B981),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFFF43F5E).withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(PhosphorIconsLight.warning, size: 32, color: Color(0xFFF43F5E)),
          ),
          const SizedBox(height: 16),
          Text(
            'Payment Failed',
            style: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: Colors.white.withValues(alpha: 0.5), height: 1.5),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            height: 48,
            child: CupertinoButton(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              onPressed: () {
                ref.read(paymentProvider.notifier).reset();
                setState(() => _processing = false);
              },
              child: const Text(
                'Try Again',
                style: TextStyle(fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black),
              ),
            ),
          ),
          const SizedBox(height: 12),

          CupertinoButton(
            onPressed: _sendInvoiceLink,
            child: Text(
              'Send Invoice Link Instead',
              style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: Colors.white.withValues(alpha: 0.4)),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
