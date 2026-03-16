import 'dart:convert';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class PendingPolicyTask {
  final String acknowledgementId;
  final String policyId;
  final String policyVersionId;
  final String title;
  final String versionNumber;
  final int enforcementLevel;
  final DateTime? dueAt;
  final String? richTextContent;
  final String? documentUrl;
  final List<Map<String, dynamic>> quizPayload;

  const PendingPolicyTask({
    required this.acknowledgementId,
    required this.policyId,
    required this.policyVersionId,
    required this.title,
    required this.versionNumber,
    required this.enforcementLevel,
    required this.dueAt,
    required this.richTextContent,
    required this.documentUrl,
    required this.quizPayload,
  });

  factory PendingPolicyTask.fromRow(Map<String, dynamic> row) {
    final version = (row['policy_versions'] as Map?)?.cast<String, dynamic>() ?? {};
    final policy = (row['policy_register'] as Map?)?.cast<String, dynamic>() ?? {};
    return PendingPolicyTask(
      acknowledgementId: row['id']?.toString() ?? '',
      policyId: row['policy_id']?.toString() ?? '',
      policyVersionId: row['policy_version_id']?.toString() ?? '',
      title: policy['title']?.toString() ?? 'Policy',
      versionNumber: version['version_number']?.toString() ?? row['policy_version']?.toString() ?? '1.0',
      enforcementLevel: (policy['enforcement_level'] as num?)?.toInt() ?? 2,
      dueAt: row['due_at'] != null ? DateTime.tryParse(row['due_at'].toString()) : null,
      richTextContent: version['rich_text_content']?.toString(),
      documentUrl: version['document_url']?.toString(),
      quizPayload: ((version['quiz_payload'] as List?) ?? const [])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList(),
    );
  }
}

Future<List<PendingPolicyTask>> fetchMyPendingPolicies() async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return const [];
  final rows = await SupabaseService.client
      .from('policy_acknowledgements')
      .select('id, policy_id, policy_version_id, policy_version, due_at, policy_register(title,enforcement_level), policy_versions(version_number,rich_text_content,document_url,quiz_payload)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('due_at', ascending: true);
  return (rows as List)
      .map((row) => PendingPolicyTask.fromRow((row as Map).cast<String, dynamic>()))
      .toList();
}

Future<List<Map<String, dynamic>>> fetchPendingCriticalPolicies() async {
  final res = await SupabaseService.client.functions.invoke('pending-critical-policies');
  final data = (res.data as Map?)?.cast<String, dynamic>() ?? {};
  return ((data['policies'] as List?) ?? const [])
      .map((e) => (e as Map).cast<String, dynamic>())
      .toList();
}

Future<void> acknowledgePolicyTask({
  required String acknowledgementId,
  required bool quizPassed,
  required double quizScore,
  String? signatureBase64,
  String? biometricToken,
}) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return;
  final info = DeviceInfoPlugin();
  String deviceInfo = 'unknown-device';
  try {
    if (kIsWeb) {
      final web = await info.webBrowserInfo;
      deviceInfo = '${web.browserName.name}-${web.platform ?? 'web'}';
    } else {
      try {
        final android = await info.androidInfo;
        deviceInfo = '${android.manufacturer} ${android.model}';
      } catch (_) {
        final ios = await info.iosInfo;
        deviceInfo = '${ios.name} ${ios.model}';
      }
    }
  } catch (_) {}

  String? uploadedSignaturePath;
  if (signatureBase64 != null && signatureBase64.isNotEmpty) {
    final bytes = base64Decode(signatureBase64.contains(',') ? signatureBase64.split(',').last : signatureBase64);
    final path = 'policy-signatures/$userId/$acknowledgementId-${DateTime.now().millisecondsSinceEpoch}.png';
    await SupabaseService.client.storage.from('documents').uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(upsert: true, contentType: 'image/png'),
        );
    uploadedSignaturePath = path;
  }

  await SupabaseService.client
      .from('policy_acknowledgements')
      .update({
        'status': 'signed',
        'acknowledged_at': DateTime.now().toUtc().toIso8601String(),
        'quiz_passed': quizPassed,
        'quiz_score': quizScore,
        'signature_image_url': uploadedSignaturePath,
        'biometric_token': biometricToken,
        'device_info': deviceInfo,
      })
      .eq('id', acknowledgementId)
      .eq('user_id', userId);
}

