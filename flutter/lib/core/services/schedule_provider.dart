import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

/// Selected date for schedule view
final selectedDateProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

/// Provides schedule blocks for the selected date
final scheduleBlocksProvider = FutureProvider<List<ScheduleBlock>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final date = ref.watch(selectedDateProvider);
  final startOfDay = DateTime(date.year, date.month, date.day).toUtc().toIso8601String();
  final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59).toUtc().toIso8601String();

  final data = await SupabaseService.client
      .from('schedule_blocks')
      .select()
      .eq('organization_id', orgId)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .order('start_time');

  return (data as List).map((b) => ScheduleBlock.fromJson(b as Map<String, dynamic>)).toList();
});

/// Today's blocks for the current user
final myTodayBlocksProvider = FutureProvider<List<ScheduleBlock>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  final userId = SupabaseService.auth.currentUser?.id;
  if (orgId == null || userId == null) return [];

  final now = DateTime.now();
  final startOfDay = DateTime(now.year, now.month, now.day).toUtc().toIso8601String();
  final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59).toUtc().toIso8601String();

  final data = await SupabaseService.client
      .from('schedule_blocks')
      .select()
      .eq('organization_id', orgId)
      .eq('technician_id', userId)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .order('start_time');

  return (data as List).map((b) => ScheduleBlock.fromJson(b as Map<String, dynamic>)).toList();
});
