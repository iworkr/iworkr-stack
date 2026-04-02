/**
 * @component components/site-renderer/blocks/PublicFaqAccordion.tsx
 * @status STABLE
 * @description Public Loom site render — PublicFaqAccordion
 * @lastReview 2026-03-28
 */
"use client";

import { useState } from "react";
import type { PublicBlockProps } from ".";
import type { FaqAccordionContent } from "@/components/site-editor/types";

export function PublicFaqAccordion({ block }: PublicBlockProps<"faq_accordion">) {
  const c = block.content as FaqAccordionContent;
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-3xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        <div className="space-y-3">
          {c.faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div key={faq.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <span className="text-base font-semibold text-gray-900">{faq.question}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-6 pb-4">
                    <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
