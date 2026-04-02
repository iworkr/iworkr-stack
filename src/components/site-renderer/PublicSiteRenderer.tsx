/**
 * @component components/site-renderer/PublicSiteRenderer.tsx
 * @status STABLE
 * @description Public Loom site render — PublicSiteRenderer
 * @lastReview 2026-03-28
 */
import type { SiteBlock, SiteGlobalStyles } from "@/components/site-editor/types";
import { PUBLIC_BLOCK_REGISTRY } from "./blocks";

interface Props {
  blocks: SiteBlock[];
  globalStyles: SiteGlobalStyles;
  siteName: string;
  workspaceId: string;
}

export function PublicSiteRenderer({ blocks, globalStyles, siteName, workspaceId }: Props) {
  const cssVars = {
    "--site-primary": globalStyles.primaryColor,
    "--site-secondary": globalStyles.secondaryColor,
    "--site-font-heading": globalStyles.fontHeading,
    "--site-font-body": globalStyles.fontBody,
    "--site-button-radius": `${globalStyles.buttonRadius}px`,
  } as React.CSSProperties;

  return (
    <div style={cssVars} className="min-h-screen">
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(globalStyles.fontHeading)}:wght@400;500;600;700;800&family=${encodeURIComponent(globalStyles.fontBody)}:wght@300;400;500;600&display=swap`}
      />
      {blocks.map((block) => {
        const Renderer = PUBLIC_BLOCK_REGISTRY[block.type];
        if (!Renderer) return null;
        return (
          <Renderer
            key={block.id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            block={block as any}
            globalStyles={globalStyles}
            siteName={siteName}
            workspaceId={workspaceId}
          />
        );
      })}
    </div>
  );
}
