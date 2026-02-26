"use client";

import { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useAuthStore } from "@/lib/auth-store";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";

export default function ProfilePage() {
  const { currentOrg, currentMembership } = useAuthStore();
  const {
    fullName, email, phone, avatarUrl,
    updateProfileField,
  } = useSettingsStore();

  const roleName = currentMembership?.role
    ? currentMembership.role.charAt(0).toUpperCase() + currentMembership.role.slice(1)
    : "";
  const orgName = currentOrg?.name || "";

  const [nameVal, setNameVal] = useState("");
  const [phoneVal, setPhoneVal] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from store ONCE on initial load — no nameVal in deps to prevent feedback loop
  const hasSynced = useRef(false);
  useEffect(() => {
    if (hasSynced.current) return;
    if (fullName) setNameVal(fullName);
    if (phone !== undefined) setPhoneVal(phone);
    if (fullName || phone) hasSynced.current = true;
  }, [fullName, phone]);

  function handleNameBlur() {
    if (nameVal.trim() && nameVal !== fullName) {
      updateProfileField("full_name", nameVal.trim());
    }
  }

  function handlePhoneBlur() {
    if (phoneVal !== phone) {
      updateProfileField("phone", phoneVal);
    }
  }

  const initials = fullName
    ? fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "";

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Profile
      </h1>

      {/* Avatar */}
      <div className="mb-8 flex items-center gap-5">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName || ""}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-white/[0.08]"
              referrerPolicy="no-referrer"
            />
          ) : initials ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-lg font-medium text-zinc-300">
              {initials}
            </div>
          ) : (
            <ShimmerCircle className="h-16 w-16" />
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[#141414] text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <Camera size={11} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={() => {
              // Avatar upload handling would go here with Supabase Storage
            }}
          />
        </div>
        <div>
          <div className="text-[14px] font-medium text-zinc-200">
            {fullName || <Shimmer className="h-4 w-32" />}
          </div>
          <div className="text-[12px] text-zinc-600">
            {roleName && orgName ? `${roleName} · ${orgName}` : <Shimmer className="h-3 w-28" />}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="max-w-md space-y-5">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">
            Full name
          </label>
          <input
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleNameBlur}
            className="w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">
            Email
          </label>
          <div className="flex items-center rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[13px] text-zinc-500">
            {email || <Shimmer className="h-3 w-40" />}
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            Contact an admin to change your email address.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">
            Phone
          </label>
          <input
            type="tel"
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            onBlur={handlePhoneBlur}
            className="w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
            placeholder="+61 400 000 000"
          />
        </div>
      </div>
    </>
  );
}
