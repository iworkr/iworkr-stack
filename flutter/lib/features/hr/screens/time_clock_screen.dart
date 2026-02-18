import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:intl/intl.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/timeclock_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';

class TimeClockScreen extends ConsumerStatefulWidget {
  const TimeClockScreen({super.key});

  @override
  ConsumerState<TimeClockScreen> createState() => _TimeClockScreenState();
}

class _TimeClockScreenState extends ConsumerState<TimeClockScreen>
    with TickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final AnimationController _ringController;
  Timer? _elapsedTimer;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _ringController.dispose();
    _elapsedTimer?.cancel();
    super.dispose();
  }

  void _startElapsedTimer(DateTime clockIn) {
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _elapsed = DateTime.now().difference(clockIn));
      }
    });
    _elapsed = DateTime.now().difference(clockIn);
  }

  String _formatDuration(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  Future<void> _handleClockAction(Map<String, dynamic>? active) async {
    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId == null) return;

    if (active == null) {
      HapticFeedback.heavyImpact();
      await clockIn(organizationId: orgId);
      _ringController.forward(from: 0);
    } else {
      final status = active['status'] as String? ?? 'active';
      if (status == 'active') {
        HapticFeedback.heavyImpact();
        final clockInTime = DateTime.parse(active['clock_in'] as String);
        final breakMins = active['break_duration_minutes'] as int? ?? 0;
        await clockOut(
          entryId: active['id'] as String,
          clockInTime: clockInTime,
          breakMinutes: breakMins,
        );
        _elapsedTimer?.cancel();
      } else if (status == 'break') {
        HapticFeedback.mediumImpact();
        final breakStart = DateTime.parse(active['break_start'] as String);
        final breakMins = DateTime.now().difference(breakStart).inMinutes +
            (active['break_duration_minutes'] as int? ?? 0);
        await endBreak(active['id'] as String, breakMins);
      }
    }
    ref.invalidate(activeTimeEntryProvider);
    ref.invalidate(recentTimeEntriesProvider);
    ref.invalidate(weeklyHoursProvider);
  }

  Future<void> _handleBreak(String entryId) async {
    HapticFeedback.mediumImpact();
    await startBreak(entryId);
    ref.invalidate(activeTimeEntryProvider);
  }

  @override
  Widget build(BuildContext context) {
    final activeAsync = ref.watch(activeTimeEntryProvider);
    final recentAsync = ref.watch(recentTimeEntriesProvider);
    final weeklyAsync = ref.watch(weeklyHoursProvider);

    final active = activeAsync.valueOrNull;
    final isClockedIn = active != null;
    final isOnBreak = active?['status'] == 'break';

    if (isClockedIn && _elapsedTimer == null) {
      final clockInTime = DateTime.parse(active['clock_in'] as String);
      _startElapsedTimer(clockInTime);
    }

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          children: [
            // Header
            Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: ObsidianTheme.hoverBg,
                      borderRadius: ObsidianTheme.radiusMd,
                    ),
                    child: const Icon(PhosphorIconsLight.arrowLeft, color: ObsidianTheme.textSecondary, size: 20),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'My Time',
                        style: GoogleFonts.inter(
                          fontSize: 20, fontWeight: FontWeight.w600,
                          color: ObsidianTheme.textPrimary, letterSpacing: -0.3,
                        ),
                      ),
                      Text(
                        DateFormat('EEEE, d MMMM').format(DateTime.now()),
                        style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.textTertiary),
                      ),
                    ],
                  ),
                ),
              ],
            )
                .animate()
                .fadeIn(duration: 300.ms, curve: ObsidianTheme.easeOutExpo),

            const SizedBox(height: 32),

            // Chronometer
            Center(
              child: _Chronometer(
                isClockedIn: isClockedIn,
                isOnBreak: isOnBreak,
                elapsed: _elapsed,
                formatDuration: _formatDuration,
                pulseController: _pulseController,
                onLongPress: () => _handleClockAction(active),
                onBreakTap: isClockedIn && !isOnBreak
                    ? () => _handleBreak(active['id'] as String)
                    : null,
              ),
            )
                .animate()
                .fadeIn(delay: 100.ms, duration: 600.ms, curve: Curves.easeOutBack)
                .scaleXY(begin: 0.9, end: 1, delay: 100.ms, duration: 600.ms, curve: Curves.easeOutBack),

            const SizedBox(height: 32),

            // Weekly summary
            weeklyAsync.when(
              data: (hours) => GlassCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: ObsidianTheme.emeraldDim,
                      ),
                      child: const Center(
                        child: Icon(PhosphorIconsLight.chartBar, size: 18, color: ObsidianTheme.emerald),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'This Week',
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${hours.toStringAsFixed(1)} hours logged',
                            style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${hours.toStringAsFixed(1)}h',
                      style: GoogleFonts.jetBrainsMono(fontSize: 18, fontWeight: FontWeight.w700, color: ObsidianTheme.emerald),
                    ),
                  ],
                ),
              )
                  .animate()
                  .fadeIn(delay: 300.ms, duration: 500.ms)
                  .moveY(begin: 10, end: 0, delay: 300.ms, duration: 500.ms),
              loading: () => const SizedBox(height: 72),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 28),

            // Recent history
            Text(
              'RECENT SHIFTS',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
            ).animate().fadeIn(delay: 400.ms, duration: 300.ms),
            const SizedBox(height: 10),

            recentAsync.when(
              data: (entries) {
                final completed = entries.where((e) => e['status'] == 'completed').toList();
                if (completed.isEmpty) {
                  return const AnimatedEmptyState(
                    type: EmptyStateType.calendar,
                    title: 'No Shifts Yet',
                    subtitle: 'Clock in to start tracking\nyour work hours.',
                  );
                }
                return Column(
                  children: completed.asMap().entries.map((e) {
                    final i = e.key;
                    final entry = e.value;
                    return _ShiftHistoryCard(entry: entry, index: i);
                  }).toList(),
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
              ),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Chronometer Widget ─────────────────────────────────

class _Chronometer extends StatelessWidget {
  final bool isClockedIn;
  final bool isOnBreak;
  final Duration elapsed;
  final String Function(Duration) formatDuration;
  final AnimationController pulseController;
  final VoidCallback onLongPress;
  final VoidCallback? onBreakTap;

  const _Chronometer({
    required this.isClockedIn,
    required this.isOnBreak,
    required this.elapsed,
    required this.formatDuration,
    required this.pulseController,
    required this.onLongPress,
    this.onBreakTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color ringColor = isOnBreak
        ? ObsidianTheme.amber
        : isClockedIn
            ? ObsidianTheme.emerald
            : ObsidianTheme.textTertiary;

    final String stateLabel = isOnBreak
        ? 'ON BREAK'
        : isClockedIn
            ? 'CLOCKED IN'
            : 'READY';

    final String actionLabel = isOnBreak
        ? 'Long press to resume'
        : isClockedIn
            ? 'Long press to clock out'
            : 'Long press to clock in';

    return Column(
      children: [
        GestureDetector(
          onLongPress: onLongPress,
          child: SizedBox(
            width: 220,
            height: 220,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Outer glow ring (animated)
                if (isClockedIn)
                  AnimatedBuilder(
                    animation: pulseController,
                    builder: (_, __) {
                      final scale = 1.0 + pulseController.value * 0.08;
                      return Transform.scale(
                        scale: scale,
                        child: Container(
                          width: 200, height: 200,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: ringColor.withValues(alpha: 0.15 - pulseController.value * 0.1),
                              width: 2,
                            ),
                          ),
                        ),
                      );
                    },
                  ),

                // Static ring
                Container(
                  width: 190, height: 190,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: ringColor.withValues(alpha: 0.2), width: 1),
                  ),
                ),

                // Progress arc
                SizedBox(
                  width: 180, height: 180,
                  child: CustomPaint(
                    painter: _ChronoRingPainter(
                      color: ringColor,
                      progress: isClockedIn
                          ? (elapsed.inMinutes % 60) / 60.0
                          : 0,
                    ),
                  ),
                ),

                // Center content
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Status label
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusFull,
                        color: ringColor.withValues(alpha: 0.1),
                      ),
                      child: Text(
                        stateLabel,
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 9, fontWeight: FontWeight.w600,
                          color: ringColor, letterSpacing: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Clock display
                    Text(
                      isClockedIn ? formatDuration(elapsed) : '00:00:00',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 32, fontWeight: FontWeight.w700,
                        color: isClockedIn ? ObsidianTheme.textPrimary : ObsidianTheme.textDisabled,
                        letterSpacing: 2,
                      ),
                    ),

                    const SizedBox(height: 4),

                    // Icon
                    Icon(
                      isClockedIn
                          ? (isOnBreak ? PhosphorIconsLight.pause : PhosphorIconsLight.clock)
                          : PhosphorIconsLight.play,
                      size: 20,
                      color: ringColor.withValues(alpha: 0.6),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Action hint
        Text(
          actionLabel,
          style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary),
        ),

        // Break button (only when clocked in + not on break)
        if (onBreakTap != null) ...[
          const SizedBox(height: 16),
          GestureDetector(
            onTap: onBreakTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.2)),
                color: ObsidianTheme.amberDim,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(PhosphorIconsLight.coffee, size: 16, color: ObsidianTheme.amber),
                  const SizedBox(width: 8),
                  Text(
                    'Take Break',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.amber),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ── Chrono Ring Painter ──────────────────────────────

class _ChronoRingPainter extends CustomPainter {
  final Color color;
  final double progress;

  _ChronoRingPainter({required this.color, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;

    // Track
    final trackPaint = Paint()
      ..color = color.withValues(alpha: 0.06)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, trackPaint);

    // Progress
    if (progress > 0) {
      final progressPaint = Paint()
        ..color = color
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -pi / 2,
        2 * pi * progress,
        false,
        progressPaint,
      );

      // Glow at tip
      final angle = -pi / 2 + 2 * pi * progress;
      final tipX = center.dx + radius * cos(angle);
      final tipY = center.dy + radius * sin(angle);
      final glowPaint = Paint()
        ..color = color.withValues(alpha: 0.4)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
      canvas.drawCircle(Offset(tipX, tipY), 4, glowPaint);
    }

    // Tick marks (every 5 minutes = 12 ticks)
    for (int i = 0; i < 12; i++) {
      final angle = -pi / 2 + (i / 12) * 2 * pi;
      final outer = center + Offset(radius * cos(angle), radius * sin(angle));
      final inner = center + Offset((radius - 6) * cos(angle), (radius - 6) * sin(angle));
      final tickPaint = Paint()
        ..color = i == 0 ? color.withValues(alpha: 0.5) : color.withValues(alpha: 0.12)
        ..strokeWidth = i == 0 ? 2 : 1
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(inner, outer, tickPaint);
    }
  }

  @override
  bool shouldRepaint(_ChronoRingPainter old) =>
      old.progress != progress || old.color != color;
}

// ── Shift History Card ──────────────────────────────

class _ShiftHistoryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final int index;

  const _ShiftHistoryCard({required this.entry, required this.index});

  @override
  Widget build(BuildContext context) {
    final clockIn = DateTime.tryParse(entry['clock_in']?.toString() ?? '');
    final clockOutTime = DateTime.tryParse(entry['clock_out']?.toString() ?? '');
    final totalMinutes = entry['total_minutes'] as int? ?? 0;
    final breakMinutes = entry['break_duration_minutes'] as int? ?? 0;
    final geoWarning = entry['geo_warning'] as bool? ?? false;
    final hours = totalMinutes / 60;
    final timeFormat = DateFormat('HH:mm');

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: ObsidianTheme.surface1,
        border: Border.all(
          color: geoWarning
              ? ObsidianTheme.amber.withValues(alpha: 0.15)
              : ObsidianTheme.border,
        ),
      ),
      child: Row(
        children: [
          // Date column
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusMd,
              color: ObsidianTheme.hoverBg,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  clockIn != null ? DateFormat('d').format(clockIn) : '--',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 16, fontWeight: FontWeight.w700,
                    color: ObsidianTheme.textPrimary,
                  ),
                ),
                Text(
                  clockIn != null ? DateFormat('EEE').format(clockIn).toUpperCase() : '',
                  style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  clockIn != null && clockOutTime != null
                      ? '${timeFormat.format(clockIn.toLocal())} — ${timeFormat.format(clockOutTime.toLocal())}'
                      : 'Shift',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      '${hours.toStringAsFixed(1)}h worked',
                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                    ),
                    if (breakMinutes > 0) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          color: ObsidianTheme.amberDim,
                        ),
                        child: Text(
                          '${breakMinutes}m break',
                          style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.amber),
                        ),
                      ),
                    ],
                    if (geoWarning) ...[
                      const SizedBox(width: 8),
                      Icon(PhosphorIconsLight.mapPinLine, size: 12, color: ObsidianTheme.amber),
                    ],
                  ],
                ),
              ],
            ),
          ),

          Text(
            '${hours.toStringAsFixed(1)}h',
            style: GoogleFonts.jetBrainsMono(
              fontSize: 14, fontWeight: FontWeight.w600,
              color: ObsidianTheme.emerald,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 450 + index * 40), duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 450 + index * 40), duration: 500.ms);
  }
}
