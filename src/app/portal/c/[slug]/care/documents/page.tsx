/**
 * @page /portal/c/[slug]/care/documents
 * @status COMPLETE
 * @description NDIS document vault — service agreements, assessments, and compliance documents
 *   with e-signature support for family-visible documents.
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, FileText, Download, CheckCircle, PenTool, Loader2 } from "lucide-react";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalCareDocuments } from "@/app/actions/portal-client";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

interface Document {
  id: string;
  title: string;
  file_path: string;
  mime_type: string | null;
  status: string;
  requires_signature: boolean;
  signed_at: string | null;
  created_at: string;
}

export default function PortalCareDocumentsPage() {
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const tenant = usePortalStore((s) => s.activeTenant);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!activeEntityId) return;
    setLoading(true);
    getPortalCareDocuments(activeEntityId).then((result) => {
      setDocuments((result.documents || []) as Document[]);
      setLoading(false);
    });
  }, [activeEntityId]);

  const pending = documents.filter((d) => d.requires_signature && d.status !== "signed");
  const signed = documents.filter((d) => d.status === "signed");
  const general = documents.filter((d) => !d.requires_signature && d.status !== "signed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Documents</h1>
        <p className="text-[12px] text-zinc-500">
          Service agreements, assessments, and compliance documents
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-12 text-center">
          <FolderOpen size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400">No documents available</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Documents shared by your care team will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Pending Signatures */}
          {pending.length > 0 && (
            <Section
              title="Requires Your Signature"
              icon={<PenTool size={14} className="text-amber-400" />}
              brandColor={brandColor}
            >
              {pending.map((doc, i) => (
                <DocumentCard key={doc.id} doc={doc} index={i} brandColor={brandColor} />
              ))}
            </Section>
          )}

          {/* General Documents */}
          {general.length > 0 && (
            <Section
              title="Documents"
              icon={<FileText size={14} className="text-zinc-400" />}
              brandColor={brandColor}
            >
              {general.map((doc, i) => (
                <DocumentCard key={doc.id} doc={doc} index={i} brandColor={brandColor} />
              ))}
            </Section>
          )}

          {/* Signed */}
          {signed.length > 0 && (
            <Section
              title="Signed Documents"
              icon={<CheckCircle size={14} className="text-emerald-400" />}
              brandColor={brandColor}
            >
              {signed.map((doc, i) => (
                <DocumentCard key={doc.id} doc={doc} index={i} brandColor={brandColor} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  brandColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-[13px] font-medium text-zinc-300">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DocumentCard({
  doc,
  index,
  brandColor,
}: {
  doc: Document;
  index: number;
  brandColor: string;
}) {
  const isSigned = doc.status === "signed";
  const needsSig = doc.requires_signature && !isSigned;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${brandColor}12` }}
        >
          <FileText size={14} style={{ color: brandColor }} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-200">{doc.title}</p>
          <p className="text-[11px] text-zinc-600">
            Added {fmtDate(doc.created_at)}
            {isSigned && doc.signed_at && ` · Signed ${fmtDate(doc.signed_at)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isSigned && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle size={10} /> Signed
          </span>
        )}
        {needsSig && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            <PenTool size={10} /> Needs signature
          </span>
        )}
        {doc.file_path && (
          <a
            href={doc.file_path}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/[0.08] p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Download size={14} />
          </a>
        )}
      </div>
    </motion.div>
  );
}
