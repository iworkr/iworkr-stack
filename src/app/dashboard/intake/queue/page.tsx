"use client";

/**
 * @page Lead Queue
 * @route /dashboard/intake/queue
 * @description Project Gateway-Intake: Lead triage command center.
 *   Dispatchers see structured lead cards with urgency, territory, CRM link,
 *   and one-click conversion to jobs/participants.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";
import {
  fetchLeads,
  fetchLeadStats,
  updateLeadStatus,
  convertLeadToJob,
  type Lead,
  type LeadStats,
} from "@/app/actions/gateway-intake";
import {
  Zap,
  Phone,
  Mail,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  User,
  Briefcase,
  ChevronRight,
  Inbox,
  ArrowUpRight,
  Shield,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

/* ── Urgency Badge ────────────────────────────────────── */

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { bg: string; text: string; pulse?: boolean }> = {
    LOW: { bg: "bg-neutral-700/50", text: "text-neutral-400" },
    STANDARD: { bg: "bg-blue-500/10", text: "text-blue-400" },
    URGENT: { bg: "bg-amber-500/10", text: "text-amber-400" },
    EMERGENCY: { bg: "bg-red-500/10", text: "text-red-400", pulse: true },
  };
  const c = config[urgency] || config.STANDARD;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {urgency === "EMERGENCY" && <Zap className="w-3 h-3" />}
      {c.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
      {urgency}
    </span>
  );
}

/* ── Status Badge ─────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    NEW: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: <Inbox className="w-3 h-3" /> },
    VIEWED: { bg: "bg-blue-500/10", text: "text-blue-400", icon: <Eye className="w-3 h-3" /> },
    CONTACTED: { bg: "bg-amber-500/10", text: "text-amber-400", icon: <MessageSquare className="w-3 h-3" /> },
    CONVERTED: { bg: "bg-emerald-500/10", text: "text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> },
    JUNK: { bg: "bg-neutral-700/50", text: "text-neutral-500", icon: <XCircle className="w-3 h-3" /> },
  };
  const c = config[status] || config.NEW;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon} {status}
    </span>
  );
}

/* ── Stats Bar ────────────────────────────────────────── */

function StatsBar({ stats }: { stats: LeadStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "New Leads", value: stats.new_count, icon: Inbox, color: "text-emerald-400" },
        { label: "Today", value: stats.today, icon: TrendingUp, color: "text-blue-400" },
        { label: "Emergency", value: stats.emergency, icon: Zap, color: "text-red-400" },
        { label: "Converted", value: stats.converted, icon: CheckCircle2, color: "text-emerald-300" },
      ].map((card) => (
        <div key={card.label} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 uppercase tracking-wider">{card.label}</span>
            <card.icon className={`w-4 h-4 ${card.color}`} />
          </div>
          <p className="text-2xl font-semibold text-neutral-100 mt-1 tabular-nums">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Lead Card ────────────────────────────────────────── */

function LeadCard({
  lead,
  onStatusChange,
  onConvert,
}: {
  lead: Lead;
  onStatusChange: (id: string, status: string) => void;
  onConvert: (id: string) => void;
}) {
  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-neutral-900/50 p-4 transition-colors ${
        lead.urgency === "EMERGENCY" ? "border-red-500/30" : "border-neutral-800 hover:border-neutral-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-neutral-200">
              {lead.first_name} {lead.last_name}
            </h3>
            <UrgencyBadge urgency={lead.urgency} />
            <StatusBadge status={lead.status} />
            {lead.client_id && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <User className="w-3 h-3" /> Returning
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            {lead.phone && (
              <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> {lead.phone}
              </p>
            )}
            {lead.email && (
              <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> {lead.email}
              </p>
            )}
            {lead.address_string && (
              <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {lead.address_string}
              </p>
            )}
            {lead.territory_name && (
              <p className="text-xs text-blue-400 flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> {lead.territory_name}
              </p>
            )}
          </div>

          {typeof (lead.captured_data as Record<string, unknown>)?.details === "string" ? (
            <p className="mt-2 text-xs text-neutral-500 line-clamp-2">
              {(lead.captured_data as Record<string, string>).details}
            </p>
          ) : null}
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-xs text-neutral-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeSince(lead.created_at)}
          </span>
          {lead.widget_name && (
            <p className="text-[10px] text-neutral-600 mt-0.5">{lead.widget_name}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {lead.status !== "CONVERTED" && lead.status !== "JUNK" && (
        <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-2 flex-wrap">
          {lead.status === "NEW" && (
            <button
              onClick={() => onStatusChange(lead.id, "VIEWED")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors"
            >
              <Eye className="w-3 h-3" /> Mark Viewed
            </button>
          )}
          {(lead.status === "NEW" || lead.status === "VIEWED") && (
            <button
              onClick={() => onStatusChange(lead.id, "CONTACTED")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors"
            >
              <Phone className="w-3 h-3" /> Contacted
            </button>
          )}
          <button
            onClick={() => onConvert(lead.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
          >
            <Briefcase className="w-3 h-3" /> Convert to Job
          </button>
          <button
            onClick={() => onStatusChange(lead.id, "JUNK")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-500 text-xs hover:bg-neutral-700 transition-colors ml-auto"
          >
            <XCircle className="w-3 h-3" /> Junk
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function LeadQueuePage() {
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    total: 0, new_count: 0, viewed: 0, contacted: 0, converted: 0, junk: 0, emergency: 0, today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("NEW");

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const [leadsResult, statsResult] = await Promise.all([
      fetchLeads(orgId, { status: statusFilter }),
      fetchLeadStats(orgId),
    ]);
    setLeads(leadsResult.data);
    setStats(statsResult);
    setLoading(false);
  }, [orgId, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`leads-queue-${orgId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "leads",
        filter: `organization_id=eq.${orgId}`,
      }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, loadData]);

  const handleStatusChange = useCallback(async (leadId: string, status: string) => {
    await updateLeadStatus(leadId, status);
    loadData();
  }, [loadData]);

  const handleConvert = useCallback(async (leadId: string) => {
    if (!orgId) return;
    const result = await convertLeadToJob(leadId, orgId);
    if (result.success) loadData();
  }, [orgId, loadData]);

  if (!orgId) {
    return <div className="flex items-center justify-center h-64"><p className="text-neutral-500">Select an organization</p></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            Lead Queue
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">Inbound leads from your embedded widgets</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-400 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard/settings/intake" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-sm transition-colors">
            Widget Settings <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <StatsBar stats={stats} />

      <div className="flex items-center gap-1 border-b border-neutral-800">
        {[
          { value: "NEW", label: `New (${stats.new_count})` },
          { value: "all", label: "All" },
          { value: "VIEWED", label: "Viewed" },
          { value: "CONTACTED", label: "Contacted" },
          { value: "CONVERTED", label: "Converted" },
          { value: "JUNK", label: "Junk" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              statusFilter === tab.value ? "text-emerald-400 border-emerald-400" : "text-neutral-500 border-transparent hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-neutral-800 bg-neutral-900/30">
            <Inbox className="w-10 h-10 text-neutral-700 mb-3" />
            <p className="text-sm text-neutral-500">No leads in this queue</p>
            <p className="text-xs text-neutral-600 mt-1">Leads from your embedded widgets will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onStatusChange={handleStatusChange} onConvert={handleConvert} />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
