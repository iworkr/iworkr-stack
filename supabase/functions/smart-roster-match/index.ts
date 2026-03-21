import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-active-workspace-id",
};

interface ShiftSlot {
  id: string;
  organization_id: string;
  participant_id: string;
  blueprint_id: string;
  shift_group_id: string;
  target_ratio: number;
  start_time: string;
  end_time: string;
  house_id: string | null;
}

interface WorkerCandidate {
  user_id: string;
  full_name: string;
  skill_ids: string[];
  hours_this_week: number;
  continuity_score: number;
  fit_score: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { blueprint_id } = await req.json();
    if (!blueprint_id) {
      return new Response(
        JSON.stringify({ error: "blueprint_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Fetch the blueprint
    const { data: blueprint, error: bpErr } = await supabaseAdmin
      .from("care_blueprints")
      .select("*")
      .eq("id", blueprint_id)
      .single();

    if (bpErr || !blueprint) {
      return new Response(
        JSON.stringify({ error: "Blueprint not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requiredSkills: string[] = blueprint.required_skills || [];
    const bannedWorkers: string[] = blueprint.banned_workers || [];
    const orgId = blueprint.organization_id;
    const participantId = blueprint.participant_id;

    // 2. Fetch all UNFILLED shifts for this blueprint
    const { data: unfilledShifts, error: shiftErr } = await supabaseAdmin
      .from("schedule_blocks")
      .select("id, organization_id, participant_id, blueprint_id, shift_group_id, target_ratio, start_time, end_time, house_id")
      .eq("blueprint_id", blueprint_id)
      .eq("status", "unfilled")
      .is("technician_id", null)
      .order("start_time", { ascending: true });

    if (shiftErr || !unfilledShifts || unfilledShifts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No unfilled shifts to match", filled: 0, total_unfilled: 0, remaining_unfilled: 0, assignments: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2b. Ring-Fencing: check if participant lives in a house
    const { data: houseLink } = await supabaseAdmin
      .from("house_participants")
      .select("house_id")
      .eq("participant_id", participantId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const participantHouseId = houseLink?.house_id || null;

    // 2c. If house exists, fetch house staff with roles for ring-fence scoring
    const houseStaffMap = new Map<string, string>();
    if (participantHouseId) {
      const { data: houseStaff } = await supabaseAdmin
        .from("house_staff")
        .select("worker_id, role")
        .eq("house_id", participantHouseId);
      for (const hs of houseStaff || []) {
        houseStaffMap.set(hs.worker_id, hs.role);
      }
    }

    // 3. Fetch all active org members (workers)
    const { data: workers } = await supabaseAdmin
      .from("organization_members")
      .select("user_id, profiles(full_name)")
      .eq("organization_id", orgId)
      .eq("status", "active");

    if (!workers || workers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No workers available", filled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Fetch worker clinical skills
    const workerIds = workers.map((w: any) => w.user_id);
    const { data: workerSkills } = await supabaseAdmin
      .from("worker_clinical_skills")
      .select("user_id, skill_id")
      .eq("organization_id", orgId)
      .in("user_id", workerIds);

    const workerSkillMap = new Map<string, string[]>();
    for (const ws of workerSkills || []) {
      const existing = workerSkillMap.get(ws.user_id) || [];
      existing.push(ws.skill_id);
      workerSkillMap.set(ws.user_id, existing);
    }

    // 5. Fetch all scheduled blocks for these workers (for overlap/fatigue checks)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { data: existingBlocks } = await supabaseAdmin
      .from("schedule_blocks")
      .select("technician_id, start_time, end_time")
      .eq("organization_id", orgId)
      .not("technician_id", "is", null)
      .not("status", "in", "(cancelled)")
      .gte("start_time", new Date().toISOString());

    // 6. Fetch continuity data (workers who have worked with this participant before)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: continuityData } = await supabaseAdmin
      .from("schedule_blocks")
      .select("technician_id")
      .eq("participant_id", participantId)
      .eq("status", "complete")
      .not("technician_id", "is", null)
      .gte("start_time", thirtyDaysAgo.toISOString());

    const continuityWorkers = new Set(
      (continuityData || []).map((c: any) => c.technician_id),
    );

    // 7. Fetch leave requests
    const { data: leaveData } = await supabaseAdmin
      .from("staff_leave")
      .select("user_id, start_date, end_date")
      .eq("organization_id", orgId)
      .eq("status", "approved");

    // Helper: check if worker is on leave during a shift
    const isOnLeave = (workerId: string, shiftStart: Date, shiftEnd: Date): boolean => {
      for (const leave of leaveData || []) {
        if (leave.user_id !== workerId) continue;
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        leaveEnd.setHours(23, 59, 59);
        if (shiftStart < leaveEnd && shiftEnd > leaveStart) return true;
      }
      return false;
    };

    // Helper: check if worker has overlapping shift (including 10hr SCHADS gap)
    const hasOverlap = (workerId: string, shiftStart: Date, shiftEnd: Date): boolean => {
      for (const block of existingBlocks || []) {
        if (block.technician_id !== workerId) continue;
        const bStart = new Date(block.start_time);
        const bEnd = new Date(block.end_time);

        // Direct overlap
        if (shiftStart < bEnd && shiftEnd > bStart) return true;

        // SCHADS 10-hour rest gap enforcement
        const gapMs = 10 * 60 * 60 * 1000;
        if (
          (shiftStart.getTime() - bEnd.getTime() >= 0 && shiftStart.getTime() - bEnd.getTime() < gapMs) ||
          (bStart.getTime() - shiftEnd.getTime() >= 0 && bStart.getTime() - shiftEnd.getTime() < gapMs)
        ) {
          return true;
        }
      }
      return false;
    };

    // 8. Calculate weekly hours for each worker
    const workerWeeklyHours = new Map<string, number>();
    for (const block of existingBlocks || []) {
      if (!block.technician_id) continue;
      const hrs = (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 3600000;
      workerWeeklyHours.set(
        block.technician_id,
        (workerWeeklyHours.get(block.technician_id) || 0) + hrs,
      );
    }

    // 9. Process each unfilled shift
    let filledCount = 0;
    const assignments: Array<{ shift_id: string; worker_id: string; worker_name: string }> = [];

    // Group shifts by shift_group_id so we assign both slots together
    const groupMap = new Map<string, ShiftSlot[]>();
    for (const shift of unfilledShifts) {
      const group = groupMap.get(shift.shift_group_id) || [];
      group.push(shift as ShiftSlot);
      groupMap.set(shift.shift_group_id, group);
    }

    for (const [_groupId, groupShifts] of groupMap) {
      const slotsNeeded = groupShifts.length;
      const refShift = groupShifts[0];
      const shiftStart = new Date(refShift.start_time);
      const shiftEnd = new Date(refShift.end_time);

      // Score all workers
      const candidates: WorkerCandidate[] = [];

      for (const worker of workers) {
        const workerId = worker.user_id;
        const workerName = (worker as any).profiles?.full_name || "Unknown";

        // Hard Filter: Banned workers
        if (bannedWorkers.includes(workerId)) continue;

        // Hard Filter: Leave
        if (isOnLeave(workerId, shiftStart, shiftEnd)) continue;

        // Hard Filter: Overlap / SCHADS rest
        if (hasOverlap(workerId, shiftStart, shiftEnd)) continue;

        // Hard Filter: Required skills
        if (requiredSkills.length > 0) {
          const workerSkillArr = workerSkillMap.get(workerId) || [];
          const hasAll = requiredSkills.every((s) => workerSkillArr.includes(s));
          if (!hasAll) continue;
        }

        // Soft Scoring
        const weeklyHrs = workerWeeklyHours.get(workerId) || 0;
        const fatigueScore = Math.max(0, 40 * (1 - weeklyHrs / 38));
        const contScore = continuityWorkers.has(workerId) ? 40 : 0;
        const proximityScore = 10;

        // Ring-Fencing: House staff prioritization
        let houseScore = 0;
        if (participantHouseId && houseStaffMap.size > 0) {
          const houseRole = houseStaffMap.get(workerId);
          if (houseRole === "leader") houseScore = 500;
          else if (houseRole === "core_team") houseScore = 300;
          else if (houseRole === "float_pool") houseScore = 50;
          else houseScore = -1000; // Not in house staff — soft block
        }

        const fitScore = fatigueScore + contScore + proximityScore + houseScore;

        candidates.push({
          user_id: workerId,
          full_name: workerName,
          skill_ids: workerSkillMap.get(workerId) || [],
          hours_this_week: weeklyHrs,
          continuity_score: contScore,
          fit_score: fitScore,
        });
      }

      // Sort by fit score descending
      candidates.sort((a, b) => b.fit_score - a.fit_score);

      // Assign top N candidates
      const assigned = candidates.slice(0, slotsNeeded);
      for (let i = 0; i < assigned.length && i < groupShifts.length; i++) {
        const { error: updateErr } = await supabaseAdmin
          .from("schedule_blocks")
          .update({
            technician_id: assigned[i].user_id,
            status: "published",
          })
          .eq("id", groupShifts[i].id);

        if (!updateErr) {
          filledCount++;
          assignments.push({
            shift_id: groupShifts[i].id,
            worker_id: assigned[i].user_id,
            worker_name: assigned[i].full_name,
          });

          // Update the existing blocks tracker to prevent double-booking
          existingBlocks?.push({
            technician_id: assigned[i].user_id,
            start_time: groupShifts[i].start_time,
            end_time: groupShifts[i].end_time,
          });

          // Update weekly hours tracker
          const hrs = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000;
          workerWeeklyHours.set(
            assigned[i].user_id,
            (workerWeeklyHours.get(assigned[i].user_id) || 0) + hrs,
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_unfilled: unfilledShifts.length,
        filled: filledCount,
        remaining_unfilled: unfilledShifts.length - filledCount,
        assignments: assignments.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
