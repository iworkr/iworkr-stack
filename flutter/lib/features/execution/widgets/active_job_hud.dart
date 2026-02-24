import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:drift/drift.dart' show OrderingTerm;
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/slide_to_act.dart';

/// The Active Job HUD — a persistent, glassmorphic bottom bar that shows
/// the running timer and Slide-to-Complete control whenever a job is in progress.
///
/// This widget is meant to be placed in the app shell so it persists across
/// all screens while a job timer is active.
class ActiveJobHud extends ConsumerStatefulWidget {
  const ActiveJobHud({super.key});

  @override
  ConsumerState<ActiveJobHud> createState() => _ActiveJobHudState();
}

class _ActiveJobHudState extends ConsumerState<ActiveJobHud> {
  Timer? _tickTimer;
  Duration _elapsed = Duration.zero;
  LocalTimerSession? _session;

  @override
  void initState() {
    super.initState();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    super.dispose();
  }

  void _tick() {
    if (_session != null && mounted) {
      setState(() {
        _elapsed = DateTime.now().toUtc().difference(_session!.startedAt);
      });
    }
  }

  String _formatDuration(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final userId = SupabaseService.auth.currentUser?.id;
    final orgId = ref.watch(activeWorkspaceIdProvider);
    if (userId == null || orgId == null) return const SizedBox.shrink();

    final db = ref.watch(appDatabaseProvider);

    return StreamBuilder<List<LocalTimerSession>>(
      stream: (db.select(db.localTimerSessions)
            ..where((t) => t.userId.equals(userId))
            ..where((t) => t.status.equals('active'))
            ..orderBy([(t) => OrderingTerm.desc(t.startedAt)])
            ..limit(1))
          .watch(),
      builder: (context, snapshot) {
        final sessions = snapshot.data ?? [];
        if (sessions.isEmpty) {
          _session = null;
          return const SizedBox.shrink();
        }

        final session = sessions.first;
        _session = session;
        _elapsed = DateTime.now().toUtc().difference(session.startedAt);

        return _HudBar(
          elapsed: _elapsed,
          formattedTime: _formatDuration(_elapsed),
          jobId: session.jobId,
          sessionId: session.id,
          onTap: () => context.push('/jobs/${session.jobId}/execute'),
          onComplete: () async {
            HapticFeedback.heavyImpact();
            final sync = ref.read(syncEngineProvider);
            await sync.completeTimer(
              sessionId: session.id,
              jobId: session.jobId,
            );
          },
          onPause: () {
            HapticFeedback.mediumImpact();
          },
        );
      },
    );
  }
}

class _HudBar extends StatelessWidget {
  final Duration elapsed;
  final String formattedTime;
  final String jobId;
  final String sessionId;
  final VoidCallback onTap;
  final VoidCallback onComplete;
  final VoidCallback onPause;

  const _HudBar({
    required this.elapsed,
    required this.formattedTime,
    required this.jobId,
    required this.sessionId,
    required this.onTap,
    required this.onComplete,
    required this.onPause,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: EdgeInsets.fromLTRB(16, 12, 16, bottomPad + 12),
            decoration: BoxDecoration(
              color: const Color(0xFF09090B).withValues(alpha: 0.92),
              border: const Border(
                top: BorderSide(color: Color(0x0DFFFFFF)),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  blurRadius: 20,
                  offset: const Offset(0, -8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Timer row
                GestureDetector(
                  onTap: onTap,
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    children: [
                      // Pause button
                      GestureDetector(
                        onTap: onPause,
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            color: Colors.white.withValues(alpha: 0.04),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                          ),
                          child: const Icon(PhosphorIconsLight.pause, size: 16, color: ObsidianTheme.textSecondary),
                        ),
                      ),
                      const SizedBox(width: 14),

                      // Timer display
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            formattedTime,
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: ObsidianTheme.emerald,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Text(
                            'Job in progress',
                            style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // Live indicator
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(6),
                          color: ObsidianTheme.emeraldDim,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: ObsidianTheme.emerald,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'LIVE',
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 9,
                                color: ObsidianTheme.emerald,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // Slide to complete
                SlideToAct(
                  label: 'Slide to Complete Job',
                  onSlideComplete: onComplete,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
