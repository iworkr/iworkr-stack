/**
 * @page /dashboard/finance/invoices/new
 * @status COMPLETE
 * @description Moneta-Canvas — WYSIWYG block-based invoice editor with drag-and-drop, contextual panels, inline editing, and dual-render PDF pipeline
 * @dataSource zustand (invoice-editor-store) + server-action
 * @lastAudit 2026-03-26
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Copy,
  ExternalLink,
  Link2,
  Check,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useClientsStore } from "@/lib/clients-store";
import { useFinanceStore } from "@/lib/finance-store";
import { dispatchInvoiceEmail } from "@/app/actions/finance";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { EditorTopBar } from "@/components/finance/editor/EditorTopBar";
import { PropertyPanel } from "@/components/finance/editor/PropertyPanel";
import { PaperCanvas } from "@/components/finance/editor/PaperCanvas";
import { standardTemplate, ndisTemplate } from "@/components/finance/editor/templates";
import type {
  LineItemsContent,
  NdisLineItemsContent,
  ClientDetailsContent,
  MetaContent,
  NotesContent,
  ProgressClaimContent,
} from "@/components/finance/editor/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export default function InvoiceEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgId } = useOrg();
  const { currentOrg } = useAuthStore();
  const { isCare } = useIndustryLexicon();
  const storeClients = useClientsStore((s) => s.clients);
  const { createInvoiceServer } = useFinanceStore();
  const { addToast } = useToastStore();
  const hasValidOrgContext = isUuid(orgId);

  const prefillClientId = searchParams.get("client_id");
  const prefillJobId = searchParams.get("job_id");

  const blocks = useInvoiceEditorStore((s) => s.blocks);
  const setBlocks = useInvoiceEditorStore((s) => s.setBlocks);
  const setWorkspace = useInvoiceEditorStore((s) => s.setWorkspace);
  const setGlobalSettings = useInvoiceEditorStore((s) => s.setGlobalSettings);
  const getTotals = useInvoiceEditorStore((s) => s.getTotals);
  const updateBlockContent = useInvoiceEditorStore((s) => s.updateBlockContent);
  const reset = useInvoiceEditorStore((s) => s.reset);

  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<{
    displayId: string;
    invoiceId: string;
    paymentLink: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const initializedRef = useRef(false);

  // Initialize editor with template
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    reset();
    const tpl = isCare ? ndisTemplate() : standardTemplate();
    setBlocks(tpl);
  }, [isCare, reset, setBlocks]);

  // Sync workspace branding
  useEffect(() => {
    if (!currentOrg) return;
    setWorkspace({
      name: currentOrg.name || "Your Company",
      logo_url: (currentOrg as any)?.brand_logo_url || (currentOrg as any)?.logo_url || null,
      brand_color_hex: (currentOrg as any)?.brand_color_hex || "#10B981",
      tax_id: (currentOrg as any)?.settings?.tax_id || null,
      address: (currentOrg as any)?.settings?.address || null,
      email: (currentOrg as any)?.settings?.email || null,
      phone: (currentOrg as any)?.settings?.phone || null,
    });
    setGlobalSettings({
      brandColor: (currentOrg as any)?.brand_color_hex || "#10B981",
    });
  }, [currentOrg, setWorkspace, setGlobalSettings]);

  // Auto-select client from query param
  useEffect(() => {
    if (!prefillClientId || storeClients.length === 0) return;
    const cl = storeClients.find((c: any) => c.id === prefillClientId);
    if (!cl) return;
    const clientBlock = blocks.find((b) => b.type === "client_details");
    if (clientBlock && !(clientBlock.content as ClientDetailsContent).clientId) {
      updateBlockContent(clientBlock.id, {
        clientId: cl.id,
        clientName: cl.name,
        clientEmail: cl.email || null,
        clientAddress: cl.address || null,
      });
    }
  }, [prefillClientId, storeClients, blocks, updateBlockContent]);

  // Validation: need client + at least one monetary block with items
  const isValid = useCallback(() => {
    if (!hasValidOrgContext) return false;
    const clientBlock = blocks.find((b) => b.type === "client_details");
    if (!clientBlock || !(clientBlock.content as ClientDetailsContent).clientId) return false;

    const hasLineItems = blocks.some(
      (b) =>
        (b.type === "line_items" && (b.content as LineItemsContent).items.length > 0) ||
        (b.type === "ndis_line_items" && (b.content as NdisLineItemsContent).items.length > 0) ||
        (b.type === "progress_claim" &&
          (b.content as ProgressClaimContent).milestones.some((m) => m.completed)),
    );
    if (!hasLineItems) return false;

    const totals = getTotals();
    return totals.total > 0;
  }, [blocks, hasValidOrgContext, getTotals]);

  // Extract data from blocks for server persistence
  function extractSavePayload(mode: "draft" | "send") {
    const clientBlock = blocks.find((b) => b.type === "client_details");
    const metaBlock = blocks.find((b) => b.type === "meta");
    const notesBlock = blocks.find((b) => b.type === "notes");
    const settings = useInvoiceEditorStore.getState().globalSettings;

    const client = clientBlock?.content as ClientDetailsContent | undefined;
    const meta = metaBlock?.content as MetaContent | undefined;
    const notes = notesBlock?.content as NotesContent | undefined;

    const lineItems: { description: string; quantity: number; unit_price: number }[] = [];
    for (const b of blocks) {
      if (b.type === "line_items") {
        for (const item of (b.content as LineItemsContent).items) {
          lineItems.push({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          });
        }
      } else if (b.type === "ndis_line_items") {
        for (const item of (b.content as NdisLineItemsContent).items) {
          lineItems.push({
            description: `${item.supportItemCode} — ${item.description}`,
            quantity: item.hours,
            unit_price: item.rate,
          });
        }
      }
    }

    return {
      organization_id: orgId!,
      client_id: client?.clientId || null,
      client_name: client?.clientName || null,
      client_email: client?.clientEmail || null,
      client_address: client?.clientAddress || null,
      job_id: prefillJobId || null,
      status: mode === "send" ? ("sent" as const) : ("draft" as const),
      issue_date: meta?.issueDate || new Date().toISOString().split("T")[0],
      due_date: meta?.dueDate || undefined,
      tax_rate: settings.taxRate,
      notes: notes?.text || null,
      metadata: {
        blocks_json: blocks,
        editor_version: 2,
        global_settings: settings,
      },
      line_items: lineItems,
    };
  }

  const handleSave = useCallback(
    async (mode: "draft" | "send") => {
      if (!hasValidOrgContext || !isValid() || saving) return;
      setSaving(true);
      try {
        const payload = extractSavePayload(mode);
        const result = await createInvoiceServer(payload);
        if (result.success && result.invoiceId) {
          const payLink = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/pay/${result.invoiceId}`;

          if (mode === "send" && payload.client_email) {
            const totals = getTotals();
            const emailItems = payload.line_items.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              rate: li.unit_price,
              total: Math.round(li.quantity * li.unit_price * 100) / 100,
            }));
            dispatchInvoiceEmail({
              invoiceId: result.invoiceId,
              displayId: result.displayId || "Invoice",
              clientEmail: payload.client_email,
              clientName: payload.client_name || "",
              orgName: useInvoiceEditorStore.getState().workspace.name,
              orgLogo: useInvoiceEditorStore.getState().workspace.logo_url || undefined,
              issueDate: payload.issue_date || new Date().toISOString().split("T")[0],
              dueDate: payload.due_date || "",
              lineItems: emailItems,
              subtotal: totals.subtotal,
              tax: totals.tax,
              total: totals.total,
              paymentUrl: payLink,
              currency: "AUD",
            }).catch(() => {});
          }

          setSavedInvoice({
            displayId: result.displayId || "Invoice",
            invoiceId: result.invoiceId,
            paymentLink: payLink,
          });
          addToast(mode === "send" ? "Invoice sent" : "Invoice saved as draft");
        } else if (result.success) {
          addToast(mode === "send" ? "Invoice sent" : "Invoice saved as draft");
          router.push("/dashboard/finance");
        } else {
          addToast(`Error: ${result.error || "Failed to save"}`, undefined, "error");
        }
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasValidOrgContext, saving, orgId, createInvoiceServer, addToast, router],
  );

  const handlePreviewPdf = useCallback(async () => {
    if (!isValid() || pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const settings = useInvoiceEditorStore.getState().globalSettings;
      const workspace = useInvoiceEditorStore.getState().workspace;

      const res = await fetch("/api/invoices/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, globalSettings: settings, workspace }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      addToast("Failed to generate PDF preview", undefined, "error");
    } finally {
      setPdfGenerating(false);
    }
  }, [blocks, pdfGenerating, isValid, addToast]);

  function handleCopyLink() {
    if (!savedInvoice) return;
    navigator.clipboard?.writeText(savedInvoice.paymentLink);
    setLinkCopied(true);
    addToast("Payment link copied");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  // Success screen
  if (savedInvoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[var(--surface-1)] px-6">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-[var(--noise-opacity)]" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-zinc-100">
            {savedInvoice.displayId} Created
          </h2>
          <p className="mb-6 text-sm text-zinc-500">
            {isCare
              ? "Your claim is ready. Share the payment link or submit via PRODA."
              : "Your invoice is ready. Share the payment link with your client."}
          </p>

          <div className="mb-4 rounded-xl border border-[var(--border-active)] bg-white/[0.03] p-4">
            <label className="mb-2 block text-left font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Payment Link
            </label>
            <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--border-base)] bg-[var(--background)] px-3 py-2.5">
              <Link2 size={13} className="shrink-0 text-zinc-600" />
              <span className="min-w-0 flex-1 truncate text-left text-[12px] text-zinc-400">
                {savedInvoice.paymentLink}
              </span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
              >
                {linkCopied ? (
                  <Check size={13} className="text-emerald-400" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
            <button
              onClick={handleCopyLink}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              <Copy size={13} />
              {linkCopied ? "Copied!" : "Copy Payment Link"}
            </button>
            <button
              onClick={() => window.open(savedInvoice.paymentLink, "_blank")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-active)] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <ExternalLink size={13} />
              Preview Payment Portal
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                router.push(
                  `/dashboard/finance/invoices/${savedInvoice.displayId}`,
                )
              }
              className="flex-1 rounded-lg border border-[var(--border-base)] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              View Invoice
            </button>
            <button
              onClick={() => router.push("/dashboard/finance")}
              className="flex-1 rounded-lg border border-[var(--border-base)] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              Back to Finance
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--surface-1)]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-noise opacity-[var(--noise-opacity)]" />

      <EditorTopBar
        onSave={handleSave}
        onPreviewPdf={handlePreviewPdf}
        saving={saving}
        isValid={isValid()}
      />

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <PropertyPanel />
        <PaperCanvas />
      </div>

      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative w-[90vw] max-w-4xl h-[85vh] rounded-xl border border-[var(--border-base)] bg-zinc-900 overflow-hidden">
            <div className="flex h-10 items-center justify-between border-b border-[var(--border-base)] px-4">
              <span className="font-mono text-[9px] font-medium tracking-widest text-zinc-500 uppercase">
                PDF Preview
              </span>
              <button
                onClick={() => {
                  if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                  setPdfPreviewUrl(null);
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Close
              </button>
            </div>
            <iframe
              src={`${pdfPreviewUrl}#toolbar=0&navpanes=0`}
              title="PDF Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          </div>
        </div>
      )}

      {pdfGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 border border-[var(--border-base)]">
            <Loader2 size={16} className="animate-spin text-emerald-400" />
            <span className="text-sm text-zinc-300">Generating PDF…</span>
          </div>
        </div>
      )}
    </div>
  );
}
