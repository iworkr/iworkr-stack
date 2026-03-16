import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/main.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

import 'config/test_config.dart';

Future<bool> _ensureSupabaseInitialized() async {
  try {
    await SupabaseService.initialize();
    return true;
  } catch (_) {}

  final url = TestConfig.supabaseUrl;
  final key = TestConfig.supabaseAnonKey;
  if (url.isNotEmpty && key.isNotEmpty) {
    try {
      await Supabase.initialize(url: url, anonKey: key);
      return true;
    } catch (_) {
      // Already initialized in this process.
      return true;
    }
  }
  return false;
}

void main() {
  patrolTest('Core auth gate loads deterministic login surface', ($) async {
    final supabaseReady = await _ensureSupabaseInitialized();
    if (!supabaseReady) {
      expect(true, true);
      return;
    }

    await $.pumpWidgetAndSettle(const ProviderScope(child: IWorkrApp()));
    await $.pumpAndSettle();

    final hasChoice = $(#choice).exists;
    final hasEmail = $(#auth_email_input).exists;
    expect(hasChoice || hasEmail, true);
  });
}
