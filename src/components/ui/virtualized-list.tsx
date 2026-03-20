"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedListProps<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualizedList<T>({
  items,
  estimateSize = 56,
  overscan = 10,
  className = "",
  renderItem,
  getItemKey,
  onEndReached,
  endReachedThreshold = 5,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!onEndReached || !lastItem) return;
    if (lastItem.index >= items.length - endReachedThreshold) {
      onEndReached();
    }
  }, [lastItem?.index, items.length, endReachedThreshold, onEndReached]);

  if (items.length === 0) return null;

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          const key = getItemKey
            ? getItemKey(item, virtualRow.index)
            : virtualRow.index;

          return (
            <div
              key={key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
