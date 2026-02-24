import { NextResponse } from "next/server";

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/releases`
  : "https://olqjuadvseoxpfjzlghb.supabase.co/storage/v1/object/public/releases";

export const runtime = "edge";
export const revalidate = 300; // 5 minute cache

export async function GET() {
  try {
    const manifestUrl = `${SUPABASE_STORAGE_URL}/mac/latest-mac.yml`;
    const res = await fetch(manifestUrl, { next: { revalidate: 300 } });

    if (!res.ok) {
      return NextResponse.json(getFallbackVersion(), { status: 200 });
    }

    const yaml = await res.text();
    const version = extractYamlValue(yaml, "version") ?? "1.0.0";
    const releaseDate = extractYamlValue(yaml, "releaseDate") ?? new Date().toISOString();

    return NextResponse.json({
      version,
      releaseDate,
      macArmUrl: `${SUPABASE_STORAGE_URL}/mac/iWorkr-${version}-arm64.dmg`,
      macIntelUrl: `${SUPABASE_STORAGE_URL}/mac/iWorkr-${version}-x64.dmg`,
      winUrl: `${SUPABASE_STORAGE_URL}/win/iWorkr-Setup-${version}.exe`,
    });
  } catch {
    return NextResponse.json(getFallbackVersion(), { status: 200 });
  }
}

function extractYamlValue(yaml: string, key: string): string | null {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = yaml.match(regex);
  return match ? match[1].trim() : null;
}

function getFallbackVersion() {
  return {
    version: "1.0.0",
    releaseDate: new Date().toISOString(),
    macArmUrl: `${SUPABASE_STORAGE_URL}/mac/iWorkr-1.0.0-arm64.dmg`,
    macIntelUrl: `${SUPABASE_STORAGE_URL}/mac/iWorkr-1.0.0-x64.dmg`,
    winUrl: `${SUPABASE_STORAGE_URL}/win/iWorkr-Setup-1.0.0.exe`,
  };
}
