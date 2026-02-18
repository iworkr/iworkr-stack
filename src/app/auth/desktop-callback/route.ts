import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=desktop_callback_missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=desktop_callback_error`);
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.redirect(`${origin}/auth?error=desktop_no_session`);
  }

  const callbackUrl = new URL("iworkr://auth/callback");
  callbackUrl.searchParams.set("token", session.access_token);
  if (session.refresh_token) {
    callbackUrl.searchParams.set("refresh_token", session.refresh_token);
  }

  return NextResponse.redirect(callbackUrl.toString());
}
