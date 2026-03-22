/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No file provided — expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");

    const admin = createAdminSupabaseClient() as any;
    const { data, error } = await admin
      .from("document_hashes")
      .select("*")
      .eq("sha256_hash", hash)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      authentic: Boolean(data),
      sha256_hash: hash,
      record: data || null,
      message: data ? "DOCUMENT AUTHENTIC - UNALTERED" : "DOCUMENT TAMPERED OR UNKNOWN",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}
