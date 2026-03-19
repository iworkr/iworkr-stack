// Edge Function: ingest-regulation
// Project Solon-Law — PDF → Chunks → Embeddings → Vector DB
// Pipeline: Supabase Storage PDF → text extraction → recursive splitting → OpenAI embeddings → bulk insert

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 50;

function recursiveCharacterSplit(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const separators = ["\n\n", "\n", ". ", " "];
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining);
      break;
    }

    let splitAt = chunkSize;
    for (const sep of separators) {
      const lastIdx = remaining.lastIndexOf(sep, chunkSize);
      if (lastIdx > chunkSize * 0.3) {
        splitAt = lastIdx + sep.length;
        break;
      }
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(Math.max(0, splitAt - overlap)).trim();
  }

  return chunks.filter((c) => c.length > 20);
}

function extractMetadata(
  chunk: string,
  index: number,
  totalChunks: number
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    chunk_index: index,
    total_chunks: totalChunks,
  };

  const clauseMatch = chunk.match(
    /(?:clause|section|article|rule)\s+(\d+[\.\d]*)/i
  );
  if (clauseMatch) meta.clause_ref = clauseMatch[1];

  const chapterMatch = chunk.match(
    /(?:chapter|part|division)\s+(\d+[\.\d]*)/i
  );
  if (chapterMatch) meta.chapter = chapterMatch[1];

  return meta;
}

async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI Embeddings error: ${await res.text()}`);
  }

  const data = await res.json();
  return (data.data as { embedding: number[] }[])
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Simple PDF text extraction — extracts readable text streams
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  // Extract text between BT (Begin Text) and ET (End Text) markers
  const textSegments: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const streamContent = match[1];
    const tjMatches = streamContent.match(/\(([^)]*)\)/g);
    if (tjMatches) {
      for (const tj of tjMatches) {
        const cleaned = tj.slice(1, -1).replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
        if (cleaned.trim().length > 1) {
          textSegments.push(cleaned);
        }
      }
    }
  }

  let result = textSegments.join(" ");

  // Fallback: if PDF text extraction yields little, try treating as raw text
  if (result.trim().length < 100) {
    result = text
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{3,}/g, "\n")
      .trim();
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const {
      framework_id,
      storage_path,
      raw_text,
    } = body as {
      framework_id: string;
      storage_path?: string;
      raw_text?: string;
    };

    if (!framework_id) {
      return new Response(
        JSON.stringify({ error: "framework_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update ingestion status
    await supabase.from("regulatory_frameworks").update({
      ingestion_status: "extracting",
      updated_at: new Date().toISOString(),
    }).eq("id", framework_id);

    // Get text content
    let fullText = raw_text ?? "";

    if (!fullText && storage_path) {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("compliance-raw")
        .download(storage_path);

      if (dlErr || !fileData) {
        throw new Error(`Storage download failed: ${dlErr?.message}`);
      }

      const buffer = await fileData.arrayBuffer();
      fullText = await extractTextFromPdf(buffer);
    }

    if (!fullText || fullText.trim().length < 50) {
      await supabase.from("regulatory_frameworks").update({
        ingestion_status: "failed",
        updated_at: new Date().toISOString(),
      }).eq("id", framework_id);

      return new Response(
        JSON.stringify({ error: "Could not extract sufficient text from PDF" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status
    await supabase.from("regulatory_frameworks").update({
      ingestion_status: "chunking",
      updated_at: new Date().toISOString(),
    }).eq("id", framework_id);

    // Chunk the text
    const chunks = recursiveCharacterSplit(fullText, CHUNK_SIZE, CHUNK_OVERLAP);

    // Delete existing chunks for this framework (re-ingestion)
    await supabase.from("regulatory_chunks")
      .delete()
      .eq("framework_id", framework_id);

    // Update status
    await supabase.from("regulatory_frameworks").update({
      ingestion_status: "embedding",
      updated_at: new Date().toISOString(),
    }).eq("id", framework_id);

    // Process in batches
    let totalInserted = 0;

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch);

      const rows = batch.map((content, idx) => ({
        framework_id,
        chunk_index: i + idx,
        content,
        metadata: extractMetadata(content, i + idx, chunks.length),
        embedding: JSON.stringify(embeddings[idx]),
        token_count: Math.ceil(content.length / 4),
      }));

      const { error: insertErr } = await supabase
        .from("regulatory_chunks")
        .insert(rows);

      if (insertErr) {
        throw new Error(`Chunk insert failed: ${insertErr.message}`);
      }

      totalInserted += batch.length;
    }

    // Finalize framework
    await supabase.from("regulatory_frameworks").update({
      ingestion_status: "completed",
      total_chunks: totalInserted,
      status: "ACTIVE",
      ingested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", framework_id);

    return new Response(
      JSON.stringify({
        framework_id,
        status: "completed",
        total_chunks: totalInserted,
        text_length: fullText.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
