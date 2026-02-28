# Git & Release Rules — iWorkr

## Branching
- `main` is the production branch. Deployed to Vercel automatically.
- Feature work happens on feature branches: `feature/<name>`, `fix/<name>`, `chore/<name>`.
- Claude Code branches use `claude/<description>` prefix.
- Never commit directly to `main` during development — use branches and merge.

## Commits
- Small, atomic commits with clear messages.
- Format: `type: description` where type is `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`.
- Examples:
  - `feat: add job priority badges to schedule timeline`
  - `fix: resolve RLS policy for client delete`
  - `chore: update Supabase to v2.x`
  - `docs: add invoice API documentation`

## Push rules
- **Do not push** unless the user explicitly says "push".
- Always run `pnpm build` before pushing web changes.
- Always run `flutter analyze` before pushing Flutter changes.
- Verify no secrets are staged: check `.env*` files, API keys, tokens.

## Pull requests
- Use the PR review workflow (see `workflows/workflow-pr-review.md`).
- PR description must include: what changed, why, verification steps, screenshots for UI changes.
- Ensure `INCOMPLETE:` trails are present for any staged/partial work.

## Migrations
- Supabase migrations use sequential numbering: `NNN_description.sql`.
- Test migrations locally with `supabase db reset` before pushing.
- Never modify an already-deployed migration. Create a new one instead.
- Bundled migration (`BUNDLED_ALL_MIGRATIONS.sql`) is for fresh setups only — keep it updated.

## Release process
1. Security scan: no secrets, correct env handling
2. Run `pnpm build` (must succeed)
3. Run `pnpm test` (all pass)
4. Run `pnpm test:e2e` (critical paths pass)
5. Tag version if milestone
6. Deploy via Vercel (push to `main`)
7. Post-deploy smoke test on production

## Version tagging
- Use semantic versioning: `vMAJOR.MINOR.PATCH`
- Tag milestones and releases in git.
- Desktop releases tracked via Supabase Storage version manifest.

## Hotfixes
- Branch from `main`: `hotfix/<description>`
- Fix, test, merge to `main`, deploy immediately.
- Document in `docs/DECISIONS_LOG.md` if the fix changes behavior.
