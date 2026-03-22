/**
 * @page /dashboard/knowledge
 * @status COMPLETE
 * @description Knowledge base with articles, video library, search, and CRUD editor
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  Video,
  FileText,
  Tag,
  Plus,
  Edit,
  Trash2,
  Eye,
  Clock,
  Shield,
  Wifi,
  WifiOff,
  Sparkles,
  BarChart3,
  X,
  Check,
  Upload,
  AlertTriangle,
  Users,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getKnowledgeLibrary,
  getKnowledgeStats,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
  getTags,
  createTag,
  addTagToArticle,
  removeTagFromArticle,
  generateEmbedding,
  type KnowledgeArticle,
  type KnowledgeStats,
  type KnowledgeTag,
} from "@/app/actions/athena-sop";

/* ── Types ──────────────────────────────────────────────── */

type TabId = "library" | "studio" | "analytics";

interface EditorState {
  id: string | null;
  title: string;
  description: string;
  category: string;
  content_html: string;
  difficulty_level: string;
  is_mandatory_read: boolean;
  is_offline_critical: boolean;
  tags: string[];
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: "",
  description: "",
  category: "",
  content_html: "",
  difficulty_level: "beginner",
  is_mandatory_read: false,
  is_offline_critical: false,
  tags: [],
};

const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced", "expert"];

const TABS: { id: TabId; label: string; icon: typeof BookOpen }[] = [
  { id: "library", label: "Library", icon: BookOpen },
  { id: "studio", label: "Studio", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

/* ── Helpers ────────────────────────────────────────────── */

function statusColor(status: string) {
  switch (status) {
    case "published":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "draft":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    case "archived":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function difficultyColor(level: string | null) {
  switch (level) {
    case "beginner":
      return "text-emerald-400";
    case "intermediate":
      return "text-blue-400";
    case "advanced":
      return "text-amber-400";
    case "expert":
      return "text-rose-400";
    default:
      return "text-zinc-500";
  }
}

/* ── Toggle Switch ──────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-emerald-500" : "bg-white/[0.08]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
      <span className="text-[13px] text-zinc-300 group-hover:text-white transition-colors">
        {label}
      </span>
    </label>
  );
}

/* ── Loading Spinner ────────────────────────────────────── */

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="opacity-20"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-emerald-500"
      />
    </svg>
  );
}

/* ── Empty State ────────────────────────────────────────── */

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  cta,
  onCta,
}: {
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-xl border border-white/[0.04] animate-pulse" />
        <div className="absolute inset-2 rounded-lg border border-white/[0.03] animate-pulse" />
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Icon size={16} strokeWidth={1.5} className="text-zinc-600" />
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[280px] text-[12px] text-zinc-600">
        {subtitle}
      </p>
      {cta && onCta && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCta}
          className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[12px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
        >
          <Plus size={14} />
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Stats Badge ────────────────────────────────────────── */

function StatBadge({
  label,
  value,
  color = "zinc",
}: {
  label: string;
  value: number | string;
  color?: "zinc" | "emerald" | "amber" | "blue" | "rose";
}) {
  const colors = {
    zinc: "text-zinc-400 bg-white/[0.03] border-white/[0.06]",
    emerald: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/5 border-amber-500/10",
    blue: "text-blue-400 bg-blue-500/5 border-blue-500/10",
    rose: "text-rose-400 bg-rose-500/5 border-rose-500/10",
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] ${colors[color]}`}
    >
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

/* ── Article Card ───────────────────────────────────────── */

function ArticleCard({
  article,
  onEdit,
  onDelete,
  onPublish,
}: {
  article: KnowledgeArticle;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 transition-colors hover:border-white/[0.1] hover:bg-[#0E0E0E]"
    >
      {/* Thumbnail / Video indicator */}
      <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
        {article.thumbnail_url ? (
          <img
            src={article.thumbnail_url}
            alt={article.title}
            className="h-full w-full object-cover"
          />
        ) : article.video_hls_url ? (
          <div className="flex flex-col items-center gap-2">
            <Video size={24} className="text-emerald-500/60" />
            <span className="text-[10px] text-zinc-600">Video SOP</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileText size={24} className="text-zinc-700" />
            <span className="text-[10px] text-zinc-600">Article</span>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusColor(article.status)}`}
        >
          {article.status}
        </span>
        {article.difficulty_level && (
          <span
            className={`text-[10px] font-medium ${difficultyColor(article.difficulty_level)}`}
          >
            {article.difficulty_level}
          </span>
        )}
      </div>

      {/* Title & description */}
      <h3 className="text-[14px] font-medium text-white leading-snug line-clamp-1">
        {article.title}
      </h3>
      {article.description && (
        <p className="mt-1 text-[12px] text-zinc-500 leading-relaxed line-clamp-2">
          {article.description}
        </p>
      )}

      {/* Author */}
      {article.author_name && (
        <p className="mt-1.5 text-[11px] text-zinc-600">
          by {article.author_name}
        </p>
      )}

      {/* Tags */}
      {article.structured_tags && article.structured_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {article.structured_tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500 border border-white/[0.04]"
            >
              {tag}
            </span>
          ))}
          {article.structured_tags.length > 3 && (
            <span className="text-[10px] text-zinc-600">
              +{article.structured_tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-3 border-t border-white/[0.04] pt-3">
        <div className="flex items-center gap-1 text-[11px] text-zinc-600">
          <Eye size={12} />
          <span>{article.view_count}</span>
        </div>
        {article.is_mandatory_read && (
          <div className="flex items-center gap-1 text-[11px] text-amber-500">
            <Shield size={12} />
            <span>Mandatory</span>
          </div>
        )}
        {article.is_offline_critical && (
          <div className="flex items-center gap-1 text-[11px] text-blue-400">
            <WifiOff size={12} />
            <span>Offline</span>
          </div>
        )}
        {article.estimated_read_minutes && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-600">
            <Clock size={12} />
            <span>{article.estimated_read_minutes}m</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Edit size={12} />
          Edit
        </button>
        {article.status === "draft" && (
          <button
            onClick={onPublish}
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <Check size={12} />
            Publish
          </button>
        )}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <Trash2 size={12} />
          </button>
        ) : (
          <button
            onClick={() => {
              onDelete();
              setConfirmDelete(false);
            }}
            onBlur={() => setConfirmDelete(false)}
            className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-[11px] text-rose-400 animate-pulse"
          >
            <Trash2 size={12} />
            Confirm
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   ██ MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function KnowledgeBasePage() {
  const { orgId, loading: orgLoading } = useOrg();

  /* ── State ─────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<TabId>("library");
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [tags, setTags] = useState<KnowledgeTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Library filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");

  // Studio editor
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [embedding, setEmbedding] = useState(false);

  // Tag management
  const [newTagName, setNewTagName] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);

  /* ── Data Fetching ─────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const [libRes, statsRes, tagsRes] = await Promise.all([
        getKnowledgeLibrary(orgId, {
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          tag: tagFilter || undefined,
        }),
        getKnowledgeStats(orgId),
        getTags(orgId),
      ]);

      if (libRes.error) throw new Error(libRes.error);
      if (statsRes.error) throw new Error(statsRes.error);
      if (tagsRes.error) throw new Error(tagsRes.error);

      setArticles(libRes.data ?? []);
      setStats(statsRes.data ?? null);
      setTags(tagsRes.data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId, search, statusFilter, tagFilter]);

  useEffect(() => {
    if (!orgLoading && orgId) {
      fetchData();
    }
  }, [orgLoading, orgId, fetchData]);

  // Debounced search
  useEffect(() => {
    if (!orgId) return;
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /* ── Handlers ──────────────────────────────────────────── */

  const handleEditArticle = useCallback((article: KnowledgeArticle) => {
    setEditor({
      id: article.id,
      title: article.title,
      description: article.description ?? "",
      category: article.category ?? "",
      content_html: article.content_html ?? "",
      difficulty_level: article.difficulty_level ?? "beginner",
      is_mandatory_read: article.is_mandatory_read,
      is_offline_critical: article.is_offline_critical,
      tags: article.structured_tags ?? [],
    });
    setActiveTab("studio");
  }, []);

  const handleDeleteArticle = useCallback(
    async (articleId: string) => {
      const res = await deleteArticle(articleId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      if (editor.id === articleId) {
        setEditor(EMPTY_EDITOR);
      }
    },
    [editor.id]
  );

  const handlePublishArticle = useCallback(
    async (articleId: string) => {
      const res = await publishArticle(articleId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId ? { ...a, status: "published" as const } : a
        )
      );
    },
    []
  );

  const handleSaveDraft = useCallback(async () => {
    if (!orgId || !editor.title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      if (editor.id) {
        // Update existing
        const res = await updateArticle(editor.id, {
          title: editor.title,
          description: editor.description || null,
          category: editor.category || null,
          content_html: editor.content_html || null,
          raw_text: editor.content_html
            ? editor.content_html.replace(/<[^>]*>/g, "")
            : null,
          difficulty_level: editor.difficulty_level,
          is_mandatory_read: editor.is_mandatory_read,
          is_offline_critical: editor.is_offline_critical,
        });
        if (res.error) throw new Error(res.error);
      } else {
        // Create new
        const res = await createArticle(orgId, {
          title: editor.title,
          description: editor.description || undefined,
          content_html: editor.content_html || undefined,
          raw_text: editor.content_html
            ? editor.content_html.replace(/<[^>]*>/g, "")
            : undefined,
          category: editor.category || undefined,
          status: "draft",
          difficulty_level: editor.difficulty_level,
          is_mandatory_read: editor.is_mandatory_read,
          is_offline_critical: editor.is_offline_critical,
        });
        if (res.error) throw new Error(res.error);
        if (res.data) {
          setEditor((prev) => ({ ...prev, id: res.data!.id }));
        }
      }
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [orgId, editor, fetchData]);

  const handlePublishFromStudio = useCallback(async () => {
    if (!orgId || !editor.title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      if (editor.id) {
        // Update then publish
        await updateArticle(editor.id, {
          title: editor.title,
          description: editor.description || null,
          category: editor.category || null,
          content_html: editor.content_html || null,
          raw_text: editor.content_html
            ? editor.content_html.replace(/<[^>]*>/g, "")
            : null,
          difficulty_level: editor.difficulty_level,
          is_mandatory_read: editor.is_mandatory_read,
          is_offline_critical: editor.is_offline_critical,
        });
        const res = await publishArticle(editor.id);
        if (res.error) throw new Error(res.error);
      } else {
        // Create as published
        const res = await createArticle(orgId, {
          title: editor.title,
          description: editor.description || undefined,
          content_html: editor.content_html || undefined,
          raw_text: editor.content_html
            ? editor.content_html.replace(/<[^>]*>/g, "")
            : undefined,
          category: editor.category || undefined,
          status: "published",
          difficulty_level: editor.difficulty_level,
          is_mandatory_read: editor.is_mandatory_read,
          is_offline_critical: editor.is_offline_critical,
        });
        if (res.error) throw new Error(res.error);
        if (res.data) {
          setEditor((prev) => ({ ...prev, id: res.data!.id }));
        }
      }
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to publish";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [orgId, editor, fetchData]);

  const handleGenerateEmbedding = useCallback(async () => {
    if (!editor.id) return;
    setEmbedding(true);
    setError(null);
    try {
      const res = await generateEmbedding(editor.id);
      if (res.error) throw new Error(res.error);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate embedding";
      setError(message);
    } finally {
      setEmbedding(false);
    }
  }, [editor.id]);

  const handleCreateTag = useCallback(async () => {
    if (!orgId || !newTagName.trim()) return;
    const res = await createTag(orgId, newTagName.trim());
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setTags((prev) => [...prev, res.data!]);
    }
    setNewTagName("");
    setShowNewTag(false);
  }, [orgId, newTagName]);

  const handleAddTagToArticle = useCallback(
    async (tagId: string, tagName: string) => {
      if (!editor.id) return;
      const res = await addTagToArticle(editor.id, tagId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditor((prev) => ({
        ...prev,
        tags: [...prev.tags, tagName],
      }));
    },
    [editor.id]
  );

  const handleRemoveTagFromArticle = useCallback(
    async (tagId: string, tagName: string) => {
      if (!editor.id) return;
      const res = await removeTagFromArticle(editor.id, tagId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditor((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t !== tagName),
      }));
    },
    [editor.id]
  );

  const handleNewArticle = useCallback(() => {
    setEditor(EMPTY_EDITOR);
    setActiveTab("studio");
  }, []);

  /* ── Loading / Auth guard ──────────────────────────────── */

  if (orgLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)]">
        <Spinner size={28} />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--background)]">
        <AlertTriangle size={24} className="text-amber-500" />
        <p className="text-[14px] text-zinc-400">
          No workspace found. Please select or create an organization.
        </p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     ██ RENDER
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex-none border-b border-white/[0.06] px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <BookOpen size={16} className="text-emerald-500" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-white tracking-tight">
                Knowledge Base
              </h1>
              <p className="text-[12px] text-zinc-500">
                SOP Studio & Training Library
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNewArticle}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[13px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <Plus size={14} />
            New Article
          </motion.button>
        </div>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="knowledge-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-px bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-none border-b border-rose-500/20 bg-rose-500/5 px-6 py-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] text-rose-400">
                <AlertTriangle size={14} />
                {error}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-400/60 hover:text-rose-400"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <LibraryTab
                articles={articles}
                stats={stats}
                tags={tags}
                loading={loading}
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                tagFilter={tagFilter}
                onTagFilterChange={setTagFilter}
                onEdit={handleEditArticle}
                onDelete={handleDeleteArticle}
                onPublish={handlePublishArticle}
                onNewArticle={handleNewArticle}
              />
            </motion.div>
          )}

          {activeTab === "studio" && (
            <motion.div
              key="studio"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <StudioTab
                editor={editor}
                setEditor={setEditor}
                tags={tags}
                saving={saving}
                embedding={embedding}
                showNewTag={showNewTag}
                setShowNewTag={setShowNewTag}
                newTagName={newTagName}
                setNewTagName={setNewTagName}
                onSaveDraft={handleSaveDraft}
                onPublish={handlePublishFromStudio}
                onGenerateEmbedding={handleGenerateEmbedding}
                onCreateTag={handleCreateTag}
                onAddTag={handleAddTagToArticle}
                onRemoveTag={handleRemoveTagFromArticle}
              />
            </motion.div>
          )}

          {activeTab === "analytics" && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <AnalyticsTab stats={stats} loading={loading} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ██ TAB 1 — LIBRARY
   ══════════════════════════════════════════════════════════ */

function LibraryTab({
  articles,
  stats,
  tags,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  tagFilter,
  onTagFilterChange,
  onEdit,
  onDelete,
  onPublish,
  onNewArticle,
}: {
  articles: KnowledgeArticle[];
  stats: KnowledgeStats | null;
  tags: KnowledgeTag[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  onEdit: (article: KnowledgeArticle) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onNewArticle: () => void;
}) {
  const STATUS_FILTERS = ["all", "published", "draft", "archived"];

  return (
    <div className="space-y-5">
      {/* Stats badges */}
      {stats && (
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge label="Total" value={stats.total_articles} />
          <StatBadge
            label="Published"
            value={stats.published}
            color="emerald"
          />
          <StatBadge label="With Video" value={stats.with_video} color="blue" />
          <StatBadge
            label="Mandatory"
            value={stats.mandatory}
            color="amber"
          />
        </div>
      )}

      {/* Search + filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0A] pl-9 pr-4 text-[13px] text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[#0A0A0A] p-0.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => onStatusFilterChange(s)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Tag size={12} className="flex-none text-zinc-600" />
          <button
            onClick={() => onTagFilterChange("")}
            className={`flex-none rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              !tagFilter
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
            }`}
          >
            All Tags
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() =>
                onTagFilterChange(tagFilter === tag.tag_name ? "" : tag.tag_name)
              }
              className={`flex-none rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                tagFilter === tag.tag_name
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
              }`}
              style={
                tagFilter === tag.tag_name
                  ? undefined
                  : { borderColor: `${tag.color_hex}20` }
              }
            >
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color_hex }}
              />
              {tag.tag_name}
            </button>
          ))}
        </div>
      )}

      {/* Article grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No articles yet"
          subtitle="Create your first SOP or training article to build your team's knowledge base."
          cta="Create Article"
          onCta={onNewArticle}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onEdit={() => onEdit(article)}
                onDelete={() => onDelete(article.id)}
                onPublish={() => onPublish(article.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ██ TAB 2 — STUDIO (Article Editor)
   ══════════════════════════════════════════════════════════ */

function StudioTab({
  editor,
  setEditor,
  tags,
  saving,
  embedding,
  showNewTag,
  setShowNewTag,
  newTagName,
  setNewTagName,
  onSaveDraft,
  onPublish,
  onGenerateEmbedding,
  onCreateTag,
  onAddTag,
  onRemoveTag,
}: {
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>;
  tags: KnowledgeTag[];
  saving: boolean;
  embedding: boolean;
  showNewTag: boolean;
  setShowNewTag: (v: boolean) => void;
  newTagName: string;
  setNewTagName: (v: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onGenerateEmbedding: () => void;
  onCreateTag: () => void;
  onAddTag: (tagId: string, tagName: string) => void;
  onRemoveTag: (tagId: string, tagName: string) => void;
}) {
  const inputClasses =
    "h-10 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0A] px-3 text-[13px] text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20";
  const labelClasses = "block text-[12px] font-medium text-zinc-400 mb-1.5";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-white">
            {editor.id ? "Edit Article" : "New Article"}
          </h2>
          <p className="text-[12px] text-zinc-500">
            {editor.id
              ? "Update your article content and settings"
              : "Create a new knowledge article or SOP"}
          </p>
        </div>
        {editor.id && (
          <button
            onClick={() => setEditor(EMPTY_EDITOR)}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Plus size={12} />
            New
          </button>
        )}
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-6 space-y-5">
        {/* Title */}
        <div>
          <label className={labelClasses}>Title *</label>
          <input
            type="text"
            placeholder="Article title..."
            value={editor.title}
            onChange={(e) =>
              setEditor((prev) => ({ ...prev, title: e.target.value }))
            }
            className={inputClasses}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClasses}>Description</label>
          <input
            type="text"
            placeholder="Brief description..."
            value={editor.description}
            onChange={(e) =>
              setEditor((prev) => ({ ...prev, description: e.target.value }))
            }
            className={inputClasses}
          />
        </div>

        {/* Category + Difficulty row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Category</label>
            <input
              type="text"
              placeholder="e.g. Safety, Procedures, Training..."
              value={editor.category}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, category: e.target.value }))
              }
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Difficulty</label>
            <select
              value={editor.difficulty_level}
              onChange={(e) =>
                setEditor((prev) => ({
                  ...prev,
                  difficulty_level: e.target.value,
                }))
              }
              className={`${inputClasses} cursor-pointer appearance-none`}
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d} className="bg-[#0A0A0A]">
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content HTML */}
        <div>
          <label className={labelClasses}>
            Content{" "}
            <span className="text-zinc-600 font-normal">
              (HTML — rich editor coming soon)
            </span>
          </label>
          <textarea
            placeholder="Write your article content here... HTML is supported."
            value={editor.content_html}
            onChange={(e) =>
              setEditor((prev) => ({
                ...prev,
                content_html: e.target.value,
              }))
            }
            rows={12}
            className="w-full rounded-lg border border-white/[0.06] bg-[#0A0A0A] px-3 py-3 text-[13px] text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 resize-y font-mono leading-relaxed"
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6 rounded-lg border border-white/[0.04] bg-white/[0.01] p-4">
          <Toggle
            checked={editor.is_mandatory_read}
            onChange={(v) =>
              setEditor((prev) => ({ ...prev, is_mandatory_read: v }))
            }
            label="Mandatory Read"
          />
          <Toggle
            checked={editor.is_offline_critical}
            onChange={(v) =>
              setEditor((prev) => ({ ...prev, is_offline_critical: v }))
            }
            label="Offline Critical"
          />
        </div>

        {/* Tag management */}
        <div>
          <label className={labelClasses}>Tags</label>

          {/* Current tags */}
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
            {editor.tags.length === 0 && (
              <span className="text-[12px] text-zinc-600">
                No tags assigned
              </span>
            )}
            {editor.tags.map((tagName) => {
              const tagObj = tags.find((t) => t.tag_name === tagName);
              return (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400 border border-white/[0.06]"
                >
                  {tagObj && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tagObj.color_hex }}
                    />
                  )}
                  {tagName}
                  {editor.id && tagObj && (
                    <button
                      onClick={() => onRemoveTag(tagObj.id, tagName)}
                      className="ml-0.5 text-zinc-600 hover:text-rose-400"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>

          {/* Add tags */}
          {editor.id && (
            <div className="flex flex-wrap gap-1.5">
              {tags
                .filter((t) => !editor.tags.includes(t.tag_name))
                .map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => onAddTag(tag.id, tag.tag_name)}
                    className="inline-flex items-center gap-1 rounded-md bg-white/[0.02] px-2 py-0.5 text-[11px] text-zinc-600 border border-white/[0.04] transition-colors hover:bg-white/[0.05] hover:text-zinc-400"
                  >
                    <Plus size={10} />
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tag.color_hex }}
                    />
                    {tag.tag_name}
                  </button>
                ))}

              {/* Create new tag */}
              {!showNewTag ? (
                <button
                  onClick={() => setShowNewTag(true)}
                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.02] px-2 py-0.5 text-[11px] text-zinc-600 border border-dashed border-white/[0.08] transition-colors hover:bg-white/[0.05] hover:text-zinc-400"
                >
                  <Plus size={10} />
                  New Tag
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Tag name..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCreateTag();
                      if (e.key === "Escape") {
                        setShowNewTag(false);
                        setNewTagName("");
                      }
                    }}
                    autoFocus
                    className="h-6 w-28 rounded-md border border-white/[0.08] bg-[#0A0A0A] px-2 text-[11px] text-white outline-none focus:border-emerald-500/30"
                  />
                  <button
                    onClick={onCreateTag}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => {
                      setShowNewTag(false);
                      setNewTagName("");
                    }}
                    className="text-zinc-600 hover:text-zinc-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video upload placeholder */}
        <div>
          <label className={labelClasses}>Video</label>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] p-4">
            <Upload size={16} className="text-zinc-600" />
            <div className="flex-1">
              <p className="text-[12px] text-zinc-400">
                Upload an MP4 video for this SOP
              </p>
              <p className="text-[11px] text-zinc-600">
                {editor.id
                  ? "Save the article first, then upload via the API"
                  : "Save the article first to enable video upload"}
              </p>
            </div>
            <input
              type="file"
              accept="video/mp4"
              disabled={!editor.id}
              className="text-[11px] text-zinc-500 file:mr-3 file:rounded-md file:border file:border-white/[0.06] file:bg-white/[0.03] file:px-3 file:py-1.5 file:text-[11px] file:text-zinc-400 file:cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pb-8">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onSaveDraft}
          disabled={saving || !editor.title.trim()}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Spinner size={14} /> : <FileText size={14} />}
          Save Draft
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onPublish}
          disabled={saving || !editor.title.trim()}
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 text-[13px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Spinner size={14} /> : <Check size={14} />}
          Publish
        </motion.button>

        {editor.id && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onGenerateEmbedding}
            disabled={embedding}
            className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-5 py-2.5 text-[13px] font-medium text-violet-400 transition-colors hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {embedding ? <Spinner size={14} /> : <Sparkles size={14} />}
            Generate AI Embedding
          </motion.button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ██ TAB 3 — ANALYTICS
   ══════════════════════════════════════════════════════════ */

function AnalyticsTab({
  stats,
  loading,
}: {
  stats: KnowledgeStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics available"
        subtitle="Start creating and publishing articles to see your knowledge base analytics."
      />
    );
  }

  const statCards: {
    label: string;
    value: number | string;
    icon: typeof BookOpen;
    color: string;
    bgColor: string;
    borderColor: string;
    pulse?: boolean;
  }[] = [
    {
      label: "Total Articles",
      value: stats.total_articles,
      icon: FileText,
      color: "text-white",
      bgColor: "bg-white/[0.03]",
      borderColor: "border-white/[0.06]",
    },
    {
      label: "Total Views (30d)",
      value: stats.total_views.toLocaleString(),
      icon: Eye,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/5",
      borderColor: "border-emerald-500/10",
    },
    {
      label: "Total Watch Time",
      value: `${Math.round(stats.total_watch_time / 60)}m`,
      icon: Clock,
      color: "text-blue-400",
      bgColor: "bg-blue-500/5",
      borderColor: "border-blue-500/10",
    },
    {
      label: "Unread Mandatory",
      value: stats.unread_mandatory,
      icon: AlertTriangle,
      color: "text-amber-400",
      bgColor: "bg-amber-500/5",
      borderColor: "border-amber-500/10",
      pulse: stats.unread_mandatory > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats ribbon */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`rounded-xl border ${card.borderColor} ${card.bgColor} p-5 ${card.pulse ? "animate-pulse" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${card.borderColor} bg-white/[0.02]`}
                >
                  <Icon size={14} className={card.color} />
                </div>
              </div>
              <div className={`text-[24px] font-semibold ${card.color} tracking-tight`}>
                {card.value}
              </div>
              <div className="mt-1 text-[12px] text-zinc-500">
                {card.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-emerald-500" />
            <span className="text-[13px] font-medium text-zinc-300">
              Published
            </span>
          </div>
          <div className="text-[20px] font-semibold text-white">
            {stats.published}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/50"
              style={{
                width: `${stats.total_articles ? (stats.published / stats.total_articles) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            {stats.total_articles
              ? Math.round((stats.published / stats.total_articles) * 100)
              : 0}
            % of total
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Video size={14} className="text-blue-400" />
            <span className="text-[13px] font-medium text-zinc-300">
              With Video
            </span>
          </div>
          <div className="text-[20px] font-semibold text-white">
            {stats.with_video}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500/50"
              style={{
                width: `${stats.total_articles ? (stats.with_video / stats.total_articles) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            {stats.total_articles
              ? Math.round((stats.with_video / stats.total_articles) * 100)
              : 0}
            % include video
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5">
          <div className="flex items-center gap-2 mb-3">
            <WifiOff size={14} className="text-amber-400" />
            <span className="text-[13px] font-medium text-zinc-300">
              Offline Critical
            </span>
          </div>
          <div className="text-[20px] font-semibold text-white">
            {stats.offline_critical}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500/50"
              style={{
                width: `${stats.total_articles ? (stats.offline_critical / stats.total_articles) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            {stats.total_articles
              ? Math.round(
                  (stats.offline_critical / stats.total_articles) * 100
                )
              : 0}
            % marked offline
          </p>
        </div>
      </div>

      {/* Read receipts placeholder */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-zinc-500" />
            <h3 className="text-[14px] font-medium text-zinc-300">
              Read Receipts
            </h3>
          </div>
          <span className="rounded-md bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-600 uppercase tracking-wider">
            Coming Soon
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] mb-3">
            <Users size={18} className="text-zinc-700" />
          </div>
          <p className="text-[13px] text-zinc-500">
            Select an article to view read receipts
          </p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Track who has read mandatory SOPs and training materials
          </p>
        </div>
      </div>
    </div>
  );
}
