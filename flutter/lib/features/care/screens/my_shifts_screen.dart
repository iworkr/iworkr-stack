import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

// ═══════════════════════════════════════════════════════════
// ── My Shifts — Support Worker Roster View ───────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// Week calendar + agenda view showing the worker's upcoming
// and past shifts with status indicators and action buttons.

class MyShiftsScreen extends ConsumerStatefulWidget {
  const MyShiftsScreen({super.key});

  @override
  ConsumerState<MyShiftsScreen> createState() => _MyShiftsScreenState();
}

class _MyShiftsScreenState extends ConsumerState<MyShiftsScreen> {
  late ScrollController _weekScrollController;
  // We show 8 weeks total: 2 past + 6 future
  static const _totalWeeks = 8;
  static const _pastWeeks = 2;

  @override
  void initState() {
    super.initState();
    _weekScrollController = ScrollController(
      initialScrollOffset: _pastWeeks * 7 * 48.0, // Each day cell is 48 wide
    );
  }

  @override
  void dispose() {
    _weekScrollController.dispose();
    super.dispose();
  }

  DateTime get _weekStart {
    final now = DateTime.now();
    final monday = now.subtract(Duration(days: now.weekday - 1));
    return DateTime(monday.year, monday.month, monday.day)
        .subtract(Duration(days: _pastWeeks * 7));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final selectedDate = ref.watch(rosterSelectedDateProvider);
    final shiftsForDay = ref.watch(shiftsForDateProvider(selectedDate));
    final allShiftsAsync = ref.watch(myCareShiftsProvider);

    // Build a set of dates that have shifts for dot indicators
    final datesWithShifts = <String>{};
    allShiftsAsync.whenData((shifts) {
      for (final s in shifts) {
        final d = s.scheduledStart;
        datesWithShifts.add('${d.year}-${d.month}-${d.day}');
      }
    });

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: false,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            automaticallyImplyLeading: false,
            title: Row(
              children: [
                Text(
                  DateFormat('MMMM yyyy').format(selectedDate),
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(rosterSelectedDateProvider.notifier).state =
                        DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Today',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: ObsidianTheme.careBlue,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Week Calendar Strip ────────────────────────
          SliverToBoxAdapter(
            child: Container(
              height: 80,
              margin: const EdgeInsets.fromLTRB(0, 4, 0, 8),
              child: ListView.builder(
                controller: _weekScrollController,
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _totalWeeks * 7,
                itemBuilder: (context, index) {
                  final date = _weekStart.add(Duration(days: index));
                  final isSelected = date.year == selectedDate.year &&
                      date.month == selectedDate.month &&
                      date.day == selectedDate.day;
                  final isToday = date.year == DateTime.now().year &&
                      date.month == DateTime.now().month &&
                      date.day == DateTime.now().day;
                  final hasShifts = datesWithShifts.contains('${date.year}-${date.month}-${date.day}');

                  return _DayCell(
                    date: date,
                    isSelected: isSelected,
                    isToday: isToday,
                    hasShifts: hasShifts,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      ref.read(rosterSelectedDateProvider.notifier).state = date;
                    },
                  );
                },
              ),
            ),
          ),

          // ── Day Header ─────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  Text(
                    DateFormat('EEEE, d MMMM').format(selectedDate),
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: c.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (shiftsForDay.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${shiftsForDay.length} shift${shiftsForDay.length != 1 ? 's' : ''}',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: ObsidianTheme.careBlue,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // ── Shift Cards or Empty State ─────────────────
          if (shiftsForDay.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: c.border),
                      ),
                      child: Icon(PhosphorIconsLight.calendarBlank, size: 28, color: c.textDisabled),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No shifts scheduled',
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'You have no shifts on this day.',
                      style: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                    ),
                  ],
                ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList.separated(
                itemCount: shiftsForDay.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final shift = shiftsForDay[index];
                  return _ShiftCard(
                    shift: shift,
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      context.push('/care/shift/${shift.id}');
                    },
                    onAccept: shift.requiresAcceptance && shift.acceptanceStatus == 'pending'
                        ? () async {
                            HapticFeedback.heavyImpact();
                            await acceptShift(shift.id);
                          }
                        : null,
                    onDecline: shift.requiresAcceptance && shift.acceptanceStatus == 'pending'
                        ? () {
                            HapticFeedback.mediumImpact();
                            _showDeclineSheet(context, shift);
                          }
                        : null,
                  ).animate().fadeIn(delay: (index * 40).ms, duration: 300.ms).moveY(begin: 12, end: 0);
                },
              ),
            ),
        ],
      ),
    );
  }

  void _showDeclineSheet(BuildContext context, CareShift shift) {
    final reasons = ['Sick Leave', 'Personal Emergency', 'Clash with other shift', 'Transport unavailable', 'Other'];
    final c = context.iColors;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        decoration: BoxDecoration(
          color: c.canvas,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border.all(color: c.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: c.borderMedium, borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            Text('Decline Shift', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
            const SizedBox(height: 4),
            Text('Select a reason for declining this shift:', style: GoogleFonts.inter(fontSize: 14, color: c.textTertiary)),
            const SizedBox(height: 16),
            ...reasons.map((reason) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () async {
                  HapticFeedback.mediumImpact();
                  Navigator.pop(context);
                  await declineShift(shift.id, reason);
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: c.border),
                  ),
                  child: Text(reason, style: GoogleFonts.inter(fontSize: 15, color: c.textPrimary)),
                ),
              ),
            )),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Day Cell (Week Calendar Strip) ───────────────────────
// ═══════════════════════════════════════════════════════════

class _DayCell extends StatelessWidget {
  final DateTime date;
  final bool isSelected;
  final bool isToday;
  final bool hasShifts;
  final VoidCallback onTap;

  const _DayCell({
    required this.date,
    required this.isSelected,
    required this.isToday,
    required this.hasShifts,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final dayName = DateFormat('E').format(date).substring(0, 2).toUpperCase();
    final dayNum = date.day.toString();

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 48,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: isSelected
              ? ObsidianTheme.careBlue.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: isToday && !isSelected
              ? Border.all(color: ObsidianTheme.careBlue.withValues(alpha: 0.4))
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              dayName,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isSelected ? ObsidianTheme.careBlue : c.textTertiary,
              ),
            ),
            const SizedBox(height: 4),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? ObsidianTheme.careBlue : Colors.transparent,
              ),
              child: Center(
                child: Text(
                  dayNum,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: isSelected || isToday ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected
                        ? Colors.white
                        : isToday
                            ? ObsidianTheme.careBlue
                            : c.textPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: hasShifts ? 4 : 0,
              height: hasShifts ? 4 : 0,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? Colors.white : ObsidianTheme.careBlue,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Shift Card ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ShiftCard extends StatelessWidget {
  final CareShift shift;
  final VoidCallback onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

  const _ShiftCard({
    required this.shift,
    required this.onTap,
    this.onAccept,
    this.onDecline,
  });

  Color _statusColor() {
    switch (shift.status) {
      case CareShiftStatus.published:
        return ObsidianTheme.careBlue;
      case CareShiftStatus.inProgress:
        return ObsidianTheme.emerald;
      case CareShiftStatus.completed:
        return ObsidianTheme.emerald;
      case CareShiftStatus.cancelled:
      case CareShiftStatus.cancelledBillable:
        return ObsidianTheme.textTertiary;
      case CareShiftStatus.actionRequired:
        return ObsidianTheme.amber;
      case CareShiftStatus.unassignedCritical:
        return ObsidianTheme.rose;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final color = _statusColor();
    final isCancelled = shift.status == CareShiftStatus.cancelled ||
        shift.status == CareShiftStatus.cancelledBillable;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: shift.status == CareShiftStatus.inProgress
                ? ObsidianTheme.emerald.withValues(alpha: 0.5)
                : isCancelled
                    ? c.borderMedium
                    : color.withValues(alpha: 0.3),
            width: shift.status == CareShiftStatus.inProgress ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time block + Status
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${DateFormat('h:mm a').format(shift.scheduledStart)} – ${DateFormat('h:mm a').format(shift.scheduledEnd)}  (${shift.formattedDuration})',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isCancelled ? c.textDisabled : c.textPrimary,
                      decoration: isCancelled ? TextDecoration.lineThrough : null,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    shift.status.label,
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: color),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Participant row
            Row(
              children: [
                // Avatar
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      shift.participantInitials,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: ObsidianTheme.careBlue,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        shift.participantName ?? 'Unknown Participant',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: c.textPrimary,
                        ),
                      ),
                      if (shift.serviceType != null)
                        Text(
                          shift.serviceType!,
                          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
              ],
            ),

            // Location
            if (shift.location != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(PhosphorIconsLight.mapPin, size: 14, color: c.textTertiary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      shift.location!,
                      style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],

            // Critical alerts
            if (shift.criticalAlerts.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: shift.criticalAlerts.map((alert) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.rose.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.warning, size: 12, color: ObsidianTheme.rose),
                      const SizedBox(width: 4),
                      Text(alert, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: ObsidianTheme.rose)),
                    ],
                  ),
                )).toList(),
              ),
            ],

            // Accept / Decline buttons
            if (onAccept != null || onDecline != null) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  if (onAccept != null)
                    Expanded(
                      child: GestureDetector(
                        onTap: onAccept,
                        child: Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: ObsidianTheme.careBlue,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text('Accept', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                          ),
                        ),
                      ),
                    ),
                  if (onAccept != null && onDecline != null)
                    const SizedBox(width: 8),
                  if (onDecline != null)
                    Expanded(
                      child: GestureDetector(
                        onTap: onDecline,
                        child: Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: c.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.3)),
                          ),
                          child: Center(
                            child: Text('Decline', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: ObsidianTheme.rose)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
