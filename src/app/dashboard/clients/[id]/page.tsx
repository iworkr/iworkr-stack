"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Building2,
  User,
  Plus,
  Tag,
  Copy,
  Trash2,
  MoreHorizontal,
  Check,
  Briefcase,
  Receipt,
  FileText,
  StickyNote,
  PhoneCall,
  Sparkles,
  Clock,
  Calendar,
  X,
  ExternalLink,
  DollarSign,
  Activity,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { type Client, type ClientActivity } from "@/lib/data";
import { useToastStore } from "@/components/app/action-toast";
import { useClientsStore } from "@/lib/clients-store";
import { getClientDetails } from "@/app/actions/clients";
import { useOrg } from "@/lib/hooks/use-org";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";

/* ── Constants ────────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; border: string; bg: string; text: string }> = {
  active: { label: "Active", dot: "bg-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  lead: { label: "Lead", dot: "bg-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/10", text: "text-sky-400" },
  churned: { label: "Churned", dot: "bg-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", text: "text-rose-400" },
  inactive: { label: "Inactive", dot: "bg-zinc-500", border: "border-zinc-600/20", bg: "bg-zinc-500/10", text: "text-zinc-400" },
};

type DossierTab = "jobs" | "invoices" | "notes" | "activity";

const dossierTabs: { id: DossierTab; label: string; icon: typeof Briefcase }[] = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "notes", label: "Notes", icon: StickyNote },
];

const activityIcons: Record<string, typeof Briefcase> = {
  job_completed: Check,
  invoice_paid: DollarSign,
  invoice_sent: Receipt,
  quote_sent: FileText,
  note: StickyNote,
  job_created: Briefcase,
  call: PhoneCall,
};

const activityColors: Record<string, string> = {
  job_completed: "text-emerald-400",
  invoice_paid: "text-emerald-400",
  invoice_sent: "text-amber-400",
  quote_sent: "text-sky-400",
  note: "text-yellow-400",
  job_created: "text-zinc-400",
  call: "text-emerald-400",
};

const gradients = [
  "from-zinc-600/40 to-zinc-800/40",
  "from-emerald-600/40 to-teal-800/40",
  "from-amber-600/40 to-orange-800/40",
  "from-rose-600/40 to-pink-800/40",
  "from-zinc-500/40 to-zinc-700/40",
  "from-sky-600/40 to-indigo-800/40",
];

function getGradient(initials: string): string {
  const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return gradients[charCode % gradients.length];
}

const headerContextItems: ContextMenuItem[] = [
  { id: "copy_email", label: "Copy Email", icon: <Copy size={13} /> },
  { id: "copy_phone", label: "Copy Phone", icon: <Copy size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "archive", label: "Archive Client", icon: <Trash2 size={13} />, danger: true },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Count-Up Hook ────────────────────────────────────────── */

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

/* ── Page Component ───────────────────────────────────────── */

export default function ClientDossierPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const { addToast } = useToastStore();
  const { orgId } = useOrg();

  const storeClients = useClientsStore((s) => s.clients);
  const storeClient = storeClients.find((c) => c.id === clientId);

  const [serverDetail, setServerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DossierTab>("activity");

  useEffect(() => {
    if (!clientId || detailLoading || serverDetail) return;
    setDetailLoading(true);
    getClientDetails(clientId).then(({ data }) => {
      if (data) setServerDetail(data);
      setDetailLoading(false);
    }).catch(() => setDetailLoading(false));
  }, [clientId, detailLoading, serverDetail]);

  const client: Client | undefined = storeClient
    ? {
        ...storeClient,
        contacts: serverDetail?.contacts?.map((cc: any) => ({
          id: cc.id,
          name: cc.name || cc.full_name || "",
          initials: (cc.name || "").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "??",
          role: cc.role || "",
          email: cc.email || "",
          phone: cc.phone || "",
        })) || storeClient.contacts,
        activity: serverDetail?.recent_activity?.map((a: any) => ({
          id: a.id,
          type: a.action_type || "note",
          text: a.metadata?.description || a.action_type || "",
          time: a.created_at ? new Date(a.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" }) : "",
          user: a.user_name || "System",
        })) || storeClient.activity,
        spendHistory: serverDetail?.spend_history?.map((inv: any) => ({
          month: new Date(inv.created_at).toLocaleDateString("en-AU", { month: "short" }),
          amount: Number(inv.total || 0),
        })) || storeClient.spendHistory,
      }
    : undefined;

  /* ── Editable state ─────────────────────────────────────── */
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localPhone, setLocalPhone] = useState("");
  const [localEmail, setLocalEmail] = useState("");
  const [localNotes, setLocalNotes] = useState("");
  const [savedField, setSavedField] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false, x: 0, y: 0,
  });

  useEffect(() => {
    if (client) {
      setLocalPhone(client.phone);
      setLocalEmail(client.email);
      setLocalNotes(client.notes || "");
    }
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function flashSaved(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingField) setEditingField(null);
        else router.push("/dashboard/clients");
      }
    },
    [editingField, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  function handleHeaderContextAction(actionId: string) {
    if (!client) return;
    if (actionId === "copy_email") {
      navigator.clipboard?.writeText(client.email);
      addToast("Email copied");
    } else if (actionId === "copy_phone") {
      navigator.clipboard?.writeText(client.phone);
      addToast("Phone copied");
    } else if (actionId === "archive") {
      useClientsStore.getState().archiveClientServer(clientId);
      addToast(`${client.name} archived`);
      router.push("/dashboard/clients");
    }
  }

  if (!client) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full items-center justify-center bg-[#050505]"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <User size={20} className="text-zinc-700" />
          </div>
          <h2 className="mb-1 text-[15px] font-medium text-zinc-300">Client not found</h2>
          <p className="mb-4 text-[12px] text-zinc-600">This client may have been archived.</p>
          <button
            onClick={() => router.push("/dashboard/clients")}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
          >
            <ArrowLeft size={12} />
            Back to Clients
          </button>
        </div>
      </motion.div>
    );
  }

  /* ── Computed ────────────────────────────────────────────── */
  const sc = statusConfig[client.status] || statusConfig.inactive;
  const spendData = client.spendHistory || [];
  const maxSpend = Math.max(...spendData.map((d) => d.amount), 1);
  const totalSpend = spendData.reduce((sum, d) => sum + d.amount, 0);
  const isVIP = (client.lifetimeValueNum || 0) >= 10000;
  const outstandingBalance = 0; // Would come from unpaid invoices

  /* ── SVG path for spend chart ───────────────────────────── */
  const chartW = 480;
  const chartH = 100;
  const padding = 8;

  const points = spendData.map((d, i) => ({
    x: padding + (i / Math.max(spendData.length - 1, 1)) * (chartW - padding * 2),
    y: chartH - padding - (d.amount / maxSpend) * (chartH - padding * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${chartH} L ${points[0]?.x || 0} ${chartH} Z`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col bg-[#050505]"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-1.5 text-[12px]">
            <button
              onClick={() => router.push("/dashboard/clients")}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
            >
              <ArrowLeft size={12} />
              Clients
            </button>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="font-medium text-zinc-300">{client.name}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (!client.email) { addToast("No email configured"); return; }
                window.location.href = `mailto:${client.email}`;
              }}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              title="Email"
            >
              <Mail size={14} />
            </button>
            <button
              onClick={() => {
                if (!client.phone) { addToast("No phone number"); return; }
                window.location.href = `tel:${client.phone}`;
              }}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              title="Call"
            >
              <Phone size={14} />
            </button>
            <button
              onClick={() => {
                if (!client.phone) { addToast("No phone number"); return; }
                window.location.href = `sms:${client.phone}`;
              }}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              title="Message"
            >
              <MessageSquare size={14} />
            </button>
            <button
              onClick={(e) => setCtxMenu({ open: true, x: e.clientX, y: e.clientY })}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <MoreHorizontal size={14} />
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/dashboard/jobs?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
              className="ml-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500"
            >
              <Plus size={12} />
              Create Job
            </motion.button>
          </div>
        </div>

        {/* Identity row */}
        <div className="flex items-center gap-4 px-6 pb-4">
          <div className="relative">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-[18px] font-bold text-zinc-200 ${getGradient(client.initials)}`}
            >
              {client.initials}
            </div>
            {isVIP && (
              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-[#050505]">
                <span className="text-[8px] font-bold text-black">★</span>
              </div>
            )}
          </div>
          <div>
            <h1 className={`text-[24px] font-semibold tracking-tight ${isVIP ? "text-amber-100" : "text-zinc-100"}`}>
              {client.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[10px] font-medium ${sc.border} ${sc.bg} ${sc.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
              {isVIP && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  <Sparkles size={8} />
                  VIP
                </span>
              )}
              {client.type === "commercial" && (
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                  <Building2 size={8} />
                  Commercial
                </span>
              )}
              {client.since && (
                <span className="text-[10px] text-zinc-600">Since {client.since}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2-Column Body ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas (Left ~65%) ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {/* ── Financial Stats Strip ────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 border-b border-white/[0.03] px-6 py-5">
            <StatCard
              label="Total Spent"
              icon={<DollarSign size={10} />}
              value={`$${totalSpend.toLocaleString()}`}
              subtext="last 12 months"
              accent="emerald"
            />
            <StatCard
              label="Outstanding"
              icon={<AlertCircle size={10} />}
              value={outstandingBalance > 0 ? `$${outstandingBalance.toLocaleString()}` : "$0"}
              subtext={outstandingBalance > 0 ? "unpaid" : "all clear"}
              accent={outstandingBalance > 0 ? "rose" : "zinc"}
            />
            <StatCard
              label="Total Jobs"
              icon={<Briefcase size={10} />}
              value={String(client.totalJobs)}
              subtext={client.lastJob !== "Never" ? `Last: ${client.lastJob}` : "No jobs yet"}
              accent="zinc"
            />
          </div>

          {/* ── Spend Pulse Graph ────────────────────────────── */}
          {spendData.length > 0 && (
            <div className="border-b border-white/[0.03] px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  <TrendingUp size={10} />
                  Revenue Trend
                </h3>
                <span className="font-mono text-[13px] font-medium text-emerald-400">
                  {client.lifetimeValue}
                  <span className="ml-1 text-[9px] text-zinc-600">lifetime</span>
                </span>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-white/[0.03] bg-white/[0.01] p-3">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: 100 }}>
                  <defs>
                    <linearGradient id={`spend-grad-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <motion.path
                    d={areaPath}
                    fill={`url(#spend-grad-${client.id})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                  {points.map((p, i) => (
                    <motion.circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={spendData[i].amount > 0 ? 2.5 : 0}
                      fill="#050505"
                      stroke="#34d399"
                      strokeWidth="1.5"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.2 }}
                    />
                  ))}
                </svg>
                <div className="mt-1 flex justify-between px-1">
                  {spendData.map((d) => (
                    <span key={d.month} className="text-[8px] text-zinc-700">{d.month}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Dossier Tabs ────────────────────────────────── */}
          <div className="border-b border-white/[0.03] px-6">
            <div className="flex items-center gap-0.5 pt-1">
              {dossierTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-medium transition-colors ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon size={12} />
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="dossier-tab-indicator"
                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-emerald-500"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tab Content ─────────────────────────────────── */}
          <div className="px-6 py-5">
            <AnimatePresence mode="wait">
              {activeTab === "activity" && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ActivityTimeline activity={client.activity || []} router={router} />
                </motion.div>
              )}
              {activeTab === "jobs" && (
                <motion.div
                  key="jobs"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="text-center py-12"
                >
                  <Briefcase size={24} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-[13px] text-zinc-500">{client.totalJobs} total jobs</p>
                  <button
                    onClick={() => router.push(`/dashboard/jobs?clientId=${client.id}`)}
                    className="mt-3 text-[11px] text-emerald-500 transition-colors hover:text-emerald-400"
                  >
                    View all jobs →
                  </button>
                </motion.div>
              )}
              {activeTab === "invoices" && (
                <motion.div
                  key="invoices"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="text-center py-12"
                >
                  <Receipt size={24} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-[13px] text-zinc-500">{spendData.length} invoices</p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    ${totalSpend.toLocaleString()} total
                  </p>
                </motion.div>
              )}
              {activeTab === "notes" && (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <textarea
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    onBlur={() => {
                      useClientsStore.getState().updateClientServer(clientId, { notes: localNotes });
                      addToast("Notes saved");
                    }}
                    placeholder="Add notes about this client..."
                    className="h-48 w-full resize-none rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/30"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── HUD Panel (Right ~35%) ──────────────────────────── */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.04] bg-white/[0.01] scrollbar-none">
          <div className="p-5">
            {/* ── LTV Spotlight ──────────────────────────────── */}
            <div className="mb-6 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
              <div className="mb-1 flex items-center gap-1 text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                <DollarSign size={9} />
                Lifetime Value
              </div>
              <AnimatedLTV value={client.lifetimeValueNum || 0} isVIP={isVIP} />
            </div>

            {/* ── Location Intel ──────────────────────────────── */}
            {client.address && (
              <div className="mb-6">
                <h4 className="mb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  Location
                </h4>
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <div className="relative h-[130px] bg-[#080808]">
                    <div className="absolute inset-0 opacity-[0.03]">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-white" style={{ top: `${i * 20}%` }} />
                      ))}
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={`v-${i}`} className="absolute top-0 bottom-0 border-l border-white" style={{ left: `${i * 12.5}%` }} />
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        initial={{ y: -15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
                        className="relative"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                          <MapPin size={10} className="text-white" />
                        </div>
                        <motion.div
                          animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 rounded-full border border-emerald-500"
                        />
                      </motion.div>
                    </div>
                    {client.addressCoords && (
                      <div className="absolute right-2 bottom-2 rounded-md bg-black/60 px-2 py-1 text-[9px] text-zinc-400 backdrop-blur-sm">
                        {haversineKm(client.addressCoords.lat, client.addressCoords.lng, -33.8688, 151.2093).toFixed(1)} km from HQ
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
                    <MapPin size={9} className="shrink-0 text-zinc-600" />
                    <span className="truncate">{client.address}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Contact Grid ────────────────────────────────── */}
            <div className="mb-6">
              <h4 className="mb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Contacts
              </h4>
              <div className="space-y-1">
                {(client.contacts || []).map((contact, i) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-medium text-zinc-300 ${getGradient(contact.initials)}`}>
                      {contact.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-zinc-300">{contact.name}</div>
                      <div className="text-[10px] text-zinc-600">{contact.role}</div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(contact.email);
                          addToast("Email copied");
                        }}
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
                      >
                        <Mail size={10} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!contact.phone) { addToast("No phone number"); return; }
                          window.location.href = `tel:${contact.phone}`;
                        }}
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
                      >
                        <Phone size={10} />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {(!client.contacts || client.contacts.length === 0) && (
                  <p className="py-3 text-center text-[11px] text-zinc-700">No contacts yet</p>
                )}
              </div>
            </div>

            {/* ── Details (Editable) ──────────────────────────── */}
            <div className="mb-6">
              <h4 className="mb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Details
              </h4>
              <div className="space-y-0.5">
                <EditableRow
                  label="Email"
                  value={localEmail}
                  icon={<Mail size={11} className="text-zinc-600" />}
                  editing={editingField === "email"}
                  saved={savedField === "email"}
                  onStartEdit={() => setEditingField("email")}
                  onChange={setLocalEmail}
                  onSave={() => {
                    setEditingField(null);
                    flashSaved("email");
                    useClientsStore.getState().updateClientServer(clientId, { email: localEmail });
                    addToast("Email updated");
                  }}
                />
                <EditableRow
                  label="Phone"
                  value={localPhone}
                  icon={<Phone size={11} className="text-zinc-600" />}
                  editing={editingField === "phone"}
                  saved={savedField === "phone"}
                  onStartEdit={() => setEditingField("phone")}
                  onChange={setLocalPhone}
                  onSave={() => {
                    setEditingField(null);
                    flashSaved("phone");
                    useClientsStore.getState().updateClientServer(clientId, { phone: localPhone });
                    addToast("Phone updated");
                  }}
                />
                <div className="flex items-center justify-between rounded-md px-3 py-2">
                  <span className="text-[11px] text-zinc-600">Type</span>
                  <div className="flex items-center gap-1.5">
                    {client.type === "commercial" ? <Building2 size={11} className="text-zinc-600" /> : <User size={11} className="text-zinc-600" />}
                    <span className="text-[12px] text-zinc-400">
                      {client.type ? client.type.charAt(0).toUpperCase() + client.type.slice(1) : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2">
                  <span className="text-[11px] text-zinc-600">Since</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-zinc-600" />
                    <span className="text-[12px] text-zinc-500">{client.since || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Tags ────────────────────────────────────────── */}
            <div className="mb-6">
              <h4 className="mb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(client.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-white/[0.12]"
                  >
                    <Tag size={8} className="text-zinc-600" />
                    {tag}
                  </span>
                ))}
                {addingTag ? (
                  <input
                    ref={tagInputRef}
                    autoFocus
                    value={newTagValue}
                    onChange={(e) => setNewTagValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTagValue.trim()) {
                        const tag = newTagValue.trim();
                        const updatedTags = [...(client.tags || []), tag];
                        useClientsStore.getState().updateClientServer(clientId, { tags: updatedTags });
                        addToast(`Tag "${tag}" added`);
                        setNewTagValue("");
                        setAddingTag(false);
                      } else if (e.key === "Escape") {
                        setNewTagValue("");
                        setAddingTag(false);
                      }
                    }}
                    onBlur={() => { setNewTagValue(""); setAddingTag(false); }}
                    placeholder="Tag name..."
                    className="inline-flex w-20 rounded-md border border-emerald-500/30 bg-white/[0.02] px-2.5 py-1 text-[10px] text-zinc-300 outline-none placeholder:text-zinc-700"
                  />
                ) : (
                  <button
                    onClick={() => setAddingTag(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-white/[0.06] px-2.5 py-1 text-[10px] text-zinc-600 transition-colors hover:border-white/[0.12] hover:text-zinc-400"
                  >
                    <Plus size={8} />
                    Add
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Sticky Footer Actions ─────────────────────────── */}
          <div className="sticky bottom-0 border-t border-white/[0.04] bg-[#080808]/90 px-5 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/dashboard/jobs?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[12px] font-medium text-white transition-all hover:bg-emerald-500"
              >
                <Briefcase size={12} />
                Create Job
              </motion.button>
              <button
                onClick={() => addToast("Statement generation coming soon")}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-2 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
              >
                <FileText size={12} />
                Statement
              </button>
            </div>
          </div>
        </div>
      </div>

      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={headerContextItems}
        onSelect={handleHeaderContextAction}
        onClose={() => setCtxMenu((p) => ({ ...p, open: false }))}
      />
    </motion.div>
  );
}

/* ── Stat Card Component ──────────────────────────────────── */

function StatCard({ label, icon, value, subtext, accent }: {
  label: string;
  icon: React.ReactNode;
  value: string;
  subtext: string;
  accent: "emerald" | "rose" | "zinc";
}) {
  const accentClasses = {
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    zinc: "text-zinc-300",
  };

  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
      <div className="mb-2 flex items-center gap-1 text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
        {icon}
        {label}
      </div>
      <div className={`font-mono text-[20px] font-semibold ${accentClasses[accent]}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-zinc-600">{subtext}</div>
    </div>
  );
}

/* ── Activity Timeline Component ──────────────────────────── */

function ActivityTimeline({ activity, router }: { activity: ClientActivity[]; router: any }) {
  if (activity.length === 0) {
    return (
      <div className="py-12 text-center">
        <Clock size={24} className="mx-auto mb-3 text-zinc-700" />
        <p className="text-[13px] text-zinc-500">No activity yet</p>
        <p className="mt-1 text-[11px] text-zinc-600">Activity will appear here when jobs, invoices, or notes are created.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute top-2 bottom-2 left-[7px] w-px bg-white/[0.04]" />
      <div className="space-y-3">
        {activity.map((entry, i) => {
          const Icon = activityIcons[entry.type] || Briefcase;
          const iconColor = activityColors[entry.type] || "text-zinc-500";
          const isNote = entry.type === "note";
          const isInvoice = entry.type === "invoice_paid" || entry.type === "invoice_sent";

          return (
            <motion.div
              key={entry.id || i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="relative flex gap-3"
            >
              <div className="absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/[0.06] bg-[#080808]">
                <Icon size={8} className={iconColor} />
              </div>
              <div
                className={`flex-1 rounded-lg p-3 ${
                  isNote
                    ? "border border-yellow-500/10 bg-yellow-500/[0.03]"
                    : "border border-white/[0.03] bg-white/[0.01]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-[12px] text-zinc-400">{entry.text}</div>
                  {isInvoice && entry.amount && (
                    <span className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                      entry.type === "invoice_paid"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {entry.type === "invoice_paid" ? "Paid" : "Sent"} {entry.amount}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-zinc-700">{entry.time}</span>
                  {entry.jobRef && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/jobs/${entry.jobRef}`);
                      }}
                      className="flex items-center gap-0.5 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
                    >
                      <ExternalLink size={8} />
                      {entry.jobRef}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Animated LTV Display ─────────────────────────────────── */

function AnimatedLTV({ value, isVIP }: { value: number; isVIP: boolean }) {
  const displayed = useCountUp(value, 700);

  return (
    <div
      className={`font-mono text-[26px] font-bold tracking-tight ${isVIP ? "text-emerald-400" : "text-zinc-200"}`}
      style={
        isVIP
          ? { textShadow: "0 0 20px rgba(16, 185, 129, 0.35)" }
          : undefined
      }
    >
      ${displayed.toLocaleString()}
    </div>
  );
}

/* ── Editable Row Component ───────────────────────────────── */

function EditableRow({
  label,
  value,
  icon,
  editing,
  saved,
  onStartEdit,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  editing: boolean;
  saved: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="relative flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-white/[0.02]">
      <span className="text-[11px] text-zinc-600">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
            className="w-40 bg-transparent text-right text-[12px] text-zinc-300 outline-none"
          />
        ) : (
          <span
            onClick={onStartEdit}
            className="cursor-text text-[12px] text-zinc-400 transition-colors hover:text-zinc-300"
          >
            {value || "—"}
          </span>
        )}
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Check size={11} className="text-emerald-400" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
