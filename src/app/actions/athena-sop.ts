/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* ── Types ───────────────────────────────────────────── */

export interface KnowledgeArticle {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  content_html: string | null;
  raw_text: string | null;
  video_hls_url: string | null;
  video_duration_seconds: number | null;
  author_id: string | null;
  view_count: number;
  is_mandatory_read: boolean;
  is_offline_critical: boolean;
  status: "draft" | "published" | "archived";
  estimated_read_minutes: number | null;
  difficulty_level: string | null;
  tags: string[] | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  author_name?: string;
  structured_tags?: string[];
}

export interface KnowledgeTag {
  id: string;
  workspace_id: string;
  tag_name: string;
  color_hex: string;
  usage_count: number;
}

export interface ReadReceipt {
  id: string;
  article_id: string;
  worker_id: string;
  context_job_id: string | null;
  watch_time_seconds: number;
  completion_percentage: number;
  acknowledged_at: string | null;
  created_at: string;
}

export interface KnowledgeStats {
  total_articles: number;
  published: number;
  drafts: number;
  with_video: number;
  mandatory: number;
  offline_critical: number;
  total_views: number;
  total_watch_time: number;
  unread_mandatory: number;
}

export interface RecommendedSop {
  id: string;
  title: string;
  description: string | null;
  video_hls_url: string | null;
  video_duration_seconds: number | null;
  is_mandatory_read: boolean;
  estimated_read_minutes: number | null;
  thumbnail_url: string | null;
  content_html: string | null;
  match_type: string;
  match_score: number | null;
}

/* ── 1. Get Knowledge Library ────────────────────────── */

export async function getKnowledgeLibrary(
  orgId: string,
  options?: {
    search?: string;
    status?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc(
      "get_knowledge_library",
      {
        p_workspace_id: orgId,
        p_search: options?.search ?? null,
        p_status: options?.status ?? null,
        p_tag: options?.tag ?? null,
        p_limit: options?.limit ?? 50,
        p_offset: options?.offset ?? 0,
      }
    );

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as KnowledgeArticle[], error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to fetch knowledge library",
    };
  }
}

/* ── 2. Get Knowledge Stats ──────────────────────────── */

export async function getKnowledgeStats(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc(
      "get_knowledge_stats",
      {
        p_workspace_id: orgId,
      }
    );

    if (error) return { data: null, error: error.message };
    return { data: data as KnowledgeStats, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to fetch knowledge stats",
    };
  }
}

/* ── 3. Create Article ───────────────────────────────── */

export async function createArticle(
  orgId: string,
  data: {
    title: string;
    description?: string;
    content_html?: string;
    raw_text?: string;
    category?: string;
    status?: "draft" | "published" | "archived";
    is_mandatory_read?: boolean;
    is_offline_critical?: boolean;
    estimated_read_minutes?: number;
    difficulty_level?: string;
  }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: article, error } = await (supabase as any)
      .from("knowledge_articles")
      .insert({
        workspace_id: orgId,
        title: data.title,
        description: data.description ?? null,
        content_html: data.content_html ?? null,
        raw_text: data.raw_text ?? null,
        category: data.category ?? null,
        status: data.status ?? "draft",
        is_mandatory_read: data.is_mandatory_read ?? false,
        is_offline_critical: data.is_offline_critical ?? false,
        estimated_read_minutes: data.estimated_read_minutes ?? null,
        difficulty_level: data.difficulty_level ?? null,
        author_id: user.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: article as KnowledgeArticle, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to create article",
    };
  }
}

/* ── 4. Update Article ───────────────────────────────── */

export async function updateArticle(
  articleId: string,
  data: Partial<KnowledgeArticle>
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Strip read-only / joined fields before update
    const {
      id: _id,
      created_at: _ca,
      updated_at: _ua,
      author_name: _an,
      structured_tags: _st,
      view_count: _vc,
      ...updateData
    } = data;

    const { data: article, error } = await (supabase as any)
      .from("knowledge_articles")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: article as KnowledgeArticle, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to update article",
    };
  }
}

/* ── 5. Delete Article ───────────────────────────────── */

export async function deleteArticle(articleId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await (supabase as any)
      .from("knowledge_articles")
      .delete()
      .eq("id", articleId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: { deleted: true }, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to delete article",
    };
  }
}

/* ── 6. Publish Article ──────────────────────────────── */

export async function publishArticle(articleId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: article, error } = await (supabase as any)
      .from("knowledge_articles")
      .update({
        status: "published",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: article as KnowledgeArticle, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to publish article",
    };
  }
}

/* ── 7. Get Article By ID ────────────────────────────── */

export async function getArticleById(articleId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: article, error } = await (supabase as any)
      .from("knowledge_articles")
      .select(
        `
        *,
        article_tags (
          knowledge_tags (
            id,
            tag_name,
            color_hex
          )
        )
      `
      )
      .eq("id", articleId)
      .single();

    if (error) return { data: null, error: error.message };

    // Flatten tags into structured_tags array
    const structured_tags =
      article.article_tags
        ?.map((at: any) => at.knowledge_tags?.tag_name)
        .filter(Boolean) ?? [];

    return {
      data: { ...article, structured_tags } as KnowledgeArticle,
      error: null,
    };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to fetch article",
    };
  }
}

/* ── 8. Get Tags ─────────────────────────────────────── */

export async function getTags(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("knowledge_tags")
      .select("*")
      .eq("workspace_id", orgId)
      .order("tag_name", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as KnowledgeTag[], error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to fetch tags",
    };
  }
}

/* ── 9. Create Tag ───────────────────────────────────── */

export async function createTag(
  orgId: string,
  tagName: string,
  colorHex?: string
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: tag, error } = await (supabase as any)
      .from("knowledge_tags")
      .insert({
        workspace_id: orgId,
        tag_name: tagName,
        color_hex: colorHex ?? "#10B981",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: tag as KnowledgeTag, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to create tag",
    };
  }
}

/* ── 10. Add Tag to Article ──────────────────────────── */

export async function addTagToArticle(articleId: string, tagId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("article_tags")
      .insert({
        article_id: articleId,
        tag_id: tagId,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to add tag to article",
    };
  }
}

/* ── 11. Remove Tag from Article ─────────────────────── */

export async function removeTagFromArticle(
  articleId: string,
  tagId: string
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await (supabase as any)
      .from("article_tags")
      .delete()
      .eq("article_id", articleId)
      .eq("tag_id", tagId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: { removed: true }, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to remove tag from article",
    };
  }
}

/* ── 12. Get Job Recommended SOPs ────────────────────── */

export async function getJobRecommendedSops(jobId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc(
      "get_job_recommended_sops",
      {
        p_job_id: jobId,
      }
    );

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as RecommendedSop[], error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to fetch recommended SOPs",
    };
  }
}

/* ── 13. Acknowledge Article ─────────────────────────── */

export async function acknowledgeArticle(
  orgId: string,
  data: {
    articleId: string;
    jobId?: string;
    watchTimeSeconds?: number;
    completionPercentage?: number;
  }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: receipt, error } = await (supabase as any).rpc(
      "acknowledge_article",
      {
        p_workspace_id: orgId,
        p_article_id: data.articleId,
        p_worker_id: user.id,
        p_context_job_id: data.jobId ?? null,
        p_watch_time_seconds: data.watchTimeSeconds ?? 0,
        p_completion_percentage: data.completionPercentage ?? 100,
      }
    );

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/knowledge");
    return { data: receipt as ReadReceipt, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to acknowledge article",
    };
  }
}

/* ── 14. Get Article Read Receipts ───────────────────── */

export async function getArticleReadReceipts(articleId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("article_read_receipts")
      .select("*")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ReadReceipt[], error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to fetch read receipts",
    };
  }
}

/* ── 15. Upload Video for Article ────────────────────── */

export async function uploadVideoForArticle(
  articleId: string,
  formData: FormData
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const file = formData.get("video") as File | null;
    if (!file) return { data: null, error: "No video file provided" };

    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${articleId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("knowledge-media")
      .upload(path, file, {
        contentType: file.type || "video/mp4",
        upsert: true,
      });

    if (uploadError) return { data: null, error: uploadError.message };

    // Update the article with the raw video URL
    const { data: article, error: updateError } = await (supabase as any)
      .from("knowledge_articles")
      .update({
        video_raw_url: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .select()
      .single();

    if (updateError) return { data: null, error: updateError.message };
    revalidatePath("/dashboard/knowledge");
    return { data: article as KnowledgeArticle, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to upload video",
    };
  }
}

/* ── 16. Generate Embedding ──────────────────────────── */

export async function generateEmbedding(articleId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Fetch the article raw text
    const { data: article, error: fetchError } = await (supabase as any)
      .from("knowledge_articles")
      .select("raw_text, title, description")
      .eq("id", articleId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };
    if (!article) return { data: null, error: "Article not found" };

    // Build input text from available content
    const rawText = [article.title, article.description, article.raw_text]
      .filter(Boolean)
      .join("\n\n");

    if (!rawText.trim()) {
      return { data: null, error: "Article has no text content to embed" };
    }

    // Call OpenAI embeddings API
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: rawText,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: result.error?.message || "OpenAI embedding request failed",
      };
    }

    const embedding = result.data[0].embedding;

    // Upsert embedding using service client (bypasses RLS)
    const serviceClient = createServiceClient();
    const { error: upsertError } = await (serviceClient as any)
      .from("article_embeddings")
      .upsert(
        {
          article_id: articleId,
          embedding,
          model: "text-embedding-3-small",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "article_id" }
      );

    if (upsertError) return { data: null, error: upsertError.message };
    return { data: { article_id: articleId, embedded: true }, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error.message || "Failed to generate embedding",
    };
  }
}
