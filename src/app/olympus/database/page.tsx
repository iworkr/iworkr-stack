"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Schema-Aware Database Mutator
   Safe GUI for viewing/editing raw database rows with full audit trail
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Database,
  Table2,
  ChevronRight,
  ChevronLeft,
  X,
  Save,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  Edit3,
  History,
} from "lucide-react";
import {
  listTables,
  readTableRows,
  updateTableRow,
  deleteTableRow,
  insertTableRow,
  getAuditLogs,
} from "@/app/actions/superadmin";

/* ── Types ────────────────────────────────────────────────────── */

interface AuditLog {
  id: string;
  admin_email: string;
  action_type: string;
  target_table: string;
  target_record_id: string;
  mutation_payload: any;
  created_at: string;
  notes: string;
}

/* ── Tabs ─────────────────────────────────────────────────────── */

type TabId = "explorer" | "audit";
const TABS: { id: TabId; label: string; icon: typeof Database }[] = [
  { id: "explorer", label: "Table Explorer", icon: Table2 },
  { id: "audit", label: "Audit Log", icon: History },
];

/* ── Page ─────────────────────────────────────────────────────── */

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState<TabId>("explorer");
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(0);

  const PAGE_SIZE = 20;

  // Load tables
  useEffect(() => {
    (async () => {
      setTablesLoading(true);
      const result = await listTables();
      if (result.data) {
        const t = result.data as string[];
        setTables(t.sort());
      }
      setTablesLoading(false);
    })();
  }, []);

  // Load rows when table changes
  const loadRows = useCallback(async (table: string, pg: number = 0) => {
    setLoading(true);
    const result = await readTableRows(table, PAGE_SIZE, pg * PAGE_SIZE);
    if (result.data) {
      const r = result.data.rows as any[];
      setRows(r);
      setTotalRows(result.data.total || 0);
      if (r.length > 0) setColumns(Object.keys(r[0]));
      else setColumns([]);
    }
    setLoading(false);
  }, []);

  const selectTable = useCallback((table: string) => {
    setSelectedTable(table);
    setPage(0);
    setEditingRow(null);
    loadRows(table, 0);
  }, [loadRows]);

  const changePage = useCallback((newPage: number) => {
    if (!selectedTable) return;
    setPage(newPage);
    setEditingRow(null);
    loadRows(selectedTable, newPage);
  }, [selectedTable, loadRows]);

  const handleEdit = useCallback((rowId: string, row: any) => {
    setEditingRow(rowId);
    setEditValues({ ...row });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedTable || !editingRow) return;
    // Remove id and timestamps from updates
    const updates = { ...editValues };
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const result = await updateTableRow(selectedTable, editingRow, updates);
    if (result.error) {
      setFeedback(`Error: ${result.error}`);
    } else {
      setFeedback("Row updated successfully");
      setEditingRow(null);
      loadRows(selectedTable, page);
    }
    setTimeout(() => setFeedback(null), 3000);
  }, [selectedTable, editingRow, editValues, page, loadRows]);

  const handleDelete = useCallback(async (rowId: string) => {
    if (!selectedTable) return;
    const result = await deleteTableRow(selectedTable, rowId);
    if (result.error) {
      setFeedback(`Error: ${result.error}`);
    } else {
      setFeedback("Row deleted");
      setShowDeleteConfirm(null);
      loadRows(selectedTable, page);
    }
    setTimeout(() => setFeedback(null), 3000);
  }, [selectedTable, page, loadRows]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setFeedback("Copied");
    setTimeout(() => setFeedback(null), 1500);
  }, []);

  // Load audit logs
  const loadAuditLogs = useCallback(async (pg: number = 0) => {
    setAuditLoading(true);
    const result = await getAuditLogs(PAGE_SIZE, pg * PAGE_SIZE);
    if (result.data) {
      setAuditLogs(result.data.rows as AuditLog[]);
      setAuditTotal(result.data.total || 0);
    }
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "audit") loadAuditLogs(auditPage);
  }, [activeTab, auditPage, loadAuditLogs]);

  const filteredTables = tableSearch ? tables.filter((t) => t.includes(tableSearch.toLowerCase())) : tables;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div>
          <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">DATABASE MUTATOR</span>
          <h2 className="mt-0.5 text-[16px] font-semibold text-white">Schema-Aware Editor</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 rounded-lg bg-white/[0.02] p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors ${
                activeTab === tab.id ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="db-tab"
                  className="absolute inset-0 rounded-md bg-white/[0.06]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon size={11} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-b border-white/[0.04] px-6 py-2">
            <span className={`text-[10px] font-medium ${feedback.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>{feedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === "explorer" && (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Table List ── */}
          <div className="flex w-[200px] min-w-[200px] flex-col border-r border-white/[0.04]">
            <div className="relative border-b border-white/[0.04] p-2">
              <Search size={11} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tables…"
                className="w-full rounded bg-white/[0.02] py-1 pl-7 pr-2 text-[10px] text-zinc-400 placeholder:text-zinc-700 outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {tablesLoading ? (
                <div className="p-2 space-y-0.5">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="h-6 animate-pulse rounded bg-white/[0.02]" />
                  ))}
                </div>
              ) : (
                filteredTables.map((t) => (
                  <button
                    key={t}
                    onClick={() => selectTable(t)}
                    className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[10px] transition-colors ${
                      selectedTable === t
                        ? "bg-red-500/[0.06] text-red-300 font-medium"
                        : "text-zinc-600 hover:bg-white/[0.02] hover:text-zinc-400"
                    }`}
                  >
                    <Table2 size={10} className={selectedTable === t ? "text-red-400" : "text-zinc-700"} />
                    {t}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Row Grid ── */}
          <div className="flex-1 overflow-auto">
            {!selectedTable ? (
              <div className="flex h-full flex-col items-center justify-center">
                <Database size={24} className="text-zinc-800 mb-2" />
                <p className="text-[12px] text-zinc-600">Select a table to browse</p>
              </div>
            ) : loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <Table2 size={24} className="text-zinc-800 mb-2" />
                <p className="text-[12px] text-zinc-600">Table is empty</p>
              </div>
            ) : (
              <div>
                {/* Table info bar */}
                <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-black/95 backdrop-blur px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-red-400">{selectedTable}</span>
                    <span className="text-[9px] text-zinc-700">{totalRows} rows · {columns.length} columns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changePage(Math.max(0, page - 1))} disabled={page === 0} className="rounded px-2 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.04] disabled:opacity-30">
                      <ChevronLeft size={11} />
                    </button>
                    <span className="text-[9px] text-zinc-600 font-mono">{page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalRows)} of {totalRows}</span>
                    <button onClick={() => changePage(page + 1)} disabled={(page + 1) * PAGE_SIZE >= totalRows} className="rounded px-2 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.04] disabled:opacity-30">
                      <ChevronRight size={11} />
                    </button>
                    <button onClick={() => loadRows(selectedTable, page)} className="rounded p-1 text-zinc-700 hover:bg-white/[0.04] hover:text-zinc-400">
                      <RefreshCw size={11} />
                    </button>
                  </div>
                </div>

                {/* Spreadsheet grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="sticky left-0 z-10 bg-black px-3 py-1.5 text-[8px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Actions</th>
                        {columns.map((col) => (
                          <th key={col} className="px-3 py-1.5 text-[8px] font-mono font-bold tracking-wider text-zinc-600 uppercase whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const rowId = row.id;
                        const isEditing = editingRow === rowId;
                        return (
                          <tr key={rowId || JSON.stringify(row)} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                            <td className="sticky left-0 z-10 bg-black px-2 py-1 whitespace-nowrap">
                              <div className="flex items-center gap-0.5">
                                {isEditing ? (
                                  <>
                                    <button onClick={handleSaveEdit} className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10" title="Save">
                                      <Save size={10} />
                                    </button>
                                    <button onClick={() => setEditingRow(null)} className="rounded p-1 text-zinc-600 hover:bg-white/[0.04]" title="Cancel">
                                      <X size={10} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => handleEdit(rowId, row)} className="rounded p-1 text-zinc-700 hover:bg-white/[0.04] hover:text-zinc-400" title="Edit">
                                      <Edit3 size={10} />
                                    </button>
                                    {showDeleteConfirm === rowId ? (
                                      <>
                                        <button onClick={() => handleDelete(rowId)} className="rounded p-1 text-red-400 hover:bg-red-500/10" title="Confirm">
                                          <Check size={10} />
                                        </button>
                                        <button onClick={() => setShowDeleteConfirm(null)} className="rounded p-1 text-zinc-600 hover:bg-white/[0.04]">
                                          <X size={10} />
                                        </button>
                                      </>
                                    ) : (
                                      <button onClick={() => setShowDeleteConfirm(rowId)} className="rounded p-1 text-zinc-700 hover:bg-red-500/10 hover:text-red-400" title="Delete">
                                        <Trash2 size={10} />
                                      </button>
                                    )}
                                    <button onClick={() => copyToClipboard(rowId)} className="rounded p-1 text-zinc-700 hover:bg-white/[0.04] hover:text-zinc-400" title="Copy ID">
                                      <Copy size={10} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            {columns.map((col) => (
                              <td key={col} className="px-3 py-1 whitespace-nowrap max-w-[200px]">
                                {isEditing && col !== "id" && col !== "created_at" ? (
                                  <input
                                    value={typeof editValues[col] === "object" ? JSON.stringify(editValues[col]) : editValues[col] ?? ""}
                                    onChange={(e) => setEditValues({ ...editValues, [col]: e.target.value })}
                                    className="w-full bg-red-500/[0.04] rounded px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none border border-red-500/15 font-mono"
                                  />
                                ) : (
                                  <span className="text-[10px] text-zinc-500 font-mono truncate block max-w-[200px]" title={String(row[col] ?? "")}>
                                    {row[col] === null ? <span className="text-zinc-800 italic">null</span> : typeof row[col] === "object" ? JSON.stringify(row[col]).slice(0, 40) : String(row[col]).slice(0, 60)}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Audit Log Tab ── */}
      {activeTab === "audit" && (
        <div className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-black/95 backdrop-blur px-6 py-2">
            <span className="text-[10px] text-zinc-500">{auditTotal} audit entries</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setAuditPage(Math.max(0, auditPage - 1))} disabled={auditPage === 0} className="rounded px-2 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.04] disabled:opacity-30">Previous</button>
              <span className="text-[9px] text-zinc-600 font-mono">Page {auditPage + 1}</span>
              <button onClick={() => setAuditPage(auditPage + 1)} disabled={(auditPage + 1) * PAGE_SIZE >= auditTotal} className="rounded px-2 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.04] disabled:opacity-30">Next</button>
            </div>
          </div>

          {auditLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <History size={24} className="text-zinc-800 mb-2" />
              <p className="text-[12px] text-zinc-600">No audit entries yet</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-white/[0.02] px-4 py-2.5 hover:bg-white/[0.01]">
                  <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${
                    log.action_type.includes("DELETE") ? "bg-red-500/10 text-red-400" :
                    log.action_type.includes("UPDATE") || log.action_type.includes("OVERRIDE") ? "bg-amber-500/10 text-amber-400" :
                    log.action_type.includes("IMPERSONATE") ? "bg-purple-500/10 text-purple-400" :
                    "bg-zinc-800 text-zinc-500"
                  }`}>
                    <AlertTriangle size={11} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-mono font-bold text-zinc-500">{log.action_type}</span>
                      {log.target_table && (
                        <span className="text-[9px] text-zinc-600 font-mono">{log.target_table}</span>
                      )}
                      <span className="ml-auto text-[9px] text-zinc-700">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">{log.admin_email}</span>
                      {log.target_record_id && (
                        <span className="text-[9px] text-zinc-700 font-mono truncate">{log.target_record_id}</span>
                      )}
                    </div>
                    {log.notes && <p className="mt-0.5 text-[10px] text-zinc-600">{log.notes}</p>}
                    {log.mutation_payload && (
                      <details className="mt-1">
                        <summary className="text-[9px] text-zinc-700 cursor-pointer hover:text-zinc-500">View payload</summary>
                        <pre className="mt-1 rounded bg-white/[0.02] p-2 text-[9px] text-zinc-600 font-mono overflow-x-auto max-h-[100px]">
                          {JSON.stringify(log.mutation_payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
