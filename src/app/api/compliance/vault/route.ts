/**
 * @route GET,POST /api/compliance/vault
 * @status COMPLETE
 * @auth PUBLIC — Passcode + OTP 2FA (self-contained auth)
 * @description Secure compliance vault with 2FA access for document retrieval
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomInt } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function hashPasscode(passcode: string) {
  return createHash("sha256").update(passcode).digest("hex");
}

function hashOtpCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

const OTP_TTL_MINUTES = 10;
const SESSION_COOKIE_NAME = "ironclad_vault_2fa";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
  return process.env.VAULT_2FA_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-vault-secret";
}

function signVaultSession(portalId: string) {
  const payload = JSON.stringify({
    p: portalId,
    e: Date.now() + SESSION_TTL_SECONDS * 1000,
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${sig}`;
}

function verifyVaultSession(token: string | undefined, portalId: string) {
  if (!token) return false;
  const [encodedPayload, sig] = token.split(".");
  if (!encodedPayload || !sig) return false;
  const expectedSig = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("hex");
  if (sig.length !== expectedSig.length || sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      p?: string;
      e?: number;
    };
    return payload.p === portalId && typeof payload.e === "number" && payload.e > Date.now();
  } catch {
    return false;
  }
}

function maskPhone(phone: string) {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

async function sendSms(phone: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !authToken || !from) {
    throw new Error("SMS provider not configured");
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phone,
      From: from,
      Body: message,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SMS send failed (${response.status}): ${body}`);
  }
}

function redactNarrative(
  narrative: string | null | undefined,
  nonScopedNames: string[],
): string {
  if (!narrative) return "";
  let redacted = narrative;
  let idx = 0;
  for (const name of nonScopedNames) {
    if (!name || name.length < 3) continue;
    idx += 1;
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    redacted = redacted.replace(re, `[Participant ${String.fromCharCode(64 + idx)}]`);
  }
  return redacted;
}

export async function POST(request: NextRequest) {
  try {
    const {
      token,
      passcode,
      otp,
      mode,
    } = (await request.json()) as {
      token?: string;
      passcode?: string;
      otp?: string;
      mode?: "request_otp" | "verify_otp" | "access";
    };
    if (!token || !passcode) {
      return NextResponse.json({ error: "token and passcode are required" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient() as any;
    const { data: portal } = await admin
      .from("auditor_portals")
      .select("*")
      .eq("access_token", token)
      .maybeSingle();

    if (!portal) return NextResponse.json({ error: "Portal not found" }, { status: 404 });

    if (portal.is_revoked || new Date(portal.expires_at) <= new Date()) {
      return NextResponse.json({ error: "Portal expired or revoked" }, { status: 403 });
    }

    const hashed = hashPasscode(passcode);
    if (hashed !== portal.passcode_hash) {
      await admin.rpc("log_auditor_access", {
        p_portal_id: portal.id,
        p_action: "AUTH_FAILED",
        p_target_record_id: "portal_auth",
        p_ip_address: request.headers.get("x-forwarded-for") ?? null,
        p_user_agent: request.headers.get("user-agent") ?? null,
      });
      return NextResponse.json({ error: "Invalid passcode" }, { status: 403 });
    }

    const accessMode = mode || "access";
    if (accessMode === "request_otp") {
      if (!portal.auditor_phone) {
        return NextResponse.json({ error: "No auditor phone is configured for this portal." }, { status: 400 });
      }

      const code = randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
      await admin.from("auditor_portal_otps").insert({
        portal_id: portal.id,
        phone_e164: portal.auditor_phone,
        code_hash: hashOtpCode(code),
        expires_at: expiresAt,
      });

      await sendSms(
        portal.auditor_phone,
        `iWorkr Vault code: ${code}. Expires in ${OTP_TTL_MINUTES} minutes.`,
      );

      await admin.rpc("log_auditor_access", {
        p_portal_id: portal.id,
        p_action: "OTP_SENT",
        p_target_record_id: portal.id,
        p_ip_address: request.headers.get("x-forwarded-for") ?? null,
        p_user_agent: request.headers.get("user-agent") ?? null,
      });

      return NextResponse.json({
        success: true,
        channel: maskPhone(portal.auditor_phone),
      });
    }

    if (accessMode === "verify_otp") {
      if (!otp || !/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: "Enter a valid 6-digit SMS code." }, { status: 400 });
      }

      const { data: latestOtp } = await admin
        .from("auditor_portal_otps")
        .select("id, code_hash, attempts, expires_at, consumed_at")
        .eq("portal_id", portal.id)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestOtp) {
        return NextResponse.json({ error: "No active OTP challenge found. Request a new code." }, { status: 403 });
      }

      if (new Date(latestOtp.expires_at) <= new Date()) {
        return NextResponse.json({ error: "SMS code expired. Request a new code." }, { status: 403 });
      }

      if (Number(latestOtp.attempts || 0) >= 5) {
        return NextResponse.json({ error: "Too many invalid attempts. Request a new code." }, { status: 429 });
      }

      if (hashOtpCode(otp) !== latestOtp.code_hash) {
        await admin
          .from("auditor_portal_otps")
          .update({
            attempts: Number(latestOtp.attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", latestOtp.id);
        return NextResponse.json({ error: "Invalid SMS code." }, { status: 403 });
      }

      await admin
        .from("auditor_portal_otps")
        .update({
          consumed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", latestOtp.id);
    }

    if (accessMode === "access") {
      const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const hasValidSession = verifyVaultSession(sessionToken, portal.id);
      if (!hasValidSession) {
        return NextResponse.json({ error: "SMS verification required", requires_otp: true }, { status: 401 });
      }
    }

    const allowedParticipants: string[] = portal.allowed_participant_ids || [];
    const allowedStaff: string[] = portal.allowed_staff_ids || [];

    const [{ data: allowedParticipantRows }, { data: allParticipants }, { data: staffRows }, { data: shiftNotes }, { data: incidents }] =
      await Promise.all([
        admin
          .from("participant_profiles")
          .select("id, preferred_name, ndis_number, clients(name)")
          .eq("organization_id", portal.organization_id)
          .in("id", allowedParticipants),
        admin
          .from("participant_profiles")
          .select("id, preferred_name, clients(name)")
          .eq("organization_id", portal.organization_id),
        admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", allowedStaff),
        admin
          .from("shift_note_submissions")
          .select("id, shift_id, participant_id, worker_id, status, created_at, family_visible_data, flags")
          .eq("organization_id", portal.organization_id)
          .in("participant_id", allowedParticipants)
          .gte("created_at", `${portal.scope_date_start}T00:00:00.000Z`)
          .lte("created_at", `${portal.scope_date_end}T23:59:59.999Z`)
          .order("created_at", { ascending: false })
          .limit(300),
        admin
          .from("incidents")
          .select("id, participant_id, title, description, severity, status, occurred_at")
          .eq("organization_id", portal.organization_id)
          .in("participant_id", allowedParticipants)
          .gte("occurred_at", `${portal.scope_date_start}T00:00:00.000Z`)
          .lte("occurred_at", `${portal.scope_date_end}T23:59:59.999Z`)
          .order("occurred_at", { ascending: false })
          .limit(300),
      ]);

    const allowedSet = new Set(allowedParticipants);
    const nonScopedNames = (allParticipants || [])
      .filter((p: any) => !allowedSet.has(p.id))
      .map((p: any) => (p.preferred_name as string | null) || (p.clients?.name as string) || "")
      .filter(Boolean);

    const redactedIncidents = (incidents || []).map((incident: any) => ({
      ...incident,
      description: redactNarrative(incident.description, nonScopedNames),
    }));

    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    const watermark = `VIEWED BY ${portal.auditor_email.toUpperCase()} - ${new Date().toLocaleString("en-AU")} - IP: ${ip}`;

    await admin.rpc("log_auditor_access", {
      p_portal_id: portal.id,
      p_action: "VIEWED_DATA_ROOM",
      p_target_record_id: portal.id,
      p_ip_address: ip,
      p_user_agent: request.headers.get("user-agent") ?? null,
    });

    const response = NextResponse.json({
      portal: {
        id: portal.id,
        title: portal.title,
        auditor_email: portal.auditor_email,
        scope_date_start: portal.scope_date_start,
        scope_date_end: portal.scope_date_end,
      },
      watermark,
      standards: {
        participant_rights: {
          participants: allowedParticipantRows || [],
        },
        provision_of_supports: {
          shift_notes: shiftNotes || [],
        },
        high_intensity: {
          incidents: redactedIncidents,
        },
      },
      staff: staffRows || [],
    });
    if (accessMode === "verify_otp") {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: signVaultSession(portal.id),
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: SESSION_TTL_SECONDS,
        path: "/",
      });
    }
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load vault" }, { status: 500 });
  }
}
