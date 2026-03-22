/**
 * @page /dashboard/settings/security
 * @status COMPLETE
 * @description MFA enrollment settings with TOTP setup and security event log
 * @dataSource api-route
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Factor } from "@supabase/supabase-js";
// Hyperion-Vanguard S-04: Client-side QR code — TOTP secret never leaves the browser
import { QRCodeSVG } from "qrcode.react";

/**
 * Aegis-Citadel: Security Settings — MFA Enrollment
 *
 * Allows users to:
 *   - Enroll in TOTP (Authenticator App) MFA
 *   - View and remove enrolled factors
 *   - View recent security events for their account
 *
 * WebAuthn/Passkeys will be added when Supabase enables the feature.
 */

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function SecuritySettingsPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [securityEvents, setSecurityEvents] = useState<Array<{
    id: string;
    event_type: string;
    severity: string;
    ip_address: string;
    country_code: string;
    created_at: string;
    details: Record<string, unknown>;
  }>>([]);

  // ── Load enrolled factors ───────────────────────────────────────────

  const loadFactors = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error: factorsErr } = await supabase.auth.mfa.listFactors();
      if (factorsErr) throw factorsErr;
      setFactors(data?.totp ?? []);
    } catch (err) {
      console.error("Failed to load MFA factors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSecurityEvents = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("security_events")
        .select("id, event_type, severity, ip_address, country_code, created_at, details")
        .order("created_at", { ascending: false })
        .limit(20);
      setSecurityEvents(data ?? []);
    } catch {
      // Security events table may not exist yet
    }
  }, []);

  useEffect(() => {
    loadFactors();
    loadSecurityEvents();
  }, [loadFactors, loadSecurityEvents]);

  // ── Enroll TOTP ─────────────────────────────────────────────────────

  const startEnrollment = async () => {
    setEnrolling(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (enrollErr) throw enrollErr;
      if (data?.totp) {
        setQrUri(data.totp.uri);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start enrollment");
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    setError(null);
    try {
      const supabase = getSupabase();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });
      if (verify.error) throw verify.error;

      setSuccess("MFA enrolled successfully! Your account is now more secure.");
      setEnrolling(false);
      setQrUri(null);
      setSecret(null);
      setFactorId(null);
      setVerifyCode("");
      loadFactors();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed — check your code");
    }
  };

  const cancelEnrollment = async () => {
    if (factorId) {
      const supabase = getSupabase();
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setEnrolling(false);
    setQrUri(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode("");
    setError(null);
  };

  // ── Remove Factor ───────────────────────────────────────────────────

  const removeFactor = async (id: string) => {
    if (!confirm("Remove this MFA factor? You will need to re-enroll to use MFA again.")) return;
    try {
      const supabase = getSupabase();
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (unenrollErr) throw unenrollErr;
      setSuccess("MFA factor removed.");
      loadFactors();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove factor");
    }
  };

  // ── Severity badge ──────────────────────────────────────────────────

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "warning": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">Security</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage multi-factor authentication and monitor security events.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {success}
        </div>
      )}

      {/* MFA Section */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-1 text-base font-medium text-white">
          Multi-Factor Authentication
        </h2>
        <p className="mb-6 text-sm text-zinc-500">
          Add an extra layer of security with an authenticator app like Google Authenticator, Authy, or 1Password.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
            Loading...
          </div>
        ) : enrolling && qrUri ? (
          /* Enrollment Flow */
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-sm text-zinc-300">
                1. Scan this QR code with your authenticator app:
              </p>
              <div className="flex justify-center rounded-lg bg-white p-4">
                {/* Hyperion-Vanguard S-04: QR code rendered client-side.
                    The TOTP URI (containing the MFA seed) NEVER leaves the browser.
                    Previously used api.qrserver.com which leaked the seed to a 3rd party. */}
                <QRCodeSVG
                  value={qrUri}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>
              {secret && (
                <div className="mt-3">
                  <p className="text-xs text-zinc-500">
                    Or enter this code manually:
                  </p>
                  <code className="mt-1 block break-all rounded bg-zinc-800 px-3 py-2 font-mono text-xs text-emerald-400">
                    {secret}
                  </code>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm text-zinc-300">
                2. Enter the 6-digit code from your authenticator:
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-center font-mono text-lg tracking-widest text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={verifyEnrollment}
                  disabled={verifyCode.length !== 6}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
                >
                  Verify
                </button>
                <button
                  onClick={cancelEnrollment}
                  className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Enrolled Factors List */
          <div className="space-y-4">
            {factors.length > 0 ? (
              factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                      <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {factor.friendly_name ?? "Authenticator App"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {factor.status === "verified" ? "Active" : "Pending verification"}
                        {" · "}
                        Added {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFactor(factor.id)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center">
                <p className="mb-1 text-sm text-zinc-400">No MFA factors enrolled</p>
                <p className="text-xs text-zinc-600">
                  Add an authenticator app to protect your account
                </p>
              </div>
            )}

            <button
              onClick={startEnrollment}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              {factors.length > 0 ? "Add Another Factor" : "Set Up Authenticator App"}
            </button>
          </div>
        )}
      </section>

      {/* WebAuthn/Passkeys Section (Placeholder) */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-1 text-base font-medium text-white">
          Passkeys & Hardware Keys
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Use YubiKey, FaceID, TouchID, or Windows Hello for phishing-resistant authentication.
        </p>
        <div className="rounded-lg border border-dashed border-zinc-800 py-6 text-center">
          <p className="text-sm text-zinc-500">
            WebAuthn/FIDO2 support coming soon
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Enable via Supabase Dashboard → Auth → MFA → WebAuthn
          </p>
        </div>
      </section>

      {/* Security Events */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-1 text-base font-medium text-white">
          Recent Security Events
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Activity and anomalies detected on your account.
        </p>

        {securityEvents.length > 0 ? (
          <div className="space-y-2">
            {securityEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${severityColor(event.severity)}`}>
                    {event.severity}
                  </span>
                  <div>
                    <p className="text-sm text-zinc-300">
                      {event.event_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {event.ip_address && `${event.ip_address} · `}
                      {event.country_code && `${event.country_code} · `}
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-800 py-6 text-center">
            <p className="text-sm text-zinc-500">No security events recorded</p>
          </div>
        )}
      </section>

      {/* Supabase Auth Config Recommendations */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
        <h2 className="mb-2 text-base font-medium text-amber-400">
          Recommended Auth Configuration
        </h2>
        <p className="mb-3 text-sm text-zinc-400">
          Update these settings in the Supabase Dashboard for maximum security:
        </p>
        <ul className="space-y-1 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Enable MFA TOTP: Auth → MFA → TOTP → enroll &amp; verify enabled
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Enable WebAuthn: Auth → MFA → WebAuthn → enroll &amp; verify enabled
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Min password length: 8+ characters with letters &amp; digits
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Enable email confirmations for new signups
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Enable secure password change (require re-authentication)
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Set session inactivity timeout to 1 hour
          </li>
        </ul>
      </section>
    </div>
  );
}
