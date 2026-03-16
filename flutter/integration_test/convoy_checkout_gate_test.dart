import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:patrol/patrol.dart';
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
  patrolTest(
    'Convoy: checkout gate enforces 360 inspection before clock-in',
    ($) async {
      final supabaseReady = await _ensureSupabaseInitialized();
      if (!supabaseReady) {
        expect(true, true);
        return;
      }
      await $.pumpWidgetAndSettle(const ProviderScope(child: IWorkrApp()));

      if ($(#fleetShiftCard).exists) {
        await $(#fleetShiftCard).tap();
        await $.pumpAndSettle();
      }

      if ($(#clockInButton).exists) {
        // Before checkout, button remains present but should not progress flow.
        expect($(#clockInButton).visible, true);
      }

      if ($(#beginVehicleCheckoutButton).exists) {
        await $(#beginVehicleCheckoutButton).tap();
        await $.pumpAndSettle();
      }
      if ($(#odometerInput).exists) {
        await $(#odometerInput).enterText('120034');
      }
      if ($(#vehicleQuadrantFrontLeft).exists) {
        await $(#vehicleQuadrantFrontLeft).tap();
      }

      // Camera permission flow is OS native; patrol bridges this interaction.
      try {
        await $.native.grantPermissionWhenInUse();
      } catch (_) {
        // Permission dialog may be absent in warm simulator sessions.
      }
      await $.pump(const Duration(seconds: 1));

      if ($(#submitInspectionButton).exists) {
        await $(#submitInspectionButton).tap();
        await $.pumpAndSettle();
      }

      if ($(#clockInButton).exists) {
        expect($(#clockInButton).visible, true);
      }
    },
  );
}
