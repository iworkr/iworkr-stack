# Workflow — Release (iWorkr)

> Use this workflow when preparing a production release.

## Pre-release checklist

### 1) Security scan
- [ ] No secrets in source code: `grep -rn "sk-\|eyJ\|whsec_\|re_\|polar_oat" src/ --include="*.ts" --include="*.tsx"`
- [ ] `.env.local.example` is up to date
- [ ] All tables have RLS enabled
- [ ] Webhook endpoints validate signatures
- [ ] CSP headers configured in `next.config.ts`

### 2) Build verification
```bash
# Web
pnpm build           # Must succeed
pnpm lint            # Must pass
pnpm test            # All tests pass
pnpm test:e2e        # Critical E2E paths pass

# Flutter (if mobile release)
cd flutter
flutter analyze      # Zero issues
flutter test         # Tests pass
flutter build apk    # Android builds
flutter build ios    # iOS builds (on macOS)

# Electron (if desktop release)
cd electron
npm run build        # Must succeed
```

### 3) INCOMPLETE audit
```bash
# Count by severity
echo "BLOCKED:" && grep -rc "INCOMPLETE:BLOCKED" src/ flutter/lib/ supabase/ 2>/dev/null | grep -v ":0$"
echo "PARTIAL:" && grep -rc "INCOMPLETE:PARTIAL" src/ flutter/lib/ supabase/ 2>/dev/null | grep -v ":0$"
echo "TODO:" && grep -rc "INCOMPLETE:TODO" src/ flutter/lib/ supabase/ 2>/dev/null | grep -v ":0$"
```

- No `INCOMPLETE:BLOCKED` items should remain for a release.
- `INCOMPLETE:PARTIAL` items should be documented as known limitations.
- `INCOMPLETE:TODO` items are acceptable.

### 4) Database migrations
- [ ] All migrations tested with `supabase db reset`
- [ ] New migrations applied to staging/preview environment first
- [ ] Bundled migration (`BUNDLED_ALL_MIGRATIONS.sql`) updated if needed

### 5) Environment variables
- [ ] All required env vars set in Vercel (Production scope)
- [ ] Webhook URLs point to production domain
- [ ] Stripe Connect/Terminal configured for production mode

## Release steps

### Web (Vercel)
1. Merge to `main` → automatic Vercel deployment
2. Verify deployment at production URL
3. Post-deploy smoke test:
   - [ ] Landing page loads
   - [ ] Auth works (login/signup)
   - [ ] Dashboard loads with widgets
   - [ ] Job creation works
   - [ ] Invoice generation works
   - [ ] Billing checkout works

### Mobile (Flutter)
1. Increment version in `flutter/pubspec.yaml`
2. Build release APK/IPA
3. Submit to App Store / Play Store
4. Monitor crash reports (RevenueCat + analytics)

### Desktop (Electron)
1. Update version in `electron/package.json`
2. Build for macOS and Windows
3. Upload to Supabase Storage for auto-updater
4. Verify auto-update works on test installation

### Version tagging
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z — [brief description]"
git push origin vX.Y.Z
```

## Post-release

### Smoke test
- [ ] Production landing page loads correctly
- [ ] Auth flow works (magic link + Google)
- [ ] Dashboard shows real data
- [ ] Critical path: create job → schedule → invoice
- [ ] Billing: pricing page → checkout → subscription

### Monitoring
- [ ] Check Vercel deployment logs for errors
- [ ] Check Supabase logs for Edge Function errors
- [ ] Check Sentry for new errors (desktop)
- [ ] Monitor Polar.sh webhook deliveries

### Documentation
- [ ] Update `docs/DECISIONS_LOG.md` with any notable changes
- [ ] Update `src/CONTEXT.md` work-in-progress status
- [ ] Notify team of release
