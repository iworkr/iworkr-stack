import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:drift/drift.dart' show OrderingTerm;
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';

class SyncIndicator extends ConsumerWidget {
  const SyncIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(syncStatusProvider);
    final pendingCount = ref.watch(pendingSyncCountProvider);
    final failedCount = ref.watch(failedSyncCountProvider);

    final icon = switch (status) {
      SyncStatus.synced => Icons.cloud_done_rounded,
      SyncStatus.syncing => Icons.cloud_sync_rounded,
      SyncStatus.offline => Icons.cloud_off_rounded,
      SyncStatus.failed => Icons.error_outline_rounded,
    };

    final color = switch (status) {
      SyncStatus.synced => const Color(0xFF10B981),
      SyncStatus.syncing => const Color(0xFFF59E0B),
      SyncStatus.offline => const Color(0xFFEF4444),
      SyncStatus.failed => const Color(0xFFEF4444),
    };

    final pending = pendingCount.valueOrNull ?? 0;
    final failed = failedCount.valueOrNull ?? 0;

    return GestureDetector(
      onTap: () {
        if (failed > 0) {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const DeadLetterQueueScreen()),
          );
        }
      },
      child: Tooltip(
        message: switch (status) {
          SyncStatus.synced => 'All changes synced',
          SyncStatus.syncing => 'Syncing...',
          SyncStatus.offline => '$pending items pending sync',
          SyncStatus.failed => '$failed items failed to sync',
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Icon(icon, key: ValueKey(status), color: color, size: 22),
            ),
            if (pending > 0 && status != SyncStatus.synced)
              Positioned(
                top: -4,
                right: -6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '$pending',
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class DeadLetterQueueScreen extends ConsumerStatefulWidget {
  const DeadLetterQueueScreen({super.key});

  @override
  ConsumerState<DeadLetterQueueScreen> createState() => _DeadLetterQueueScreenState();
}

class _DeadLetterQueueScreenState extends ConsumerState<DeadLetterQueueScreen> {
  List<SyncQueueData> _failed = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final db = ref.read(appDatabaseProvider);
    final items = await (db.select(db.syncQueue)
          ..where((q) => q.status.equals('failed'))
          ..orderBy([(q) => OrderingTerm.desc(q.createdAt)])
          ..limit(50))
        .get();
    setState(() { _failed = items; _loading = false; });
  }

  Future<void> _dismiss(String id) async {
    final db = ref.read(appDatabaseProvider);
    await db.markSynced(id);
    _load();
  }

  Future<void> _retryAll() async {
    final db = ref.read(appDatabaseProvider);
    await db.resetToPending(_failed.map((f) => f.id).toList());
    ref.read(syncEngineProvider).drainQueue();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        title: const Text('Failed Sync Items', style: TextStyle(fontSize: 16)),
        actions: [
          if (_failed.isNotEmpty)
            TextButton.icon(
              onPressed: _retryAll,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry All'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
          : _failed.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_outline, size: 48, color: Color(0xFF10B981)),
                      SizedBox(height: 12),
                      Text('No failed items', style: TextStyle(color: Color(0xFF6B7280))),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _failed.length,
                  itemBuilder: (_, i) {
                    final item = _failed[i];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF141414),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF374151).withValues(alpha: 0.5)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.error_outline, size: 16, color: Color(0xFFEF4444)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '${item.entityType} / ${item.action}',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFF3F4F6)),
                                ),
                              ),
                              Text(
                                'Retry ${item.retryCount}/5',
                                style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
                              ),
                            ],
                          ),
                          if (item.errorMessage != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              _humanError(item.errorMessage!),
                              style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              _ActionButton(
                                label: 'Dismiss',
                                icon: Icons.close,
                                onTap: () => _dismiss(item.id),
                              ),
                              const SizedBox(width: 8),
                              _ActionButton(
                                label: 'Retry',
                                icon: Icons.refresh,
                                color: const Color(0xFF10B981),
                                onTap: () async {
                                  final db = ref.read(appDatabaseProvider);
                                  await db.resetToPending([item.id]);
                                  ref.read(syncEngineProvider).drainQueue();
                                  _load();
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }

  String _humanError(String raw) {
    if (raw.contains('No rows updated')) return 'This record was deleted by the office. You can safely dismiss it.';
    if (raw.contains('No rows deleted')) return 'This record was already removed. You can dismiss it.';
    if (raw.contains('duplicate key')) return 'This record already exists on the server.';
    if (raw.contains('violates foreign key')) return 'A related record no longer exists.';
    return raw.length > 120 ? '${raw.substring(0, 120)}...' : raw;
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final Color color;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
    this.color = const Color(0xFF6B7280),
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          color: color.withValues(alpha: 0.1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}
