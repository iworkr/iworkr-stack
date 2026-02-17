"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical, Pencil, RotateCcw, Plus, Check } from "lucide-react";
import { useDashboardStore, type WidgetSize } from "@/lib/dashboard-store";
import { saveDashboardLayout } from "@/app/actions/dashboard";
import { useOrg } from "@/lib/hooks/use-org";

import { WidgetRevenue } from "./widget-revenue";
import { WidgetMap } from "./widget-map";
import { WidgetInbox } from "./widget-inbox";
import { WidgetSchedule } from "./widget-schedule";
import { WidgetActions } from "./widget-actions";
import { WidgetInsights } from "./widget-insights";
import { WidgetTeamStatus } from "./widget-team-status";
import { WidgetQuickLinks } from "./widget-quick-links";
import { WidgetNotepad } from "./widget-notepad";
import { WidgetLibrary } from "./widget-library";

import "react-grid-layout/css/styles.css";

/* ── Widget Size Classification ─────────────────────── */

function classifySize(w: number, h: number): WidgetSize {
  const area = w * h;
  if (area <= 1) return "small";
  if (area <= 4) return "medium";
  return "large";
}

/* ── Widget Renderer ────────────────────────────────── */

function renderWidget(id: string, size: WidgetSize) {
  switch (id) {
    case "revenue":   return <WidgetRevenue size={size} />;
    case "dispatch":  return <WidgetMap size={size} />;
    case "inbox":     return <WidgetInbox size={size} />;
    case "schedule":  return <WidgetSchedule size={size} />;
    case "actions":   return <WidgetActions size={size} />;
    case "insights":  return <WidgetInsights size={size} />;
    case "team":      return <WidgetTeamStatus size={size} />;
    case "links":     return <WidgetQuickLinks size={size} />;
    case "notepad":   return <WidgetNotepad size={size} />;
    default:          return <div className="p-4 text-zinc-600 text-[12px]">Unknown widget</div>;
  }
}

/* ── Grid Component ─────────────────────────────────── */

const ROW_HEIGHT = 100;
const MARGIN: [number, number] = [16, 16];
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 4, md: 4, sm: 2, xs: 1, xxs: 1 };

export function DashboardGrid() {
  const { orgId } = useOrg();
  const layouts = useDashboardStore((s) => s.layouts);
  const setLayouts = useDashboardStore((s) => s.setLayouts);
  const activeWidgets = useDashboardStore((s) => s.activeWidgets);
  const editMode = useDashboardStore((s) => s.editMode);
  const removeWidget = useDashboardStore((s) => s.removeWidget);
  const setDrawerOpen = useDashboardStore((s) => s.setDrawerOpen);
  const resetLayout = useDashboardStore((s) => s.resetLayout);
  const setEditMode = useDashboardStore((s) => s.setEditMode);

  const { containerRef, width: containerWidth, mounted } = useContainerWidth();

  // Debounce save to Supabase
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);

  const persistLayout = useCallback(
    (newLayouts: ResponsiveLayouts) => {
      setLayouts(newLayouts);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        await saveDashboardLayout(newLayouts);
        setSaving(false);
      }, 1500);
    },
    [setLayouts]
  );

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      persistLayout(allLayouts);
    },
    [persistLayout]
  );

  // Build size map from current lg layout
  const sizeMap = useMemo(() => {
    const map: Record<string, WidgetSize> = {};
    const lgLayout = layouts.lg || [];
    for (const item of lgLayout) {
      map[item.i] = classifySize(item.w, item.h);
    }
    return map;
  }, [layouts]);

  // Filter layouts to only include active widgets
  const filteredLayouts = useMemo(() => {
    const result: ResponsiveLayouts = {};
    for (const bp of Object.keys(layouts)) {
      result[bp] = (layouts[bp] || []).filter((l) =>
        activeWidgets.includes(l.i)
      );
    }
    return result;
  }, [layouts, activeWidgets]);

  return (
    <div ref={containerRef}>
      {/* Edit Mode Toolbar */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mb-4 flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2.5 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <Pencil size={14} className="text-indigo-400" />
              <span className="text-[13px] font-medium text-indigo-300">
                Editing Layout
              </span>
              <span className="text-[11px] text-indigo-400/60">
                Drag to reorder, resize handles in corners
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saving && (
                <span className="text-[10px] text-zinc-500">Saving...</span>
              )}
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.1)] px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
              >
                <Plus size={13} />
                Add Widget
              </button>
              <button
                onClick={resetLayout}
                className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.1)] px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
              >
                <RotateCcw size={13} />
                Reset
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-indigo-400"
              >
                <Check size={13} />
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {mounted && containerWidth > 0 && (
        <ResponsiveGridLayout
          width={containerWidth}
          layouts={filteredLayouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={[0, 0]}
          dragConfig={{
            enabled: editMode,
            handle: ".widget-drag-handle",
            threshold: 3,
            bounded: false,
          }}
          resizeConfig={{
            enabled: editMode,
            handles: ["se"],
          }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
        >
          {activeWidgets.map((widgetId) => (
            <div key={widgetId} className="relative">
              {/* Edit mode overlay */}
              {editMode && (
                <div className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-2 ring-indigo-500/30 ring-offset-1 ring-offset-black/50" />
              )}

              {/* Drag handle + remove button (edit mode only) */}
              {editMode && (
                <>
                  <div className="widget-drag-handle absolute top-0 left-0 z-30 flex cursor-grab items-center gap-0.5 rounded-br-lg rounded-tl-xl bg-[rgba(0,0,0,0.7)] px-2 py-1 active:cursor-grabbing">
                    <GripVertical size={12} className="text-zinc-500" />
                    <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">
                      {widgetId}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWidget(widgetId);
                    }}
                    className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white transition-transform hover:scale-110"
                  >
                    <X size={10} />
                  </button>
                </>
              )}

              {/* Widget content */}
              <div className="h-full overflow-hidden rounded-xl">
                {renderWidget(widgetId, sizeMap[widgetId] || "medium")}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {/* Widget Library Drawer */}
      <WidgetLibrary />
    </div>
  );
}
