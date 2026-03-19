import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/evidence/models/evidence_models.dart';

// ============================================================================
// Project Panopticon-Vision — Evidence Provider (Riverpod)
// ============================================================================
// Provides real-time evidence streams, stats, upload, delete, search, and
// visibility toggling — all scoped to the active workspace via RLS.
// ============================================================================

const _uuid = Uuid();

// ── Stream of all evidence for a job (or all jobs when jobId is null) ─────
final evidenceStreamProvider =
    StreamProvider.family<List<EvidenceItem>, String?>((ref, jobId) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return Stream.value([]);

  final client = SupabaseService.client;

  // Build the realtime query scoped to workspace via RLS
  var query = client
      .from('job_evidence')
      .stream(primaryKey: ['id'])
      .order('captured_at', ascending: false);

  // If jobId is provided, filter server-side
  if (jobId != null) {
    query = client
        .from('job_evidence')
        .stream(primaryKey: ['id'])
        .eq('job_id', jobId)
        .order('captured_at', ascending: false);
  }

  return query.map((rows) {
    return rows.map((row) => EvidenceItem.fromJson(row)).toList();
  });
});

// ── Evidence stats (total, annotated, defects, etc.) ─────────────────────
final evidenceStatsProvider =
    FutureProvider.family<Map<String, dynamic>, String?>((ref, jobId) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return {};

  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return {};

  final client = SupabaseService.client;

  final response = await client.rpc('get_evidence_stats', params: {
    'p_workspace_id': orgId,
    'p_job_id': jobId,
  });

  if (response == null) return {};
  return response as Map<String, dynamic>;
});

// ── Upload service provider ──────────────────────────────────────────────
final uploadEvidenceProvider = Provider((ref) => EvidenceUploadService(ref));

// ============================================================================
// EvidenceUploadService
// ============================================================================

class EvidenceUploadService {
  final Ref _ref;
  EvidenceUploadService(this._ref);

  /// Upload a new piece of evidence — stores files in Supabase Storage and
  /// inserts a row into job_evidence.
  ///
  /// Returns the created [EvidenceItem] on success.
  Future<EvidenceItem> uploadEvidence({
    required String jobId,
    required Uint8List originalBytes,
    Uint8List? annotatedBytes,
    required List<String> aiTags,
    Map<String, double>? aiConfidence,
    String? caption,
    double? lat,
    double? lng,
    bool isDefect = false,
    bool faceDetected = false,
    bool faceObfuscated = false,
  }) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) throw StateError('User not authenticated');

    final orgId = await _ref.read(organizationIdProvider.future);
    if (orgId == null) throw StateError('No active workspace');

    final client = SupabaseService.client;
    final evidenceId = _uuid.v4();
    final fileId = _uuid.v4();

    // ── 1. Upload original image to evidence-raw bucket ─────────────
    final originalPath = '$orgId/$jobId/$fileId.jpg';
    await client.storage.from('evidence-raw').uploadBinary(
          originalPath,
          originalBytes,
          fileOptions: const FileOptions(contentType: 'image/jpeg'),
        );

    // ── 2. Upload annotated image (if provided) ─────────────────────
    String? annotatedPath;
    if (annotatedBytes != null) {
      annotatedPath = '$orgId/$jobId/${fileId}_annotated.jpg';
      await client.storage.from('evidence-annotated').uploadBinary(
            annotatedPath,
            annotatedBytes,
            fileOptions: const FileOptions(contentType: 'image/jpeg'),
          );
    }

    // ── 3. Insert evidence row ──────────────────────────────────────
    final now = DateTime.now().toUtc();
    final row = {
      'id': evidenceId,
      'workspace_id': orgId,
      'job_id': jobId,
      'worker_id': user.id,
      'original_path': originalPath,
      'annotated_path': annotatedPath,
      'ai_tags': aiTags,
      'ai_confidence': aiConfidence ?? {},
      'manual_caption': caption,
      'location_lat': lat,
      'location_lng': lng,
      'file_size_bytes': originalBytes.length,
      'is_client_visible': false,
      'is_defect': isDefect,
      'face_detected': faceDetected,
      'face_obfuscated': faceObfuscated,
      'captured_at': now.toIso8601String(),
      'synced_at': now.toIso8601String(),
      'created_at': now.toIso8601String(),
    };

    final inserted = await client
        .from('job_evidence')
        .insert(row)
        .select()
        .single();

    debugPrint('[Panopticon] Evidence uploaded: $evidenceId → $originalPath');
    return EvidenceItem.fromJson(inserted);
  }

  /// Delete evidence — removes storage files and the database row.
  Future<void> deleteEvidence(String evidenceId) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) throw StateError('User not authenticated');

    final client = SupabaseService.client;

    // Fetch the row first so we know which storage paths to delete
    final row = await client
        .from('job_evidence')
        .select()
        .eq('id', evidenceId)
        .maybeSingle();

    if (row == null) {
      debugPrint('[Panopticon] Evidence $evidenceId not found — skipping');
      return;
    }

    // Delete storage objects (non-fatal if already gone)
    final originalPath = row['original_path'] as String?;
    final annotatedPath = row['annotated_path'] as String?;
    final thumbnailPath = row['thumbnail_path'] as String?;

    try {
      if (originalPath != null) {
        await client.storage.from('evidence-raw').remove([originalPath]);
      }
      if (annotatedPath != null) {
        await client.storage.from('evidence-annotated').remove([annotatedPath]);
      }
      if (thumbnailPath != null) {
        await client.storage.from('evidence-raw').remove([thumbnailPath]);
      }
    } catch (e) {
      debugPrint('[Panopticon] Storage cleanup warning: $e');
    }

    // Delete the database row
    await client.from('job_evidence').delete().eq('id', evidenceId);
    debugPrint('[Panopticon] Evidence deleted: $evidenceId');
  }

  /// Toggle client visibility of an evidence item via the server-side RPC.
  Future<Map<String, dynamic>> toggleVisibility(
    String evidenceId,
    bool visible,
  ) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) throw StateError('User not authenticated');

    final client = SupabaseService.client;
    final result = await client.rpc('toggle_evidence_visibility', params: {
      'p_evidence_id': evidenceId,
      'p_visible': visible,
    });

    debugPrint('[Panopticon] Visibility toggled: $evidenceId → $visible');
    return result as Map<String, dynamic>;
  }

  /// Search evidence by AI tags, manual captions, or manual tags.
  ///
  /// Uses the server-side `search_evidence_by_tag` RPC for efficient
  /// GIN-indexed JSONB search.
  Future<List<EvidenceItem>> searchByTag(
    String searchTerm, {
    String? jobId,
    bool defectsOnly = false,
    int limit = 50,
    int offset = 0,
  }) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) return [];

    final orgId = await _ref.read(organizationIdProvider.future);
    if (orgId == null) return [];

    final client = SupabaseService.client;
    final result = await client.rpc('search_evidence_by_tag', params: {
      'p_workspace_id': orgId,
      'p_search_term': searchTerm,
      'p_job_id': jobId,
      'p_defects_only': defectsOnly,
      'p_limit': limit,
      'p_offset': offset,
    });

    if (result == null) return [];

    final list = result as List<dynamic>;
    return list
        .map((e) => EvidenceItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
