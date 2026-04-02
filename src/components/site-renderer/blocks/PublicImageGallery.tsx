/**
 * @component components/site-renderer/blocks/PublicImageGallery.tsx
 * @status STABLE
 * @description Public Loom site render — PublicImageGallery
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
import type { PublicBlockProps } from ".";
import type { ImageGalleryContent } from "@/components/site-editor/types";

export function PublicImageGallery({ block }: PublicBlockProps<"image_gallery">) {
  const c = block.content as ImageGalleryContent;
  const cols = c.columns === 4 ? "md:grid-cols-4" : c.columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  const aspect = c.aspectRatio === "portrait" ? "aspect-[3/4]" : c.aspectRatio === "landscape" ? "aspect-video" : "aspect-square";

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-6xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        <div className={`grid gap-4 ${cols}`}>
          {c.images.map((img) => (
            <div key={img.id} className={`overflow-hidden rounded-xl ${aspect}`}>
              <img src={img.url} alt={img.alt} className="h-full w-full object-cover transition-transform hover:scale-105" />
              {img.caption && (
                <p className="mt-2 text-xs text-gray-500 text-center">{img.caption}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
