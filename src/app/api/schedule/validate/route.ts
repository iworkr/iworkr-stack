import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface ValidateRequest {
  organization_id: string;
  technician_id: string;
  start_time: string;
  end_time: string;
  job_id?: string;
  location?: string;
  location_lat?: number;
  location_lng?: number;
}

interface ValidationResult {
  valid: boolean;
  conflicts: Array<{
    block_id: string;
    title: string;
    start_time: string;
    end_time: string;
  }>;
  travel: {
    previous_block?: {
      id: string;
      title: string;
      end_time: string;
      location: string | null;
    };
    estimated_minutes: number | null;
    gap_minutes: number;
    sufficient: boolean;
  } | null;
  warnings: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const { organization_id, technician_id, start_time, end_time } = body;

    if (!organization_id || !technician_id || !start_time || !end_time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Verify auth and org membership
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const proposedStart = new Date(start_time);
    const proposedEnd = new Date(end_time);
    const dateStr = proposedStart.toISOString().split("T")[0];

    // Check for overlapping blocks on the same technician/day
    const { data: existingBlocks } = await (supabase as any)
      .from("schedule_blocks")
      .select("id, title, start_time, end_time, location, status, job_id")
      .eq("organization_id", organization_id)
      .eq("technician_id", technician_id)
      .gte("start_time", `${dateStr}T00:00:00Z`)
      .lte("start_time", `${dateStr}T23:59:59Z`)
      .neq("status", "cancelled")
      .order("start_time");

    const conflicts: ValidationResult["conflicts"] = [];
    for (const block of existingBlocks || []) {
      const bStart = new Date(block.start_time);
      const bEnd = new Date(block.end_time);
      if (proposedStart < bEnd && proposedEnd > bStart) {
        conflicts.push({
          block_id: block.id,
          title: block.title,
          start_time: block.start_time,
          end_time: block.end_time,
        });
      }
    }

    // Find the immediately preceding block (ends right before proposed start)
    const precedingBlocks = (existingBlocks || [])
      .filter((b: any) => new Date(b.end_time) <= proposedStart)
      .sort((a: any, b: any) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());

    let travel: ValidationResult["travel"] = null;
    const warnings: string[] = [];

    if (precedingBlocks.length > 0) {
      const prevBlock = precedingBlocks[0];
      const prevEnd = new Date(prevBlock.end_time);
      const gapMinutes = Math.round((proposedStart.getTime() - prevEnd.getTime()) / 60000);

      let estimatedMinutes: number | null = null;

      // Estimate travel via Haversine when both sides have coordinates
      if (body.location_lat && body.location_lng && prevBlock.job_id) {
        const { data: prevJob } = await (supabase as any)
          .from("jobs")
          .select("location_lat, location_lng")
          .eq("id", prevBlock.job_id)
          .maybeSingle();

        if (prevJob?.location_lat && prevJob?.location_lng) {
          const distKm = haversineDistance(
            prevJob.location_lat, prevJob.location_lng,
            body.location_lat, body.location_lng
          );
          // ~40 km/h average urban driving speed
          estimatedMinutes = Math.round((distKm / 40) * 60);
        }
      }

      // Fallback: 15 min default when locations differ but no coordinates available
      if (estimatedMinutes === null && prevBlock.location && body.location) {
        if (prevBlock.location.toLowerCase() !== body.location?.toLowerCase()) {
          estimatedMinutes = 15;
        } else {
          estimatedMinutes = 0;
        }
      }

      const sufficient = estimatedMinutes !== null ? gapMinutes >= estimatedMinutes : true;

      travel = {
        previous_block: {
          id: prevBlock.id,
          title: prevBlock.title,
          end_time: prevBlock.end_time,
          location: prevBlock.location,
        },
        estimated_minutes: estimatedMinutes,
        gap_minutes: gapMinutes,
        sufficient,
      };

      if (!sufficient && estimatedMinutes !== null) {
        warnings.push(
          `Travel Time Warning: ~${estimatedMinutes}min drive from "${prevBlock.title}" but only ${gapMinutes}min gap`
        );
      }
    }

    if (conflicts.length > 0) {
      warnings.push(`Overlaps with ${conflicts.length} existing block(s)`);
    }

    const result: ValidationResult = {
      valid: conflicts.length === 0,
      conflicts,
      travel,
      warnings,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
