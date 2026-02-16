import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/setup";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has completed onboarding / has an org
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if ((profile as any)?.onboarding_completed) {
          // User already onboarded — go to dashboard
          const forwardedHost = request.headers.get("x-forwarded-host");
          const isLocalEnv = process.env.NODE_ENV === "development";
          if (isLocalEnv) {
            return NextResponse.redirect(`${origin}/dashboard`);
          } else if (forwardedHost) {
            return NextResponse.redirect(`https://${forwardedHost}/dashboard`);
          } else {
            return NextResponse.redirect(`${origin}/dashboard`);
          }
        }
      }

      // New user or not onboarded — go to setup
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Auth error — redirect to auth page with error
  return NextResponse.redirect(`${origin}/auth?error=auth_callback_error`);
}
