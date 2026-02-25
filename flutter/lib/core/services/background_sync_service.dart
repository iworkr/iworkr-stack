import 'dart:convert';
import 'dart:developer';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart' show FileOptions;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:workmanager/workmanager.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

const _syncTaskName = 'com.iworkr.backgroundSync';
const _periodicSyncName = 'com.iworkr.periodicSync';

/// Top-level callback — runs in a separate isolate.
/// Cannot access Flutter widgets or Provider.
@pragma('vm:entry-point')
void backgroundSyncCallback() {
  Workmanager().executeTask((taskName, inputData) async {
    try {
      log('[BackgroundSync] Task started: $taskName');

      final connectivity = await Connectivity().checkConnectivity();
      final hasNetwork = connectivity.any((c) => c != ConnectivityResult.none);
      if (!hasNetwork) {
        log('[BackgroundSync] No network, skipping');
        return true;
      }

      await SupabaseService.initialize();

      final session = SupabaseService.auth.currentSession;
      if (session == null) {
        log('[BackgroundSync] No active session, skipping');
        return true;
      }

      final db = AppDatabase();
      final pending = await db.pendingMutations();

      if (pending.isEmpty) {
        log('[BackgroundSync] Queue empty, nothing to sync');
        await db.close();
        return true;
      }

      log('[BackgroundSync] Processing ${pending.length} queued mutations');

      for (final item in pending) {
        try {
          await _processMutation(item);
          await db.markSynced(item.id);
          log('[BackgroundSync] Synced: ${item.entityType}/${item.action}');
        } catch (e) {
          final retries = item.retryCount + 1;
          if (retries > 4) {
            await db.markFailed(item.id, e.toString());
            log('[BackgroundSync] Permanently failed: ${item.id}');
          } else {
            await db.incrementRetry(item.id);
            log('[BackgroundSync] Retry $retries for ${item.id}');
          }
        }
      }

      // Drain upload queue (binary file uploads to Supabase Storage)
      final pendingUploads = await db.pendingUploads();
      if (pendingUploads.isNotEmpty) {
        log('[BackgroundSync] Processing ${pendingUploads.length} queued uploads');
        for (final upload in pendingUploads) {
          try {
            final file = File(upload.localPath);
            if (!file.existsSync()) {
              await db.markUploaded(upload.id, '');
              continue;
            }
            final bytes = await file.readAsBytes();
            final remotePath = upload.remotePath ?? '${upload.jobId}/${upload.id}.jpg';
            await SupabaseService.client.storage
                .from('evidence')
                .uploadBinary(remotePath, bytes,
                    fileOptions: FileOptions(contentType: upload.mimeType));
            final publicUrl = SupabaseService.client.storage
                .from('evidence')
                .getPublicUrl(remotePath);
            await db.markUploaded(upload.id, publicUrl);

            // Update the job_media record with the remote URL
            await SupabaseService.client
                .from('job_media')
                .update({'file_url': publicUrl})
                .eq('job_id', upload.jobId)
                .eq('file_url', upload.localPath);

            log('[BackgroundSync] Uploaded: ${upload.id}');
          } catch (e) {
            log('[BackgroundSync] Upload failed: ${upload.id} - $e');
          }
        }
      }

      await db.close();
      log('[BackgroundSync] Task completed');
      return true;
    } catch (e) {
      log('[BackgroundSync] Task failed: $e');
      return false;
    }
  });
}

Future<void> _processMutation(SyncQueueData item) async {
  final payload = item.payload;

  switch (item.action) {
    case 'UPDATE':
      await SupabaseService.client
          .from(_tableForEntity(item.entityType))
          .update(_decodePayload(payload))
          .eq('id', item.entityId);
    case 'INSERT':
      final data = _decodePayload(payload);
      data['id'] = item.entityId;
      await SupabaseService.client
          .from(_tableForEntity(item.entityType))
          .upsert(data);
    case 'DELETE':
      await SupabaseService.client
          .from(_tableForEntity(item.entityType))
          .delete()
          .eq('id', item.entityId);
    default:
      throw Exception('Unknown action: ${item.action}');
  }
}

Map<String, dynamic> _decodePayload(String json) {
  return Map<String, dynamic>.from(
    (const JsonDecoder().convert(json)) as Map,
  );
}

String _tableForEntity(String entityType) {
  return switch (entityType) {
    'job' => 'jobs',
    'job_subtask' => 'job_subtasks',
    'job_timer_session' => 'job_timer_sessions',
    'job_media' => 'job_media',
    _ => entityType,
  };
}

/// Service class for registering background sync tasks.
class BackgroundSyncService {
  BackgroundSyncService._();
  static final instance = BackgroundSyncService._();

  Future<void> initialize() async {
    await Workmanager().initialize(
      backgroundSyncCallback,
      isInDebugMode: false,
    );

    await Workmanager().registerPeriodicTask(
      _periodicSyncName,
      _periodicSyncName,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
      backoffPolicy: BackoffPolicy.exponential,
      initialDelay: const Duration(seconds: 30),
    );
  }

  /// Trigger an immediate one-off sync (e.g., when app goes to background)
  Future<void> triggerImmediateSync() async {
    await Workmanager().registerOneOffTask(
      '$_syncTaskName-${DateTime.now().millisecondsSinceEpoch}',
      _syncTaskName,
      constraints: Constraints(networkType: NetworkType.connected),
      backoffPolicy: BackoffPolicy.exponential,
    );
  }
}
