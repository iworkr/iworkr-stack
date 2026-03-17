// /api/revalidate — cache purge endpoint for Edge Functions
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const { path, secret } = await req.json();

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (path) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, path });
}
