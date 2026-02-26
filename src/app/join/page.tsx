/* ═══════════════════════════════════════════════════════════════
   Project Genesis — /join
   SSR Token Validation & Onboarding Entry Point

   The token is validated SERVER-SIDE before rendering any UI.
   This prevents flash-of-unauthenticated-UI and ensures tokens
   are cryptographically verified before any client JavaScript runs.
   ═══════════════════════════════════════════════════════════════ */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvalidTokenUI } from "@/components/onboarding/invalid-token-ui";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

interface JoinPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const token = params.token;

  /* ── Guard: No token provided ─────────────────────────── */
  if (!token) {
    return <InvalidTokenUI reason="missing" />;
  }

  /* ── SSR: Validate the token against the database ──────── */
  const supabase = (await createServerSupabaseClient()) as any;

  const { data, error } = await supabase.rpc("validate_invite_token", {
    p_token: token,
  });

  /* ── Guard: RPC error ─────────────────────────────────── */
  if (error) {
    return <InvalidTokenUI reason="invalid" />;
  }

  /* ── Guard: Token validation failed ───────────────────── */
  if (!data?.valid) {
    const reason: string = data?.reason || "invalid";
    return <InvalidTokenUI reason={reason} />;
  }

  /* ── Check for existing session (Account Collision) ───── */
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  /* ── Render: Valid token → Onboarding Wizard ──────────── */
  return (
    <OnboardingWizard
      token={token}
      existingUser={
        existingUser
          ? { id: existingUser.id, email: existingUser.email ?? "" }
          : null
      }
      inviteContext={{
        email: data.email,
        role: data.role,
        organizationId: data.organization_id,
        organizationName: data.organization_name,
        organizationSlug: data.organization_slug,
        organizationLogo: data.organization_logo || null,
        brandColor: data.brand_color || "#00E676",
        inviterName: data.inviter_name || "Your team",
        expiresAt: data.expires_at,
      }}
    />
  );
}
