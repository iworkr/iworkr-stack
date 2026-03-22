/**
 * @page /dashboard/communications
 * @status COMPLETE
 * @description Unified communications hub with calls, emails, SMS, and message threading
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Mail,
  MailOpen,
  MessageSquare,
  Inbox,
  Search,
  Filter,
  Star,
  StarOff,
  Link2,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Briefcase,
  FileText,
  Paperclip,
  Send,
  Voicemail,
  Radio,
  BarChart3,
  AlertCircle,
  ArrowUpRight,
  Eye,
  X,
  Sparkles,
  DollarSign,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getInboxFeed,
  getInboxStats,
  markAsRead,
  markAsStarred,
  linkToJob,
  getVoipRecord,
  getEmailThread,
  sendEmailReply,
  convertToBillableTime,
  type CommunicationLog,
  type InboxStats,
  type VoipCallRecord,
  type EmailThread,
} from "@/app/actions/synapse-comms";

/* ── Helpers ──────────────────────────────────────────────── */

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function channelIcon(channel: string, direction?: string, status?: string) {
  if (channel === "voice_call") {
    if (status === "missed") return <PhoneMissed size={14} className="text-rose-400" />;
    if (status === "voicemail") return <Voicemail size={14} className="text-amber-400" />;
    if (direction === "inbound") return <PhoneIncoming size={14} className="text-emerald-400" />;
    return <PhoneOutgoing size={14} className="text-blue-400" />;
  }
  if (channel === "email") {
    return <Mail size={14} className="text-sky-400" />;
  }
  if (channel === "sms") {
    return <MessageSquare size={14} className="text-violet-400" />;
  }
  return <Radio size={14} className="text-zinc-500" />;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    missed: "bg-rose-500/15 text-rose-400",
    completed: "bg-emerald-500/15 text-emerald-400",
    voicemail: "bg-amber-500/15 text-amber-400",
    delivered: "bg-sky-500/15 text-sky-400",
    bounced: "bg-rose-500/15 text-rose-400",
    in_progress: "bg-blue-500/15 text-blue-400",
    ringing: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-rose-500/15 text-rose-400",
  };
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${colors[status] || "bg-zinc-800 text-zinc-500"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

type ChannelFilter = "all" | "voice_call" | "email" | "sms";

/* ── Main Page ────────────────────────────────────────────── */
export default function CommunicationsPage() {
  const org = useOrg();
  const orgId = org?.orgId;

  const queryClient = useQueryClient();

  // ── State ──
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);
  const [detailVoip, setDetailVoip] = useState<VoipCallRecord | null>(null);
  const [detailEmail, setDetailEmail] = useState<EmailThread | null>(null);
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [linkJobModal, setLinkJobModal] = useState<string | null>(null);
  const [linkJobId, setLinkJobId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Load Feed & Stats via useQuery ──
  const feedFilters = { channel: channelFilter === "all" ? undefined : channelFilter, unreadOnly: showUnreadOnly, unlinkedOnly: showUnlinkedOnly };

  const { data: feedData, isLoading: feedLoading } = useQuery<CommunicationLog[]>({
    queryKey: queryKeys.communications.feed(orgId!, feedFilters),
    queryFn: async () => {
      const res = await getInboxFeed(orgId!, feedFilters);
      return res.data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: stats = null } = useQuery<InboxStats>({
    queryKey: queryKeys.communications.stats(orgId!),
    queryFn: async () => {
      const res = await getInboxStats(orgId!);
      return res.data!;
    },
    enabled: !!orgId,
  });

  const feed = feedData ?? [];
  const loading = feedLoading;

  const loadData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["communications"] });
  }, [queryClient]);

  const updateFeedItem = (id: string, patch: Partial<CommunicationLog>) => {
    const feedKey = queryKeys.communications.feed(orgId!, feedFilters);
    queryClient.setQueryData<CommunicationLog[]>(feedKey, (old) =>
      old?.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  };

  // ── Detail Load ──
  const openDetail = async (log: CommunicationLog) => {
    setSelectedLog(log);
    setDetailVoip(null);
    setDetailEmail(null);
    setReplyMode(false);
    setShowTranscript(false);

    if (!log.is_read) {
      await markAsRead(log.id);
      updateFeedItem(log.id, { is_read: true });
    }

    if (log.channel === "voice_call") {
      const res = await getVoipRecord(log.id);
      if (res.data) setDetailVoip(res.data);
    } else if (log.channel === "email") {
      const res = await getEmailThread(log.id);
      if (res.data) setDetailEmail(res.data);
    }
  };

  // ── Toggle Star ──
  const toggleStar = async (logId: string, current: boolean) => {
    await markAsStarred(logId, !current);
    updateFeedItem(logId, { is_starred: !current });
  };

  // ── Link to Job ──
  const handleLinkJob = async () => {
    if (!linkJobModal || !linkJobId) return;
    await linkToJob(linkJobModal, linkJobId);
    updateFeedItem(linkJobModal, { is_linked: true, job_id: linkJobId });
    setLinkJobModal(null);
    setLinkJobId("");
    loadData();
  };

  // ── Send Reply ──
  const handleSendReply = async () => {
    if (!orgId || !selectedLog || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await sendEmailReply(orgId, {
        logId: selectedLog.id,
        toEmail: selectedLog.from_address || "",
        subject: `Re: ${selectedLog.subject || ""}`,
        bodyHtml: `<p>${replyText.replace(/\n/g, "<br/>")}</p>`,
        bodyText: replyText,
        inReplyTo: detailEmail?.message_id || undefined,
      });
      setReplyText("");
      setReplyMode(false);
      loadData();
    } finally {
      setSendingReply(false);
    }
  };

  // ── Convert to Billable ──
  const handleBillable = async (logId: string) => {
    await convertToBillableTime(logId);
    loadData();
  };

  // ── Audio Player ──
  const toggleAudio = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => setPlayingAudio(null);
      setPlayingAudio(url);
    }
  };

  // ── Filtered Feed ──
  const filteredFeed = searchQuery
    ? feed.filter((l) => {
        const q = searchQuery.toLowerCase();
        return (
          l.from_address?.toLowerCase().includes(q) ||
          l.to_address?.toLowerCase().includes(q) ||
          l.subject?.toLowerCase().includes(q) ||
          l.body_preview?.toLowerCase().includes(q) ||
          l.client_name?.toLowerCase().includes(q)
        );
      })
    : feed;

  if (!orgId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)]">
        <p className="text-[13px] text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      {/* Noise */}
      <div className="stealth-noise" />

      {/* ══════════════════════════ LEFT: Feed ══════════════════════════ */}
      <div className="flex w-[440px] shrink-0 flex-col border-r border-white/[0.06]">
        {/* ── Header ── */}
        <div className="border-b border-white/[0.06] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Radio size={15} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold tracking-tight text-white">
                  Communications
                </h1>
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                  Unified Omnichannel
                </p>
              </div>
            </div>
            {stats && (
              <div className="flex items-center gap-1.5">
                {stats.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-400">
                    {stats.unread}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Stats Bar ── */}
          {stats && (
            <div className="mt-3 flex gap-1.5">
              {[
                { label: "Calls", value: stats.calls, icon: Phone, color: "emerald" },
                { label: "Emails", value: stats.emails, icon: Mail, color: "sky" },
                { label: "SMS", value: stats.sms, icon: MessageSquare, color: "violet" },
                { label: "Missed", value: stats.missed_calls, icon: PhoneMissed, color: "rose" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex flex-1 items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2 py-1.5"
                >
                  <Icon size={11} className={`text-${color}-400/70`} />
                  <span className="text-[11px] font-medium text-white">{value ?? 0}</span>
                  <span className="text-[9px] text-zinc-600">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Search & Filters ── */}
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                placeholder="Search communications…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 pl-8 pr-3 text-[12px] text-white placeholder-zinc-600 outline-none focus:border-emerald-500/30"
              />
            </div>
          </div>

          {/* ── Channel Tabs ── */}
          <div className="mt-2.5 flex gap-1">
            {(
              [
                { key: "all", label: "All", icon: Inbox },
                { key: "voice_call", label: "Calls", icon: Phone },
                { key: "email", label: "Email", icon: Mail },
                { key: "sms", label: "SMS", icon: MessageSquare },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setChannelFilter(key)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  channelFilter === key
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Toggle Filters ── */}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                showUnreadOnly
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setShowUnlinkedOnly(!showUnlinkedOnly)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                showUnlinkedOnly
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Unlinked
            </button>
          </div>
        </div>

        {/* ── Feed List ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-emerald-400"
              />
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox size={32} className="mb-3 text-zinc-700" />
              <p className="text-[13px] font-medium text-zinc-500">No communications yet</p>
              <p className="mt-1 text-[11px] text-zinc-700">
                Calls, emails, and messages will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filteredFeed.map((log) => (
                <motion.button
                  key={log.id}
                  onClick={() => openDetail(log)}
                  className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                    selectedLog?.id === log.id ? "bg-white/[0.05]" : ""
                  } ${!log.is_read ? "border-l-2 border-l-emerald-500" : "border-l-2 border-l-transparent"}`}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {channelIcon(log.channel, log.direction, log.status)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`truncate text-[13px] ${!log.is_read ? "font-semibold text-white" : "text-zinc-300"}`}>
                        {log.client_name || log.from_address || "Unknown"}
                      </span>
                      <span className="ml-2 shrink-0 text-[10px] text-zinc-600">
                        {timeAgo(log.created_at)}
                      </span>
                    </div>

                    {/* Subject / Preview */}
                    {log.subject && (
                      <p className="truncate text-[11px] text-zinc-400">{log.subject}</p>
                    )}
                    {log.body_preview && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">
                        {log.body_preview}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="mt-1 flex items-center gap-2">
                      {statusBadge(log.status)}
                      {log.duration_seconds && log.duration_seconds > 0 && (
                        <span className="text-[10px] text-zinc-600">
                          {formatDuration(log.duration_seconds)}
                        </span>
                      )}
                      {log.job_display_id && (
                        <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/70">
                          <Briefcase size={9} />
                          {log.job_display_id}
                        </span>
                      )}
                      {!log.is_linked && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400/70">
                          <AlertCircle size={9} />
                          Unlinked
                        </span>
                      )}
                      {log.has_attachments && (
                        <Paperclip size={10} className="text-zinc-600" />
                      )}
                    </div>
                  </div>

                  {/* Star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(log.id, log.is_starred);
                    }}
                    className="mt-0.5 shrink-0 text-zinc-700 transition hover:text-amber-400"
                  >
                    {log.is_starred ? (
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                    ) : (
                      <Star size={13} className="opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════ RIGHT: Detail ══════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedLog ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.01]" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]"
              >
                <Inbox size={28} className="text-zinc-700" />
              </motion.div>
              <h3 className="text-[15px] font-semibold text-zinc-400">
                Select a communication
              </h3>
              <p className="mt-1 max-w-[280px] text-[12px] text-zinc-600">
                Click any item from the feed to view full details, transcripts, and email threads
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={selectedLog.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 flex-col overflow-y-auto"
            >
              {/* ── Detail Header ── */}
              <div className="border-b border-white/[0.06] px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05]">
                      {channelIcon(selectedLog.channel, selectedLog.direction, selectedLog.status)}
                    </div>
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">
                        {selectedLog.client_name || selectedLog.from_address || "Unknown"}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-zinc-500 capitalize">
                          {selectedLog.direction} {selectedLog.channel.replace("_", " ")}
                        </span>
                        {statusBadge(selectedLog.status)}
                        <span className="text-[10px] text-zinc-600">
                          {new Date(selectedLog.created_at).toLocaleString("en-AU")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!selectedLog.is_linked && (
                      <button
                        onClick={() => setLinkJobModal(selectedLog.id)}
                        className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 transition hover:bg-amber-500/10"
                      >
                        <Link2 size={12} />
                        Link to Job
                      </button>
                    )}
                    {selectedLog.channel === "voice_call" && selectedLog.duration_seconds && selectedLog.duration_seconds > 0 && (
                      <button
                        onClick={() => handleBillable(selectedLog.id)}
                        className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-500/10"
                      >
                        <DollarSign size={12} />
                        Convert to Billable Time
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Address info */}
                <div className="mt-3 flex gap-4 text-[11px] text-zinc-500">
                  {selectedLog.from_address && (
                    <span>
                      <span className="text-zinc-600">From:</span> {selectedLog.from_address}
                    </span>
                  )}
                  {selectedLog.to_address && (
                    <span>
                      <span className="text-zinc-600">To:</span> {selectedLog.to_address}
                    </span>
                  )}
                  {selectedLog.job_display_id && (
                    <span className="flex items-center gap-1 text-emerald-400/80">
                      <Briefcase size={10} />
                      {selectedLog.job_display_id} — {selectedLog.job_title}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Detail Body ── */}
              <div className="flex-1 px-6 py-4">
                {/* Voice Call Detail */}
                {selectedLog.channel === "voice_call" && (
                  <div className="space-y-4">
                    {/* Duration & Recording */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <Clock size={14} className="text-zinc-500" />
                        <span className="text-[14px] font-semibold text-white">
                          {formatDuration(selectedLog.duration_seconds || detailVoip?.duration_seconds)}
                        </span>
                        <span className="text-[11px] text-zinc-600">duration</span>
                      </div>

                      {(selectedLog.recording_url || detailVoip?.recording_url) && (
                        <button
                          onClick={() =>
                            toggleAudio(
                              (selectedLog.recording_url || detailVoip?.recording_url) as string
                            )
                          }
                          className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          {playingAudio === (selectedLog.recording_url || detailVoip?.recording_url) ? (
                            <>
                              <Pause size={14} className="text-emerald-400" />
                              <span>Playing…</span>
                            </>
                          ) : (
                            <>
                              <Play size={14} />
                              <span>Play Recording</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* VOIP Details */}
                    {detailVoip && (
                      <div className="space-y-3">
                        <div className="flex gap-3 text-[11px] text-zinc-500">
                          <span>Call SID: <span className="font-mono text-zinc-400">{detailVoip.twilio_call_sid}</span></span>
                          {detailVoip.call_quality_score && (
                            <span>Quality: <span className="text-zinc-400">{detailVoip.call_quality_score}/5</span></span>
                          )}
                        </div>

                        {/* AI Transcript */}
                        {(detailVoip.ai_transcript || selectedLog.ai_transcript) && (
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                            <button
                              onClick={() => setShowTranscript(!showTranscript)}
                              className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles size={13} className="text-violet-400" />
                                <span className="text-[12px] font-medium text-white">
                                  AI Transcript
                                </span>
                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                  detailVoip.transcript_status === "completed"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}>
                                  {detailVoip.transcript_status}
                                </span>
                              </div>
                              <ChevronDown
                                size={14}
                                className={`text-zinc-600 transition ${showTranscript ? "rotate-180" : ""}`}
                              />
                            </button>
                            <AnimatePresence>
                              {showTranscript && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-white/[0.04] px-4 py-3">
                                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">
                                      {detailVoip.ai_transcript || selectedLog.ai_transcript}
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Notes */}
                        {detailVoip.notes && (
                          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                            <p className="mb-1 text-[10px] font-medium uppercase text-zinc-600">
                              Call Notes
                            </p>
                            <p className="text-[12px] text-zinc-300">{detailVoip.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Email Detail */}
                {selectedLog.channel === "email" && (
                  <div className="space-y-4">
                    {selectedLog.subject && (
                      <h3 className="text-[15px] font-semibold text-white">
                        {selectedLog.subject}
                      </h3>
                    )}

                    {detailEmail && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                          <span>From: <span className="text-zinc-400">{detailEmail.sender_name} &lt;{detailEmail.sender_email}&gt;</span></span>
                          {detailEmail.has_attachments && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Paperclip size={10} />
                              Attachments
                            </span>
                          )}
                        </div>

                        {/* Email body */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                          {detailEmail.body_html ? (
                            <div
                              className="prose prose-invert prose-sm max-w-none text-[13px] text-zinc-300"
                              dangerouslySetInnerHTML={{ __html: detailEmail.body_html }}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                              {detailEmail.body_text || selectedLog.body_preview}
                            </p>
                          )}
                        </div>

                        {/* Attachment list */}
                        {detailEmail.attachment_urls && detailEmail.attachment_urls.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium uppercase text-zinc-600">
                              Attachments
                            </p>
                            {detailEmail.attachment_urls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-sky-400 transition hover:bg-white/[0.04]"
                              >
                                <FileText size={12} />
                                Attachment {i + 1}
                                <ArrowUpRight size={10} className="ml-auto" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Reply */}
                        {!replyMode ? (
                          <button
                            onClick={() => setReplyMode(true)}
                            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[12px] font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                          >
                            <Send size={12} />
                            Reply
                          </button>
                        ) : (
                          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Type your reply…"
                              rows={4}
                              className="w-full resize-none bg-transparent px-4 py-3 text-[13px] text-white placeholder-zinc-600 outline-none"
                            />
                            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
                              <button
                                onClick={() => {
                                  setReplyMode(false);
                                  setReplyText("");
                                }}
                                className="text-[11px] text-zinc-600 transition hover:text-zinc-400"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSendReply}
                                disabled={sendingReply || !replyText.trim()}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                              >
                                <Send size={11} />
                                {sendingReply ? "Sending…" : "Send Reply"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SMS Detail */}
                {selectedLog.channel === "sms" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                      <p className="text-[13px] leading-relaxed text-zinc-300">
                        {selectedLog.body_preview || "No message content"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════ Link to Job Modal ══════════════ */}
      <AnimatePresence>
        {linkJobModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setLinkJobModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[380px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-2xl"
            >
              <h3 className="text-[15px] font-semibold text-white">Link to Job</h3>
              <p className="mt-1 text-[12px] text-zinc-500">
                Enter the Job ID to link this communication
              </p>
              <input
                type="text"
                placeholder="Enter Job ID…"
                value={linkJobId}
                onChange={(e) => setLinkJobId(e.target.value)}
                className="mt-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder-zinc-600 outline-none focus:border-emerald-500/30"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setLinkJobModal(null)}
                  className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-500 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkJob}
                  disabled={!linkJobId}
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  Link
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
