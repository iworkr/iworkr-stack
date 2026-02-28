# Tools — iWorkr

> Utility scripts and tools for development, testing, and deployment.

## Available scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `scripts/push-migrations-live.sh` | Push Supabase migrations to the live project |
| `scripts/seed-demo-data.sh` | Seed demo data into the database |
| `scripts/setup-vercel-env.sh` | Configure Vercel environment variables |

## CLI tools (project-level)

### Next.js / Web
```bash
pnpm dev               # Dev server at localhost:3000
pnpm build             # Production build (also validates TypeScript)
pnpm lint              # ESLint check
pnpm test              # Vitest unit tests
pnpm test:watch        # Vitest watch mode
pnpm test:e2e          # Playwright E2E tests
pnpm test:e2e:qase     # Playwright E2E with Qase reporting
```

### Supabase
```bash
supabase start         # Start local Supabase stack
supabase stop          # Stop local Supabase
supabase db reset      # Reset local DB (runs all migrations + seed)
supabase db push       # Push migrations to remote project
supabase functions serve              # Serve Edge Functions locally
supabase functions deploy <name>      # Deploy single Edge Function
supabase migration new <name>         # Create new migration file
supabase gen types typescript --local # Generate TypeScript types from local DB
```

### Flutter
```bash
cd flutter
flutter pub get              # Install dependencies
flutter run                  # Run on connected device
flutter analyze              # Static analysis
flutter test                 # Unit tests
flutter build apk            # Build Android APK
flutter build ios            # Build iOS (macOS only)
dart run build_runner build  # Run code generation (Riverpod, Drift, etc.)
```

### Electron
```bash
cd electron
npm install                  # Install dependencies
npm run dev                  # Dev mode (hot reload web app)
npm run build                # Production build
npm run dist                 # Package for distribution
```

## INCOMPLETE trail scanner
```bash
# Scan all platforms
grep -rn "INCOMPLETE:" src/ flutter/lib/ supabase/ electron/src/

# By severity
grep -rn "INCOMPLETE:BLOCKED" src/ flutter/lib/ supabase/ electron/src/
grep -rn "INCOMPLETE:PARTIAL" src/ flutter/lib/ supabase/ electron/src/
grep -rn "INCOMPLETE:TODO" src/ flutter/lib/ supabase/ electron/src/
```

## Environment setup
1. Copy `.env.local.example` to `.env.local` and fill in values.
2. See `docs/LIVE-SETUP.md` for production deployment instructions.
3. See `supabase/config.toml` for local Supabase configuration.
