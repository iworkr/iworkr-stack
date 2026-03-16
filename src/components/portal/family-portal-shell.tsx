"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Home, CalendarDays, Users, Wallet, MessageCircle } from "lucide-react";

type LinkedParticipant = {
  participant_id: string;
  participant_name: string;
};

type Props = {
  participants: LinkedParticipant[];
  activeParticipantId: string;
};

const tabs = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/roster", label: "Roster", icon: CalendarDays },
  { href: "/portal/updates", label: "Updates", icon: MessageCircle },
  { href: "/portal/care-team", label: "Care Team", icon: Users },
  { href: "/portal/funds", label: "Funds", icon: Wallet },
];

export function FamilyPortalShell({ participants, activeParticipantId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const participantParam = searchParams.get("participant") || activeParticipantId;
  const active = useMemo(
    () =>
      participants.find((p) => p.participant_id === participantParam) ||
      participants[0],
    [participants, participantParam]
  );

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-800 bg-[#050505]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Family Portal</p>
          <p className="truncate text-base font-semibold text-zinc-50">{active?.participant_name || "Participant"}</p>
        </div>
        <select
          aria-label="Select participant"
          disabled={pending}
          className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-blue-500"
          value={active?.participant_id || ""}
          onChange={(e) =>
            startTransition(() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("participant", e.target.value);
              router.push(`${pathname}?${params.toString()}`);
            })
          }
        >
          {participants.map((p) => (
            <option key={p.participant_id} value={p.participant_id}>
              {p.participant_name}
            </option>
          ))}
        </select>
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-5 gap-2 px-4 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const activeTab = pathname === tab.href;
          const params = new URLSearchParams(searchParams.toString());
          if (active?.participant_id) params.set("participant", active.participant_id);
          return (
            <Link
              key={tab.href}
              href={`${tab.href}?${params.toString()}`}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                activeTab
                  ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
