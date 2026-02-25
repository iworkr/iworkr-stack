import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/job_execution_provider.dart' as exec;
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/telemetry_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/models/job.dart';
import 'package:iworkr_mobile/models/telemetry_event.dart';

import 'package:iworkr_mobile/core/services/forms_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/execution/widgets/slide_to_engage.dart';
import 'package:iworkr_mobile/features/execution/widgets/hud_subtask_list.dart';
import 'package:iworkr_mobile/features/execution/widgets/evidence_locker_sheet.dart';
import 'package:iworkr_mobile/features/execution/widgets/job_completion_sheet.dart';
import 'package:iworkr_mobile/features/payments/screens/terminal_screen.dart';
import 'package:iworkr_mobile/features/forms/screens/compliance_packet_screen.dart';
import 'package:iworkr_mobile/features/forms/screens/form_runner_screen.dart';
import 'package:iworkr_mobile/models/form_template.dart';
import 'package:iworkr_mobile/models/invoice.dart';

/// Job HUD — immersive "Black Box" job execution interface.
///
/// Full-screen, dock hidden, emerald pulse vignette indicates "live recording."
/// Contains: Job Brief (pre-start), Timer, Task List, Evidence Locker, Activity Stream.
class JobHudScreen extends ConsumerStatefulWidget {
  final String jobId;
  const JobHudScreen({super.key, required this.jobId});

  @override
  ConsumerState<JobHudScreen> createState() => _JobHudScreenState();
}

enum _HudPhase { brief, traveling, onSite, working, completed }

class _JobHudScreenState extends ConsumerState<JobHudScreen>
    with TickerProviderStateMixin {
  Timer? _ticker;
  Duration _elapsed = Duration.zero;
  DateTime? _startTime;
  String? _sessionId;
  _HudPhase _phase = _HudPhase.brief;
  bool _hazardActive = false;

  bool get _engaged => _phase == _HudPhase.working;
  bool get _completed => _phase == _HudPhase.completed;

  late AnimationController _pulseBorder;
  late AnimationController _timerGlow;
  late AnimationController _vignetteCtrl;

  List<Map<String, dynamic>> _subtasks = [];
  int _tabIndex = 0;

  final _noteController = TextEditingController();
  final _noteFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _pulseBorder = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );
    _timerGlow = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _vignetteCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    );

    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);

    _resolveInitialPhase();
  }

  Future<void> _resolveInitialPhase() async {
    final job = await ref.read(jobDetailProvider(widget.jobId).future);
    if (job == null || !mounted) return;

    setState(() {
      switch (job.status) {
        case JobStatus.enRoute:
          _phase = _HudPhase.traveling;
        case JobStatus.onSite:
          _phase = _HudPhase.onSite;
        case JobStatus.inProgress:
          _phase = _HudPhase.working;
          _resumeActiveTimer();
        case JobStatus.done:
        case JobStatus.completed:
        case JobStatus.invoiced:
        case JobStatus.archived:
          _phase = _HudPhase.completed;
        default:
          _phase = _HudPhase.brief;
      }
    });
  }

  Future<void> _resumeActiveTimer() async {
    final session = await ref.read(exec.activeTimerProvider(widget.jobId).future);
    if (session != null && mounted) {
      setState(() {
        _sessionId = session.id;
        _startTime = session.startedAt;
        _elapsed = DateTime.now().difference(session.startedAt);
      });
      _startTimer();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _pulseBorder.dispose();
    _timerGlow.dispose();
    _vignetteCtrl.dispose();
    _noteController.dispose();
    _noteFocus.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _startTimer() {
    _startTime = DateTime.now();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _elapsed = DateTime.now().difference(_startTime!);
      });
    });
    _pulseBorder.repeat(reverse: true);
    _timerGlow.repeat(reverse: true);
    _vignetteCtrl.repeat(reverse: true);
  }

  Future<void> _onStartTravel() async {
    try {
      await exec.startTravel(jobId: widget.jobId);
      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: TelemetryEventType.jobStarted,
        eventData: {'phase': 'travel'},
      );
      if (mounted) {
        setState(() => _phase = _HudPhase.traveling);
        HapticFeedback.heavyImpact();
      }
      ref.invalidate(jobDetailProvider(widget.jobId));
    } catch (e) {
      if (mounted) _showError('Failed to start travel.');
    }
  }

  Future<void> _onArrived() async {
    try {
      await exec.arriveOnSite(jobId: widget.jobId);
      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: TelemetryEventType.jobStarted,
        eventData: {'phase': 'arrived'},
      );
      if (mounted) {
        setState(() => _phase = _HudPhase.onSite);
        HapticFeedback.heavyImpact();
      }
      ref.invalidate(jobDetailProvider(widget.jobId));
    } catch (e) {
      if (mounted) _showError('Failed to update status.');
    }
  }

  Future<void> _onEngaged() async {
    setState(() => _phase = _HudPhase.working);

    try {
      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: TelemetryEventType.jobStarted,
      );

      final session = await exec.startJobTimer(jobId: widget.jobId);
      if (session != null && mounted) {
        setState(() => _sessionId = session.id);
        _startTimer();
      }

      ref.invalidate(jobDetailProvider(widget.jobId));
    } catch (e) {
      if (mounted) {
        setState(() => _phase = _HudPhase.onSite);
        _showError('Failed to start job. Check your connection.');
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: const Color(0xFFF43F5E),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
      duration: const Duration(seconds: 4),
    ));
  }

  Future<void> _onTaskToggle(Map<String, dynamic> task) async {
    final id = task['id'] as String;
    final wasCompleted = task['completed'] as bool? ?? false;
    final newCompleted = !wasCompleted;

    final previousSubtasks = List<Map<String, dynamic>>.from(_subtasks.map((t) => Map<String, dynamic>.from(t)));

    setState(() {
      final idx = _subtasks.indexWhere((t) => t['id'] == id);
      if (idx >= 0) {
        _subtasks[idx] = {..._subtasks[idx], 'completed': newCompleted};
      }
    });

    try {
      await exec.toggleSubtask(subtaskId: id, completed: newCompleted);

      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: newCompleted
            ? TelemetryEventType.taskCompleted
            : TelemetryEventType.taskUnchecked,
        eventData: {'task_title': task['title'], 'task_id': id},
      );
    } catch (e) {
      if (mounted) {
        setState(() => _subtasks = previousSubtasks);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to update task.'),
          backgroundColor: const Color(0xFFF43F5E),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        ));
      }
    }
  }

  Future<void> _onComplete() async {
    if (_sessionId == null) return;

    final postForms = await ref.read(stageFormsProvider('post_job').future);
    if (postForms.isNotEmpty && mounted) {
      final postComplete = await ref.read(postJobFormsCompleteProvider(widget.jobId).future);
      if (!postComplete) {
        if (!mounted) return;
        final cleared = await showCompliancePacket(
          context,
          jobId: widget.jobId,
          stage: FormStage.postJob,
        );
        if (!cleared) return;
        ref.invalidate(postJobFormsCompleteProvider(widget.jobId));
      }
    }

    final photoCount = await ref.read(exec.jobMediaCountProvider(widget.jobId).future);

    if (!mounted) return;

    final result = await showJobCompletionSheet(
      context,
      jobId: widget.jobId,
      sessionId: _sessionId!,
      elapsed: _elapsed,
      subtasks: _subtasks,
      photoCount: photoCount,
    );

    if (result == true && mounted) {
      setState(() => _phase = _HudPhase.completed);
      _ticker?.cancel();
      _pulseBorder.stop();
      _timerGlow.stop();
      _vignetteCtrl.stop();

      // Check for an outstanding invoice linked to this job
      try {
        final invoiceData = await SupabaseService.client
            .from('invoices')
            .select()
            .eq('job_id', widget.jobId)
            .inFilter('status', ['draft', 'sent', 'overdue', 'partially_paid'])
            .order('created_at', ascending: false)
            .limit(1)
            .maybeSingle();

        if (invoiceData != null && mounted) {
          final invoice = Invoice.fromJson(invoiceData);
          if (invoice.total > 0) {
            // Push terminal and await result — paid (true) or declined/invoice-link (false)
            final paid = await Navigator.of(context, rootNavigator: true).push<bool>(
              PageRouteBuilder(
                opaque: true,
                pageBuilder: (_, __, ___) => TerminalScreen(invoice: invoice),
                transitionsBuilder: (_, animation, __, child) {
                  return FadeTransition(
                    opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
                    child: child,
                  );
                },
                transitionDuration: const Duration(milliseconds: 400),
                reverseTransitionDuration: const Duration(milliseconds: 250),
              ),
            );

            // Whether paid or pivoted to invoice link, release the tech
            if (mounted) {
              await Future.delayed(const Duration(milliseconds: 300));
              Navigator.of(context).pop(paid ?? false);
            }
            return;
          }
        }
      } catch (_) {}

      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  Future<void> _submitNote() async {
    final text = _noteController.text.trim();
    if (text.isEmpty) return;

    HapticFeedback.lightImpact();
    _noteController.clear();
    _noteFocus.unfocus();

    await logTelemetryEvent(
      jobId: widget.jobId,
      eventType: TelemetryEventType.noteAdded,
      eventData: {'note': text},
    );

    ref.invalidate(jobTelemetryProvider(widget.jobId));
  }

  void _toggleHazard() {
    HapticFeedback.heavyImpact();
    setState(() => _hazardActive = !_hazardActive);
  }

  String get _timerDisplay {
    final h = _elapsed.inHours.toString().padLeft(2, '0');
    final m = _elapsed.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = _elapsed.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final jobAsync = ref.watch(jobDetailProvider(widget.jobId));
    final subtasksAsync = ref.watch(jobSubtasksProvider(widget.jobId));
    final telemetryAsync = ref.watch(jobTelemetryProvider(widget.jobId));

    subtasksAsync.whenData((data) {
      if (_subtasks.isEmpty && data.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) setState(() => _subtasks = List.from(data));
        });
      }
    });

    return Scaffold(
      backgroundColor: c.canvas,
      body: AnimatedBuilder(
        animation: Listenable.merge([_pulseBorder, _vignetteCtrl]),
        builder: (context, child) {
          final pulseVal = _engaged && !_completed ? _pulseBorder.value : 0.0;
          final vigVal = _engaged && !_completed ? _vignetteCtrl.value : 0.0;
          return Container(
            decoration: BoxDecoration(
              border: _engaged && !_completed
                  ? Border.all(
                      color: (_hazardActive ? ObsidianTheme.amber : ObsidianTheme.emerald)
                          .withValues(alpha: 0.06 + pulseVal * 0.06),
                      width: 1.5,
                    )
                  : null,
            ),
            child: Stack(
              children: [
                child!,
                if (_engaged && !_completed)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            center: Alignment.center,
                            radius: 1.2,
                            colors: [
                              Colors.transparent,
                              (_hazardActive ? ObsidianTheme.amber : ObsidianTheme.emerald)
                                  .withValues(alpha: 0.03 + vigVal * 0.03),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(jobAsync, c),
              Expanded(
                child: _phase == _HudPhase.working
                    ? _buildEngagedContent(telemetryAsync, c)
                    : _phase == _HudPhase.traveling
                        ? _buildTravelingView(jobAsync, c)
                        : _phase == _HudPhase.onSite
                            ? _buildOnSiteView(jobAsync, subtasksAsync, c)
                            : _buildJobBrief(jobAsync, subtasksAsync, c),
              ),
              if (_engaged && !_completed) _buildBottomBar(c),
            ],
          ),
        ),
      ),
      floatingActionButton: _engaged && !_completed
          ? FloatingActionButton(
              onPressed: () => showEvidenceLocker(context, jobId: widget.jobId),
              backgroundColor: c.surfaceSecondary,
              shape: const CircleBorder(),
              child: const Icon(PhosphorIconsLight.camera, color: ObsidianTheme.emerald, size: 22),
            )
                .animate()
                .fadeIn(delay: 500.ms, duration: 400.ms)
                .scale(begin: const Offset(0.8, 0.8), delay: 500.ms, duration: 400.ms, curve: Curves.easeOutBack)
          : null,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── Header ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildHeader(AsyncValue<Job?> jobAsync, IWorkrColors c) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: BoxDecoration(
        color: c.canvas,
        border: Border(
          bottom: BorderSide(
            color: _phase == _HudPhase.traveling
                ? ObsidianTheme.amber.withValues(alpha: 0.1)
                : _engaged
                    ? (_hazardActive ? ObsidianTheme.amber : ObsidianTheme.emerald)
                        .withValues(alpha: 0.1)
                    : c.border,
          ),
        ),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 20),
            ),
          ),
          const SizedBox(width: 14),

          jobAsync.when(
            data: (job) => Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    job?.displayId ?? '',
                    style: GoogleFonts.jetBrainsMono(
                      color: c.textTertiary,
                      fontSize: 11,
                      letterSpacing: 1,
                    ),
                  ),
                  if (job?.clientName != null)
                    Text(
                      job!.clientName!,
                      style: GoogleFonts.inter(
                        color: c.textSecondary,
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            loading: () => const Expanded(child: SizedBox.shrink()),
            error: (_, __) => const Expanded(child: SizedBox.shrink()),
          ),

          if (_phase == _HudPhase.traveling)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: ObsidianTheme.amber.withValues(alpha: 0.1),
                border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.2)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(PhosphorIconsBold.navigationArrow, size: 12, color: ObsidianTheme.amber),
                  const SizedBox(width: 6),
                  Text('EN ROUTE', style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.amber, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1,
                  )),
                ],
              ),
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .fadeIn(begin: 0.6, duration: 1500.ms),

          if (_phase == _HudPhase.onSite)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: const Color(0xFF6D28D9).withValues(alpha: 0.1),
                border: Border.all(color: const Color(0xFF6D28D9).withValues(alpha: 0.2)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(PhosphorIconsBold.mapPinArea, size: 12, color: Color(0xFF8B5CF6)),
                  const SizedBox(width: 6),
                  Text('ON SITE', style: GoogleFonts.jetBrainsMono(
                    color: const Color(0xFF8B5CF6), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1,
                  )),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),

          if (_engaged)
            AnimatedBuilder(
              animation: _timerGlow,
              builder: (_, child) {
                final glow = _timerGlow.value;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    color: ObsidianTheme.emerald.withValues(alpha: 0.06 + glow * 0.04),
                    border: Border.all(
                      color: ObsidianTheme.emerald.withValues(alpha: 0.15 + glow * 0.1),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6, height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: ObsidianTheme.emerald,
                          boxShadow: [
                            BoxShadow(
                              color: ObsidianTheme.emerald.withValues(alpha: 0.4 + glow * 0.3),
                              blurRadius: 4 + glow * 4,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      child!,
                    ],
                  ),
                );
              },
              child: Text(
                _timerDisplay,
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.emerald,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms)
                .scale(begin: const Offset(0.9, 0.9), duration: 400.ms, curve: Curves.easeOutBack),

          if (_engaged) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                color: ObsidianTheme.emerald.withValues(alpha: 0.1),
              ),
              child: Text(
                'REC',
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.emerald,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .fadeIn(begin: 0.4, duration: 1500.ms),
            const SizedBox(width: 6),
            GestureDetector(
              onTap: _toggleHazard,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _hazardActive
                      ? ObsidianTheme.amber.withValues(alpha: 0.15)
                      : c.border,
                  border: Border.all(
                    color: _hazardActive
                        ? ObsidianTheme.amber.withValues(alpha: 0.3)
                        : c.borderMedium,
                  ),
                ),
                child: Icon(
                  PhosphorIconsBold.warning,
                  size: 14,
                  color: _hazardActive ? ObsidianTheme.amber : c.textTertiary,
                ),
              ),
            ),
          ],
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }

  // ═══════════════════════════════════════════════════════════
  // ── Job Brief (Pre-Start) ──────────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildJobBrief(
    AsyncValue<Job?> jobAsync,
    AsyncValue<List<Map<String, dynamic>>> subtasksAsync,
    IWorkrColors c,
  ) {
    return jobAsync.when(
      data: (job) {
        if (job == null) return const SizedBox.shrink();
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            _MapSnapshotCard(job: job),
            const SizedBox(height: 16),

            _BriefInfoCard(
              icon: PhosphorIconsLight.notepad,
              label: 'SCOPE OF WORK',
              content: job.description ?? job.title,
              accentColor: ObsidianTheme.emerald,
              delay: 100,
            ),

            if (job.description != null && job.description!.toLowerCase().contains('code'))
              _BriefInfoCard(
                icon: PhosphorIconsLight.key,
                label: 'ACCESS',
                content: _extractAccessInfo(job.description!),
                accentColor: ObsidianTheme.amber,
                delay: 150,
              ),

            subtasksAsync.when(
              data: (tasks) {
                if (tasks.isEmpty) return const SizedBox.shrink();
                final critical = tasks.where((t) => t['is_critical'] == true).length;
                return _BriefInfoCard(
                  icon: PhosphorIconsLight.listChecks,
                  label: 'TASKS',
                  content: '${tasks.length} tasks queued${critical > 0 ? ' · $critical critical' : ''}',
                  accentColor: c.textSecondary,
                  delay: 200,
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            Row(
              children: [
                Expanded(
                  child: _BriefStatCard(
                    icon: PhosphorIconsLight.flag,
                    label: 'PRIORITY',
                    value: job.priority.name.toUpperCase(),
                    color: _priorityColor(job.priority, c),
                    delay: 250,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _BriefStatCard(
                    icon: PhosphorIconsLight.timer,
                    label: 'ESTIMATED',
                    value: job.estimatedDurationMinutes != null
                        ? '${job.estimatedDurationMinutes}m'
                        : '${job.estimatedHours.toStringAsFixed(1)}h',
                    color: c.textSecondary,
                    delay: 300,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            SlideToEngage(
              onEngaged: _onStartTravel,
              label: 'SLIDE TO START TRAVEL',
            ),
          ],
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── Traveling View (en_route) ────────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildTravelingView(AsyncValue<Job?> jobAsync, IWorkrColors c) {
    return jobAsync.when(
      data: (job) {
        if (job == null) return const SizedBox.shrink();
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            _MapSnapshotCard(job: job),
            const SizedBox(height: 16),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: ObsidianTheme.amber.withValues(alpha: 0.06),
                border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: ObsidianTheme.amber.withValues(alpha: 0.12),
                    ),
                    child: const Icon(PhosphorIconsBold.navigationArrow, color: ObsidianTheme.amber, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'EN ROUTE',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.amber,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          job.location ?? 'Heading to job site',
                          style: GoogleFonts.inter(color: c.textSecondary, fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
                .animate(onPlay: (ctrl) => ctrl.repeat(reverse: true))
                .shimmer(delay: 500.ms, duration: 2000.ms, color: ObsidianTheme.amber.withValues(alpha: 0.05)),

            const SizedBox(height: 16),

            if (job.location != null)
              _BriefInfoCard(
                icon: PhosphorIconsLight.mapPin,
                label: 'DESTINATION',
                content: job.location!,
                accentColor: ObsidianTheme.amber,
                delay: 100,
              ),

            _BriefInfoCard(
              icon: PhosphorIconsLight.notepad,
              label: 'SCOPE OF WORK',
              content: job.description ?? job.title,
              accentColor: ObsidianTheme.emerald,
              delay: 150,
            ),

            const SizedBox(height: 24),

            GestureDetector(
              onTap: () {
                HapticFeedback.heavyImpact();
                _onArrived();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: ObsidianTheme.amber.withValues(alpha: 0.1),
                  border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(PhosphorIconsBold.mapPinArea, size: 18, color: ObsidianTheme.amber),
                    const SizedBox(width: 8),
                    Text(
                      'I HAVE ARRIVED',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.amber,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            )
                .animate()
                .fadeIn(delay: 200.ms, duration: 400.ms)
                .moveY(begin: 8, delay: 200.ms, duration: 400.ms),
          ],
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.amber, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── On-Site View (Pre-Work Gate) ─────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildOnSiteView(
    AsyncValue<Job?> jobAsync,
    AsyncValue<List<Map<String, dynamic>>> subtasksAsync,
    IWorkrColors c,
  ) {
    return jobAsync.when(
      data: (job) {
        if (job == null) return const SizedBox.shrink();
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: const Color(0xFF0D1117),
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                    ),
                    child: const Icon(PhosphorIconsBold.mapPinArea, color: ObsidianTheme.emerald, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ON SITE',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.emerald,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Complete pre-start checks before beginning work',
                          style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms)
                .moveY(begin: 8, duration: 400.ms),

            const SizedBox(height: 16),

            _BriefInfoCard(
              icon: PhosphorIconsLight.notepad,
              label: 'SCOPE OF WORK',
              content: job.description ?? job.title,
              accentColor: ObsidianTheme.emerald,
              delay: 100,
            ),

            subtasksAsync.when(
              data: (tasks) {
                if (tasks.isEmpty) return const SizedBox.shrink();
                final critical = tasks.where((t) => t['is_critical'] == true).length;
                return _BriefInfoCard(
                  icon: PhosphorIconsLight.listChecks,
                  label: 'TASKS',
                  content: '${tasks.length} tasks queued${critical > 0 ? ' · $critical critical' : ''}',
                  accentColor: c.textSecondary,
                  delay: 150,
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 16),

            // SWMS / Pre-Job Forms Gate
            Consumer(
              builder: (context, ref, _) {
                final preJobReady = ref.watch(preJobFormsCompleteProvider(widget.jobId));
                final preJobForms = ref.watch(stageFormsProvider('pre_job'));
                final hasPreForms = preJobForms.valueOrNull?.isNotEmpty ?? false;

                final isUnlocked = preJobReady.valueOrNull ?? true;

                return Column(
                  children: [
                    if (hasPreForms) ...[
                      GestureDetector(
                        onTap: () async {
                          HapticFeedback.mediumImpact();
                          final cleared = await showCompliancePacket(
                            context,
                            jobId: widget.jobId,
                            stage: FormStage.preJob,
                          );
                          if (cleared) {
                            ref.invalidate(preJobFormsCompleteProvider(widget.jobId));
                          }
                        },
                        child: AnimatedContainer(
                          duration: ObsidianTheme.standard,
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: isUnlocked
                                ? ObsidianTheme.emeraldDim
                                : ObsidianTheme.amberDim,
                            border: Border.all(
                              color: isUnlocked
                                  ? ObsidianTheme.emerald.withValues(alpha: 0.25)
                                  : ObsidianTheme.amber.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  color: (isUnlocked ? ObsidianTheme.emerald : ObsidianTheme.amber)
                                      .withValues(alpha: 0.12),
                                ),
                                child: Icon(
                                  isUnlocked
                                      ? PhosphorIconsBold.shieldCheck
                                      : PhosphorIconsBold.lockKey,
                                  color: isUnlocked ? ObsidianTheme.emerald : ObsidianTheme.amber,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      isUnlocked ? 'SAFETY SHIELD CLEARED' : 'SWMS REQUIRED',
                                      style: GoogleFonts.jetBrainsMono(
                                        color: isUnlocked ? ObsidianTheme.emerald : ObsidianTheme.amber,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: 1,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      isUnlocked
                                          ? 'All safety forms completed'
                                          : 'Tap to complete mandatory safety check',
                                      style: GoogleFonts.inter(
                                        color: c.textTertiary,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(
                                PhosphorIconsLight.caretRight,
                                size: 16,
                                color: isUnlocked ? ObsidianTheme.emerald : ObsidianTheme.amber,
                              ),
                            ],
                          ),
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 200.ms, duration: 400.ms)
                          .moveY(begin: 8, delay: 200.ms, duration: 400.ms),
                    ],

                    SlideToEngage(
                      onEngaged: _onEngaged,
                      enabled: isUnlocked,
                      label: isUnlocked ? 'SLIDE TO START WORK' : 'COMPLETE SAFETY CHECK',
                    ),
                  ],
                );
              },
            ),
          ],
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  String _extractAccessInfo(String description) {
    final lines = description.split('\n');
    for (final line in lines) {
      if (line.toLowerCase().contains('code') ||
          line.toLowerCase().contains('access') ||
          line.toLowerCase().contains('gate') ||
          line.toLowerCase().contains('key')) {
        return line.trim();
      }
    }
    return 'See job description';
  }

  Color _priorityColor(JobPriority p, IWorkrColors c) {
    switch (p) {
      case JobPriority.urgent:
        return ObsidianTheme.rose;
      case JobPriority.high:
        return ObsidianTheme.amber;
      case JobPriority.medium:
        return ObsidianTheme.blue;
      case JobPriority.low:
      case JobPriority.none:
        return c.textTertiary;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ── Engaged Content (Tabs) ─────────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildEngagedContent(AsyncValue<List<TelemetryEvent>> telemetryAsync, IWorkrColors c) {
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: c.hoverBg,
          ),
          child: Row(
            children: [
              _HudTab(label: 'TASKS', isActive: _tabIndex == 0, onTap: () => setState(() => _tabIndex = 0)),
              _HudTab(label: 'FORMS', isActive: _tabIndex == 1, onTap: () => setState(() => _tabIndex = 1)),
              _HudTab(label: 'ACTIVITY', isActive: _tabIndex == 2, onTap: () => setState(() => _tabIndex = 2)),
              _HudTab(label: 'INFO', isActive: _tabIndex == 3, onTap: () => setState(() => _tabIndex = 3)),
            ],
          ),
        )
            .animate()
            .fadeIn(duration: 300.ms),

        const SizedBox(height: 8),

        Expanded(
          child: AnimatedSwitcher(
            duration: ObsidianTheme.standard,
            child: _tabIndex == 0
                ? _buildTasksTab()
                : _tabIndex == 1
                    ? _buildFormsTab(c)
                    : _tabIndex == 2
                        ? _buildActivityTab(telemetryAsync, c)
                        : _buildInfoTab(c),
          ),
        ),
      ],
    );
  }

  Widget _buildTasksTab() {
    final total = _subtasks.length;
    final done = _subtasks.where((t) => t['completed'] == true).length;

    return ListView(
      key: const ValueKey('tasks'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        _ProgressBar(total: total, done: done),
        const SizedBox(height: 16),
        HudSubtaskList(
          subtasks: _subtasks,
          onToggle: _onTaskToggle,
          onAddNote: _onSubtaskNote,
        ),
      ],
    );
  }

  Widget _buildFormsTab(IWorkrColors c) {
    final midFormsAsync = ref.watch(stageFormsProvider('mid_job'));
    final responsesAsync = ref.watch(jobFormResponsesProvider(widget.jobId));

    return midFormsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (templates) {
        return responsesAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
          ),
          error: (_, __) => const SizedBox.shrink(),
          data: (responses) {
            final submittedIds = responses
                .where((r) => r.isSubmitted)
                .map((r) => r.formTemplateId)
                .toSet();

            if (templates.isEmpty) {
              return Center(
                key: const ValueKey('forms-empty'),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      PhosphorIconsLight.checks,
                      size: 48,
                      color: c.textTertiary,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No forms required',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: c.textMuted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Process forms will appear here when assigned',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: c.textTertiary,
                      ),
                    ),
                  ],
                ).animate().fadeIn(duration: 400.ms),
              );
            }

            return ListView.builder(
              key: const ValueKey('forms'),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: templates.length,
              itemBuilder: (context, index) {
                final template = templates[index];
                final isComplete = submittedIds.contains(template.id);

                return GestureDetector(
                  onTap: isComplete
                      ? null
                      : () async {
                          HapticFeedback.mediumImpact();
                          final submitted = await showFormRunner(
                            context,
                            template: template,
                            jobId: widget.jobId,
                          );
                          if (submitted == true) {
                            ref.invalidate(jobFormResponsesProvider(widget.jobId));
                          }
                        },
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: isComplete
                          ? ObsidianTheme.emeraldDim
                          : c.hoverBg,
                      border: Border.all(
                        color: isComplete
                            ? ObsidianTheme.emerald.withValues(alpha: 0.2)
                            : c.border,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            color: (isComplete ? ObsidianTheme.emerald : ObsidianTheme.blue)
                                .withValues(alpha: 0.1),
                          ),
                          child: Icon(
                            isComplete
                                ? PhosphorIconsBold.checkCircle
                                : PhosphorIconsLight.clipboardText,
                            color: isComplete ? ObsidianTheme.emerald : ObsidianTheme.blue,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                template.title,
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: isComplete ? c.textMuted : Colors.white,
                                  decoration: isComplete ? TextDecoration.lineThrough : null,
                                  decorationColor: c.textTertiary,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${template.totalFields} fields${template.requiresSignature ? ' · Signature' : ''}',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: c.textTertiary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          isComplete
                              ? PhosphorIconsBold.check
                              : PhosphorIconsLight.caretRight,
                          size: 16,
                          color: isComplete ? ObsidianTheme.emerald : c.textTertiary,
                        ),
                      ],
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(
                      delay: Duration(milliseconds: 60 * index),
                      duration: 400.ms,
                    )
                    .moveY(
                      begin: 8,
                      delay: Duration(milliseconds: 60 * index),
                      duration: 400.ms,
                      curve: Curves.easeOutCubic,
                    );
              },
            );
          },
        );
      },
    );
  }

  Future<void> _onSubtaskNote(Map<String, dynamic> task) async {
    final controller = TextEditingController();
    final title = task['title'] as String? ?? 'Subtask';

    final note = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SubtaskNoteSheet(
        taskTitle: title,
        controller: controller,
      ),
    );

    if (note != null && note.trim().isNotEmpty) {
      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: TelemetryEventType.noteAdded,
        eventData: {
          'note': note,
          'task_id': task['id'],
          'task_title': title,
        },
      );
      ref.invalidate(jobTelemetryProvider(widget.jobId));
    }
    controller.dispose();
  }

  Widget _buildActivityTab(AsyncValue<List<TelemetryEvent>> telemetryAsync, IWorkrColors c) {
    return Column(
      children: [
        Expanded(
          child: telemetryAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (events) {
              if (events.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 64,
                        height: 64,
                        child: CustomPaint(painter: _ClockFacePainter()),
                      )
                          .animate(onPlay: (c) => c.repeat())
                          .rotate(duration: 8000.ms),
                      const SizedBox(height: 16),
                      Text(
                        'Activity will appear here',
                        style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                      ),
                    ],
                  ),
                );
              }

              return ListView.builder(
                key: const ValueKey('activity'),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                itemCount: events.length,
                itemBuilder: (context, index) {
                  final event = events[index];
                  return _ActivityRow(event: event, index: index);
                },
              );
            },
          ),
        ),

        Container(
          padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).viewInsets.bottom > 0 ? 8 : 16),
          decoration: BoxDecoration(
            color: c.hoverBg,
            border: Border(top: BorderSide(color: c.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: c.activeBg,
                    border: Border.all(color: c.border),
                  ),
                  child: TextField(
                    controller: _noteController,
                    focusNode: _noteFocus,
                    style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Add a note...',
                      hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      isDense: true,
                    ),
                    onSubmitted: (_) => _submitNote(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _submitNote,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                    border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                  ),
                  child: const Icon(PhosphorIconsBold.paperPlaneTilt, size: 16, color: ObsidianTheme.emerald),
                ),
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(delay: 300.ms, duration: 300.ms),
      ],
    );
  }

  Widget _buildInfoTab(IWorkrColors c) {
    final jobAsync = ref.watch(jobDetailProvider(widget.jobId));

    return jobAsync.when(
      data: (job) {
        if (job == null) return const SizedBox.shrink();
        return ListView(
          key: const ValueKey('info'),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
          children: [
            _MapSnapshotCard(job: job),
            const SizedBox(height: 12),
            _BriefInfoCard(
              icon: PhosphorIconsLight.notepad,
              label: 'SCOPE',
              content: job.description ?? job.title,
              accentColor: ObsidianTheme.emerald,
              delay: 0,
            ),
            if (job.location != null)
              _BriefInfoCard(
                icon: PhosphorIconsLight.mapPin,
                label: 'LOCATION',
                content: job.location!,
                accentColor: ObsidianTheme.blue,
                delay: 50,
              ),
          ],
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── Bottom Bar ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  Widget _buildBottomBar(IWorkrColors c) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 80, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: c.hoverBg,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _onComplete,
          style: ElevatedButton.styleFrom(
            backgroundColor: ObsidianTheme.emerald.withValues(alpha: 0.12),
            foregroundColor: ObsidianTheme.emerald,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.25)),
            ),
            elevation: 0,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(PhosphorIconsLight.flagCheckered, size: 18),
              const SizedBox(width: 8),
              Text(
                'COMPLETE JOB',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 600.ms, duration: 400.ms)
        .moveY(begin: 12, delay: 600.ms, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Map Snapshot Card ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _MapSnapshotCard extends StatelessWidget {
  final Job job;
  const _MapSnapshotCard({required this.job});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          SizedBox(
            height: 140,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              child: Stack(
                children: [
                  CustomPaint(
                    painter: _MapGridPainter(
                      hasCoords: job.locationLat != null,
                    ),
                    size: const Size(double.infinity, 140),
                  ),
                  if (job.locationLat != null)
                    Center(
                      child: _LocationPin(),
                    ),
                ],
              ),
            ),
          ),
          if (job.location != null)
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                    ),
                    child: const Icon(PhosphorIconsLight.mapPin, size: 14, color: ObsidianTheme.emerald),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          job.location!,
                          style: GoogleFonts.inter(
                            color: c.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (job.locationLat != null)
                          Text(
                            '${job.locationLat!.toStringAsFixed(4)}, ${job.locationLng!.toStringAsFixed(4)}',
                            style: GoogleFonts.jetBrainsMono(
                              color: c.textTertiary,
                              fontSize: 10,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms)
        .moveY(begin: 8, duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

class _LocationPin extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emerald.withValues(alpha: 0.15),
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.4)),
          ),
          child: const Icon(PhosphorIconsBold.mapPin, size: 14, color: ObsidianTheme.emerald),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 1.1, duration: 2000.ms),
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.1)),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 0.8, end: 1.4, duration: 2500.ms)
            .fadeOut(begin: 0.3, duration: 2500.ms),
      ],
    );
  }
}

class _MapGridPainter extends CustomPainter {
  final bool hasCoords;
  _MapGridPainter({required this.hasCoords});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF080808),
    );

    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.02)
      ..strokeWidth = 0.5;

    for (double x = 0; x < size.width; x += 30) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += 30) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    if (hasCoords) {
      final cx = size.width / 2;
      final cy = size.height / 2;
      final crossPaint = Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.08)
        ..strokeWidth = 1;
      canvas.drawLine(Offset(cx, 0), Offset(cx, size.height), crossPaint);
      canvas.drawLine(Offset(0, cy), Offset(size.width, cy), crossPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _MapGridPainter old) => old.hasCoords != hasCoords;
}

// ═══════════════════════════════════════════════════════════
// ── Job Brief Cards ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _BriefInfoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String content;
  final Color accentColor;
  final int delay;

  const _BriefInfoCard({
    required this.icon,
    required this.label,
    required this.content,
    required this.accentColor,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: accentColor.withValues(alpha: 0.1),
            ),
            child: Icon(icon, size: 14, color: accentColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.jetBrainsMono(
                    color: c.textTertiary,
                    fontSize: 9,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  content,
                  style: GoogleFonts.inter(
                    color: c.textPrimary,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: delay), duration: 400.ms)
        .moveY(begin: 8, delay: Duration(milliseconds: delay), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

class _BriefStatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final int delay;

  const _BriefStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.jetBrainsMono(
              color: c.textTertiary,
              fontSize: 9,
              letterSpacing: 1.5,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: delay), duration: 400.ms)
        .moveY(begin: 8, delay: Duration(milliseconds: delay), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Progress Bar ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ProgressBar extends StatelessWidget {
  final int total;
  final int done;
  const _ProgressBar({required this.total, required this.done});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final progress = total > 0 ? done / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'PROGRESS',
                style: GoogleFonts.jetBrainsMono(
                  color: c.textTertiary,
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Text(
                '$done / $total',
                style: GoogleFonts.jetBrainsMono(
                  color: progress >= 1.0 ? ObsidianTheme.emerald : c.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 4,
              child: Stack(
                children: [
                  Container(color: c.border),
                  AnimatedFractionallySizedBox(
                    duration: ObsidianTheme.standard,
                    widthFactor: progress,
                    alignment: Alignment.centerLeft,
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        color: progress >= 1.0
                            ? ObsidianTheme.emerald
                            : ObsidianTheme.emerald.withValues(alpha: 0.7),
                        boxShadow: progress >= 1.0
                            ? [BoxShadow(color: ObsidianTheme.emeraldGlow, blurRadius: 8)]
                            : null,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: 6, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ═══════════════════════════════════════════════════════════
// ── HUD Tab ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _HudTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _HudTab({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: ObsidianTheme.fast,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: isActive ? c.border : Colors.transparent,
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                color: isActive ? Colors.white : c.textTertiary,
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                letterSpacing: 1.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Activity Row ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ActivityRow extends StatelessWidget {
  final TelemetryEvent event;
  final int index;

  const _ActivityRow({required this.event, required this.index});

  Color _dotColor(IWorkrColors c) {
    switch (event.eventType) {
      case TelemetryEventType.jobStarted:
      case TelemetryEventType.jobCompleted:
      case TelemetryEventType.taskCompleted:
        return ObsidianTheme.emerald;
      case TelemetryEventType.photoTaken:
        return ObsidianTheme.amber;
      case TelemetryEventType.noteAdded:
        return ObsidianTheme.blue;
      default:
        return c.textTertiary;
    }
  }

  IconData get _icon {
    switch (event.eventType) {
      case TelemetryEventType.jobStarted:
        return PhosphorIconsLight.play;
      case TelemetryEventType.jobCompleted:
        return PhosphorIconsLight.flagCheckered;
      case TelemetryEventType.taskCompleted:
        return PhosphorIconsLight.checkCircle;
      case TelemetryEventType.taskUnchecked:
        return PhosphorIconsLight.minusCircle;
      case TelemetryEventType.photoTaken:
        return PhosphorIconsLight.camera;
      case TelemetryEventType.noteAdded:
        return PhosphorIconsLight.notepad;
      default:
        return PhosphorIconsLight.circleNotch;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final time = '${event.timestamp.hour.toString().padLeft(2, '0')}:${event.timestamp.minute.toString().padLeft(2, '0')}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: _dotColor(c).withValues(alpha: 0.1),
            ),
            child: Icon(_icon, size: 13, color: _dotColor(c)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.displayText,
                  style: GoogleFonts.inter(
                    color: c.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      time,
                      style: GoogleFonts.jetBrainsMono(
                        color: c.textTertiary,
                        fontSize: 10,
                      ),
                    ),
                    if (event.accuracyLabel.isNotEmpty) ...[
                      _Dot(),
                      Icon(PhosphorIconsLight.mapPin, size: 9, color: c.textTertiary),
                      const SizedBox(width: 2),
                      Text(
                        event.accuracyLabel,
                        style: GoogleFonts.jetBrainsMono(
                          color: c.textTertiary,
                          fontSize: 10,
                        ),
                      ),
                    ],
                    if (event.batteryLevel != null) ...[
                      _Dot(),
                      Icon(PhosphorIconsLight.batteryHigh, size: 9, color: c.textTertiary),
                      const SizedBox(width: 2),
                      Text(
                        '${(event.batteryLevel! * 100).toInt()}%',
                        style: GoogleFonts.jetBrainsMono(
                          color: c.textTertiary,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 50 * index),
          duration: 300.ms,
        )
        .moveX(
          begin: -8,
          delay: Duration(milliseconds: 50 * index),
          duration: 300.ms,
          curve: Curves.easeOutCubic,
        );
  }
}

class _Dot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6),
      width: 2,
      height: 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: c.textTertiary.withValues(alpha: 0.5),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Subtask Note Sheet ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _SubtaskNoteSheet extends StatelessWidget {
  final String taskTitle;
  final TextEditingController controller;

  const _SubtaskNoteSheet({required this.taskTitle, required this.controller});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, mq.viewInsets.bottom + mq.padding.bottom + 16),
      decoration: BoxDecoration(
        color: const Color(0xF8080808),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: c.borderHover,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'NOTE FOR SUBTASK',
            style: GoogleFonts.jetBrainsMono(
              color: c.textTertiary,
              fontSize: 9,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            taskTitle,
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: c.activeBg,
              border: Border.all(color: c.borderMedium),
            ),
            child: TextField(
              controller: controller,
              autofocus: true,
              maxLines: 3,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Describe the issue or observation...',
                hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: c.activeBg,
                      border: Border.all(color: c.border),
                    ),
                    child: Center(
                      child: Text(
                        'Cancel',
                        style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.of(context).pop(controller.text);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: ObsidianTheme.emerald.withValues(alpha: 0.12),
                      border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                    child: Center(
                      child: Text(
                        'Save Note',
                        style: GoogleFonts.inter(
                          color: ObsidianTheme.emerald,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Clock Face Painter (Empty Activity State) ────────────
// ═══════════════════════════════════════════════════════════

class _ClockFacePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width * 0.38;

    canvas.drawCircle(
      Offset(cx, cy),
      r,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.05)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    for (int i = 0; i < 12; i++) {
      final angle = i * 3.14159 * 2 / 12 - 3.14159 / 2;
      final inner = r * 0.8;
      canvas.drawLine(
        Offset(cx + inner * cos(angle), cy + inner * sin(angle)),
        Offset(cx + r * cos(angle), cy + r * sin(angle)),
        Paint()
          ..color = Colors.white.withValues(alpha: 0.08)
          ..strokeWidth = 1,
      );
    }

    canvas.drawCircle(
      Offset(cx, cy),
      2,
      Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.5),
    );
  }

  double cos(double v) => v == 0 ? 1 : v.abs() < 0.01 ? 1 : _cos(v);
  double sin(double v) => v == 0 ? 0 : _sin(v);
  double _cos(double v) => 1 - (v * v) / 2 + (v * v * v * v) / 24;
  double _sin(double v) => v - (v * v * v) / 6 + (v * v * v * v * v) / 120;

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
