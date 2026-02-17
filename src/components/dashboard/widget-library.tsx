"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, TrendingUp, Radio, Inbox, Calendar, Zap, Sparkles, Users, Link, FileText } from "lucide-react";
import { useDashboardStore, WIDGET_REGISTRY } from "@/lib/dashboard-store";

const iconMap: Record<string, typeof TrendingUp> = {
  TrendingUp, Radio, Inbox, Calendar, Zap, Sparkles, Users, Link, FileText,
};

export function WidgetLibrary() {
  const drawerOpen = useDashboardStore((s) => s.drawerOpen);
  const setDrawerOpen = useDashboardStore((s) => s.setDrawerOpen);
  const activeWidgets = useDashboardStore((s) => s.activeWidgets);
  const addWidget = useDashboardStore((s) => s.addWidget);

  const availableWidgets = WIDGET_REGISTRY.filter(
    (w) => !activeWidgets.includes(w.id)
  );

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed top-0 right-0 z-50 flex h-full w-80 flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-5 py-4">
              <div>
                <h3 className="text-[14px] font-medium text-zinc-200">Add Widget</h3>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Drag widgets to your dashboard
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>

            {/* Widget List */}
            <div className="flex-1 overflow-y-auto p-4">
              {availableWidgets.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Sparkles size={20} className="mb-2 text-zinc-700" />
                  <p className="text-[12px] text-zinc-600">All widgets are on your dashboard</p>
                  <p className="mt-0.5 text-[10px] text-zinc-700">Remove some to add different ones.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableWidgets.map((widget) => {
                    const Icon = iconMap[widget.icon] || Zap;
                    return (
                      <motion.button
                        key={widget.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addWidget(widget.id)}
                        className="flex w-full items-start gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 text-left transition-all hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)]"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.04)]">
                          <Icon size={16} strokeWidth={1.5} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-zinc-300">
                            {widget.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-600">
                            {widget.description}
                          </div>
                        </div>
                        <Plus size={16} className="mt-1 shrink-0 text-zinc-600" />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
