"use client";

import { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { SaveToast, useSaveToast } from "@/components/settings/save-toast";
import { useAuthStore } from "@/lib/auth-store";
import { useTeamStore } from "@/lib/team-store";
import { Shimmer } from "@/components/ui/shimmer";

export default function WorkspacePage() {
  const { visible, showSaved } = useSaveToast();
  const { currentOrg } = useAuthStore();
  const memberCount = useTeamStore((s) => s.members.length);
  const orgName = currentOrg?.name || "";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (orgName && !name) {
      setName(orgName);
      setSlug(orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  }, [orgName, name]);

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Workspace
      </h1>

      {/* Logo + name */}
      <div className="mb-8 flex items-center gap-5">
        <div className="relative">
          <img
            src="/logos/logo-dark-streamline.png"
            alt="iWorkr"
            className="h-14 w-14 rounded-xl object-contain"
          />
          <button className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[#141414] text-zinc-400 transition-colors hover:text-zinc-200">
            <Camera size={11} />
          </button>
        </div>
        <div>
          <div className="text-[14px] font-medium text-zinc-200">
            {orgName || <Shimmer className="h-4 w-32" />}
          </div>
          <div className="text-[12px] text-zinc-600">
            Free plan · {memberCount > 0 ? `${memberCount} members` : <Shimmer className="inline-block h-3 w-16" />}
          </div>
        </div>
      </div>

      <div className="max-w-lg space-y-5">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">Workspace name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={showSaved}
            className="w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[rgba(255,255,255,0.25)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">Workspace URL</label>
          <div className="flex items-center rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[13px]">
            <span className="text-zinc-600">iworkr.app/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={showSaved}
              className="bg-transparent text-zinc-300 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">Timezone</label>
          <div className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[13px] text-zinc-400">
            Australia/Brisbane (AEST, UTC+10)
          </div>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.06)] pt-5">
          <h3 className="mb-2 text-[13px] font-medium text-red-400/80">Danger zone</h3>
          <p className="mb-3 text-[12px] text-zinc-600">
            Permanently delete this workspace and all of its data. This action cannot be undone.
          </p>
          <button className="rounded-md border border-red-500/30 px-3 py-1.5 text-[12px] text-red-400/80 transition-colors hover:bg-red-500/10">
            Delete workspace
          </button>
        </div>
      </div>

      <SaveToast visible={visible} />
    </>
  );
}
