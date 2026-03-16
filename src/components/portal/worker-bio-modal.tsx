"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Glasshouse — Worker Bio Modal
   Face-first, trust-building worker profile for family portal.
   Displays verified credentials with high-trust green checkmarks.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { X, CheckCircle2, Award, Clock, User } from "lucide-react";
import { getWorkerBio, type WorkerBio } from "@/app/actions/glasshouse";

type Props = {
  workerId: string | null;
  organizationId: string;
  workerName: string;
  onClose: () => void;
};

const CREDENTIAL_LABELS: Record<string, string> = {
  NDIS_SCREENING: "NDIS Worker Screening",
  WWCC: "Working with Children Check",
  FIRST_AID: "First Aid Certificate",
  MANUAL_HANDLING: "Manual Handling",
  MEDICATION_COMPETENCY: "Medication Competency",
  CPR: "CPR Certified",
  DRIVERS_LICENSE: "Driver's Licence",
  POLICE_CHECK: "Police Check",
  OTHER: "Other Credential",
};

export function WorkerBioModal({ workerId, organizationId, workerName, onClose }: Props) {
  const [bio, setBio] = useState<WorkerBio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workerId) return;
    setLoading(true);
    getWorkerBio(workerId, organizationId)
      .then((data) => setBio(data))
      .finally(() => setLoading(false));
  }, [workerId, organizationId]);

  if (!workerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 mb-4 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900 shadow-2xl sm:mb-0">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          <X size={18} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : (
          <div className="p-6">
            {/* Avatar & Name */}
            <div className="mb-5 flex flex-col items-center text-center">
              <div className="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-teal-500/30 bg-teal-500/10">
                {bio?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bio.avatar_url}
                    alt={bio.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={32} className="text-teal-400" />
                )}
              </div>
              <h2 className="text-xl font-bold text-zinc-100">
                Hi, I&apos;m {bio?.full_name?.split(" ")[0] || workerName}!
              </h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                {bio?.full_name || workerName}
              </p>
            </div>

            {/* Bio */}
            {bio?.public_bio && (
              <div className="mb-5 rounded-xl bg-zinc-800/50 p-4">
                <p className="text-sm leading-relaxed text-zinc-300">
                  {bio.public_bio}
                </p>
              </div>
            )}

            {/* Quick Facts */}
            <div className="mb-5 flex flex-wrap justify-center gap-2">
              {bio?.years_experience && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-[11px] text-zinc-300">
                  <Clock size={10} />
                  {bio.years_experience} Years Experience
                </span>
              )}
              {bio?.specialties?.map((s: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-[11px] text-teal-400 border border-teal-500/20"
                >
                  <Award size={10} />
                  {s}
                </span>
              ))}
            </div>

            {/* Verified Credentials */}
            {bio?.verified_credentials && bio.verified_credentials.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Verified Credentials
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {bio.verified_credentials.map((cred, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2"
                    >
                      <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-300">
                        {cred.credential_name || CREDENTIAL_LABELS[cred.credential_type] || cred.credential_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!bio && (
              <p className="text-center text-sm text-zinc-500">
                Profile information is not yet available for this worker.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
