/**
 * @page /portal/c/[slug]
 * @status COMPLETE
 * @description Universal portal dashboard — shows grants, recent activity, and quick actions
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Receipt, Package, CalendarDays, PieChart, ArrowRight, Shield } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalInvoices, getPortalQuotes, type PortalInvoice, type PortalQuote } from "@/app/actions/portal-client";

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const tenant = usePortalStore((s) => s.activeTenant);
  const portalUser = usePortalStore((s) => s.portalUser);
  const grantedEntities = usePortalStore((s) => s.grantedEntities);
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const [recentInvoices, setRecentInvoices] = useState<PortalInvoice[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<PortalQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const isCare = tenant?.trade === "care" || tenant?.trade === "ndis" || tenant?.trade === "disability";
  const basePrefix = `/portal/c/${slug}`;
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!tenant?.workspace_id) return;
    setLoading(true);
    Promise.all([
      getPortalInvoices(tenant.workspace_id, activeEntityId || undefined),
      getPortalQuotes(tenant.workspace_id, activeEntityId || undefined),
    ]).then(([inv, qt]) => {
      setRecentInvoices(inv.invoices.slice(0, 3));
      setRecentQuotes(qt.quotes.slice(0, 3));
      setLoading(false);
    });
  }, [tenant?.workspace_id, activeEntityId]);

  const stats = {
    outstandingInvoices: recentInvoices.filter((i) => ["sent", "overdue"].includes(i.status)).length,
    totalOwed: recentInvoices
      .filter((i) => ["sent", "overdue"].includes(i.status))
      .reduce((sum, i) => sum + Number(i.total), 0),
    pendingQuotes: recentQuotes.filter((q) => ["sent", "viewed"].includes(q.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.06] p-6"
        style={{ backgroundColor: `${brandColor}08` }}
      >
        <h1 className="text-xl font-semibold text-zinc-100">
          {tenant?.welcome_text || `Welcome${portalUser ? `, ${portalUser.full_name.split(" ")[0]}` : ""}`}
        </h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          {isCare
            ? "View your care roster, budget, and documents in one place."
            : "Manage your quotes, invoices, and service history."}
        </p>
      </motion.div>

      {/* Stats Grid */}
      {!isCare && (
        <div className="grid gap-4 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5"
          >
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <Receipt size={12} /> Outstanding
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: brandColor }}>
              ${fmtMoney(stats.totalOwed)}
            </p>
            <p className="text-[11px] text-zinc-600">{stats.outstandingInvoices} invoice{stats.outstandingInvoices !== 1 ? "s" : ""}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5"
          >
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <FileText size={12} /> Pending Quotes
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{stats.pendingQuotes}</p>
            <p className="text-[11px] text-zinc-600">Awaiting your approval</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5"
          >
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <Shield size={12} /> Your Accounts
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{grantedEntities.length}</p>
            <p className="text-[11px] text-zinc-600">Active portal access grants</p>
          </motion.div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {!isCare && (
          <>
            <QuickActionCard
              href={`${basePrefix}/invoices`}
              icon={Receipt}
              title="Invoices"
              desc="View and pay outstanding invoices"
              brandColor={brandColor}
            />
            <QuickActionCard
              href={`${basePrefix}/quotes`}
              icon={FileText}
              title="Quotes"
              desc="Review and approve pending quotes"
              brandColor={brandColor}
            />
            <QuickActionCard
              href={`${basePrefix}/assets`}
              icon={Package}
              title="Assets"
              desc="View maintenance history and certificates"
              brandColor={brandColor}
            />
          </>
        )}
        {isCare && (
          <>
            <QuickActionCard
              href={`${basePrefix}/care/roster`}
              icon={CalendarDays}
              title="Roster"
              desc="See upcoming and past visits"
              brandColor={brandColor}
            />
            <QuickActionCard
              href={`${basePrefix}/care/budget`}
              icon={PieChart}
              title="Budget"
              desc="Track NDIS plan utilisation"
              brandColor={brandColor}
            />
            <QuickActionCard
              href={`${basePrefix}/care/shifts`}
              icon={FileText}
              title="Shift Sign-Off"
              desc="Approve completed shifts"
              brandColor={brandColor}
            />
            <QuickActionCard
              href={`${basePrefix}/care/documents`}
              icon={Package}
              title="Documents"
              desc="View service agreements and assessments"
              brandColor={brandColor}
            />
          </>
        )}
      </div>

      {/* Recent Activity */}
      {!isCare && !loading && recentInvoices.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-zinc-300">Recent Invoices</h2>
            <Link
              href={`${basePrefix}/invoices`}
              className="flex items-center gap-1 text-[11px] hover:text-zinc-300"
              style={{ color: brandColor }}
            >
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-zinc-950/50 px-4 py-3">
                <div>
                  <p className="text-[13px] text-zinc-200">{inv.display_id} — {inv.client_name || "Invoice"}</p>
                  <p className="text-[11px] text-zinc-600">Due {fmtDate(inv.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium tabular-nums" style={{ color: brandColor }}>
                    ${fmtMoney(Number(inv.total))}
                  </p>
                  <StatusPill status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickActionCard({
  href,
  icon: Icon,
  title,
  desc,
  brandColor,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  desc: string;
  brandColor: string;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 transition hover:border-white/[0.12]"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-zinc-200 group-hover:text-white">{title}</p>
          <p className="text-[12px] text-zinc-500">{desc}</p>
        </div>
        <ArrowRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition" />
      </motion.div>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-400",
    sent: "bg-sky-500/10 text-sky-400",
    overdue: "bg-red-500/10 text-red-400",
    draft: "bg-zinc-500/10 text-zinc-400",
    viewed: "bg-amber-500/10 text-amber-400",
    voided: "bg-zinc-500/10 text-zinc-500",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}
