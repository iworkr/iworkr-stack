"use client";

import { motion } from "framer-motion";
import { Plus, MoreHorizontal } from "lucide-react";
import { useTeamStore } from "@/lib/team-store";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";

function ShimmerRow() {
  return (
    <div className="flex items-center border-b border-[rgba(255,255,255,0.04)] px-4 py-3">
      <div className="flex flex-1 items-center gap-3">
        <ShimmerCircle className="h-8 w-8" />
        <div className="space-y-1.5">
          <Shimmer className="h-3 w-28" />
          <Shimmer className="h-2 w-36" />
        </div>
      </div>
      <div className="w-24"><Shimmer className="h-3 w-12" /></div>
      <div className="w-28"><Shimmer className="h-3 w-14" /></div>
      <div className="w-28"><Shimmer className="h-3 w-16" /></div>
      <div className="w-10" />
    </div>
  );
}

export default function MembersPage() {
  const members = useTeamStore((s) => s.members);
  const loaded = useTeamStore((s) => s.loaded);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-zinc-100">Members</h1>
          <p className="mt-1 text-[13px] text-zinc-600">
            Manage team members, roles, and access in your workspace.
          </p>
        </div>
        <button className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-zinc-200">
          <Plus size={14} />
          Invite
        </button>
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)]">
        {/* Header */}
        <div className="flex items-center border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-2.5">
          <div className="flex-1 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Member</div>
          <div className="w-24 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Role</div>
          <div className="w-28 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Status</div>
          <div className="w-28 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Joined</div>
          <div className="w-10" />
        </div>

        {/* Loading state */}
        {!loaded && members.length === 0 && (
          <>
            <ShimmerRow />
            <ShimmerRow />
            <ShimmerRow />
          </>
        )}

        {/* Empty state */}
        {loaded && members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[13px] text-zinc-500">No team members yet</p>
            <p className="mt-1 text-[11px] text-zinc-700">Invite your team to get started.</p>
          </div>
        )}

        {/* Rows */}
        {members.map((member, i) => {
          const initials = member.name
            ? member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
            : "??";
          const onlineStatus = member.onlineStatus || "offline";
          const role = member.role || "member";

          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center border-b border-[rgba(255,255,255,0.04)] px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                  {initials}
                  <div className={`absolute -right-0.5 -bottom-0.5 h-[9px] w-[9px] rounded-full border-[1.5px] border-black ${
                    onlineStatus === "online" ? "bg-emerald-500" : onlineStatus === "idle" ? "bg-amber-500" : "bg-zinc-600"
                  }`} />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-zinc-200">{member.name}</div>
                  <div className="text-[11px] text-zinc-600">{member.email}</div>
                </div>
              </div>
              <div className="w-24">
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                  role === "owner" || role === "manager"
                    ? "border-[rgba(0,230,118,0.3)] bg-[rgba(0,230,118,0.08)] text-[#00E676]"
                    : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-zinc-500"
                }`}>
                  {role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </span>
              </div>
              <div className="w-28">
                <span className={`flex items-center gap-1.5 text-[12px] ${
                  onlineStatus === "online" ? "text-emerald-400/70" : onlineStatus === "idle" ? "text-amber-400/70" : "text-zinc-600"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    onlineStatus === "online" ? "bg-emerald-500" : onlineStatus === "idle" ? "bg-amber-500" : "bg-zinc-600"
                  }`} />
                  {onlineStatus.charAt(0).toUpperCase() + onlineStatus.slice(1)}
                </span>
              </div>
              <div className="w-28 text-[12px] text-zinc-600">
                {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
              </div>
              <div className="w-10 text-right">
                <button className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400">
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
