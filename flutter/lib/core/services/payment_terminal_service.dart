import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

// ── Payment State Machine ────────────────────────────

enum TerminalState {
  idle,       // Not started
  ready,      // Pulsing radar, waiting for tap
  reading,    // NFC detected, reading card
  processing, // Stripe processing charge
  success,    // Payment approved
  declined,   // Card declined / error
}

/// The result of a payment attempt
class PaymentResult {
  final bool success;
  final String? paymentIntentId;
  final String? errorMessage;
  final String? receiptUrl;

  const PaymentResult({
    required this.success,
    this.paymentIntentId,
    this.errorMessage,
    this.receiptUrl,
  });
}

/// Payment Terminal Service
///
/// Manages the Tap to Pay flow via Stripe Terminal SDK.
/// In the current implementation, we provide the full UI and state machine.
/// The actual Stripe Terminal SDK calls require a backend connection token
/// endpoint, which the app will call once configured.
class PaymentTerminalService {
  /// Check if the device has NFC / Tap to Pay capability
  static Future<bool> get isAvailable async {
    // In production, check device NFC capability
    // For now, return true on real devices
    return true;
  }

  /// Check if the device is online (required for Tap to Pay)
  static Future<bool> get isOnline async {
    final connectivity = await Connectivity().checkConnectivity();
    return connectivity.any((c) => c != ConnectivityResult.none);
  }

  /// Create a Stripe PaymentIntent via your backend
  ///
  /// In production, this calls your Supabase Edge Function or API route
  /// that creates a PaymentIntent with the amount and returns a client_secret.
  static Future<String?> createPaymentIntent({
    required int amountCents,
    required String currency,
    required String invoiceId,
    String? customerEmail,
  }) async {
    try {
      // Call Supabase Edge Function to create PaymentIntent
      // In production:
      // final response = await SupabaseService.client.functions.invoke(
      //   'create-payment-intent',
      //   body: {
      //     'amount': amountCents,
      //     'currency': currency,
      //     'invoice_id': invoiceId,
      //     'customer_email': customerEmail,
      //   },
      // );
      // return response.data['client_secret'] as String;

      // Simulated for now - returns a placeholder
      await Future.delayed(const Duration(milliseconds: 500));
      return 'pi_simulated_${DateTime.now().millisecondsSinceEpoch}';
    } catch (_) {
      return null;
    }
  }

  /// Process a simulated Tap to Pay transaction
  ///
  /// In production, this calls:
  /// 1. Terminal.getInstance().connectLocalMobileReader()
  /// 2. Terminal.getInstance().collectPaymentMethod(paymentIntent)
  /// 3. Terminal.getInstance().confirmPaymentIntent(paymentIntent)
  static Future<PaymentResult> processPayment({
    required String paymentIntentId,
    required int amountCents,
  }) async {
    try {
      // Simulate NFC read (1-2 seconds)
      await Future.delayed(const Duration(milliseconds: 1500));

      // Simulate processing (1 second)
      await Future.delayed(const Duration(milliseconds: 1000));

      // In production, this would be the actual Stripe Terminal flow.
      // For now, simulate success.
      return PaymentResult(
        success: true,
        paymentIntentId: paymentIntentId,
        receiptUrl: 'https://pay.stripe.com/receipts/$paymentIntentId',
      );
    } catch (e) {
      return PaymentResult(
        success: false,
        errorMessage: e.toString(),
      );
    }
  }

  /// Send a receipt email via backend
  static Future<bool> sendReceipt({
    required String invoiceId,
    required String email,
    String? paymentIntentId,
  }) async {
    try {
      // In production, call Supabase Edge Function to send receipt
      await Future.delayed(const Duration(milliseconds: 500));
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Riverpod Providers ───────────────────────────────

final terminalAvailableProvider = FutureProvider<bool>((ref) async {
  return PaymentTerminalService.isAvailable;
});

final networkAvailableProvider = FutureProvider<bool>((ref) async {
  return PaymentTerminalService.isOnline;
});
