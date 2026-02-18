import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/fleet_position.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Live fleet positions for the org — combines REST fetch + Realtime stream.
/// Profiles are fetched separately since there's no direct FK.
final fleetPositionsProvider = StreamProvider<List<FleetPosition>>((ref) {
  final controller = StreamController<List<FleetPosition>>();

  Future<void> fetchAll() async {
    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId == null) {
      controller.add([]);
      return;
    }

    final posData = await SupabaseService.client
        .from('fleet_positions')
        .select('*, jobs(title)')
        .eq('organization_id', orgId)
        .neq('status', 'offline');

    final positions = posData as List;
    if (positions.isEmpty) {
      controller.add([]);
      return;
    }

    // Batch-fetch profiles for the user IDs
    final userIds = positions.map((e) => (e as Map)['user_id'] as String).toSet().toList();
    final profileData = await SupabaseService.client
        .from('profiles')
        .select('id, full_name, avatar_url')
        .inFilter('id', userIds);

    final profileMap = <String, Map<String, dynamic>>{};
    for (final p in profileData as List) {
      final m = p as Map<String, dynamic>;
      profileMap[m['id'] as String] = m;
    }

    final list = positions.map((e) {
      final row = e as Map<String, dynamic>;
      final profile = profileMap[row['user_id'] as String];
      if (profile != null) {
        row['profiles'] = profile;
      }
      return FleetPosition.fromJson(row);
    }).toList();

    controller.add(list);
  }

  fetchAll();

  final channel = SupabaseService.client
      .channel('fleet_positions_realtime')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'fleet_positions',
        callback: (_) => fetchAll(),
      )
      .subscribe();

  ref.onDispose(() {
    channel.unsubscribe();
    controller.close();
  });

  return controller.stream;
});

/// Breadcrumb history for a specific user on a specific date.
final breadcrumbsProvider = FutureProvider.family<List<BreadcrumbPoint>, String>((ref, userId) async {
  final orgId = await ref.read(organizationIdProvider.future);
  if (orgId == null) return [];

  final today = DateTime.now().toIso8601String().split('T').first;

  final data = await SupabaseService.client
      .from('position_history')
      .select('lat, lng, heading, speed, status, recorded_at')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .gte('recorded_at', '${today}T00:00:00')
      .order('recorded_at', ascending: true);

  return (data as List)
      .map((e) => BreadcrumbPoint.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// All org members with their profiles (for showing offline members too)
final orgMembersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('organization_members')
      .select('user_id, role, status, profiles(full_name, avatar_url)')
      .eq('organization_id', orgId)
      .eq('status', 'active');

  return (data as List).cast<Map<String, dynamic>>();
});

/// Update the current user's fleet position.
Future<void> updateFleetPosition({
  required double lat,
  required double lng,
  double heading = 0,
  double speed = 0,
  double battery = 1.0,
  String status = 'idle',
  String? currentJobId,
  double? accuracy,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return;
  final orgId = orgRow['organization_id'] as String;

  // Upsert fleet position
  await SupabaseService.client.from('fleet_positions').upsert({
    'organization_id': orgId,
    'user_id': user.id,
    'lat': lat,
    'lng': lng,
    'heading': heading,
    'speed': speed,
    'battery': battery,
    'status': status,
    'current_job_id': currentJobId,
    'accuracy': accuracy,
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }, onConflict: 'organization_id,user_id');

  // Also record in breadcrumb history
  await SupabaseService.client.from('position_history').insert({
    'organization_id': orgId,
    'user_id': user.id,
    'lat': lat,
    'lng': lng,
    'heading': heading,
    'speed': speed,
    'status': status,
  });
}
