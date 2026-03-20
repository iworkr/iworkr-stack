"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  getGoalMatrix,
  getGoalEvidenceFeed,
  updateGoalStatus,
  type GoalMatrixRow,
  type EvidenceFeedItem,
  type GoalTelemetry,
  type GoalDomain,
  type GoalStatus,
  type ProgressRating,
} from "@/app/actions/teleology";
import { useOrg } from "@/lib/hooks/use-org";
import { LetterAvatar } from "@/components/ui/letter-avatar";

// ── Helpers ──────────────────────────────────────────────
const DOMAIN_LABELS: Record<GoalDomain, string> = {
  DAILY_LIVING: "Daily Living",
  SOCIAL_COMMUNITY: "Social & Community",
  HEALTH_WELLBEING: "Health & Wellbeing",
  EMPLOYMENT: "Employment",
  LIFELONG_LEARNING: "Lifelong Learning",
  HOME_LIVING: "Home Living",
  CHOICE_CONTROL: "Choice & Control",
};

const DOMAIN_COLORS: Record<GoalDomain, string> = {
  DAILY_LIVING: "#10B981",
  SOCIAL_COMMUNITY: "#8B5CF6",
  HEALTH_WELLBEING: "#F59E0B",
  EMPLOYMENT: "#3B82F6",
  LIFELONG_LEARNING: "#EC4899",
  HOME_LIVING: "#14B8A6",
  CHOICE_CONTROL: "#F97316",
};

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Active", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  ACHIEVED: { label: "Achieved", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  STAGNANT: { label: "Stagnant", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  ARCHIVED: { label: "Archived", color: "#71717A", bg: "rgba(113,113,122,0.12)" },
};

const RATING_CONFIG: Record<ProgressRating, { label: string; color: string }> = {
  PROGRESSED: { label: "Progressed", color: "#10B981" },
  MAINTAINED: { label: "Maintained", color: "#71717A" },
  REGRESSED: { label: "Regressed", color: "#F43F5E" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Sparkline SVG ─────────────────────────────────────────
function Sparkline({ data }: { data: Array<{ ts: string; rating: number }> }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center w-24 h-8">
        <span className="text-[10px] text-zinc-600 font-mono">No data</span>
      </div>
    );
  }

  const W = 96;
  const H = 32;
  const PAD = 4;
  const pts = data.slice(-10);
  const xs = pts.map((_, i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2));
  const ys = pts.map((p) => H / 2 - (p.rating * (H / 2 - PAD)));

  const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");

  const lastRating = pts[pts.length - 1]?.rating ?? 0;
  const trend = pts.length >= 2 ? pts[pts.length - 1].rating - pts[0].rating : 0;
  const strokeColor = trend > 0 ? "#10B981" : trend < 0 ? "#F43F5E" : "#71717A";

  // Area fill path
  const areaD =
    pathD +
    ` L ${xs[xs.length - 1].toFixed(1)} ${H} L ${xs[0].toFixed(1)} ${H} Z`;

  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${strokeColor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${strokeColor.replace("#", "")})`} />
      <path d={pathD} stroke={strokeColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill={strokeColor} />
    </svg>
  );
}

// ── Telemetry Ribbon ──────────────────────────────────────
function TelemetryRibbon({ t }: { t: GoalTelemetry }) {
  const metrics = [
    { label: "Active Goals", value: t.active_goals, alert: false },
    { label: "Observations (30d)", value: t.observations_30d, alert: false },
    { label: "Stagnant Goals", value: t.stagnant_goals, alert: t.stagnant_goals > 0 },
    { label: "Upcoming Reviews", value: t.upcoming_reviews, alert: t.upcoming_reviews > 0 },
  ];

  return (
    <div className="h-16 bg-zinc-950/30 border-b border-white/5 flex items-center px-6 gap-8">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{m.label}</span>
          <span
            className={`font-mono text-xl font-bold leading-none ${
              m.alert && m.value > 0 ? "text-rose-500 animate-pulse" : "text-white"
            }`}
          >
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Evidence Slide-Over ───────────────────────────────────
function EvidenceSlideOver({
  goal,
  orgId,
  onClose,
}: {
  goal: GoalMatrixRow;
  orgId: string;
  onClose: () => void;
}) {
  const [feed, setFeed] = useState<EvidenceFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<ProgressRating | "ALL">("ALL");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await getGoalEvidenceFeed(goal.goal_id, orgId, 50, 0);
      setFeed(data ?? []);
      setLoading(false);
    })();
  }, [goal.goal_id, orgId]);

  const filtered = ratingFilter === "ALL" ? feed : feed.filter((f) => f.progress_rating === ratingFilter);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 w-[600px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="h-14 flex items-center px-5 border-b border-white/5 gap-3">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: DOMAIN_COLORS[goal.domain] ?? "#10B981" }}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{goal.title}</h2>
          <p className="text-[10px] text-zinc-500">
            {goal.participant_name} · {DOMAIN_LABELS[goal.domain]}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 bg-zinc-950/50">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Observations</span>
          <p className="font-mono text-lg text-white font-bold">{goal.observation_count}</p>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Last 30 Days</span>
          <p className="font-mono text-lg text-white font-bold">{goal.observations_30d}</p>
        </div>
        {goal.last_observation_at && (
          <>
            <div className="w-px h-8 bg-white/5" />
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Observed</span>
              <p className="text-xs text-zinc-300 mt-0.5">{formatDate(goal.last_observation_at)}</p>
            </div>
          </>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
        {(["ALL", "PROGRESSED", "MAINTAINED", "REGRESSED"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRatingFilter(r)}
            className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border transition-colors font-semibold ${
              ratingFilter === r
                ? "bg-white/10 border-white/20 text-white"
                : "border-white/5 text-zinc-500 hover:text-white hover:border-white/10"
            }`}
          >
            {r === "ALL" ? "All" : RATING_CONFIG[r].label}
          </button>
        ))}
      </div>

      {/* Evidence feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border border-zinc-700 border-t-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <BookOpen size={20} className="text-zinc-600" />
            <p className="text-xs text-zinc-500">No observations found</p>
          </div>
        ) : (
          filtered.map((item) => {
            const ratingCfg = RATING_CONFIG[item.progress_rating];
            return (
              <div key={item.linkage_id} className="flex gap-3 group">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <LetterAvatar name={item.worker_name} src={item.worker_avatar_url} size={32} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 bg-zinc-900/50 rounded-xl p-3 border border-white/5 group-hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-zinc-400">{item.worker_name}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[10px] font-mono text-zinc-500">{formatDateTime(item.created_at)}</span>
                    <span
                      className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ color: ratingCfg.color, backgroundColor: `${ratingCfg.color}18` }}
                    >
                      {ratingCfg.label}
                    </span>
                  </div>
                  {item.worker_observation ? (
                    <p className="text-xs text-white leading-relaxed">{item.worker_observation}</p>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">No specific note recorded.</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ── Goal Row ──────────────────────────────────────────────
function GoalRow({
  goal,
  onSelect,
  onStatusChange,
}: {
  goal: GoalMatrixRow;
  onSelect: (g: GoalMatrixRow) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
}) {
  const statusCfg = STATUS_CONFIG[goal.goal_status] ?? STATUS_CONFIG.ACTIVE;
  const domainColor = DOMAIN_COLORS[goal.domain] ?? "#10B981";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      className={`group h-20 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer flex items-center px-6 gap-4 ${
        goal.is_stagnant ? "border-l-2 border-l-amber-500/40" : ""
      }`}
      onClick={() => onSelect(goal)}
    >
      {/* Domain dot */}
      <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: domainColor }} />

      {/* Participant + title */}
      <div className="w-[220px] min-w-0">
        <p className="text-[11px] text-zinc-500 truncate">{goal.participant_name}</p>
        <p className="text-[13px] font-semibold text-white truncate">{goal.title}</p>
      </div>

      {/* Domain */}
      <div className="w-[130px] hidden md:block">
        <span
          className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
          style={{ color: domainColor, backgroundColor: `${domainColor}18` }}
        >
          {DOMAIN_LABELS[goal.domain]}
        </span>
      </div>

      {/* Timeline */}
      <div className="w-[100px] hidden lg:block">
        {goal.end_date ? (
          <div>
            <p className="text-[10px] text-zinc-600">Ends</p>
            <p className="text-[11px] font-mono text-zinc-300">{formatDate(goal.end_date)}</p>
          </div>
        ) : (
          <span className="text-[10px] text-zinc-600">—</span>
        )}
      </div>

      {/* Observations */}
      <div className="w-[80px] text-center">
        <p className="font-mono text-sm text-zinc-300">{goal.observation_count}</p>
        <p className="text-[10px] text-zinc-600">{goal.observations_30d} (30d)</p>
      </div>

      {/* Trajectory sparkline */}
      <div className="w-[100px] hidden xl:flex items-center">
        <Sparkline data={goal.trajectory} />
      </div>

      {/* Status */}
      <div className="w-[90px]">
        {goal.is_stagnant && goal.goal_status === "ACTIVE" ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/12 uppercase tracking-wider">
            Stagnant
          </span>
        ) : (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
          >
            {statusCfg.label}
          </span>
        )}
      </div>

      {/* Action */}
      <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {goal.is_stagnant && (
          <button
            onClick={() => onStatusChange(goal.goal_id, "STAGNANT")}
            className="text-[10px] px-2.5 py-1 rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors font-medium"
          >
            Flag
          </button>
        )}
        {goal.goal_status === "ACTIVE" && (
          <button
            onClick={() => onStatusChange(goal.goal_id, "ACHIEVED")}
            className="text-[10px] px-2.5 py-1 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium"
          >
            Mark Achieved
          </button>
        )}
        <button
          onClick={() => onSelect(goal)}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── PDF Report Modal ──────────────────────────────────────
function PdfReportModal({
  orgId,
  participantId,
  participantName,
  onClose,
}: {
  orgId: string;
  participantId: string;
  participantName: string;
  onClose: () => void;
}) {
  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-plan-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            organization_id: orgId,
            participant_id: participantId,
            from_date: fromDate,
            to_date: toDate,
          }),
        }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Generation failed");

      // Trigger client-side PDF generation
      const { renderPlanReport } = await import("@/components/clinical/plan-report-renderer");
      await renderPlanReport(json.data, participantName);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="w-[480px] bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <FileText size={18} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-white">Generate Evidence Report</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Synthesizes all goal observations for {participantName} into an NDIS-ready PDF.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-black border-t-transparent" />
                Generating…
              </>
            ) : (
              <>
                <FileText size={14} />
                Generate PDF
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
type GoalMatrixData = {
  telemetry: GoalTelemetry;
  goals: GoalMatrixRow[];
};

export default function GoalMatrixPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"active" | "expiring" | "achieved">("active");
  const [selectedGoal, setSelectedGoal] = useState<GoalMatrixRow | null>(null);
  const [pdfTarget, setPdfTarget] = useState<GoalMatrixRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: matrixData, isLoading: loading, error: queryError } = useQuery<GoalMatrixData, Error>({
    queryKey: queryKeys.clinical.goals(orgId ?? ""),
    queryFn: async () => {
      const { data, error: err } = await getGoalMatrix(orgId!);
      if (err) throw new Error(err);
      return {
        telemetry: data!.telemetry,
        goals: data!.goals,
      };
    },
    enabled: !!orgId,
  });

  const telemetry: GoalTelemetry = matrixData?.telemetry ?? {
    active_goals: 0,
    observations_30d: 0,
    stagnant_goals: 0,
    upcoming_reviews: 0,
  };
  const goals = matrixData?.goals ?? [];
  const error = queryError?.message ?? null;

  const fetchData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clinical.goals(orgId ?? "") });
  }, [orgId, queryClient]);

  const filteredGoals = goals.filter((g) => {
    const matchesSearch =
      !searchQuery ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.participant_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "active"
        ? g.goal_status === "ACTIVE" || g.goal_status === "STAGNANT"
        : activeTab === "expiring"
        ? g.end_date != null &&
          new Date(g.end_date) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) &&
          g.goal_status === "ACTIVE"
        : g.goal_status === "ACHIEVED";

    return matchesSearch && matchesTab;
  });

  async function handleStatusChange(goalId: string, status: GoalStatus) {
    if (!orgId) return;
    startTransition(async () => {
      await updateGoalStatus(orgId, goalId, status);
      fetchData();
    });
  }

  const tabCounts = {
    active: goals.filter((g) => g.goal_status === "ACTIVE" || g.goal_status === "STAGNANT").length,
    expiring: goals.filter(
      (g) =>
        g.end_date != null &&
        new Date(g.end_date) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) &&
        g.goal_status === "ACTIVE"
    ).length,
    achieved: goals.filter((g) => g.goal_status === "ACHIEVED").length,
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      {/* Command Header */}
      <div className="h-14 border-b border-white/5 flex items-center px-6 gap-4 flex-shrink-0">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>CLINICAL</span>
          <ChevronRight size={12} />
          <span className="text-zinc-300">GOAL MATRIX</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-4">
          {(
            [
              { key: "active", label: "Active Plans" },
              { key: "expiring", label: "Expiring Plans" },
              { key: "achieved", label: "Achieved" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] font-mono px-1 rounded ${
                  activeTab === tab.key ? "text-emerald-400" : "text-zinc-600"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            placeholder="Search goals, participants…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 bg-zinc-900/60 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/20"
          />
          <button
            onClick={fetchData}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Telemetry Ribbon */}
      <TelemetryRibbon t={telemetry} />

      {/* Grid Header */}
      <div className="h-9 border-b border-white/5 flex items-center px-6 gap-4 flex-shrink-0">
        <div className="w-2" />
        <div className="w-[220px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Participant / Goal</div>
        <div className="w-[130px] hidden md:block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Domain</div>
        <div className="w-[100px] hidden lg:block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Timeline</div>
        <div className="w-[80px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Observations</div>
        <div className="w-[100px] hidden xl:block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Trajectory</div>
        <div className="w-[90px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Status</div>
        <div className="ml-auto text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Action</div>
      </div>

      {/* Goals List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border border-zinc-700 border-t-emerald-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <AlertTriangle size={20} className="text-rose-500" />
            <p className="text-xs text-zinc-400">{error}</p>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Activity size={20} className="text-zinc-600" />
            <p className="text-xs text-zinc-500">No goals found for this view.</p>
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <GoalRow
              key={goal.goal_id}
              goal={goal}
              onSelect={setSelectedGoal}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {/* Evidence Slide-Over */}
      <AnimatePresence>
        {selectedGoal && orgId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setSelectedGoal(null)}
            />
            <EvidenceSlideOver
              goal={selectedGoal}
              orgId={orgId}
              onClose={() => setSelectedGoal(null)}
            />
            {/* Generate report button in slide-over context */}
            <div className="fixed bottom-8 right-[616px] z-50">
              <button
                onClick={() => setPdfTarget(selectedGoal)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-black text-xs font-semibold rounded-xl hover:bg-zinc-200 shadow-2xl transition-colors"
              >
                <FileText size={14} />
                Generate Evidence Report
              </button>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* PDF Modal */}
      <AnimatePresence>
        {pdfTarget && orgId && (
          <PdfReportModal
            orgId={orgId}
            participantId={pdfTarget.participant_id}
            participantName={pdfTarget.participant_name}
            onClose={() => setPdfTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
