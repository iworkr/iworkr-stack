"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Rocket,
  GitBranch,
  DollarSign,
  Shield,
  Smartphone,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  MessageSquare,
  ArrowUp,
  BookOpen,
  Send,
  Cpu,
  X,
  AlertCircle,
  Zap,
  Plus,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  getHelpArticles,
  getHelpThreads,
  searchArticles,
  aiSearch,
  createThread,
  createTicket,
  type HelpArticle,
  type HelpThread,
} from "@/app/actions/help";

/* ── Motion variants ──────────────────────────────────── */

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

/* ── Category config ──────────────────────────────────── */

const categories = [
  { id: "getting-started", label: "Getting Started", icon: Rocket, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]" },
  { id: "workflow", label: "Workflow & Jobs", icon: GitBranch, color: "text-amber-400", bg: "bg-amber-500/8" },
  { id: "billing", label: "Billing & Finance", icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/8" },
  { id: "team", label: "Team & RBAC", icon: Shield, color: "text-violet-400", bg: "bg-violet-500/8" },
  { id: "mobile", label: "Mobile App", icon: Smartphone, color: "text-zinc-400", bg: "bg-zinc-500/8" },
];

/* ── FAQ data ─────────────────────────────────────────── */

const faqs = [
  { q: "Is there a free trial?", a: "Yes! iWorkr offers a 14-day free trial with full access to all features. No credit card required." },
  { q: "Can I import my existing data?", a: "Absolutely. Navigate to Settings > Import to upload CSVs for jobs, clients, and assets. We also support direct migration from ServiceM8, Tradify, and Fergus." },
  { q: "How is my data secured?", a: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We use Supabase Row-Level Security to ensure complete data isolation between organizations." },
  { q: "Does iWorkr work offline?", a: "Yes. Critical data is cached locally so technicians can view schedules and update job statuses even without connectivity. Changes sync automatically when back online." },
  { q: "Can I customize the permissions for each role?", a: "Yes. Navigate to Team > Roles to access the Permissions Matrix. Each module (Jobs, Finance, Team, etc.) has granular toggles for View, Create, Edit, Delete, and Manage actions." },
];

/* ── Animated Icon Wrapper ─────────────────────────────── */

function AnimatedIcon({ icon: Icon, color, bg }: { icon: typeof Rocket; color: string; bg: string }) {
  return (
    <motion.div
      whileHover={{ rotate: [0, -8, 8, 0], scale: 1.1 }}
      transition={{ duration: 0.4 }}
      className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} transition-colors`}
    >
      <Icon size={22} className={color} />
    </motion.div>
  );
}

/* ── Thinking Animation ───────────────────────────────── */

function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-3 py-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Cpu size={18} className="text-[#00E676]" />
      </motion.div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="h-1.5 w-1.5 rounded-full bg-[#00E676]"
          />
        ))}
      </div>
      <span className="text-[12px] text-zinc-500">Searching knowledge base...</span>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

export default function HelpHubPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [threads, setThreads] = useState<HelpThread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; sources: { title: string; slug: string }[] } | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [ticketDrawer, setTicketDrawer] = useState(false);
  const [threadModal, setThreadModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Load data ──────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const [articlesRes, threadsRes] = await Promise.all([
        getHelpArticles(),
        getHelpThreads(),
      ]);
      if (articlesRes.data) setArticles(articlesRes.data);
      if (threadsRes.data) setThreads(threadsRes.data);
    })();
  }, []);

  /* ── Group articles by category ─────────────────────── */
  const grouped = useMemo(() => {
    const g: Record<string, HelpArticle[]> = {};
    articles.forEach((a) => {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    });
    return g;
  }, [articles]);

  /* ── Real-time search ───────────────────────────────── */
  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setAiAnswer(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await searchArticles(val);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
  }, []);

  /* ── AI Search (Enter) ──────────────────────────────── */
  const handleAiSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setAiThinking(true);
    setSearchResults([]);
    const result = await aiSearch(searchQuery);
    setAiAnswer(result);
    setAiThinking(false);
  }, [searchQuery]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      {/* ── Hero: AI Command Center ──────────────────── */}
      <motion.div variants={fadeUp} className="mb-16 pt-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-4xl font-medium tracking-tight text-[#EDEDED] md:text-5xl">
            Help Hub
          </h1>
          <p className="mt-3 text-[15px] text-zinc-500">
            Ask anything. Find answers instantly.
          </p>
        </motion.div>

        {/* AI Search Bar */}
        <div className="relative mx-auto mt-8 max-w-2xl">
          <div className="relative">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAiSearch(); }}
              placeholder="How do I create a recurring job?"
              className="h-14 w-full rounded-2xl border border-white/10 bg-zinc-900/50 pl-12 pr-24 text-[15px] text-zinc-200 placeholder-zinc-600 outline-none backdrop-blur-sm transition-all focus:border-[#00E676]/40 focus:shadow-[0_0_30px_-8px_rgba(0,230,118,0.15)]"
            />
            <button
              onClick={handleAiSearch}
              disabled={aiThinking || !searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[#00E676] px-4 py-2 text-[12px] font-medium text-black transition-all hover:bg-[#00C853] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiThinking ? "Thinking..." : "Ask AI"}
            </button>
          </div>

          {/* Real-time search dropdown */}
          <AnimatePresence>
            {searchResults.length > 0 && !aiAnswer && !aiThinking && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
              >
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedArticle(r); setSearchResults([]); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <BookOpen size={14} className="shrink-0 text-[#00E676]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-200">{r.title}</p>
                      <p className="truncate text-[11px] text-zinc-600">{r.summary}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Thinking / Answer */}
        <AnimatePresence>
          {aiThinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-6 max-w-2xl"
            >
              <ThinkingAnimation />
            </motion.div>
          )}
          {aiAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-6 max-w-2xl text-left"
            >
              <div className="rounded-2xl border border-[#00E676]/15 bg-[rgba(0,230,118,0.03)] p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Cpu size={14} className="text-[#00E676]" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#00E676]">AI Answer</span>
                </div>
                <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-zinc-300">
                  {aiAnswer.answer}
                </div>
                {aiAnswer.sources.length > 0 && (
                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {aiAnswer.sources.map((s) => (
                        <button
                          key={s.slug}
                          onClick={() => {
                            const a = articles.find((art) => art.slug === s.slug);
                            if (a) setSelectedArticle(a);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-[#00E676]/20 hover:text-zinc-200"
                        >
                          <FileText size={10} /> {s.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Knowledge Grid (Bento Box) ───────────────── */}
      <motion.div variants={fadeUp} className="mb-16">
        <h2 className="mb-6 text-[13px] font-medium uppercase tracking-wider text-zinc-600">
          Knowledge Base
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const count = grouped[cat.id]?.length || 0;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
                onClick={() => {
                  const first = grouped[cat.id]?.[0];
                  if (first) setSelectedArticle(first);
                }}
                className="group cursor-pointer rounded-xl border border-white/5 bg-zinc-950 p-6 text-left transition-all hover:border-[#00E676]/20"
              >
                <AnimatedIcon icon={cat.icon} color={cat.color} bg={cat.bg} />
                <h3 className="mt-4 text-[14px] font-medium text-white">{cat.label}</h3>
                <p className="mt-1 text-[12px] text-zinc-600">{count} Article{count !== 1 ? "s" : ""}</p>
              </motion.button>
            );
          })}
          {/* Support card */}
          <motion.button
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
            onClick={() => setTicketDrawer(true)}
            className="group cursor-pointer rounded-xl border border-white/5 bg-zinc-950 p-6 text-left transition-all hover:border-[#00E676]/20"
          >
            <AnimatedIcon icon={MessageSquare} color="text-red-400" bg="bg-red-500/8" />
            <h3 className="mt-4 text-[14px] font-medium text-white">Contact Support</h3>
            <p className="mt-1 text-[12px] text-zinc-600">Submit a ticket</p>
          </motion.button>
        </div>
      </motion.div>

      {/* ── Community Threads ─────────────────────────── */}
      <motion.div variants={fadeUp} className="mb-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-wider text-zinc-600">
            Community Threads
          </h2>
          <button
            onClick={() => setThreadModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#00E676] px-3 py-1.5 text-[11px] font-medium text-black transition-all hover:bg-[#00C853]"
          >
            <Plus size={12} />
            Ask the Community
          </button>
        </div>

        <div className="space-y-2">
          {threads.map((thread, i) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="group flex items-start gap-4 rounded-xl border border-white/5 bg-zinc-950 p-4 transition-all hover:border-white/[0.08] hover:bg-white/[0.02]"
            >
              {/* Upvote */}
              <div className="flex flex-col items-center gap-0.5 pt-0.5">
                <button className="text-zinc-600 transition-colors hover:text-[#00E676]">
                  <ArrowUp size={14} />
                </button>
                <span className="text-[11px] font-medium text-zinc-500">{thread.upvotes}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[13px] font-medium text-zinc-200">
                    {thread.title}
                  </h3>
                  {thread.is_solved && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[rgba(0,230,118,0.08)] px-2 py-0.5 text-[9px] font-medium text-[#00E676]">
                      <CheckCircle size={8} /> Solved
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-600">
                  {thread.content}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-700">
                  <span>{thread.reply_count} replies</span>
                  <span className="capitalize">{thread.category}</span>
                </div>
              </div>
            </motion.div>
          ))}
          {threads.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <MessageSquare size={24} className="mb-2 text-zinc-800" />
              <p className="text-[12px] text-zinc-600">No community threads yet.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── FAQ Accordion ─────────────────────────────── */}
      <motion.div variants={fadeUp} className="mb-16">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wider text-zinc-600">
          Frequently Asked Questions
        </h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-white/5 bg-zinc-950 transition-colors hover:border-white/[0.08]"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-[13px] font-medium text-zinc-200">{faq.q}</span>
                <motion.div
                  animate={{ rotate: expandedFaq === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={14} className="text-zinc-600" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.04] px-5 pb-4 pt-3">
                      <p className="text-[13px] leading-relaxed text-zinc-500">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── "Still Stuck?" CTA ────────────────────────── */}
      <motion.div variants={fadeUp} className="mb-12 text-center">
        <p className="text-[13px] text-zinc-600">Still stuck?</p>
        <button
          onClick={() => setTicketDrawer(true)}
          className="mt-2 text-[13px] text-white underline underline-offset-4 transition-colors hover:text-[#00E676]"
        >
          Contact Human Support
        </button>
      </motion.div>

      {/* ── Article Viewer (Slide-over) ───────────────── */}
      <AnimatePresence>
        {selectedArticle && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.06] bg-[#0a0a0a]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a]/90 px-6 py-4 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-[#00E676]" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{selectedArticle.category}</span>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-8">
                <h1 className="text-2xl font-medium tracking-tight text-[#EDEDED]">{selectedArticle.title}</h1>
                {selectedArticle.summary && (
                  <p className="mt-2 text-[14px] text-zinc-500">{selectedArticle.summary}</p>
                )}
                <div className="prose-invert mt-8 max-w-none text-[14px] leading-relaxed text-zinc-400">
                  {selectedArticle.content.split("\n").map((line, i) => {
                    if (line.startsWith("# ")) return <h1 key={i} className="mb-4 mt-8 text-xl font-medium text-[#EDEDED]">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={i} className="mb-3 mt-6 text-lg font-medium text-zinc-200">{line.slice(3)}</h2>;
                    if (line.startsWith("- **")) {
                      const match = line.match(/- \*\*(.+?)\*\*:?\s*(.*)/);
                      if (match) return <p key={i} className="mb-1.5 ml-4"><strong className="text-zinc-200">{match[1]}:</strong> {match[2]}</p>;
                    }
                    if (line.startsWith("- ")) return <p key={i} className="mb-1 ml-4 before:mr-2 before:content-['•'] before:text-[#00E676]">{line.slice(2)}</p>;
                    if (line.match(/^\d+\./)) return <p key={i} className="mb-1.5 ml-4">{line}</p>;
                    if (line.trim() === "") return <br key={i} />;
                    return <p key={i} className="mb-2">{line}</p>;
                  })}
                </div>

                {/* Related articles */}
                {grouped[selectedArticle.category] && grouped[selectedArticle.category].length > 1 && (
                  <div className="mt-10 border-t border-white/[0.06] pt-6">
                    <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Related Articles</p>
                    <div className="space-y-1">
                      {grouped[selectedArticle.category]
                        .filter((a) => a.id !== selectedArticle.id)
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelectedArticle(a)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
                          >
                            <ExternalLink size={10} className="text-[#00E676]" />
                            {a.title}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Ticket Drawer ─────────────────────────────── */}
      <AnimatePresence>
        {ticketDrawer && <TicketDrawer onClose={() => setTicketDrawer(false)} />}
      </AnimatePresence>

      {/* ── New Thread Modal ──────────────────────────── */}
      <AnimatePresence>
        {threadModal && <NewThreadModal onClose={() => setThreadModal(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Ticket Drawer Component ──────────────────────────── */

function TicketDrawer({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [severity, setSeverity] = useState("low");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    const result = await createTicket({ subject, severity, message });
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setSending(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.06] bg-[#0a0a0a]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-[14px] font-medium text-zinc-200">Submit a Ticket</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00E676] shadow-[0_0_20px_-6px_rgba(0,230,118,0.15)]"
                >
                  <Send size={20} className="text-black" />
                </motion.div>
                <h3 className="text-[15px] font-medium text-zinc-200">Ticket Submitted</h3>
                <p className="mt-2 text-[12px] text-zinc-600">
                  We&apos;ll get back to you within 24 hours.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 text-[12px] text-zinc-500 transition-colors hover:text-white"
                >
                  Close
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none transition-all focus:border-[#00E676]/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Severity</label>
                  <div className="grid grid-cols-4 gap-2">
                    {["low", "medium", "high", "critical"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(s)}
                        className={`rounded-lg border py-2 text-[11px] font-medium capitalize transition-all ${
                          severity === s
                            ? s === "critical"
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : s === "high"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : "border-[#00E676]/30 bg-[rgba(0,230,118,0.05)] text-[#00E676]"
                            : "border-white/[0.06] text-zinc-600 hover:border-white/[0.1]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Message</label>
                  <textarea
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none transition-all focus:border-[#00E676]/30"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-[12px] text-red-400">
                    <AlertCircle size={12} /> {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00E676] py-2.5 text-[13px] font-medium text-black transition-all hover:bg-[#00C853] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                  {sending ? "Submitting..." : "Submit Ticket"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

/* ── New Thread Modal ─────────────────────────────────── */

function NewThreadModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSending(true);
    setError(null);
    const result = await createThread(title, content, category);
    if (result.error) {
      setError(result.error);
      setSending(false);
    } else {
      onClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 shadow-2xl"
      >
        <h2 className="mb-5 text-[15px] font-medium text-zinc-200">Ask the Community</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your question?"
              className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-[#00E676]/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 outline-none focus:border-[#00E676]/30"
            >
              <option value="general">General</option>
              <option value="workflow">Workflow & Jobs</option>
              <option value="billing">Billing & Finance</option>
              <option value="team">Team & RBAC</option>
              <option value="mobile">Mobile App</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Details</label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide as much detail as possible..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none focus:border-[#00E676]/30"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending || !title.trim() || !content.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#00E676] px-4 py-2 text-[12px] font-medium text-black transition-all hover:bg-[#00C853] disabled:opacity-40"
            >
              <Send size={12} />
              {sending ? "Posting..." : "Post Thread"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
