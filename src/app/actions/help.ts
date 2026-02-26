"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────────── */

const CreateThreadSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required").max(10000),
  category: z.string().min(1).max(100),
});

const CreateTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  severity: z.string().min(1).max(50),
  message: z.string().min(1, "Message is required").max(10000),
  orgId: z.string().uuid().optional(),
});

/* ── Types ────────────────────────────────────────────── */

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  category: string;
  icon: string;
  sort_order: number;
}

export interface HelpThread {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  category: string;
  is_solved: boolean;
  upvotes: number;
  reply_count: number;
  created_at: string;
}

export interface HelpTicket {
  id: string;
  subject: string;
  severity: string;
  message: string;
  status: string;
  created_at: string;
}

/* ── Articles ─────────────────────────────────────────── */

export async function getHelpArticles(): Promise<{ data: HelpArticle[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, title, slug, content, summary, category, icon, sort_order")
    .eq("published", true)
    .order("sort_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function getArticleBySlug(slug: string): Promise<{ data: HelpArticle | null; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, title, slug, content, summary, category, icon, sort_order")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function searchArticles(query: string): Promise<{ data: HelpArticle[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const q = `%${query}%`;
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, title, slug, content, summary, category, icon, sort_order")
    .eq("published", true)
    .or(`title.ilike.${q},content.ilike.${q},summary.ilike.${q}`)
    .order("sort_order", { ascending: true })
    .limit(10);

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

/* ── Threads ──────────────────────────────────────────── */

export async function getHelpThreads(): Promise<{ data: HelpThread[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("help_threads")
    .select("id, author_id, title, content, category, is_solved, upvotes, reply_count, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function createThread(title: string, content: string, category: string): Promise<{ data: HelpThread | null; error?: string }> {
  // Validate input
  const parsed = CreateThreadSchema.safeParse({ title, content, category });
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("help_threads")
    .insert({ title, content, category, author_id: user.id })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  revalidatePath("/dashboard/help");
  return { data };
}

export async function upvoteThread(threadId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("increment_field", {
    table_name: "help_threads",
    field_name: "upvotes",
    row_id: threadId,
  });

  if (error) {
    // Fallback: manually read current value and increment
    const { data: thread, error: fetchError } = await supabase
      .from("help_threads")
      .select("upvotes")
      .eq("id", threadId)
      .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    const currentUpvotes = thread?.upvotes ?? 0;
    const { error: updateError } = await supabase
      .from("help_threads")
      .update({ upvotes: currentUpvotes + 1 })
      .eq("id", threadId);
    if (updateError) return { error: updateError.message };
  }
  return {};
}

/* ── Tickets ──────────────────────────────────────────── */

export async function createTicket(params: {
  subject: string;
  severity: string;
  message: string;
  orgId?: string;
}): Promise<{ data: HelpTicket | null; error?: string }> {
  // Validate input
  const parsed = CreateTicketSchema.safeParse(params);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("help_tickets")
    .insert({
      user_id: user.id,
      organization_id: params.orgId || null,
      subject: params.subject,
      severity: params.severity,
      message: params.message,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function getMyTickets(): Promise<{ data: HelpTicket[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("help_tickets")
    .select("id, subject, severity, message, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

/* ── AI Search (Text-based with smart matching) ───────── */

export async function aiSearch(query: string): Promise<{
  answer: string;
  sources: { title: string; slug: string }[];
  error?: string;
}> {
  if (!query.trim()) return { answer: "", sources: [] };

  const { data: articles } = await searchArticles(query);

  if (!articles || articles.length === 0) {
    return {
      answer: "I couldn't find any articles matching your query. Try rephrasing your question, or browse the Knowledge Base categories below.",
      sources: [],
    };
  }

  const topArticles = articles.slice(0, 3);
  const contextParts = topArticles.map((a) => `**${a.title}**\n${a.content}`);

  const answer = generateAnswer(query, topArticles);
  const sources = topArticles.map((a) => ({ title: a.title, slug: a.slug }));

  return { answer, sources };
}

function generateAnswer(query: string, articles: HelpArticle[]): string {
  if (articles.length === 0) return "No relevant articles found.";

  const q = query.toLowerCase();
  const primary = articles[0];

  const lines = primary.content.split("\n").filter((l) => l.trim());
  const relevantLines = lines.filter((l) => {
    const lower = l.toLowerCase();
    return q.split(" ").some((word) => word.length > 2 && lower.includes(word));
  });

  const summary = relevantLines.length > 0
    ? relevantLines.slice(0, 6).join("\n")
    : lines.slice(0, 8).join("\n");

  let answer = `Based on our documentation, here's what I found:\n\n${summary}`;

  if (articles.length > 1) {
    answer += `\n\nYou might also find these helpful:\n`;
    articles.slice(1).forEach((a) => {
      answer += `- **${a.title}**: ${a.summary || ""}\n`;
    });
  }

  return answer;
}
