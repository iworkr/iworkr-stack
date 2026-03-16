import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/models/care_shift.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// The "CLOCKED IN" Operations Workspace — Project Monolith-Execution
///
/// A distraction-free clinical sandbox that replaces the entire
/// navigation stack while a worker is on the clock. Features:
/// - Emerald pulse timer
/// - Participant context header (with SIL carousel)
/// - Scoped care tool grid
/// - Live task checklist
/// - Clock-out gauntlet
class ActiveWorkspaceScreen extends ConsumerStatefulWidget {
  const ActiveWorkspaceScreen({super.key});

  @override
  ConsumerState<ActiveWorkspaceScreen> createState() =>
      _ActiveWorkspaceScreenState();
}

class _ActiveWorkspaceScreenState extends ConsumerState<ActiveWorkspaceScreen>
    with SingleTickerProviderStateMixin {
  Timer? _timerTick;
  Duration _elapsed = Duration.zero;
  late final AnimationController _pulseCtrl;
  final PageController _silPageCtrl = PageController();

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _startTimer();
  }

  void _startTimer() {
    final state = ref.read(activeShiftStateProvider);
    if (state.clockInTime != null) {
      _elapsed = DateTime.now().difference(state.clockInTime!);
    }
    _timerTick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _elapsed += const Duration(seconds: 1));
    });
  }

  @override
  void dispose() {
    _timerTick?.cancel();
    _pulseCtrl.dispose();
    _silPageCtrl.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final shiftState = ref.watch(activeShiftStateProvider);

    if (!shiftState.hasActiveShift) {
      // Redirect back to home if no active shift
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/');
      });
      return const SizedBox.shrink();
    }

    final shiftId = shiftState.shiftId!;
    final activeParticipantId = shiftState.participantId;
    final activeShift = ref.watch(activeShiftProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // ── Emerald Pulse Timer ──────────────────────────
            _buildTimer(c),

            // ── Participant Context Header ───────────────────
            _buildParticipantHeader(c, shiftState, activeShift),

            // ── Tool Grid + Tasks ────────────────────────────
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                children: [
                  // Care Tool Grid
                  _buildToolGrid(c, activeParticipantId, shiftId),

                  const SizedBox(height: 24),

                  // Task Checklist
                  _buildTaskChecklist(c, shiftId),
                ],
              ),
            ),

            // ── Clock Out Button ─────────────────────────────
            _buildClockOutBar(c, shiftState),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EMERALD PULSE TIMER
  // ═══════════════════════════════════════════════════════════
  Widget _buildTimer(IWorkrColors c) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        children: [
          // Status label
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedBuilder(
                animation: _pulseCtrl,
                builder: (ctx, _) => Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.emerald,
                    boxShadow: [
                      BoxShadow(
                        color: ObsidianTheme.emerald
                            .withValues(alpha: 0.3 + _pulseCtrl.value * 0.4),
                        blurRadius: 8 + _pulseCtrl.value * 8,
                        spreadRadius: _pulseCtrl.value * 2,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'CLOCKED IN',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: ObsidianTheme.emerald,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Timer display
          AnimatedBuilder(
            animation: _pulseCtrl,
            builder: (ctx, _) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: ObsidianTheme.emerald
                      .withValues(alpha: 0.1 + _pulseCtrl.value * 0.15),
                ),
                boxShadow: [
                  BoxShadow(
                    color: ObsidianTheme.emerald
                        .withValues(alpha: _pulseCtrl.value * 0.06),
                    blurRadius: 24,
                    spreadRadius: 0,
                  ),
                ],
              ),
              child: Text(
                _formatDuration(_elapsed),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 40,
                  fontWeight: FontWeight.w300,
                  color: ObsidianTheme.emerald,
                  letterSpacing: 4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PARTICIPANT CONTEXT HEADER (with SIL carousel)
  // ═══════════════════════════════════════════════════════════
  Widget _buildParticipantHeader(
      IWorkrColors c, ActiveShiftState state, CareShift? activeShift) {
    final isSil = state.isSilShift;

    if (isSil) {
      return _buildSilCarousel(c, state);
    }

    // Single participant header
    final participantId = state.participantId;
    final participantName = activeShift?.participantName ?? 'Participant';
    final shiftTitle = activeShift?.serviceType ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.borderMedium),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: ObsidianTheme.careBlue.withValues(alpha: 0.15),
            child: Text(
              participantName.isNotEmpty
                  ? participantName[0].toUpperCase()
                  : '?',
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: ObsidianTheme.careBlue,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Supporting: $participantName',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                  ),
                ),
                if (shiftTitle.isNotEmpty)
                  Text(
                    shiftTitle,
                    style: GoogleFonts.inter(
                        fontSize: 12, color: c.textMuted),
                  ),
              ],
            ),
          ),
          // Quick profile access
          if (participantId != null)
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                context.push('/participants/$participantId');
              },
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: ObsidianTheme.careBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(PhosphorIconsLight.identificationCard,
                    size: 18, color: ObsidianTheme.careBlue),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSilCarousel(IWorkrColors c, ActiveShiftState state) {
    final silAsync =
        ref.watch(silParticipantsProvider(state.shiftId!));

    return silAsync.when(
      loading: () => const SizedBox(height: 80),
      error: (_, __) => _buildSingleParticipantFallback(c, state),
      data: (participants) {
        if (participants.isEmpty) {
          return _buildSingleParticipantFallback(c, state);
        }

        return Column(
          children: [
            SizedBox(
              height: 80,
              child: PageView.builder(
                controller: _silPageCtrl,
                itemCount: participants.length,
                onPageChanged: (index) {
                  HapticFeedback.selectionClick();
                  final p = participants[index];
                  final newState = state.copyWith(
                    participantId: p.id,
                    silActiveIndex: index,
                  );
                  ref.read(activeShiftStateProvider.notifier).state =
                      newState;
                  persistWorkspaceState(newState);
                },
                itemBuilder: (ctx, index) {
                  final p = participants[index];
                  final isActive = index == state.silActiveIndex;
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isActive ? c.surface : c.canvas,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isActive
                            ? ObsidianTheme.careBlue.withValues(alpha: 0.4)
                            : c.border,
                      ),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor:
                              ObsidianTheme.careBlue.withValues(alpha: 0.15),
                          child: Text(
                            p.name.isNotEmpty ? p.name[0].toUpperCase() : '?',
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              color: ObsidianTheme.careBlue,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(p.name,
                                  style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: c.textPrimary)),
                              if (p.alerts.isNotEmpty)
                                Text(
                                  p.alerts.take(2).join(' · '),
                                  style: GoogleFonts.inter(
                                      fontSize: 10,
                                      color: ObsidianTheme.rose),
                                ),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: () => context.push('/participants/${p.id}'),
                          child: Icon(PhosphorIconsLight.caretRight,
                              size: 16, color: c.textTertiary),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            // Page indicator dots
            if (participants.length > 1) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  participants.length,
                  (i) => Container(
                    width: i == state.silActiveIndex ? 16 : 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(3),
                      color: i == state.silActiveIndex
                          ? ObsidianTheme.careBlue
                          : c.borderMedium,
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildSingleParticipantFallback(
      IWorkrColors c, ActiveShiftState state) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.borderMedium),
      ),
      child: Text('Active shift',
          style: GoogleFonts.inter(color: c.textSecondary)),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CARE TOOL GRID (strictly scoped)
  // ═══════════════════════════════════════════════════════════
  Widget _buildToolGrid(
      IWorkrColors c, String? participantId, String shiftId) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CARE TOOLS',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: c.textMuted,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ToolCard(
                icon: PhosphorIconsLight.pill,
                label: 'Medications',
                color: ObsidianTheme.careBlue,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  context.push(
                      '/care/medications?participant_id=$participantId&shift_id=$shiftId');
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ToolCard(
                icon: PhosphorIconsLight.heartbeat,
                label: 'Observations',
                color: ObsidianTheme.amber,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  context.push(
                      '/care/observations?participant_id=$participantId');
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ToolCard(
                icon: PhosphorIconsLight.identificationCard,
                label: 'Profile',
                color: ObsidianTheme.indigo,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  if (participantId != null) {
                    context.push('/participants/$participantId');
                  }
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ToolCard(
                icon: PhosphorIconsLight.notepad,
                label: 'Progress Note',
                color: ObsidianTheme.emerald,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  context.push('/care/progress-notes');
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ToolCard(
                icon: PhosphorIconsLight.warningOctagon,
                label: 'Log Incident',
                color: ObsidianTheme.rose,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  context.push('/care/incidents/new');
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ToolCard(
                icon: PhosphorIconsLight.chatCircle,
                label: 'Handover',
                color: ObsidianTheme.textMuted,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  if (participantId != null) {
                    context.push('/participants/$participantId');
                  }
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TASK CHECKLIST
  // ═══════════════════════════════════════════════════════════
  Widget _buildTaskChecklist(IWorkrColors c, String shiftId) {
    final tasksAsync = ref.watch(shiftTasksProvider(shiftId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SHIFT TASKS',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: c.textMuted,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 10),
        tasksAsync.when(
          loading: () =>
              const Center(child: CircularProgressIndicator(strokeWidth: 2)),
          error: (e, _) => Text('Unable to load tasks: $e',
              style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12)),
          data: (tasks) {
            if (tasks.isEmpty) {
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.border),
                ),
                child: Row(
                  children: [
                    Icon(PhosphorIconsLight.checkCircle,
                        size: 20, color: ObsidianTheme.emerald),
                    const SizedBox(width: 10),
                    Text('No scheduled tasks for this shift',
                        style: GoogleFonts.inter(
                            fontSize: 13, color: c.textSecondary)),
                  ],
                ),
              );
            }

            return Column(
              children: tasks
                  .map((t) => _TaskItem(
                        task: t,
                        onToggle: () async {
                          HapticFeedback.lightImpact();
                          if (t.isCompleted) {
                            await uncompleteShiftTask(t.id);
                          } else {
                            await completeShiftTask(t.id);
                          }
                          ref.invalidate(shiftTasksProvider(shiftId));
                        },
                      ))
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CLOCK OUT BAR
  // ═══════════════════════════════════════════════════════════
  Widget _buildClockOutBar(IWorkrColors c, ActiveShiftState state) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton.icon(
          onPressed: () => _initiateClockOut(state),
          style: ElevatedButton.styleFrom(
            backgroundColor: ObsidianTheme.rose.withValues(alpha: 0.15),
            foregroundColor: ObsidianTheme.rose,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                  color: ObsidianTheme.rose.withValues(alpha: 0.3)),
            ),
            elevation: 0,
          ),
          icon: const Icon(PhosphorIconsBold.clockCountdown, size: 18),
          label: Text(
            'Clock Out & Debrief',
            style: GoogleFonts.inter(
                fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }

  Future<void> _initiateClockOut(ActiveShiftState state) async {
    final shiftId = state.shiftId;
    if (shiftId == null) return;

    // Gate 1: Check for incomplete mandatory tasks
    final tasksAsync = ref.read(shiftTasksProvider(shiftId));
    final tasks = tasksAsync.valueOrNull ?? [];
    final incompleteMandatory =
        tasks.where((t) => t.isMandatory && !t.isCompleted).toList();

    if (incompleteMandatory.isNotEmpty) {
      if (!mounted) return;
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: context.iColors.surface,
          title: Row(
            children: [
              Icon(PhosphorIconsFill.warning,
                  color: ObsidianTheme.amber, size: 22),
              const SizedBox(width: 8),
              Text('Mandatory Tasks Incomplete',
                  style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: context.iColors.textPrimary)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'The following mandatory tasks must be completed before you can clock out:',
                style: GoogleFonts.inter(
                    fontSize: 13, color: context.iColors.textSecondary),
              ),
              const SizedBox(height: 12),
              ...incompleteMandatory.map((t) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Icon(PhosphorIconsLight.xCircle,
                            size: 16, color: ObsidianTheme.rose),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(t.title,
                              style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: context.iColors.textPrimary)),
                        ),
                      ],
                    ),
                  )),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Go Back',
                  style: GoogleFonts.inter(color: ObsidianTheme.emerald)),
            ),
          ],
        ),
      );
      return;
    }

    // Gate 2: Navigate to debrief screen
    if (!mounted) return;
    HapticFeedback.heavyImpact();

    // Clear persisted state — shift is ending
    await clearWorkspaceState();

    // Reset active shift state
    ref.read(activeShiftStateProvider.notifier).state =
        const ActiveShiftState();
    ref.read(activeShiftProvider.notifier).state = null;
    ref.read(activeShiftTimeEntryIdProvider.notifier).state = null;

    if (!mounted) return;
    context.go('/care/shift/$shiftId/debrief');
  }
}

// ═══════════════════════════════════════════════════════════════════
// SHARED WIDGETS
// ═══════════════════════════════════════════════════════════════════

class _ToolCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ToolCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 22, color: color),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: c.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskItem extends StatelessWidget {
  final ShiftTask task;
  final VoidCallback onToggle;

  const _TaskItem({required this.task, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: GestureDetector(
        onTap: onToggle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: task.isMandatory && !task.isCompleted
                  ? ObsidianTheme.amber.withValues(alpha: 0.3)
                  : c.border,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: task.isCompleted
                      ? ObsidianTheme.emerald
                      : Colors.transparent,
                  border: Border.all(
                    color: task.isCompleted
                        ? ObsidianTheme.emerald
                        : c.borderMedium,
                    width: 2,
                  ),
                ),
                child: task.isCompleted
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: task.isCompleted
                            ? c.textMuted
                            : c.textPrimary,
                        decoration: task.isCompleted
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                    ),
                    if (task.description != null) ...[
                      const SizedBox(height: 2),
                      Text(task.description!,
                          style: GoogleFonts.inter(
                              fontSize: 11, color: c.textTertiary)),
                    ],
                  ],
                ),
              ),
              if (task.isMandatory && !task.isCompleted)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.amberDim,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text('REQUIRED',
                      style: GoogleFonts.jetBrainsMono(
                          fontSize: 8,
                          fontWeight: FontWeight.w700,
                          color: ObsidianTheme.amber)),
                ),
              if (task.isCompleted && task.completedAt != null)
                Text(
                  DateFormat.Hm().format(task.completedAt!),
                  style: GoogleFonts.jetBrainsMono(
                      fontSize: 10, color: c.textTertiary),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
