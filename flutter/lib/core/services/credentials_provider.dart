import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/worker_credential.dart';

// ═══════════════════════════════════════════════════════════
// ── Worker Credentials — Compliance Tracking ─────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Realtime stream of worker credentials
// with CRUD mutations and schedule validation gate.

/// Reactive credentials stream (REST + Realtime)
final credentialsStreamProvider = StreamProvider<List<WorkerCredential>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<WorkerCredential>>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('worker_credentials')
          .select('*, profiles(full_name, email, avatar_url)')
          .eq('organization_id', orgId)
          .order('expiry_date', ascending: true);

      if (!controller.isClosed) {
        controller.add(
          (data as List)
              .map((e) => WorkerCredential.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('credentials-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'worker_credentials',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Credentials for a specific worker
final workerCredentialsProvider =
    Provider.family<List<WorkerCredential>, String>((ref, userId) {
  final all = ref.watch(credentialsStreamProvider).valueOrNull ?? [];
  return all.where((c) => c.userId == userId).toList();
});

/// My credentials
final myCredentialsProvider = Provider<List<WorkerCredential>>((ref) {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return [];
  return ref.watch(workerCredentialsProvider(userId));
});

/// Summary stats
final credentialStatsProvider = Provider<CredentialStats>((ref) {
  final all = ref.watch(credentialsStreamProvider).valueOrNull ?? [];
  return CredentialStats(
    total: all.length,
    verified: all.where((c) => c.verificationStatus == VerificationStatus.verified).length,
    pending: all.where((c) => c.verificationStatus == VerificationStatus.pending).length,
    expired: all.where((c) => c.expiryStatus == ExpiryStatus.expired).length,
    expiring: all.where((c) => c.expiryStatus == ExpiryStatus.expiring).length,
  );
});

class CredentialStats {
  final int total;
  final int verified;
  final int pending;
  final int expired;
  final int expiring;

  const CredentialStats({
    this.total = 0,
    this.verified = 0,
    this.pending = 0,
    this.expired = 0,
    this.expiring = 0,
  });
}

// ── Mutations ────────────────────────────────────────────

Future<WorkerCredential?> createCredential({
  required String userId,
  required CredentialType credentialType,
  String? credentialName,
  DateTime? issuedDate,
  DateTime? expiryDate,
  String? documentUrl,
  String? notes,
}) async {
  final user = SupabaseService.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
  if (orgRow == null) return null;

  final data = await SupabaseService.client
      .from('worker_credentials')
      .insert({
        'organization_id': orgRow['organization_id'],
        'user_id': userId,
        'credential_type': credentialType.value,
        'credential_name': credentialName,
        'issued_date': issuedDate?.toIso8601String(),
        'expiry_date': expiryDate?.toIso8601String(),
        'document_url': documentUrl,
        'notes': notes,
        'verification_status': 'pending',
      })
      .select('*, profiles(full_name, email, avatar_url)')
      .single();

  return WorkerCredential.fromJson(data);
}

Future<void> updateCredentialStatus({
  required String credentialId,
  required VerificationStatus status,
}) async {
  await SupabaseService.client
      .from('worker_credentials')
      .update({
        'verification_status': status.name,
        if (status == VerificationStatus.verified) ...{
          'verified_by': SupabaseService.auth.currentUser?.id,
          'verified_at': DateTime.now().toUtc().toIso8601String(),
        },
      })
      .eq('id', credentialId);
}

Future<void> deleteCredential(String credentialId) async {
  await SupabaseService.client
      .from('worker_credentials')
      .delete()
      .eq('id', credentialId);
}

/// Validate a worker's credentials before scheduling (hard gate)
Future<ScheduleValidation> validateScheduleCompliance({
  required String organizationId,
  required String workerId,
}) async {
  try {
    final response = await SupabaseService.client.functions.invoke(
      'validate-schedule',
      body: {
        'organization_id': organizationId,
        'worker_id': workerId,
      },
    );

    if (response.status == 200) {
      return const ScheduleValidation(compliant: true);
    }

    final data = response.data as Map<String, dynamic>? ?? {};
    final issues = (data['issues'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        ['Non-compliant credentials'];

    return ScheduleValidation(compliant: false, issues: issues);
  } catch (e) {
    return ScheduleValidation(compliant: false, issues: [e.toString()]);
  }
}

class ScheduleValidation {
  final bool compliant;
  final List<String> issues;
  const ScheduleValidation({required this.compliant, this.issues = const []});
}
