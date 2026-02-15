"use client";

import { motion } from "framer-motion";
import { Plus, MoreHorizontal } from "lucide-react";
import { team } from "@/lib/data";

export default function MembersPage() {
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

      {/* Pending invites */}
      <div className="mb-6 rounded-lg border border-amber-500/10 bg-amber-500/5 px-4 py-3">
        <span className="text-[12px] text-amber-400/80">1 pending invite</span>
        <span className="ml-2 text-[12px] text-zinc-600">tom@apexplumbing.com.au — sent 2 days ago</span>
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

        {/* Rows */}
        {team.map((member, i) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center border-b border-[rgba(255,255,255,0.04)] px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
          >
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                {member.initials}
                <div className={`absolute -right-0.5 -bottom-0.5 h-[9px] w-[9px] rounded-full border-[1.5px] border-black ${
                  member.status === "online" ? "bg-emerald-500" : member.status === "away" ? "bg-amber-500" : "bg-zinc-600"
                }`} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-zinc-200">{member.name}</div>
                <div className="text-[11px] text-zinc-600">{member.email}</div>
              </div>
            </div>
            <div className="w-24">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                member.role === "admin"
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                  : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-zinc-500"
              }`}>
                {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
              </span>
            </div>
            <div className="w-28">
              <span className={`flex items-center gap-1.5 text-[12px] ${
                member.status === "online" ? "text-emerald-400/70" : member.status === "away" ? "text-amber-400/70" : "text-zinc-600"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  member.status === "online" ? "bg-emerald-500" : member.status === "away" ? "bg-amber-500" : "bg-zinc-600"
                }`} />
                {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
              </span>
            </div>
            <div className="w-28 text-[12px] text-zinc-600">
              {i === 0 ? "Jan 2024" : i === 1 ? "Mar 2024" : i === 2 ? "Jun 2024" : "Jan 2025"}
            </div>
            <div className="w-10 text-right">
              <button className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
