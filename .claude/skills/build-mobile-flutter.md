---
name: build-mobile-flutter
description: Build Flutter app features for iWorkr — Obsidian dark theme, Riverpod state, GoRouter navigation, Supabase integration, offline-first with Drift, INCOMPLETE trails and verification.
---

# Flutter Mobile Skill — iWorkr

## Architecture overview
- **SDK**: Flutter 3.11+, Dart
- **State**: Riverpod + code generation (`riverpod_annotation`)
- **Navigation**: GoRouter (`lib/core/router/`)
- **Backend**: Supabase Flutter (`supabase_flutter`)
- **Local DB**: Drift (SQLite) for offline persistence
- **Payments**: Stripe Terminal (tap-to-pay via `mek_stripe_terminal`), RevenueCat (subscriptions)
- **Maps**: `google_maps_flutter`
- **Icons**: `phosphor_flutter`
- **Animation**: `flutter_animate`, built-in `AnimatedBuilder` / `Hero` transitions

## Project structure
```
flutter/lib/
  core/
    database/       # Drift/SQLite database definitions
    theme/          # App theme (Obsidian tokens)
    services/       # Core services (auth, supabase, revenuecat, etc.)
    widgets/        # Shared widgets (feature gate, paywall, etc.)
    router/         # GoRouter configuration
  features/
    auth/           # Login, signup, biometrics
    dashboard/      # Home dashboard
    jobs/           # Job management
    schedule/       # Schedule view
    dispatch/       # Live dispatch + tracking
    finance/        # Invoices, payments
    assets/         # Asset management
    forms/          # Form builder + submissions
    payments/       # Stripe Terminal tap-to-pay
    chat/           # Messaging
    inbox/          # Notifications
    onboarding/     # First-run setup
    routes/         # Route planning + flight path
    scan/           # QR/barcode scanning
    profile/        # User profile
    ... (40+ modules)
  models/           # Shared data models
```

## UI rules (Obsidian mobile)
- **Dark by default**: Match web's `#050505` background, `#0A0A0A` surfaces.
- **Signal Green `#10B981`**: Accent color for CTAs, active states, focus.
- **Typography**: Google Fonts Inter. Tight tracking for headings.
- **Spacious layouts**: Generous padding (16–24px), clear hierarchy.
- **Smooth transitions**: `flutter_animate` for subtle fade/slide. No bouncy or playful animations.
- **Consistent radius**: 8px for cards, 12px for modals, 6px for chips.
- **Icon style**: `phosphor_flutter` with consistent weight.

## Step 1 — Understand existing patterns
Before building, check:
1. `lib/core/theme/` for current theme tokens.
2. `lib/core/services/` for existing service patterns (auth, supabase, etc.).
3. `lib/core/widgets/` for shared components (feature gate, paywall).
4. Similar feature modules in `lib/features/` for structural patterns.

## Step 2 — Add a new feature module

### Structure
```
lib/features/<name>/
  screens/
    <name>_screen.dart        # Main screen
    <name>_detail_screen.dart  # Detail view (if needed)
  widgets/
    <name>_card.dart           # List item card
    <name>_form.dart           # Create/edit form
  providers/
    <name>_provider.dart       # Riverpod providers (if complex state)
```

### Riverpod provider pattern
```dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part '<name>_provider.g.dart';

@riverpod
class MyFeatureNotifier extends _$MyFeatureNotifier {
  @override
  Future<List<MyModel>> build() async {
    final supabase = ref.read(supabaseProvider);
    final response = await supabase
        .from('my_table')
        .select()
        .order('created_at', ascending: false);
    return (response as List).map((e) => MyModel.fromJson(e)).toList();
  }
}
```

### GoRouter route
```dart
GoRoute(
  path: '/<name>',
  builder: (context, state) => const MyFeatureScreen(),
),
```

## Step 3 — Supabase integration
- Use `supabase_flutter` for auth and data access.
- Auth flows: magic link, Google OAuth, biometric unlock (`local_auth`).
- Realtime subscriptions for live data (jobs status, messages, schedule).
- Storage for file uploads (photos, documents).
- Error handling: always check `.error` on Supabase responses.

## Step 4 — Offline-first with Drift
- Use Drift (SQLite) for local persistence of critical data.
- Sync queue pattern: queue mutations when offline, replay when online.
- `workmanager` for background sync tasks.
- Show clear offline indicators in UI.

## Step 5 — Stripe Terminal (tap-to-pay)
- `mek_stripe_terminal` package for in-person payments.
- Terminal token from `supabase/functions/terminal-token/`.
- Payment intent creation via `supabase/functions/create-terminal-intent/`.
- Handle connection states: discovering, connected, processing, completed.

## Step 6 — Verification
1. `flutter analyze` — zero issues.
2. `flutter test` — unit tests pass.
3. Click-through checklist:
   - [ ] Auth flow: login → dashboard
   - [ ] Feature screen: renders, data loads
   - [ ] Create/edit flow: form validates, saves
   - [ ] Navigation: back, deep links work
   - [ ] Offline: graceful degradation
4. Layout check: test on small (iPhone SE 375px) and large (iPhone Pro Max, iPad) screens.
5. Dark theme: verify all surfaces use correct tokens.

## Step 7 — INCOMPLETE trails
- Stubs must be marked: `// INCOMPLETE:PARTIAL — Screen scaffolded; list rendering pending`
- Missing integrations: `// INCOMPLETE:BLOCKED(GOOGLE_MAPS_KEY) — Map widget requires API key`
- Nice-to-haves: `// INCOMPLETE:TODO — Add shimmer loading state for job cards`
