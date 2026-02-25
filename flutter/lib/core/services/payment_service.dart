import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import 'package:http/http.dart' as http;

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Payment Service — Stripe Terminal Tap-to-Pay ─────────
// ═══════════════════════════════════════════════════════════

enum PaymentState { idle, initializing, readyForTap, processing, succeeded, failed }

class PaymentStatus {
  final PaymentState state;
  final String? message;
  final String? paymentIntentId;

  const PaymentStatus({this.state = PaymentState.idle, this.message, this.paymentIntentId});

  PaymentStatus copyWith({PaymentState? state, String? message, String? paymentIntentId}) {
    return PaymentStatus(
      state: state ?? this.state,
      message: message ?? this.message,
      paymentIntentId: paymentIntentId ?? this.paymentIntentId,
    );
  }
}

class PaymentNotifier extends StateNotifier<PaymentStatus> {
  final Ref _ref;
  bool _initialized = false;

  PaymentNotifier(this._ref) : super(const PaymentStatus());

  static const _appUrl = String.fromEnvironment('APP_URL', defaultValue: 'https://app.iworkr.com');

  String? get _orgId => _ref.read(activeWorkspaceIdProvider);

  Future<String?> _getAccessToken() async {
    return SupabaseService.auth.currentSession?.accessToken;
  }

  Future<void> initialize() async {
    if (_initialized || Terminal.isInitialized) {
      _initialized = true;
      return;
    }

    state = state.copyWith(state: PaymentState.initializing, message: 'Initializing payment terminal...');

    try {
      await Terminal.initTerminal(
        fetchToken: _fetchConnectionToken,
        shouldPrintLogs: kDebugMode,
      );
      _initialized = true;
      state = state.copyWith(state: PaymentState.idle, message: null);
    } catch (e) {
      state = state.copyWith(state: PaymentState.failed, message: 'Failed to initialize terminal: $e');
      debugPrint('[PaymentService] Init error: $e');
    }
  }

  Future<String> _fetchConnectionToken() async {
    final orgId = _orgId;
    final token = await _getAccessToken();
    if (orgId == null || token == null) throw Exception('Not authenticated');

    final res = await http.post(
      Uri.parse('$_appUrl/api/stripe/connect/terminal-token'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'orgId': orgId}),
    );

    if (res.statusCode != 200) throw Exception('Failed to fetch terminal token');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['secret'] as String;
  }

  /// Collect a payment using Tap-to-Pay (NFC).
  Future<bool> collectPayment({
    required int amountCents,
    String currency = 'usd',
    String? invoiceId,
  }) async {
    if (!_initialized) {
      await initialize();
      if (!_initialized) return false;
    }

    final terminal = Terminal.instance;

    state = state.copyWith(state: PaymentState.initializing, message: 'Creating payment...');

    try {
      final orgId = _orgId;
      final token = await _getAccessToken();
      if (orgId == null || token == null) throw Exception('Not authenticated');

      // Create PaymentIntent on backend
      final piRes = await http.post(
        Uri.parse('$_appUrl/api/stripe/connect/payment-intent'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'orgId': orgId,
          'amountCents': amountCents,
          'currency': currency,
          'invoiceId': invoiceId,
        }),
      );

      if (piRes.statusCode != 200) throw Exception('Failed to create payment');
      final piData = jsonDecode(piRes.body) as Map<String, dynamic>;
      final clientSecret = piData['clientSecret'] as String;

      state = state.copyWith(state: PaymentState.readyForTap, message: 'Hold card near device...');

      // Discover and connect local Tap-to-Pay reader
      if (Platform.isIOS || Platform.isAndroid) {
        final connected = await terminal.getConnectedReader();
        if (connected == null) {
          final discoverStream = terminal.discoverReaders(const TapToPayDiscoveryConfiguration());

          Reader? localReader;
          await for (final readers in discoverStream) {
            if (readers.isNotEmpty) {
              localReader = readers.first;
              break;
            }
          }

          if (localReader == null) throw Exception('No Tap-to-Pay reader found on this device');

          await terminal.connectReader(
            localReader,
            configuration: TapToPayConnectionConfiguration(
              locationId: localReader.locationId ?? '',
              tosAcceptancePermitted: true,
              readerDelegate: null,
            ),
          );
        }
      }

      // Retrieve the PaymentIntent
      final paymentIntent = await terminal.retrievePaymentIntent(clientSecret);

      // Collect payment via NFC
      final collected = await terminal.collectPaymentMethod(paymentIntent);

      state = state.copyWith(state: PaymentState.processing, message: 'Processing payment...');

      // Confirm payment
      final confirmed = await terminal.confirmPaymentIntent(collected);

      state = state.copyWith(
        state: PaymentState.succeeded,
        message: 'Payment successful',
        paymentIntentId: confirmed.id,
      );

      return true;
    } catch (e) {
      final msg = e is TerminalException ? e.message : '$e';
      state = state.copyWith(state: PaymentState.failed, message: 'Payment failed: $msg');
      debugPrint('[PaymentService] Collection error: $e');
      return false;
    }
  }

  void reset() {
    state = const PaymentStatus();
  }
}

// ── Providers ────────────────────────────────────────────

final paymentProvider = StateNotifierProvider<PaymentNotifier, PaymentStatus>((ref) {
  return PaymentNotifier(ref);
});

final connectEnabledProvider = FutureProvider<bool>((ref) async {
  final orgId = ref.watch(activeWorkspaceIdProvider);
  if (orgId == null) return false;

  final data = await SupabaseService.client
      .from('organizations')
      .select('charges_enabled')
      .eq('id', orgId)
      .single();

  return data['charges_enabled'] as bool? ?? false;
});
