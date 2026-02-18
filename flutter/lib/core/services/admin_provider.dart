import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/profile.dart';

/// Check if the current user is an admin or owner
final isAdminProvider = FutureProvider<bool>((ref) async {
  final orgData = await ref.watch(organizationProvider.future);
  final role = orgData?['role'] as String?;
  return role == 'owner' || role == 'admin' || role == 'manager';
});

/// Revenue today for the organization
final revenueTodayProvider = FutureProvider<double>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return 0;

  final today = DateTime.now().toIso8601String().split('T').first;
  final data = await SupabaseService.client
      .from('invoices')
      .select('total')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_date', today);

  double total = 0;
  for (final row in (data as List)) {
    final v = row['total'];
    if (v == null) continue;
    if (v is num) { total += v.toDouble(); }
    else { total += double.tryParse(v.toString()) ?? 0; }
  }
  return total;
});

/// Outstanding (unpaid) amount
final outstandingProvider = FutureProvider<double>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return 0;

  final data = await SupabaseService.client
      .from('invoices')
      .select('total')
      .eq('organization_id', orgId)
      .inFilter('status', ['sent', 'overdue']);

  double total = 0;
  for (final row in (data as List)) {
    final v = row['total'];
    if (v == null) continue;
    if (v is num) { total += v.toDouble(); }
    else { total += double.tryParse(v.toString()) ?? 0; }
  }
  return total;
});

/// All organization members with profiles
final orgMembersProvider = FutureProvider<List<OrganizationMember>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('organization_members')
      .select('*, profiles!inner(id, email, full_name, avatar_url, phone)')
      .eq('organization_id', orgId)
      .order('joined_at');

  return (data as List).map((m) {
    final profileData = m['profiles'] as Map<String, dynamic>?;
    return OrganizationMember(
      organizationId: m['organization_id'] as String,
      userId: m['user_id'] as String,
      role: m['role'] as String? ?? 'technician',
      status: m['status'] as String? ?? 'active',
      branch: m['branch'] as String?,
      profile: profileData != null ? Profile.fromJson(profileData) : null,
    );
  }).toList();
});

/// Send an invite to join the organization
Future<void> sendInvite({
  required String organizationId,
  required String email,
  required String role,
}) async {
  final userId = SupabaseService.auth.currentUser?.id;
  await SupabaseService.client.from('organization_invites').insert({
    'organization_id': organizationId,
    'email': email,
    'role': role,
    'invited_by': userId,
  });
}

/// Suspend a member (set status to 'suspended')
Future<void> suspendMember({
  required String organizationId,
  required String userId,
}) async {
  await SupabaseService.client
      .from('organization_members')
      .update({'status': 'suspended'})
      .eq('organization_id', organizationId)
      .eq('user_id', userId);
}

/// Reactivate a suspended member
Future<void> reactivateMember({
  required String organizationId,
  required String userId,
}) async {
  await SupabaseService.client
      .from('organization_members')
      .update({'status': 'active'})
      .eq('organization_id', organizationId)
      .eq('user_id', userId);
}
