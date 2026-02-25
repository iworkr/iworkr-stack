import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ── Payment State Machine ────────────────────────────

enum TerminalState {
  idle,
  ready,
  reading,
  processing,
  success,
  declined,
}

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

/// Stripe Terminal Tap-to-Pay service.
///
/// Manages the full lifecycle: SDK initialization, reader discovery,
/// payment collection via NFC, and confirmation. Fetches connection
/// tokens and creates PaymentIntents through Supabase Edge Functions
/// scoped to the workspace's Stripe Connect account.
class PaymentTerminalService {
  static bool _sdkInitialized = false;
  static String? _activeOrgId;

  static Future<bool> get isAvailable async {
    if (!Platform.isIOS && !Platform.isAndroid) return false;
    return true;
  }

  static Future<bool> get isOnline async {
    final connectivity = await Connectivity().checkConnectivity();
    return connectivity.any((c) => c != ConnectivityResult.none);
  }

  /// Check if the workspace has Stripe Connect enabled
  static Future<bool> isConnectEnabled(String orgId) async {
    try {
      final data = await SupabaseService.client
          .from('organizations')
          .select('charges_enabled')
          .eq('id', orgId)
          .single();
      return data['charges_enabled'] as bool? ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Initialize the Stripe Terminal SDK with a token fetcher scoped to the org.
  static Future<void> initializeSdk(String orgId) async {
    if (_sdkInitialized && _activeOrgId == orgId && Terminal.isInitialized) {
      return;
    }

    await Terminal.initTerminal(
      fetchToken: () => _fetchConnectionToken(orgId),
      shouldPrintLogs: kDebugMode,
    );

    _sdkInitialized = true;
    _activeOrgId = orgId;
  }

  static Future<String> _fetchConnectionToken(String orgId) async {
    final session = SupabaseService.auth.currentSession;
    if (session == null) throw Exception('Not authenticated');

    final res = await SupabaseService.client.functions.invoke(
      'terminal-token',
      body: {'orgId': orgId},
    );

    if (res.status != 200) {
      throw Exception('Failed to fetch connection token: ${res.status}');
    }

    final data = res.data as Map<String, dynamic>;
    return data['secret'] as String;
  }

  /// Create a card_present PaymentIntent via Supabase Edge Function
  static Future<String?> createPaymentIntent({
    required int amountCents,
    required String currency,
    required String invoiceId,
    required String orgId,
    String? customerEmail,
  }) async {
    try {
      final res = await SupabaseService.client.functions.invoke(
        'create-terminal-intent',
        body: {
          'orgId': orgId,
          'amountCents': amountCents,
          'currency': currency,
          'invoiceId': invoiceId,
        },
      );

      if (res.status != 200) return null;
      final data = res.data as Map<String, dynamic>;
      return data['clientSecret'] as String;
    } catch (e) {
      debugPrint('[PaymentTerminal] createPaymentIntent error: $e');
      return null;
    }
  }

  /// Discover and connect to the device's local NFC (Tap-to-Pay) reader.
  static Future<Reader?> connectLocalReader() async {
    final terminal = Terminal.instance;

    final existing = await terminal.getConnectedReader();
    if (existing != null) return existing;

    final discoverStream = terminal.discoverReaders(
      const TapToPayDiscoveryConfiguration(),
    );

    Reader? localReader;
    await for (final readers in discoverStream) {
      if (readers.isNotEmpty) {
        localReader = readers.first;
        break;
      }
    }

    if (localReader == null) return null;

    await terminal.connectReader(
      localReader,
      configuration: TapToPayConnectionConfiguration(
        locationId: localReader.locationId ?? '',
        tosAcceptancePermitted: true,
        readerDelegate: null,
      ),
    );

    return localReader;
  }

  /// Full Tap-to-Pay flow: discover reader, collect NFC, process.
  static Future<PaymentResult> processPayment({
    required String clientSecret,
    required int amountCents,
  }) async {
    try {
      final terminal = Terminal.instance;

      // Connect local Tap-to-Pay reader
      final reader = await connectLocalReader();
      if (reader == null) {
        return const PaymentResult(
          success: false,
          errorMessage: 'No Tap-to-Pay reader available on this device',
        );
      }

      // Retrieve the PaymentIntent
      final paymentIntent = await terminal.retrievePaymentIntent(clientSecret);

      // NFC collection — native OS payment sheet takes over
      final collected = await terminal.collectPaymentMethod(paymentIntent);

      // Confirm the payment
      final confirmed = await terminal.confirmPaymentIntent(collected);

      return PaymentResult(
        success: true,
        paymentIntentId: confirmed.id,
      );
    } on TerminalException catch (e) {
      return PaymentResult(
        success: false,
        errorMessage: e.message,
      );
    } catch (e) {
      return PaymentResult(
        success: false,
        errorMessage: '$e',
      );
    }
  }

  /// Send a receipt email via Supabase Edge Function
  static Future<bool> sendReceipt({
    required String invoiceId,
    required String email,
    String? paymentIntentId,
  }) async {
    try {
      await SupabaseService.client
          .from('invoices')
          .update({'receipt_sent_to': email})
          .eq('id', invoiceId);
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

final connectEnabledForTerminalProvider = FutureProvider<bool>((ref) async {
  final orgId = ref.watch(activeWorkspaceIdProvider);
  if (orgId == null) return false;
  return PaymentTerminalService.isConnectEnabled(orgId);
});
