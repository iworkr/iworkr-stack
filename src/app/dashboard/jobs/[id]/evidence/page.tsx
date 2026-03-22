/**
 * @page /dashboard/jobs/[id]/evidence
 * @status COMPLETE
 * @description Job evidence gallery with photo upload, tagging, and GPS metadata
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Search,
  Eye,
  EyeOff,
  AlertTriangle,
  MapPin,
  Clock,
  Tag,
  Trash2,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Filter,
  BarChart3,
  Sparkles,
} from "lucide-react";
import {
  getJobEvidence,
  searchEvidence,
  getEvidenceStats,
  toggleEvidenceVisibility,
  updateEvidenceCaption,
  deleteEvidence,
  getEvidenceSignedUrl,
  markAsDefect,
  type EvidenceItem,
  type EvidenceStats,
} from "@/app/actions/panopticon-vision";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Helpers ──────────────────────────────────────────── */

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/* ── Signed URL Cache ─────────────────────────────────── */

const urlCache = new Map<string, { url: string; expiresAt: number }>();

async function getCachedSignedUrl(path: string, bucket: string): Promise<string | null> {
  const key = `${bucket}:${path}`;
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const result = await getEvidenceSignedUrl(path, bucket);
  if (result.data) {
    urlCache.set(key, { url: result.data, expiresAt: Date.now() + 50 * 60 * 1000 }); // cache for 50 min
    return result.data;
  }
  return null;
}

/* ── Stats Badge ──────────────────────────────────────── */

function StatBadge({ label, value, icon: Icon, variant = "default" }: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "emerald" | "rose";
}) {
  const colors = {
    default: "bg-white/[0.04] text-zinc-300 border-white/[0.06]",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${colors[variant]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{value}</span>
      <span className="text-zinc-500">{label}</span>
    </div>
  );
}

/* ── Evidence Card ────────────────────────────────────── */

function EvidenceCard({
  item,
  onOpen,
  onToggleVisibility,
  onMarkDefect,
  onDelete,
}: {
  item: EvidenceItem;
  onOpen: () => void;
  onToggleVisibility: () => void;
  onMarkDefect: () => void;
  onDelete: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadImage() {
      setLoading(true);
      const displayPath = item.annotated_path || item.original_path;
      const bucket = item.annotated_path ? "evidence-annotated" : "evidence-raw";
      const url = await getCachedSignedUrl(displayPath, bucket);
      if (!cancelled) {
        setImageUrl(url);
        setLoading(false);
      }
      // Pre-fetch annotated version for hover
      if (item.annotated_path && item.original_path) {
        const origUrl = await getCachedSignedUrl(item.original_path, "evidence-raw");
        const annUrl = await getCachedSignedUrl(item.annotated_path, "evidence-annotated");
        if (!cancelled) {
          setImageUrl(origUrl);
          setAnnotatedUrl(annUrl);
        }
      }
    }
    loadImage();
    return () => { cancelled = true; };
  }, [item.original_path, item.annotated_path]);

  const aiTags: string[] = Array.isArray(item.ai_tags) ? item.ai_tags : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden cursor-pointer hover:border-white/[0.12] transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onOpen}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isHovered && annotatedUrl ? annotatedUrl : imageUrl}
              alt={item.manual_caption || "Evidence photo"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {isHovered && annotatedUrl && (
              <div className="absolute top-2 left-2 bg-emerald-500/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                ANNOTATED
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {item.is_defect && (
            <div className="bg-rose-500/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              DEFECT
            </div>
          )}
          {item.is_client_visible && (
            <div className="bg-white/20 backdrop-blur text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
              <Eye className="w-3 h-3" />
              CLIENT
            </div>
          )}
        </div>

        {/* Hover action bar */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-2 left-2 right-2 flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onToggleVisibility}
                className="p-1.5 rounded-md bg-black/60 backdrop-blur text-zinc-300 hover:text-white hover:bg-black/80 transition-colors"
                title={item.is_client_visible ? "Hide from client" : "Show to client"}
              >
                {item.is_client_visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onMarkDefect}
                className={`p-1.5 rounded-md backdrop-blur transition-colors ${
                  item.is_defect
                    ? "bg-rose-500/30 text-rose-300 hover:bg-rose-500/40"
                    : "bg-black/60 text-zinc-300 hover:text-white hover:bg-black/80"
                }`}
                title={item.is_defect ? "Unmark defect" : "Mark as defect"}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-md bg-black/60 backdrop-blur text-zinc-300 hover:text-rose-400 hover:bg-black/80 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card footer */}
      <div className="p-3 space-y-2">
        {/* AI tags */}
        {aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {aiTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20"
              >
                <Sparkles className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {aiTags.length > 4 && (
              <span className="text-[10px] text-zinc-500 px-1 py-0.5">+{aiTags.length - 4}</span>
            )}
          </div>
        )}

        {/* Caption */}
        {item.manual_caption && (
          <p className="text-xs text-zinc-400 line-clamp-2">{item.manual_caption}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(item.captured_at)}
          </span>
          {item.location_lat && item.location_lng && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {formatCoords(item.location_lat, item.location_lng)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Detail Modal ─────────────────────────────────────── */

function EvidenceDetailModal({
  item,
  items,
  currentIndex,
  onClose,
  onNavigate,
  onToggleVisibility,
  onMarkDefect,
  onUpdateCaption,
  onDelete,
}: {
  item: EvidenceItem;
  items: EvidenceItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onToggleVisibility: () => void;
  onMarkDefect: () => void;
  onUpdateCaption: (caption: string) => void;
  onDelete: () => void;
}) {
  const [viewMode, setViewMode] = useState<"original" | "annotated">("original");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(item.manual_caption || "");
  const captionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const origUrl = await getCachedSignedUrl(item.original_path, "evidence-raw");
      if (!cancelled) setOriginalUrl(origUrl);
      if (item.annotated_path) {
        const annUrl = await getCachedSignedUrl(item.annotated_path, "evidence-annotated");
        if (!cancelled) setAnnotatedUrl(annUrl);
      }
    }
    loadUrls();
    return () => { cancelled = true; };
  }, [item.original_path, item.annotated_path]);

  useEffect(() => {
    setCaptionDraft(item.manual_caption || "");
    setEditingCaption(false);
    setViewMode("original");
  }, [item.id, item.manual_caption]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate(-1);
      if (e.key === "ArrowRight") onNavigate(1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNavigate]);

  useEffect(() => {
    if (editingCaption && captionRef.current) captionRef.current.focus();
  }, [editingCaption]);

  const aiTags: string[] = Array.isArray(item.ai_tags) ? item.ai_tags : [];
  const confidence: Record<string, number> = item.ai_confidence || {};
  const watermark: Record<string, any> = item.watermark_data || {};
  const displayUrl = viewMode === "annotated" && annotatedUrl ? annotatedUrl : originalUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-1 max-w-[1400px] mx-auto my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(-1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {currentIndex < items.length - 1 && (
          <button
            onClick={() => onNavigate(1)}
            className="absolute right-[340px] top-1/2 -translate-y-1/2 z-10 p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Image area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 min-w-0">
          {/* View mode toggle */}
          {item.annotated_path && (
            <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => setViewMode("original")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "original"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setViewMode("annotated")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "annotated"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Annotated
              </button>
            </div>
          )}

          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={item.manual_caption || "Evidence photo"}
              className="max-h-[calc(100vh-160px)] max-w-full object-contain rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600 gap-3">
              <ImageIcon className="w-16 h-16" />
              <span className="text-sm">Loading image…</span>
            </div>
          )}

          {/* Counter */}
          <div className="mt-3 text-xs text-zinc-500">
            {currentIndex + 1} of {items.length}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-[320px] flex-shrink-0 bg-[#0A0A0A] border-l border-white/[0.06] overflow-y-auto p-5 space-y-5">
          {/* AI Tags with confidence */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              AI Tags
            </h3>
            {aiTags.length > 0 ? (
              <div className="space-y-1.5">
                {aiTags.map((tag) => (
                  <div key={tag} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                    {confidence[tag] !== undefined && (
                      <span className="text-[10px] text-zinc-500">
                        {(confidence[tag] * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 italic">No AI tags</p>
            )}
          </div>

          {/* Caption */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5" />
              Caption
            </h3>
            {editingCaption ? (
              <div className="space-y-2">
                <textarea
                  ref={captionRef}
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/40 resize-none"
                  rows={3}
                  placeholder="Add a caption…"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => { setEditingCaption(false); setCaptionDraft(item.manual_caption || ""); }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { onUpdateCaption(captionDraft); setEditingCaption(false); }}
                    className="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingCaption(true)}
                className="cursor-pointer rounded-lg px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-colors"
              >
                <p className="text-xs text-zinc-400">
                  {item.manual_caption || <span className="italic text-zinc-600">Click to add caption…</span>}
                </p>
              </div>
            )}
          </div>

          {/* Watermark / Metadata */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Metadata</h3>
            <div className="space-y-2 text-xs">
              {item.location_lat && item.location_lng && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                  <span>{formatCoords(item.location_lat, item.location_lng)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-zinc-600" />
                <span>{new Date(item.captured_at).toLocaleString("en-AU")}</span>
              </div>
              {watermark.user_name && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Camera className="w-3.5 h-3.5 text-zinc-600" />
                  <span>{watermark.user_name}</span>
                </div>
              )}
              {watermark.timestamp && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-zinc-500">Watermark: {watermark.timestamp}</span>
                </div>
              )}
              {watermark.gps && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-zinc-500">Watermark GPS: {watermark.gps}</span>
                </div>
              )}
              {item.face_detected && (
                <div className="flex items-center gap-2 text-amber-400/80">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Face detected {item.face_obfuscated ? "(blurred)" : "(not blurred)"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-white/[0.06] pt-5 space-y-2">
            <button
              onClick={onToggleVisibility}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/[0.04] transition-colors"
            >
              {item.is_client_visible ? (
                <>
                  <EyeOff className="w-4 h-4 text-zinc-500" />
                  Hide from Client
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-zinc-500" />
                  Show to Client
                </>
              )}
            </button>
            <button
              onClick={onMarkDefect}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                item.is_defect
                  ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/15"
                  : "text-zinc-300 hover:bg-white/[0.04]"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {item.is_defect ? "Unmark Defect" : "Mark as Defect"}
            </button>
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Evidence
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function EvidenceGalleryPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { orgId } = useOrg();

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [stats, setStats] = useState<EvidenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [defectsOnly, setDefectsOnly] = useState(false);
  const [clientVisibleOnly, setClientVisibleOnly] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load data ─────────────────────────────────────── */

  const loadEvidence = useCallback(async () => {
    if (!orgId || !jobId) return;
    setLoading(true);
    setError(null);

    try {
      const [evidenceResult, statsResult] = await Promise.all([
        searchTerm || defectsOnly
          ? searchEvidence(orgId, searchTerm, { jobId, defectsOnly })
          : getJobEvidence(orgId, jobId),
        getEvidenceStats(orgId, jobId),
      ]);

      if (evidenceResult.error) {
        setError(evidenceResult.error);
      } else {
        setEvidence(evidenceResult.data ?? []);
      }

      if (statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [orgId, jobId, searchTerm, defectsOnly]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  /* ── Search with debounce ──────────────────────────── */

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      // loadEvidence will be triggered by the searchTerm state change via useEffect
    }, 300);
  }, []);

  /* ── Filtered evidence (client-visible filter is client-side) */

  const filteredEvidence = clientVisibleOnly
    ? evidence.filter((e) => e.is_client_visible)
    : evidence;

  /* ── Actions ───────────────────────────────────────── */

  const handleToggleVisibility = useCallback(async (item: EvidenceItem) => {
    setActionLoading(item.id);
    const result = await toggleEvidenceVisibility(item.id, !item.is_client_visible);
    if (!result.error) {
      setEvidence((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, is_client_visible: !e.is_client_visible } : e))
      );
    }
    setActionLoading(null);
  }, []);

  const handleMarkDefect = useCallback(async (item: EvidenceItem) => {
    setActionLoading(item.id);
    const result = await markAsDefect(item.id, !item.is_defect);
    if (!result.error) {
      setEvidence((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, is_defect: !e.is_defect } : e))
      );
      // Update stats locally
      setStats((prev) =>
        prev
          ? {
              ...prev,
              defects: prev.defects + (item.is_defect ? -1 : 1),
            }
          : prev
      );
    }
    setActionLoading(null);
  }, []);

  const handleDelete = useCallback(async (item: EvidenceItem) => {
    if (!confirm("Delete this evidence photo? This cannot be undone.")) return;
    setActionLoading(item.id);
    const result = await deleteEvidence(item.id);
    if (!result.error) {
      setEvidence((prev) => prev.filter((e) => e.id !== item.id));
      setStats((prev) => (prev ? { ...prev, total: prev.total - 1 } : prev));
      if (selectedIndex !== null) setSelectedIndex(null);
    }
    setActionLoading(null);
  }, [selectedIndex]);

  const handleUpdateCaption = useCallback(async (item: EvidenceItem, caption: string) => {
    setActionLoading(item.id);
    const result = await updateEvidenceCaption(item.id, caption);
    if (!result.error) {
      setEvidence((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, manual_caption: caption } : e))
      );
    }
    setActionLoading(null);
  }, []);

  const handleNavigate = useCallback(
    (direction: -1 | 1) => {
      if (selectedIndex === null) return;
      const next = selectedIndex + direction;
      if (next >= 0 && next < filteredEvidence.length) {
        setSelectedIndex(next);
      }
    },
    [selectedIndex, filteredEvidence.length]
  );

  /* ── Render ────────────────────────────────────────── */

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--background)]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Camera className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">Evidence Gallery</h1>
              <p className="text-xs text-zinc-500">Panopticon Vision — AI-tagged photo evidence</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <StatBadge label="Photos" value={stats.total} icon={Camera} variant="emerald" />
            <StatBadge label="Annotated" value={stats.annotated} icon={Sparkles} />
            <StatBadge label="Defects" value={stats.defects} icon={AlertTriangle} variant="rose" />
            <StatBadge label="Client Visible" value={stats.client_visible} icon={Eye} />
            <StatBadge label="Captioned" value={stats.with_captions} icon={Pencil} />
            <StatBadge label="Face Detected" value={stats.face_detected} icon={BarChart3} />
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="Search AI Tags…"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>

          <button
            onClick={() => setDefectsOnly(!defectsOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              defectsOnly
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:text-white hover:border-white/[0.1]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Defects Only
          </button>

          <button
            onClick={() => setClientVisibleOnly(!clientVisibleOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              clientVisibleOnly
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:text-white hover:border-white/[0.1]"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Client Visible
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Loading evidence…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-3 rounded-full bg-rose-500/10">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <p className="text-sm text-rose-400">{error}</p>
            <button
              onClick={loadEvidence}
              className="px-4 py-2 rounded-lg bg-white/[0.04] text-zinc-300 text-xs font-medium hover:bg-white/[0.06] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredEvidence.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-4 rounded-full bg-white/[0.02] border border-white/[0.06]">
              <Camera className="w-10 h-10 text-zinc-700" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-zinc-400 mb-1">
                {searchTerm || defectsOnly || clientVisibleOnly
                  ? "No matching evidence"
                  : "No evidence captured yet"}
              </h3>
              <p className="text-xs text-zinc-600 max-w-xs">
                {searchTerm || defectsOnly || clientVisibleOnly
                  ? "Try adjusting your search or filters."
                  : "Evidence photos will appear here when captured from the mobile app."}
              </p>
            </div>
          </div>
        )}

        {/* Gallery grid */}
        {!loading && !error && filteredEvidence.length > 0 && (
          <motion.div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            <AnimatePresence mode="popLayout">
              {filteredEvidence.map((item, index) => (
                <EvidenceCard
                  key={item.id}
                  item={item}
                  onOpen={() => setSelectedIndex(index)}
                  onToggleVisibility={() => handleToggleVisibility(item)}
                  onMarkDefect={() => handleMarkDefect(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedIndex !== null && filteredEvidence[selectedIndex] && (
          <EvidenceDetailModal
            item={filteredEvidence[selectedIndex]}
            items={filteredEvidence}
            currentIndex={selectedIndex}
            onClose={() => setSelectedIndex(null)}
            onNavigate={handleNavigate}
            onToggleVisibility={() => handleToggleVisibility(filteredEvidence[selectedIndex])}
            onMarkDefect={() => handleMarkDefect(filteredEvidence[selectedIndex])}
            onUpdateCaption={(caption) =>
              handleUpdateCaption(filteredEvidence[selectedIndex], caption)
            }
            onDelete={() => handleDelete(filteredEvidence[selectedIndex])}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
