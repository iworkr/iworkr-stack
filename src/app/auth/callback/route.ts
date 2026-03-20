/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Synapse-Gate — PKCE Auth Callback
 *
 * Handles OAuth and Magic Link callback. Exchanges the auth code for a session
 * and redirects to the user's intended destination (the `next` parameter),
 * falling back to /dashboard for returning users or /setup for new users.
 *
 * Deep link intent is preserved: if a user clicked an invoice link while logged
 * out, they arrive at that invoice after authentication — not the root dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const appContext = searchParams.get("app_context");

  if (!code) {
    return NextResponse.redirect(`${resolveOrigin(request, origin)}/auth/auth-error?reason=missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${resolveOrigin(request, origin)}/auth/auth-error?reason=code_exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const meta = user.user_metadata || {};
    const avatarUrl = meta.avatar_url || meta.picture || null;
    const fullName = meta.full_name || meta.name || null;

    if (avatarUrl || fullName) {
      await (supabase as any)
        .from("profiles")
        .update({
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(fullName ? { full_name: fullName } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    // Electron desktop app context — redirect to custom protocol
    if (appContext === "desktop") {
      return NextResponse.redirect(`iworkr://auth/callback?session=established`);
    }

    // If a specific deep link was requested, honor it
    if (next && next.startsWith("/")) {
      return NextResponse.redirect(`${resolveOrigin(request, origin)}${next}`);
    }

    // No explicit next — determine best destination based on onboarding state
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    const destination = (profile as any)?.onboarding_completed ? "/dashboard" : "/setup";
    return NextResponse.redirect(`${resolveOrigin(request, origin)}${destination}`);
  }

  return NextResponse.redirect(`${resolveOrigin(request, origin)}/auth/auth-error?reason=no_user`);
}

function resolveOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.NODE_ENV === "development") return fallbackOrigin;
  if (forwardedHost) return `https://${forwardedHost}`;
  return fallbackOrigin;
}
