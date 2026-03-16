// GENERATED CODE - DO NOT MODIFY BY HAND AND DO NOT COMMIT TO VERSION CONTROL
// ignore_for_file: type=lint, invalid_use_of_internal_member

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:patrol/src/platform/contracts/contracts.dart';
import 'package:test_api/src/backend/invoker.dart';

// START: GENERATED TEST IMPORTS
import '../integration_test/app_test.dart' as app_test;
import '../integration_test/convoy_checkout_gate_test.dart' as convoy_checkout_gate_test;
import '../integration_test/fort_knox_offline_test.dart' as fort_knox_offline_test;
import '../integration_test/tests/auth_test.dart' as auth_test;
import '../integration_test/tests/critical_ops_test.dart' as critical_ops_test;
import '../integration_test/tests/day_in_life_test.dart' as day_in_life_test;
import '../integration_test/tests/navigation_test.dart' as navigation_test;
import '../integration_test/tests/panopticon_test.dart' as panopticon_test;
// END: GENERATED TEST IMPORTS

Future<void> main() async {
  final platformAutomator = PlatformAutomator(
    config: PlatformAutomatorConfig.defaultConfig(),
  );
  await platformAutomator.initialize();
  final binding = PatrolBinding.ensureInitialized(platformAutomator);
  final testExplorationCompleter = Completer<DartGroupEntry>();

  test('patrol_test_explorer', () {
    final topLevelGroup = Invoker.current!.liveTest.groups.first;
    final dartTestGroup = createDartTestGroup(
      topLevelGroup,
      tags: null,
      excludeTags: null,
    );
    testExplorationCompleter.complete(dartTestGroup);
    print('patrol_test_explorer: obtained Dart-side test hierarchy:');
    reportGroupStructure(dartTestGroup);
  });

// START: GENERATED TEST GROUPS
  group('app_test', app_test.main);
  group('convoy_checkout_gate_test', convoy_checkout_gate_test.main);
  group('fort_knox_offline_test', fort_knox_offline_test.main);
  group('auth_test', auth_test.main);
  group('critical_ops_test', critical_ops_test.main);
  group('day_in_life_test', day_in_life_test.main);
  group('navigation_test', navigation_test.main);
  group('panopticon_test', panopticon_test.main);
// END: GENERATED TEST GROUPS

  final dartTestGroup = await testExplorationCompleter.future;
  final appService = PatrolAppService(topLevelDartTestGroup: dartTestGroup);
  binding.patrolAppService = appService;
  await runAppService(appService);

  await platformAutomator.markPatrolAppServiceReady();

  await appService.testExecutionCompleted;
}
