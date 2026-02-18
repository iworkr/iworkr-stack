import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

/// Active time entry for the current user (null if not clocked in).
final activeTimeEntryProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return null;

  final data = await SupabaseService.client
      .from('time_entries')
      .select()
      .eq('user_id', userId)
      .inFilter('status', ['active', 'break'])
      .order('clock_in', ascending: false)
      .maybeSingle();

  return data;
});

/// Recent time entries for the current user (last 14 days).
final recentTimeEntriesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return [];

  final twoWeeksAgo = DateTime.now().subtract(const Duration(days: 14)).toIso8601String();

  final data = await SupabaseService.client
      .from('time_entries')
      .select()
      .eq('user_id', userId)
      .gte('clock_in', twoWeeksAgo)
      .order('clock_in', ascending: false)
      .limit(30);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Total hours worked this week.
final weeklyHoursProvider = FutureProvider<double>((ref) async {
  final entries = await ref.watch(recentTimeEntriesProvider.future);
  final now = DateTime.now();
  final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
  final weekStart = DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);

  double totalMinutes = 0;
  for (final e in entries) {
    final clockIn = DateTime.tryParse(e['clock_in']?.toString() ?? '');
    if (clockIn == null || clockIn.isBefore(weekStart)) continue;
    final mins = e['total_minutes'] as int? ?? 0;
    totalMinutes += mins;
  }
  return totalMinutes / 60;
});

/// Leave requests for the current user.
final leaveRequestsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return [];

  final data = await SupabaseService.client
      .from('leave_requests')
      .select()
      .eq('user_id', userId)
      .order('start_date', ascending: false)
      .limit(20);

  return (data as List).cast<Map<String, dynamic>>();
});

/// Clock in — creates a new time entry.
Future<void> clockIn({
  required String organizationId,
  double? lat,
  double? lng,
  String? jobId,
}) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return;

  await SupabaseService.client.from('time_entries').insert({
    'organization_id': organizationId,
    'user_id': userId,
    'type': 'shift',
    'status': 'active',
    'clock_in': DateTime.now().toUtc().toIso8601String(),
    'clock_in_lat': lat,
    'clock_in_lng': lng,
    if (jobId != null) 'job_id': jobId,
  });
}

/// Start break.
Future<void> startBreak(String entryId) async {
  await SupabaseService.client.from('time_entries').update({
    'status': 'break',
    'break_start': DateTime.now().toUtc().toIso8601String(),
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', entryId);
}

/// End break.
Future<void> endBreak(String entryId, int breakMinutes) async {
  await SupabaseService.client.from('time_entries').update({
    'status': 'active',
    'break_end': DateTime.now().toUtc().toIso8601String(),
    'break_duration_minutes': breakMinutes,
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', entryId);
}

/// Clock out — finalizes the time entry.
Future<void> clockOut({
  required String entryId,
  required DateTime clockInTime,
  double? lat,
  double? lng,
  int breakMinutes = 0,
}) async {
  final now = DateTime.now();
  final totalMinutes = now.difference(clockInTime).inMinutes - breakMinutes;

  await SupabaseService.client.from('time_entries').update({
    'status': 'completed',
    'clock_out': now.toUtc().toIso8601String(),
    'clock_out_lat': lat,
    'clock_out_lng': lng,
    'total_minutes': totalMinutes,
    'updated_at': now.toUtc().toIso8601String(),
  }).eq('id', entryId);
}

/// Submit a leave request.
Future<void> submitLeaveRequest({
  required String organizationId,
  required String type,
  required DateTime startDate,
  required DateTime endDate,
  String? reason,
}) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return;

  final days = endDate.difference(startDate).inDays + 1;

  await SupabaseService.client.from('leave_requests').insert({
    'organization_id': organizationId,
    'user_id': userId,
    'type': type,
    'start_date': startDate.toIso8601String().split('T').first,
    'end_date': endDate.toIso8601String().split('T').first,
    'days': days,
    'reason': reason,
    'status': 'pending',
  });
}
