"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { clients as mockClients, type Client, type ClientActivity } from "@/lib/data";
import { useToastStore } from "@/components/app/action-toast";
import { useClientsStore } from "@/lib/clients-store";
import { getClientDetails, updateClient as updateClientAction, deleteClient as deleteClientAction } from "@/app/actions/clients";
import { useOrg } from "@/lib/hooks/use-org";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";

/* ── Constants ────────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; border: string; bg: string }> = {
  active: { label: "Active", dot: "bg-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/5" },
  lead: { label: "Lead", dot: "bg-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/5" },
  churned: { label: "Churned", dot: "bg-red-400", border: "border-red-500/30", bg: "bg-red-500/5" },
  inactive: { label: "Inactive", dot: "bg-zinc-500", border: "border-zinc-600/30", bg: "bg-zinc-500/5" },
};

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
  quote_sent: "text-blue-400",
  note: "text-yellow-400",
  job_created: "text-violet-400",
  call: "text-blue-400",
};

const gradients = [
  "from-violet-600/40 to-indigo-800/40",
  "from-emerald-600/40 to-teal-800/40",
  "from-amber-600/40 to-orange-800/40",
  "from-rose-600/40 to-pink-800/40",
  "from-blue-600/40 to-cyan-800/40",
  "from-fuchsia-600/40 to-purple-800/40",
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

/* ── Page Component ───────────────────────────────────────── */

export default function ClientDossierPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const { addToast } = useToastStore();
  const { orgId } = useOrg();

  // Try store first, fall back to mock data
  const storeClients = useClientsStore((s) => s.clients);
  const storeClient = storeClients.find((c) => c.id === clientId);
  const mockClient = mockClients.find((c) => c.id === clientId);

  // Server-fetched detail data (contacts, activity, spend)
  const [serverDetail, setServerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!clientId || detailLoading || serverDetail) return;
    setDetailLoading(true);
    getClientDetails(clientId).then(({ data }) => {
      if (data) setServerDetail(data);
      setDetailLoading(false);
    }).catch(() => setDetailLoading(false));
  }, [clientId, detailLoading, serverDetail]);

  // Merge: store client (list-level) + server detail (contacts/activity/spend)
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
          description: a.metadata?.description || a.action_type || "",
          date: a.created_at ? new Date(a.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" }) : "",
          user: a.user_name || "System",
        })) || storeClient.activity,
        spendHistory: serverDetail?.spend_history?.map((inv: any) => ({
          month: new Date(inv.created_at).toLocaleDateString("en-AU", { month: "short" }),
          amount: Number(inv.total || 0),
        })) || storeClient.spendHistory,
      }
    : mockClient;

  /* ── Editable state ─────────────────────────────────────── */
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localPhone, setLocalPhone] = useState("");
  const [localEmail, setLocalEmail] = useState("");
  const [localNotes, setLocalNotes] = useState("");
  const [savedField, setSavedField] = useState<string | null>(null);

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
      deleteClientAction(clientId);
      useClientsStore.getState().archiveClient(clientId);
      addToast(`${client.name} archived`);
      router.push("/dashboard/clients");
    }
  }

  /* ── Not found ──────────────────────────────────────────── */
  if (!client) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-lg font-medium text-zinc-300">Client not found</h2>
          <button
            onClick={() => router.push("/dashboard/clients")}
            className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  /* ── Computed ────────────────────────────────────────────── */
  const sc = statusConfig[client.status] || statusConfig.inactive;
  const spendData = client.spendHistory || [];
  const maxSpend = Math.max(...spendData.map((d) => d.amount), 1);
  const totalSpend = spendData.reduce((sum, d) => sum + d.amount, 0);
  const isHighLTV = (client.lifetimeValueNum || 0) >= 10000;

  /* ── SVG path for spend chart ───────────────────────────── */
  const chartW = 560;
  const chartH = 120;
  const padding = 4;

  const points = spendData.map((d, i) => ({
    x: padding + (i / Math.max(spendData.length - 1, 1)) * (chartW - padding * 2),
    y: chartH - padding - (d.amount / maxSpend) * (chartH - padding * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${chartH} L ${points[0]?.x || 0} ${chartH} Z`;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className="flex h-full flex-col"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.06)] bg-black/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push("/dashboard/clients")}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
            >
              <ArrowLeft size={12} />
              Clients
            </button>
            <ChevronRight size={12} className="text-zinc-700" />
            <span className="text-[12px] text-zinc-400">{client.name}</span>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(client.email);
                addToast("Email copied");
              }}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
              title="Email"
            >
              <Mail size={14} />
            </button>
            <button
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
              title="Call"
            >
              <Phone size={14} />
            </button>
            <button
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
              title="Message"
            >
              <MessageSquare size={14} />
            </button>
            <button
              onClick={(e) => setCtxMenu({ open: true, x: e.clientX, y: e.clientY })}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
            >
              <MoreHorizontal size={14} />
            </button>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => router.push("/dashboard/jobs")}
              className="ml-2 flex items-center gap-1.5 rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#6E7AE2]"
            >
              <Plus size={12} />
              Create Job
            </motion.button>
          </div>
        </div>

        {/* Identity row */}
        <div className="flex items-center gap-4 px-6 pb-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-[18px] font-bold text-zinc-200 ${getGradient(client.initials)}`}
          >
            {client.initials}
          </div>
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-zinc-100">
              {client.name}
            </h1>
            <div className="flex items-center gap-2">
              {/* Status pill */}
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] ${sc.border} ${sc.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
              {/* Badges */}
              {isHighLTV && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-400">
                  <Sparkles size={8} />
                  Premium
                </span>
              )}
              {client.type === "commercial" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-[10px] text-blue-400">
                  <Building2 size={8} />
                  Commercial
                </span>
              )}
              {client.since && (
                <span className="text-[10px] text-zinc-600">
                  Client since {client.since}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2-Column Body ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas (Left 65%) ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 pr-0">
          <div className="max-w-3xl">
            {/* ── Spend Pulse Graph ────────────────────────── */}
            <div className="mb-8 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                    Spend History
                  </h3>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[24px] font-semibold tracking-tight text-zinc-100">
                      ${totalSpend.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-zinc-600">last 12 months</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium text-zinc-300">
                    {client.lifetimeValue}
                  </div>
                  <div className="text-[10px] text-zinc-600">Lifetime</div>
                </div>
              </div>

              {/* SVG Chart */}
              <div className="relative">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
                  <defs>
                    <linearGradient id={`spend-grad-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <motion.path
                    d={areaPath}
                    fill={`url(#spend-grad-${client.id})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                  {/* Line */}
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                  {/* Data points */}
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
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.2 }}
                    />
                  ))}
                </svg>
                {/* Month labels */}
                <div className="mt-1 flex justify-between px-1">
                  {spendData.map((d) => (
                    <span key={d.month} className="text-[8px] text-zinc-700">
                      {d.month}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Activity Timeline ────────────────────────── */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                <Clock size={12} />
                Activity
              </h3>
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute top-2 bottom-2 left-[7px] w-px bg-[rgba(255,255,255,0.06)]" />

                <div className="space-y-4">
                  {(client.activity || []).map((entry, i) => {
                    const Icon = activityIcons[entry.type] || Briefcase;
                    const iconColor = activityColors[entry.type] || "text-zinc-500";
                    const isNote = entry.type === "note";
                    const isInvoice = entry.type === "invoice_paid" || entry.type === "invoice_sent";

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.25 }}
                        className="relative flex gap-3"
                      >
                        {/* Dot */}
                        <div className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]`}>
                          <Icon size={8} className={iconColor} />
                        </div>

                        <div
                          className={`flex-1 rounded-lg p-3 ${
                            isNote
                              ? "border border-yellow-500/10 bg-yellow-500/[0.03]"
                              : "border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.015)]"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="text-[12px] text-zinc-400">
                              {entry.text}
                            </div>
                            {isInvoice && entry.amount && (
                              <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
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
            </div>
          </div>
        </div>

        {/* ── HUD (Right 35%) ───────────────────────────────── */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-l border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
          <div className="p-5">
            {/* ── Quick Stats ────────────────────────────────── */}
            <div className="mb-6 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                <div className="mb-1 flex items-center gap-1 text-[9px] tracking-wider text-zinc-600 uppercase">
                  <Briefcase size={9} />
                  Jobs
                </div>
                <div className="text-[18px] font-semibold text-zinc-200">
                  {client.totalJobs}
                </div>
              </div>
              <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                <div className="mb-1 flex items-center gap-1 text-[9px] tracking-wider text-zinc-600 uppercase">
                  <DollarSign size={9} />
                  LTV
                </div>
                <div
                  className="text-[18px] font-semibold text-zinc-200"
                  style={
                    isHighLTV
                      ? {
                          background: "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)",
                          backgroundSize: "200% 100%",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          animation: "shimmer 3s infinite",
                        }
                      : undefined
                  }
                >
                  {client.lifetimeValue}
                </div>
              </div>
            </div>

            {/* ── Location Intel ──────────────────────────────── */}
            {client.address && (
              <div className="mb-6">
                <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                  Location
                </h4>
                <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]">
                  <div className="relative h-[140px] bg-[#0a0a0a]">
                    {/* Grid */}
                    <div className="absolute inset-0 opacity-[0.03]">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-white" style={{ top: `${i * 20}%` }} />
                      ))}
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={`v-${i}`} className="absolute top-0 bottom-0 border-l border-white" style={{ left: `${i * 12.5}%` }} />
                      ))}
                    </div>
                    {/* Pin */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        initial={{ y: -15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
                        className="relative"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5E6AD2] shadow-lg shadow-[#5E6AD2]/30">
                          <MapPin size={12} className="text-white" />
                        </div>
                        <motion.div
                          animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 rounded-full border border-[#5E6AD2]"
                        />
                      </motion.div>
                    </div>
                    <div className="absolute right-2 bottom-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur-sm">
                      15 mins from HQ
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[11px] text-zinc-500">
                    <MapPin size={10} className="text-zinc-600" />
                    {client.address}
                  </div>
                </div>
              </div>
            )}

            {/* ── Contact Grid ────────────────────────────────── */}
            <div className="mb-6">
              <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Contacts
              </h4>
              <div className="space-y-1">
                {(client.contacts || []).map((contact) => (
                  <div
                    key={contact.id}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-medium text-zinc-300 ${getGradient(contact.initials)}`}>
                      {contact.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-zinc-300">
                        {contact.name}
                      </div>
                      <div className="text-[10px] text-zinc-600">{contact.role}</div>
                    </div>
                    {/* Hover actions */}
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(contact.email);
                          addToast("Email copied");
                        }}
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
                        title="Copy email"
                      >
                        <Mail size={10} />
                      </button>
                      <button
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
                        title="Call"
                      >
                        <Phone size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Contact Details (Editable) ──────────────────── */}
            <div className="mb-6">
              <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Details
              </h4>
              <div className="space-y-1">
                {/* Email */}
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
                    updateClientAction(clientId, { email: localEmail });
                    addToast("Email updated");
                  }}
                />
                {/* Phone */}
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
                    updateClientAction(clientId, { phone: localPhone });
                    addToast("Phone updated");
                  }}
                />
                {/* Type */}
                <div className="flex items-center justify-between rounded-md px-3 py-2">
                  <span className="text-[11px] text-zinc-600">Type</span>
                  <div className="flex items-center gap-1.5">
                    {client.type === "commercial" ? <Building2 size={11} className="text-zinc-600" /> : <User size={11} className="text-zinc-600" />}
                    <span className="text-[12px] text-zinc-400">
                      {client.type ? client.type.charAt(0).toUpperCase() + client.type.slice(1) : "—"}
                    </span>
                  </div>
                </div>
                {/* Since */}
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
            <div>
              <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(client.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)]"
                  >
                    <Tag size={9} className="text-zinc-600" />
                    {tag}
                  </span>
                ))}
                <button className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[11px] text-zinc-600 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-400">
                  <Plus size={9} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
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
    <div className="relative flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.02)]">
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
            {value}
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
