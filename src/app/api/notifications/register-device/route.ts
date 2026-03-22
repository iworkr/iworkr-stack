/**
 * @route POST /api/notifications/register-device
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user session
 * @description Registers a device FCM token for push notifications
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

/* ── Schema ───────────────────────────────────────────── */

const RegisterDeviceSchema = z.object({
  fcm_token: z.string().min(1, "FCM token is required"),
  device_type: z.enum(["web", "ios", "android"]),
  app_version: z.string().max(50).optional(),
  device_name: z.string().max(200).optional(),
});

/* ── POST /api/notifications/register-device ──────────── */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = RegisterDeviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.issues.map(
            (e) => `${e.path.join(".")}: ${e.message}`,
          ),
        },
        { status: 400 },
      );
    }

    const { fcm_token, device_type, app_version, device_name } = parsed.data;

    // Upsert: on conflict (fcm_token), update last_active_at and is_active
    const { error } = await (supabase as any).from("user_devices").upsert(
      {
        user_id: user.id,
        fcm_token,
        device_type,
        app_version: app_version || null,
        device_name: device_name || null,
        is_active: true,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "fcm_token" },
    );

    if (error) {
      console.error("[register-device] Upsert error:", error.message);
      return NextResponse.json(
        { error: "Failed to register device" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[register-device] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
