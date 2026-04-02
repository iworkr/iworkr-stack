/**
 * @component components/site-renderer/blocks/PublicDivider.tsx
 * @status STABLE
 * @description Public Loom site render — PublicDivider
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { SiteDividerContent } from "@/components/site-editor/types";

export function PublicDivider({ block }: PublicBlockProps<"divider">) {
  const c = block.content as SiteDividerContent;
  const maxW = c.maxWidth === "narrow" ? "max-w-xl" : c.maxWidth === "medium" ? "max-w-4xl" : "max-w-full";

  return (
    <div className={`mx-auto ${maxW} px-6`}>
      <hr
        style={{ borderTopWidth: c.thickness, borderTopColor: c.color || "#e5e7eb" }}
        className="border-0"
      />
    </div>
  );
}
