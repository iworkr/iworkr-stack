/**
 * @component components/site-renderer/blocks/PublicVideoEmbed.tsx
 * @status STABLE
 * @description Public Loom site render — PublicVideoEmbed
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { VideoEmbedContent } from "@/components/site-editor/types";

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

export function PublicVideoEmbed({ block }: PublicBlockProps<"video_embed">) {
  const c = block.content as VideoEmbedContent;
  const embedUrl = getEmbedUrl(c.videoUrl);
  const aspect = c.aspectRatio === "4:3" ? "aspect-[4/3]" : c.aspectRatio === "1:1" ? "aspect-square" : "aspect-video";

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-4xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        {embedUrl ? (
          <div className={`overflow-hidden rounded-xl ${aspect}`}>
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className={`flex items-center justify-center rounded-xl bg-gray-100 ${aspect}`}>
            <span className="text-gray-400 text-sm">No video URL provided</span>
          </div>
        )}
      </div>
    </section>
  );
}
