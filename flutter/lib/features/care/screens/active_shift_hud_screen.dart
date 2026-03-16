import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/slide_to_act.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

class ActiveShiftHudScreen extends ConsumerStatefulWidget {
  final String shiftId;
  const ActiveShiftHudScreen({super.key, required this.shiftId});

  @override
  ConsumerState<ActiveShiftHudScreen> createState() => _ActiveShiftHudScreenState();
}

class _ActiveShiftHudScreenState extends ConsumerState<ActiveShiftHudScreen> {
  Timer? _timer;
  Duration _elapsed = Duration.zero;
  bool _onBreak = false;
  Duration _breakDuration = Duration.zero;
  bool _shiftReportCompleted = false;
  bool _clockingOut = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_onBreak) {
        setState(() => _elapsed += const Duration(seconds: 1));
      } else {
        setState(() => _breakDuration += const Duration(seconds: 1));
      }
    });
  }

  CareShift? get _shift {
    final shifts = ref.watch(myCareShiftsProvider).valueOrNull ?? [];
    try {
      return shifts.firstWhere((s) => s.id == widget.shiftId);
    } catch (_) {
      return ref.read(activeShiftProvider);
    }
  }

  String _formatDuration(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  Future<void> _handleClockOut() async {
    if (!_shiftReportCompleted) {
      // Must complete shift report first
      HapticFeedback.mediumImpact();
      final result = await context.push<bool>('/care/shift/${widget.shiftId}/report');
      if (result == true) {
        setState(() => _shiftReportCompleted = true);
        // Now proceed with clock-out
        await _performClockOut();
      }
      return;
    }
    await _performClockOut();
  }

  Future<void> _performClockOut() async {
    setState(() => _clockingOut = true);
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      final resolvedTimeEntryId = await _resolveActiveTimeEntryId();
      if (resolvedTimeEntryId == null) {
        throw Exception('No active time entry found for this shift. Please refresh and try again.');
      }
      await clockOutOfShift(
        shiftId: widget.shiftId,
        timeEntryId: resolvedTimeEntryId,
        clockInTime: DateTime.now().subtract(_elapsed),
        lat: position.latitude,
        lng: position.longitude,
        breakMinutes: _breakDuration.inMinutes,
      );

      ref.read(activeShiftProvider.notifier).state = null;
      ref.read(activeShiftTimeEntryIdProvider.notifier).state = null;

      if (mounted) {
        HapticFeedback.heavyImpact();
        context.go('/jobs');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Clock-out failed: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
        setState(() => _clockingOut = false);
      }
    }
  }

  Future<String?> _resolveActiveTimeEntryId() async {
    final fromState = ref.read(activeShiftTimeEntryIdProvider);
    if (fromState != null && fromState.isNotEmpty) {
      return fromState;
    }

    final userId = SupabaseService.auth.currentUser?.id;
    final rows = await SupabaseService.client
        .from('time_entries')
        .select('id')
        .eq('shift_id', widget.shiftId)
        .eq('worker_id', userId ?? '')
        .inFilter('status', ['active', 'break'])
        .order('clock_in', ascending: false)
        .limit(1);
    if (rows.isNotEmpty) {
      final id = rows.first['id'] as String?;
      if (id != null && id.isNotEmpty) {
        ref.read(activeShiftTimeEntryIdProvider.notifier).state = id;
        return id;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final shift = _shift;

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // ── Chronometer Ring ─────────────────────────
            const SizedBox(height: 24),
            _ChronoRing(
              elapsed: _elapsed,
              breakDuration: _breakDuration,
              isOnBreak: _onBreak,
              formattedTime: _formatDuration(_elapsed),
            ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.9, 0.9), end: const Offset(1, 1)),
            const SizedBox(height: 16),

            // ── Participant Info ─────────────────────────
            Text(
              shift?.participantName ?? 'Active Shift',
              style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary),
            ),
            if (shift?.serviceType != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(shift!.serviceType!, style: GoogleFonts.inter(fontSize: 14, color: c.textTertiary)),
              ),

            // ── Break Toggle ─────────────────────────────
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                HapticFeedback.mediumImpact();
                setState(() => _onBreak = !_onBreak);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: _onBreak
                      ? ObsidianTheme.amber.withValues(alpha: 0.12)
                      : c.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _onBreak ? ObsidianTheme.amber.withValues(alpha: 0.4) : c.border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _onBreak ? PhosphorIconsLight.play : PhosphorIconsLight.pause,
                      size: 18,
                      color: _onBreak ? ObsidianTheme.amber : c.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _onBreak ? 'End Break (${_formatDuration(_breakDuration)})' : 'Start Break',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _onBreak ? ObsidianTheme.amber : c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 32),

            // ── Care Action Grid ─────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.2,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _ActionCard(
                      icon: PhosphorIconsLight.pill,
                      label: 'Medications',
                      subtitle: 'eMAR',
                      color: ObsidianTheme.careBlue,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/medications');
                      },
                    ).animate().fadeIn(delay: 100.ms, duration: 300.ms).moveY(begin: 12, end: 0),
                    _ActionCard(
                      icon: PhosphorIconsLight.heartbeat,
                      label: 'Observations',
                      subtitle: 'Vitals & Health',
                      color: ObsidianTheme.blue,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        final participantId = shift?.participantId;
                        if (participantId != null && participantId.isNotEmpty) {
                          context.push('/care/observations/record?participant_id=$participantId');
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Participant context unavailable for this shift.',
                                style: GoogleFonts.inter(color: Colors.white),
                              ),
                              backgroundColor: ObsidianTheme.rose,
                            ),
                          );
                        }
                      },
                    ).animate().fadeIn(delay: 150.ms, duration: 300.ms).moveY(begin: 12, end: 0),
                    _ActionCard(
                      icon: PhosphorIconsLight.warningCircle,
                      label: 'Log Incident',
                      subtitle: 'Safety Report',
                      color: ObsidianTheme.rose,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/incidents/new');
                      },
                    ).animate().fadeIn(delay: 200.ms, duration: 300.ms).moveY(begin: 12, end: 0),
                    _ActionCard(
                      icon: PhosphorIconsLight.notepad,
                      label: 'Shift Report',
                      subtitle: _shiftReportCompleted ? 'Completed ✓' : 'Required',
                      color: _shiftReportCompleted ? ObsidianTheme.emerald : ObsidianTheme.indigo,
                      onTap: () async {
                        HapticFeedback.lightImpact();
                        final result = await context.push<bool>('/care/shift/${widget.shiftId}/report');
                        if (result == true) {
                          setState(() => _shiftReportCompleted = true);
                        }
                      },
                    ).animate().fadeIn(delay: 250.ms, duration: 300.ms).moveY(begin: 12, end: 0),
                  ],
                ),
              ),
            ),

            // ── Slide to End Shift ───────────────────────
            Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).viewPadding.bottom + 16),
              child: SlideToAct(
                label: _clockingOut ? 'PROCESSING...' : 'SLIDE TO END SHIFT',
                color: ObsidianTheme.rose,
                icon: PhosphorIconsLight.signOut,
                enabled: !_clockingOut,
                onSlideComplete: _handleClockOut,
              ),
            ).animate().fadeIn(delay: 400.ms, duration: 400.ms).moveY(begin: 20, end: 0),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Chronometer Ring ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ChronoRing extends StatelessWidget {
  final Duration elapsed;
  final Duration breakDuration;
  final bool isOnBreak;
  final String formattedTime;

  const _ChronoRing({
    required this.elapsed,
    required this.breakDuration,
    required this.isOnBreak,
    required this.formattedTime,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final color = isOnBreak ? ObsidianTheme.amber : ObsidianTheme.careBlue;
    // Progress based on 8-hour shift
    final progress = (elapsed.inSeconds / (8 * 3600)).clamp(0.0, 1.0);

    return SizedBox(
      width: 180,
      height: 180,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background ring
          SizedBox(
            width: 160,
            height: 160,
            child: CircularProgressIndicator(
              value: 1.0,
              strokeWidth: 6,
              color: c.border,
              strokeCap: StrokeCap.round,
            ),
          ),
          // Progress ring
          SizedBox(
            width: 160,
            height: 160,
            child: CircularProgressIndicator(
              value: progress,
              strokeWidth: 6,
              color: color,
              strokeCap: StrokeCap.round,
            ),
          ),
          // Time display
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                formattedTime,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: c.textPrimary,
                  letterSpacing: -1,
                ),
              ),
              if (isOnBreak)
                Text(
                  'ON BREAK',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: ObsidianTheme.amber,
                    letterSpacing: 1,
                  ),
                )
              else
                Text(
                  'ELAPSED',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: c.textTertiary,
                    letterSpacing: 1,
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
// ── Action Card (Care Action Grid) ───────────────────────
// ═══════════════════════════════════════════════════════════

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 24, color: color),
            ),
            const Spacer(),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
            ),
            Text(
              subtitle,
              style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
            ),
          ],
        ),
      ),
    );
  }
}
