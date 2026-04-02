/**
 * @component components/site-renderer/blocks/PublicBookingWidget.tsx
 * @status STABLE
 * @description Public Loom site render — PublicBookingWidget
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { BookingWidgetContent } from "@/components/site-editor/types";

export function PublicBookingWidget({ block, globalStyles }: PublicBlockProps<"booking_widget">) {
  const c = block.content as BookingWidgetContent;

  if (!c.enabled) return null;

  return (
    <section className="py-20 px-6 bg-gray-50" id="booking">
      <div className="mx-auto max-w-xl text-center">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 mb-3" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        {c.description && (
          <p className="text-gray-600 mb-8">{c.description}</p>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-500 mb-4">Live booking integration coming soon.</p>
          <a
            href="#contact"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white"
            style={{
              backgroundColor: globalStyles.primaryColor,
              borderRadius: `var(--site-button-radius)`,
            }}
          >
            Contact Us to Book
          </a>
        </div>
      </div>
    </section>
  );
}
