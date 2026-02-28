"use server";

import { sendEmail } from "@/lib/email/send";
import { createElement } from "react";
import { z } from "zod";
import { rateLimit, RateLimits } from "@/lib/rate-limit";

const SUPPORT_EMAIL = process.env.ADMIN_EMAIL || "support@iworkr.com";

const ContactFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").max(255),
  subject: z.enum(["support", "sales", "bug", "other"]),
  message: z.string().min(1, "Message is required").max(5000),
});

interface ContactFormData {
  name: string;
  email: string;
  subject: "support" | "sales" | "bug" | "other";
  message: string;
}

const subjectLabels: Record<string, string> = {
  support: "Support Request",
  sales: "Sales Inquiry",
  bug: "Bug Report",
  other: "General Inquiry",
};

function InternalNotification({
  name,
  email,
  subject,
  message,
}: ContactFormData) {
  return createElement(
    "div",
    {
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#e4e4e7",
        backgroundColor: "#09090b",
        padding: "32px",
        borderRadius: "12px",
      },
    },
    createElement(
      "h1",
      {
        style: {
          fontSize: "20px",
          fontWeight: 600,
          color: "#00E676",
          marginBottom: "16px",
        },
      },
      `New ${subjectLabels[subject]} from iWorkr`
    ),
    createElement(
      "table",
      {
        style: {
          width: "100%",
          borderCollapse: "collapse" as const,
          fontSize: "14px",
        },
      },
      createElement(
        "tbody",
        null,
        ...[
          ["Name", name],
          ["Email", email],
          ["Category", subjectLabels[subject]],
        ].map(([label, value]) =>
          createElement(
            "tr",
            { key: label },
            createElement(
              "td",
              {
                style: {
                  padding: "8px 12px",
                  color: "#a1a1aa",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  width: "100px",
                },
              },
              label
            ),
            createElement(
              "td",
              {
                style: {
                  padding: "8px 12px",
                  color: "#e4e4e7",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                },
              },
              value
            )
          )
        )
      )
    ),
    createElement(
      "div",
      {
        style: {
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.06)",
        },
      },
      createElement(
        "p",
        { style: { fontSize: "12px", color: "#a1a1aa", marginBottom: "8px" } },
        "Message:"
      ),
      createElement(
        "p",
        { style: { fontSize: "14px", color: "#e4e4e7", whiteSpace: "pre-wrap" as const } },
        message
      )
    )
  );
}

function AutoReply({ name }: { name: string }) {
  return createElement(
    "div",
    {
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#3f3f46",
        maxWidth: "480px",
        margin: "0 auto",
      },
    },
    createElement(
      "div",
      {
        style: {
          backgroundColor: "#09090b",
          padding: "32px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)",
        },
      },
      createElement(
        "h1",
        {
          style: {
            fontSize: "20px",
            fontWeight: 600,
            color: "#ededed",
            marginBottom: "8px",
          },
        },
        `Thanks, ${name}!`
      ),
      createElement(
        "p",
        {
          style: {
            fontSize: "14px",
            color: "#a1a1aa",
            lineHeight: "1.6",
            marginBottom: "20px",
          },
        },
        "We've received your message and our team will get back to you within 24 hours. In the meantime, feel free to check our documentation or reach out directly."
      ),
      createElement(
        "a",
        {
          href: "https://iworkrapp.com",
          style: {
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "#00E676",
            color: "#000000",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          },
        },
        "Visit iWorkr"
      )
    ),
    createElement(
      "p",
      {
        style: {
          fontSize: "12px",
          color: "#71717a",
          textAlign: "center" as const,
          marginTop: "16px",
        },
      },
      "iWorkr — The Operating System for Service Work"
    )
  );
}

export async function submitContactForm(data: ContactFormData): Promise<{ success: boolean; error?: string }> {
  // Validate input with Zod
  const parsed = ContactFormSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  // Rate limit by email to prevent spam
  const rl = rateLimit(`contact:${data.email}`, RateLimits.api);
  if (!rl.success) {
    return { success: false, error: "Too many submissions. Please try again later." };
  }

  const { name, email, subject, message } = parsed.data;

  try {
    const [internalResult, autoReplyResult] = await Promise.all([
      sendEmail({
        to: SUPPORT_EMAIL,
        subject: `[${subjectLabels[subject]}] Contact from ${name}`,
        react: createElement(InternalNotification, { name, email, subject, message }),
        replyTo: email,
        tags: [
          { name: "category", value: subject },
          { name: "source", value: "contact-form" },
        ],
      }),
      sendEmail({
        to: email,
        subject: "We received your message — iWorkr",
        react: createElement(AutoReply, { name }),
        tags: [
          { name: "type", value: "auto-reply" },
          { name: "source", value: "contact-form" },
        ],
      }),
    ]);

    if (!internalResult.success) {
      console.error("[Contact] Internal email failed:", internalResult.error);
      return { success: false, error: "Failed to send message. Please try again." };
    }

    if (!autoReplyResult.success) {
      console.warn("[Contact] Auto-reply failed:", autoReplyResult.error);
    }

    return { success: true };
  } catch (err) {
    console.error("[Contact] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
