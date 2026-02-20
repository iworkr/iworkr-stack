import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';

void main() {
  group('AuthNotifier', () {
    test('initial state is AsyncValue.data(null)', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final state = container.read(authNotifierProvider);
      expect(state.hasError, isFalse);
      expect(state.hasValue, isTrue);
    });

    test('signInWithPassword sets loading then error when override throws', () async {
      final container = ProviderContainer(
        overrides: [
          authSignInOverrideProvider.overrideWith(
            (ref) => ({required String email, required String password}) async {
              throw Exception('Invalid credentials');
            },
          ),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(authNotifierProvider.notifier);
      expect(container.read(authNotifierProvider).hasValue, isTrue);

      final future = notifier.signInWithPassword(
        email: 'test@test.com',
        password: 'wrong',
      );

      await expectLater(future, throwsA(isA<Exception>()));
      final state = container.read(authNotifierProvider);
      expect(state.hasError, isTrue);
    });

    test('signInWithPassword sets loading then data when override returns session', () async {
      final container = ProviderContainer(
        overrides: [
          authSignInOverrideProvider.overrideWith(
            (ref) => ({required String email, required String password}) async {
              return AuthResponse(
                session: null,
                user: User(
                  id: 'test-id',
                  appMetadata: {},
                  userMetadata: {},
                  aud: 'authenticated',
                  createdAt: DateTime.now().toIso8601String(),
                  email: email,
                ),
              );
            },
          ),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(authNotifierProvider.notifier);
      await notifier.signInWithPassword(
        email: 'test@test.com',
        password: 'pass',
      );

      final state = container.read(authNotifierProvider);
      expect(state.hasError, isFalse);
      expect(state.hasValue, isTrue);
    });
  });
}
