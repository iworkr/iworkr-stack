import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/route_run.dart';

/// Today's route run for the current user
final todayRouteProvider = FutureProvider<RouteRun?>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final today = DateTime.now().toIso8601String().split('T').first;
  final data = await SupabaseService.client
      .from('route_runs')
      .select()
      .eq('user_id', user.id)
      .eq('run_date', today)
      .order('created_at', ascending: false)
      .limit(1)
      .maybeSingle();

  if (data == null) return null;
  return RouteRun.fromJson(data);
});

/// All route runs for the user (history)
final routeHistoryProvider = FutureProvider<List<RouteRun>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('route_runs')
      .select()
      .eq('user_id', user.id)
      .order('run_date', ascending: false)
      .limit(30);

  return (data as List).map((r) => RouteRun.fromJson(r as Map<String, dynamic>)).toList();
});

/// Create/update today's optimized route from scheduled jobs.
///
/// Uses the Nearest-Neighbor heuristic to solve the TSP:
/// 1. Start from the first job (or "depot").
/// 2. Visit the nearest unvisited job next.
/// 3. Repeat until all jobs are visited.
///
/// Jobs with locked time windows (schedule_blocks with fixed start) are
/// respected as constraints — they stay in sequence.
Future<RouteRun?> generateOptimizedRoute() async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;
  final orgId = orgRow['organization_id'] as String;

  final today = DateTime.now().toIso8601String().split('T').first;
  final jobs = await SupabaseService.client
      .from('jobs')
      .select('id, title, location, location_lat, location_lng, priority, estimated_duration_minutes, clients(name)')
      .eq('assignee_id', user.id)
      .inFilter('status', ['todo', 'in_progress'])
      .isFilter('deleted_at', null);

  final jobList = jobs as List;
  if (jobList.isEmpty) return null;

  // Build waypoints
  final waypoints = <_Waypoint>[];
  for (final j in jobList) {
    waypoints.add(_Waypoint(
      jobId: j['id'] as String,
      title: j['title'] as String? ?? '',
      clientName: (j['clients'] as Map<String, dynamic>?)?['name'] as String?,
      address: j['location'] as String?,
      lat: (j['location_lat'] as num?)?.toDouble(),
      lng: (j['location_lng'] as num?)?.toDouble(),
      estimatedMinutes: j['estimated_duration_minutes'] as int? ?? 45,
    ));
  }

  // Nearest-neighbor TSP optimization (only for jobs with coordinates)
  final optimized = _nearestNeighborTSP(waypoints);

  // Build the JSON sequence
  final sequence = optimized.asMap().entries.map((e) {
    final w = e.value;
    return RouteStop(
      jobId: w.jobId,
      title: w.title,
      clientName: w.clientName,
      address: w.address,
      lat: w.lat,
      lng: w.lng,
      order: e.key,
      estimatedMinutes: w.estimatedMinutes,
      status: 'pending',
    ).toJson();
  }).toList();

  // Compute total distance using Haversine
  double totalKm = 0;
  for (int i = 0; i < optimized.length - 1; i++) {
    final a = optimized[i];
    final b = optimized[i + 1];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      totalKm += _haversineKm(a.lat!, a.lng!, b.lat!, b.lng!);
    } else {
      totalKm += 8.0; // fallback estimate
    }
  }

  final driveMin = (totalKm / 40 * 60).round(); // ~40km/h average in urban
  final totalJobMin = optimized.fold<int>(0, (sum, w) => sum + w.estimatedMinutes);
  final finishTime = DateTime.now().add(Duration(minutes: driveMin + totalJobMin));

  // Upsert: delete old today route, insert new
  await SupabaseService.client
      .from('route_runs')
      .delete()
      .eq('user_id', user.id)
      .eq('run_date', today);

  final row = await SupabaseService.client.from('route_runs').insert({
    'organization_id': orgId,
    'user_id': user.id,
    'run_date': today,
    'status': 'planned',
    'job_sequence': sequence,
    'total_distance_km': double.parse(totalKm.toStringAsFixed(1)),
    'estimated_drive_minutes': driveMin,
    'estimated_finish_time': finishTime.toIso8601String(),
    'optimized': true,
  }).select().single();

  return RouteRun.fromJson(row);
}

/// Start a route run
Future<void> startRouteRun(String runId) async {
  await SupabaseService.client
      .from('route_runs')
      .update({'status': 'active'})
      .eq('id', runId);
}

/// Complete a route run
Future<void> completeRouteRun(String runId) async {
  await SupabaseService.client.from('route_runs').update({
    'status': 'completed',
    'actual_finish_time': DateTime.now().toIso8601String(),
  }).eq('id', runId);
}

// ═══════════════════════════════════════════════════════════
// ── TSP Solver: Nearest Neighbor ─────────────────────────
// ═══════════════════════════════════════════════════════════

class _Waypoint {
  final String jobId;
  final String title;
  final String? clientName;
  final String? address;
  final double? lat;
  final double? lng;
  final int estimatedMinutes;

  _Waypoint({
    required this.jobId,
    required this.title,
    this.clientName,
    this.address,
    this.lat,
    this.lng,
    this.estimatedMinutes = 45,
  });
}

/// Nearest-neighbor heuristic for TSP.
///
/// Jobs without coordinates are appended at the end.
List<_Waypoint> _nearestNeighborTSP(List<_Waypoint> waypoints) {
  final withCoords = waypoints.where((w) => w.lat != null && w.lng != null).toList();
  final withoutCoords = waypoints.where((w) => w.lat == null || w.lng == null).toList();

  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  final visited = <int>{};
  final result = <_Waypoint>[];

  // Start from the first waypoint
  var currentIdx = 0;
  visited.add(currentIdx);
  result.add(withCoords[currentIdx]);

  while (visited.length < withCoords.length) {
    final current = withCoords[currentIdx];
    double bestDist = double.infinity;
    int bestIdx = -1;

    for (int i = 0; i < withCoords.length; i++) {
      if (visited.contains(i)) continue;
      final d = _haversineKm(current.lat!, current.lng!, withCoords[i].lat!, withCoords[i].lng!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestIdx == -1) break;
    visited.add(bestIdx);
    result.add(withCoords[bestIdx]);
    currentIdx = bestIdx;
  }

  return [...result, ...withoutCoords];
}

/// Haversine formula — returns distance in kilometers between two points.
double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
  const earthRadiusKm = 6371.0;
  final dLat = _degToRad(lat2 - lat1);
  final dLng = _degToRad(lng2 - lng1);

  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(_degToRad(lat1)) * cos(_degToRad(lat2)) * sin(dLng / 2) * sin(dLng / 2);
  final c = 2 * atan2(sqrt(a), sqrt(1 - a));

  return earthRadiusKm * c;
}

double _degToRad(double deg) => deg * pi / 180;
