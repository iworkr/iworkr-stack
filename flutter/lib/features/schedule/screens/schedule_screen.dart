import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/services/schedule_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/models/job.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

const double _hourHeight = 80.0;
const double _gutterWidth = 52.0;
const int _dayStartHour = 6;
const int _dayEndHour = 20;
const int _totalHours = _dayEndHour - _dayStartHour;
const double _quarterHeight = _hourHeight / 4;

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});

  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  late ScrollController _scrollController;
  Timer? _laserTimer;
  double _laserOffset = 0;
  bool _showTodayButton = false;

  // Drag state
  bool _isDragging = false;
  double? _dragY;
  Job? _dragJob;
  String? _incomingJobId;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_checkTodayButton);
    _updateLaser();
    _laserTimer = Timer.periodic(const Duration(seconds: 30), (_) => _updateLaser());
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToNow(animate: false));
  }

  @override
  void dispose() {
    _laserTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  void _updateLaser() {
    final now = DateTime.now();
    final minutesSinceStart = (now.hour - _dayStartHour) * 60 + now.minute;
    if (mounted) {
      setState(() => _laserOffset = (minutesSinceStart / 60.0) * _hourHeight);
    }
  }

  void _checkTodayButton() {
    if (!_scrollController.hasClients) return;
    final selected = ref.read(selectedDateProvider);
    final now = DateTime.now();
    final isToday = selected.year == now.year && selected.month == now.month && selected.day == now.day;
    if (!isToday) {
      if (_showTodayButton) setState(() => _showTodayButton = false);
      return;
    }
    final diff = (_scrollController.offset - (_laserOffset - 200)).abs();
    final shouldShow = diff > 150;
    if (shouldShow != _showTodayButton) setState(() => _showTodayButton = shouldShow);
  }

  void _scrollToNow({bool animate = true}) {
    if (!_scrollController.hasClients) return;
    final target = (_laserOffset - 200).clamp(0.0, _scrollController.position.maxScrollExtent);
    if (animate) {
      HapticFeedback.selectionClick();
      _scrollController.animateTo(target, duration: const Duration(milliseconds: 400), curve: Curves.easeOutQuart);
    } else {
      _scrollController.jumpTo(target);
    }
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  /// Convert a Y position on the timeline to a snapped DateTime.
  DateTime _yToSnappedTime(double y) {
    final totalMinutes = (y / _hourHeight * 60).round();
    final snapped = ((totalMinutes + 7) ~/ 15) * 15;
    final hour = _dayStartHour + snapped ~/ 60;
    final minute = snapped % 60;
    final date = ref.read(selectedDateProvider);
    return DateTime(date.year, date.month, date.day, hour.clamp(_dayStartHour, _dayEndHour - 1), minute.clamp(0, 45));
  }

  Future<void> _handleDrop(Job job, double y) async {
    final snappedTime = _yToSnappedTime(y);
    final techId = ref.read(effectiveTechnicianIdProvider);
    final orgId = await ref.read(organizationIdProvider.future);
    if (techId == null || orgId == null) return;

    HapticFeedback.heavyImpact();

    setState(() {
      _isDragging = false;
      _dragJob = null;
      _dragY = null;
      _incomingJobId = job.id;
    });

    try {
      await dispatchJob(
        jobId: job.id,
        jobTitle: job.title,
        organizationId: orgId,
        technicianId: techId,
        startTime: snappedTime,
        durationMinutes: job.estimatedDurationMinutes ?? 60,
        clientName: job.clientName,
        location: job.location,
      );

      ref.invalidate(technicianScheduleProvider);
      ref.invalidate(backlogJobsProvider);
      ref.invalidate(myTodayBlocksProvider);
      ref.invalidate(jobsProvider);

      if (mounted) {
        final selectedTech = ref.read(selectedTechnicianProvider);
        final isOwnSchedule = selectedTech == null;

        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Row(
            children: [
              Icon(PhosphorIconsBold.checkCircle, size: 16, color: ObsidianTheme.emerald),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isOwnSchedule
                      ? 'Dispatched to ${DateFormat('h:mm a').format(snappedTime)}'
                      : 'Assigned to team member at ${DateFormat('h:mm a').format(snappedTime)}',
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: ObsidianTheme.surface2,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
          duration: const Duration(seconds: 2),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Dispatch failed: $e'),
          backgroundColor: ObsidianTheme.rose,
        ));
      }
    }

    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) setState(() => _incomingJobId = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final selectedDate = ref.watch(selectedDateProvider);
    final blocksAsync = ref.watch(technicianScheduleProvider);
    final backlogAsync = ref.watch(backlogJobsProvider);
    final isToday = _isToday(selectedDate);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Column(
              children: [
                _buildHeader(selectedDate),
                const SizedBox(height: 4),
                const _TeamSwitcher(),
                const SizedBox(height: 8),
                Expanded(
                  child: blocksAsync.when(
                    data: (blocks) => _buildTimeline(blocks, isToday),
                    loading: () => Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: List.generate(5, (_) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: ShimmerLoading(height: 64, borderRadius: ObsidianTheme.radiusLg),
                        )),
                      ),
                    ),
                    error: (e, _) => Center(
                      child: Text('Error: $e', style: const TextStyle(color: ObsidianTheme.rose)),
                    ),
                  ),
                ),
              ],
            ),

            if (_showTodayButton && isToday)
              Positioned(
                right: 16,
                bottom: MediaQuery.of(context).padding.bottom + 80,
                child: _buildTodayButton(),
              ),

            Positioned(
              left: 0, right: 0, bottom: 0,
              child: backlogAsync.when(
                data: (jobs) => _BacklogTray(
                  jobs: jobs,
                  ref: ref,
                  onDragStarted: (job) => setState(() {
                    _isDragging = true;
                    _dragJob = job;
                  }),
                  onDragEnd: () => setState(() {
                    _isDragging = false;
                    _dragJob = null;
                    _dragY = null;
                  }),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(DateTime selectedDate) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Schedule',
                  style: GoogleFonts.inter(
                    fontSize: 20, fontWeight: FontWeight.w600,
                    color: ObsidianTheme.textPrimary, letterSpacing: -0.3,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () { HapticFeedback.mediumImpact(); context.push('/flight-path'); },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                    border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.mapTrifold, size: 14, color: ObsidianTheme.emerald),
                      const SizedBox(width: 5),
                      Text('Flight Path', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.emerald, fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.5)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () { HapticFeedback.mediumImpact(); context.push('/route'); },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: ObsidianTheme.blue.withValues(alpha: 0.08),
                    border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.15)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.path, size: 14, color: ObsidianTheme.blue),
                      const SizedBox(width: 5),
                      Text('Route', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.blue, fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.5)),
                    ],
                  ),
                ),
              ),
            ],
          ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
          const SizedBox(height: 14),
          Row(
            children: [
              _NavArrow(icon: PhosphorIconsLight.caretLeft, onTap: () {
                HapticFeedback.selectionClick();
                ref.read(selectedDateProvider.notifier).state = selectedDate.subtract(const Duration(days: 1));
              }),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    ref.read(selectedDateProvider.notifier).state = DateTime.now();
                    Future.delayed(const Duration(milliseconds: 100), () => _scrollToNow());
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: ObsidianTheme.shimmerBase,
                      border: Border.all(color: ObsidianTheme.border),
                    ),
                    child: Center(
                      child: Text(
                        _isToday(selectedDate) ? 'Today, ${DateFormat('MMM d').format(selectedDate)}' : DateFormat('EEE, MMM d').format(selectedDate),
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _NavArrow(icon: PhosphorIconsLight.caretRight, onTap: () {
                HapticFeedback.selectionClick();
                ref.read(selectedDateProvider.notifier).state = selectedDate.add(const Duration(days: 1));
              }),
            ],
          ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
        ],
      ),
    );
  }

  Widget _buildTimeline(List<ScheduleBlock> blocks, bool isToday) {
    // Group overlapping blocks for conflict visualization
    final columns = _resolveConflicts(blocks);

    return DragTarget<Job>(
      onWillAcceptWithDetails: (_) => true,
      onMove: (details) {
        final renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox == null) return;
        final headerHeight = 160.0;
        final localY = details.offset.dy - renderBox.localToGlobal(Offset.zero).dy - headerHeight + _scrollController.offset;
        setState(() => _dragY = localY);
      },
      onLeave: (_) => setState(() => _dragY = null),
      onAcceptWithDetails: (details) {
        if (_dragY != null) _handleDrop(details.data, _dragY!);
      },
      builder: (context, candidateData, rejectedData) {
        return RefreshIndicator(
          color: ObsidianTheme.emerald,
          backgroundColor: ObsidianTheme.surface1,
          onRefresh: () async {
            HapticFeedback.mediumImpact();
            ref.invalidate(technicianScheduleProvider);
            ref.invalidate(backlogJobsProvider);
          },
          child: SingleChildScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 140),
            child: SizedBox(
              height: _totalHours * _hourHeight,
              child: Stack(
                children: [
                  ..._buildHourLines(),
                  // 15-min grid lines (subtle)
                  if (_isDragging) ..._buildQuarterLines(),
                  // Job capsules with conflict columns
                  ...columns.entries.expand((entry) {
                    final block = entry.key;
                    final col = entry.value;
                    return [_buildJobCapsule(block, blocks.indexOf(block), col.$1, col.$2)];
                  }),
                  // Ghost block during drag
                  if (_isDragging && _dragY != null && _dragJob != null)
                    _buildGhostBlock(_dragY!, _dragJob!),
                  // Laser line
                  if (isToday && _laserOffset > 0 && _laserOffset < _totalHours * _hourHeight)
                    _buildLaserLine(),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Resolve overlapping blocks into columns for side-by-side display.
  Map<ScheduleBlock, (int, int)> _resolveConflicts(List<ScheduleBlock> blocks) {
    final result = <ScheduleBlock, (int, int)>{};
    final sorted = [...blocks]..sort((a, b) => a.startTime.compareTo(b.startTime));

    for (final block in sorted) {
      final overlapping = sorted.where((b) =>
          b != block &&
          b.startTime.isBefore(block.endTime) &&
          b.endTime.isAfter(block.startTime));

      if (overlapping.isEmpty) {
        result[block] = (0, 1);
      } else {
        final allInGroup = [block, ...overlapping];
        final totalCols = allInGroup.length;
        final usedCols = overlapping.map((b) => result[b]?.$1 ?? -1).toSet();
        var col = 0;
        while (usedCols.contains(col)) { col++; }
        result[block] = (col, totalCols.clamp(1, 3));
      }
    }
    return result;
  }

  List<Widget> _buildHourLines() {
    return List.generate(_totalHours, (i) {
      final hour = _dayStartHour + i;
      final label = hour == 0 ? '12 AM' : hour < 12 ? '${hour}am' : hour == 12 ? '12pm' : '${hour - 12}pm';
      final top = i * _hourHeight;
      return Positioned(
        top: top, left: 0, right: 0,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: _gutterWidth,
              child: Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
              ),
            ),
            Expanded(child: Container(height: 1, margin: const EdgeInsets.only(top: 6), color: const Color(0x0DFFFFFF))),
          ],
        ),
      );
    });
  }

  List<Widget> _buildQuarterLines() {
    final lines = <Widget>[];
    for (int i = 0; i < _totalHours; i++) {
      for (int q = 1; q < 4; q++) {
        final top = i * _hourHeight + q * _quarterHeight;
        lines.add(Positioned(
          top: top, left: _gutterWidth, right: 0,
          child: Container(height: 1, color: const Color(0x06FFFFFF)),
        ));
      }
    }
    return lines;
  }

  Widget _buildJobCapsule(ScheduleBlock block, int index, int column, int totalColumns) {
    final now = DateTime.now();
    final isActive = _isToday(ref.read(selectedDateProvider)) &&
        now.isAfter(block.startTime) && now.isBefore(block.endTime);
    final isIncoming = block.jobId == _incomingJobId;

    final startMinutes = (block.startTime.hour - _dayStartHour) * 60 + block.startTime.minute;
    final endMinutes = (block.endTime.hour - _dayStartHour) * 60 + block.endTime.minute;
    final top = (startMinutes / 60.0) * _hourHeight;
    final height = ((endMinutes - startMinutes) / 60.0) * _hourHeight;

    final availableWidth = MediaQuery.of(context).size.width - _gutterWidth - 16;
    final colWidth = totalColumns > 1 ? availableWidth / totalColumns : availableWidth;
    final leftOffset = _gutterWidth + 4 + (column * colWidth);

    Color statusColor;
    switch (block.status) {
      case ScheduleBlockStatus.inProgress: statusColor = ObsidianTheme.emerald;
      case ScheduleBlockStatus.enRoute: statusColor = ObsidianTheme.amber;
      case ScheduleBlockStatus.complete: statusColor = ObsidianTheme.textTertiary;
      case ScheduleBlockStatus.cancelled: statusColor = ObsidianTheme.rose;
      default: statusColor = ObsidianTheme.blue;
    }
    if (isActive) statusColor = ObsidianTheme.emerald;

    Widget capsule = Positioned(
      top: top,
      left: leftOffset,
      width: colWidth - 4,
      height: height.clamp(44.0, double.infinity),
      child: GestureDetector(
        onTap: () => _showMissionBrief(context, block),
        onLongPress: () {
          HapticFeedback.heavyImpact();
          if (block.jobId != null) context.push('/jobs/${block.jobId}');
        },
        child: ClipRRect(
          borderRadius: ObsidianTheme.radiusMd,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: const Color(0xCC18181B),
                border: Border.all(color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.border),
                boxShadow: isActive ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.08), blurRadius: 12)] : null,
              ),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: statusColor,
                      borderRadius: const BorderRadius.only(topLeft: Radius.circular(8), bottomLeft: Radius.circular(8)),
                      boxShadow: isActive ? [BoxShadow(color: statusColor.withValues(alpha: 0.4), blurRadius: 8)] : null,
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            block.clientName ?? block.title,
                            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${block.timeRange}  ${block.location ?? ''}',
                            style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (isActive)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), color: ObsidianTheme.emeraldDim),
                      child: Text('NOW', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600)),
                    ),
                  if (totalColumns > 1)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(3), color: ObsidianTheme.roseDim),
                      child: Icon(PhosphorIconsBold.warning, size: 10, color: ObsidianTheme.rose),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (isIncoming) {
      return capsule
          .animate()
          .fadeIn(duration: 500.ms, curve: Curves.easeOutCubic)
          .moveY(begin: -20, end: 0, duration: 500.ms, curve: Curves.easeOutCubic)
          .scale(begin: const Offset(0.95, 0.95), end: const Offset(1, 1), duration: 500.ms);
    }

    return capsule
        .animate()
        .fadeIn(delay: Duration(milliseconds: 150 + index * 40), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveX(begin: -12, end: 0, delay: Duration(milliseconds: 150 + index * 40), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }

  /// Ghost block shown while dragging over the timeline.
  Widget _buildGhostBlock(double y, Job job) {
    final snappedMinutes = ((y / _hourHeight * 60 + 7) ~/ 15) * 15;
    final snappedTop = (snappedMinutes / 60.0) * _hourHeight;
    final durationMinutes = job.estimatedDurationMinutes ?? 60;
    final ghostHeight = (durationMinutes / 60.0) * _hourHeight;

    final snappedHour = _dayStartHour + snappedMinutes ~/ 60;
    final snappedMin = snappedMinutes % 60;
    final timeLabel = '${snappedHour > 12 ? snappedHour - 12 : snappedHour}:${snappedMin.toString().padLeft(2, '0')} ${snappedHour >= 12 ? 'PM' : 'AM'}';

    // Check for conflicts
    final blocks = ref.read(technicianScheduleProvider).valueOrNull ?? [];
    final ghostStart = snappedMinutes;
    final ghostEnd = ghostStart + durationMinutes;
    final hasConflict = blocks.any((b) {
      final bStart = (b.startTime.hour - _dayStartHour) * 60 + b.startTime.minute;
      final bEnd = (b.endTime.hour - _dayStartHour) * 60 + b.endTime.minute;
      return bStart < ghostEnd && bEnd > ghostStart;
    });

    return Positioned(
      top: snappedTop,
      left: _gutterWidth + 4,
      right: 12,
      height: ghostHeight.clamp(44.0, double.infinity),
      child: IgnorePointer(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusMd,
            color: hasConflict ? ObsidianTheme.rose.withValues(alpha: 0.15) : ObsidianTheme.emerald.withValues(alpha: 0.12),
            border: Border.all(
              color: hasConflict ? ObsidianTheme.rose.withValues(alpha: 0.5) : ObsidianTheme.emerald.withValues(alpha: 0.5),
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: (hasConflict ? ObsidianTheme.rose : ObsidianTheme.emerald).withValues(alpha: 0.15),
                blurRadius: 12,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  job.title,
                  style: GoogleFonts.inter(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: (hasConflict ? ObsidianTheme.rose : ObsidianTheme.emerald).withValues(alpha: 0.8),
                  ),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(
                      hasConflict ? PhosphorIconsBold.warning : PhosphorIconsLight.clock,
                      size: 10,
                      color: (hasConflict ? ObsidianTheme.rose : ObsidianTheme.emerald).withValues(alpha: 0.6),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      hasConflict ? 'Conflict — $timeLabel' : timeLabel,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9,
                        color: (hasConflict ? ObsidianTheme.rose : ObsidianTheme.emerald).withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLaserLine() {
    return Positioned(
      top: _laserOffset - 1, left: 0, right: 0,
      child: Row(
        children: [
          SizedBox(
            width: _gutterWidth,
            child: Align(
              alignment: Alignment.centerRight,
              child: Container(
                width: 8, height: 8,
                margin: const EdgeInsets.only(right: 4),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald,
                  boxShadow: [
                    BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 8),
                    BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.2), blurRadius: 16),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: Container(
              height: 2,
              decoration: BoxDecoration(
                color: ObsidianTheme.emerald,
                boxShadow: [
                  BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 8),
                  BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.15), blurRadius: 16),
                ],
              ),
            ),
          ),
        ],
      )
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .custom(duration: 2000.ms, builder: (_, value, child) => Opacity(opacity: 0.7 + 0.3 * value, child: child)),
    );
  }

  Widget _buildTodayButton() {
    return GestureDetector(
      onTap: _scrollToNow,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: ObsidianTheme.surface2,
          border: Border.all(color: ObsidianTheme.borderMedium),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 12)],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsLight.crosshair, size: 14, color: ObsidianTheme.emerald),
            const SizedBox(width: 6),
            Text('Now', style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 200.ms).scale(begin: const Offset(0.9, 0.9), end: const Offset(1, 1), duration: 200.ms);
  }

  void _showMissionBrief(BuildContext context, ScheduleBlock block) {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MissionBriefSheet(block: block),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Team Switcher ────────────────────────────────────
// ══════════════════════════════════════════════════════

class _TeamSwitcher extends ConsumerWidget {
  const _TeamSwitcher();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teamAsync = ref.watch(dispatchTeamProvider);
    final selectedTech = ref.watch(selectedTechnicianProvider);
    final currentUserId = SupabaseService.auth.currentUser?.id;

    return teamAsync.when(
      loading: () => const SizedBox(height: 48),
      error: (_, __) => const SizedBox(height: 48),
      data: (members) {
        if (members.length <= 1) return const SizedBox.shrink();

        return SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: members.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final member = members[i];
              final profile = member['profiles'] as Map<String, dynamic>? ?? {};
              final userId = profile['id'] as String? ?? member['user_id'] as String?;
              final name = profile['full_name'] as String? ?? 'Unknown';
              final isMe = userId == currentUserId;
              final isActive = (selectedTech == null && isMe) || selectedTech == userId;
              final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
              final firstName = name.split(' ').first;

              return GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  ref.read(selectedTechnicianProvider.notifier).state = isMe ? null : userId;
                },
                child: AnimatedContainer(
                  duration: ObsidianTheme.fast,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusFull,
                    color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.1) : Colors.transparent,
                    border: Border.all(
                      color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.border,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.2) : ObsidianTheme.surface2,
                          border: Border.all(color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.4) : ObsidianTheme.borderMedium),
                        ),
                        child: Center(
                          child: Text(
                            initial,
                            style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.w600,
                              color: isActive ? ObsidianTheme.emerald : ObsidianTheme.textSecondary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isMe ? 'Me' : firstName,
                        style: GoogleFonts.inter(
                          fontSize: 12, fontWeight: FontWeight.w500,
                          color: isActive ? ObsidianTheme.emerald : ObsidianTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              )
                  .animate()
                  .fadeIn(delay: Duration(milliseconds: 50 + i * 30), duration: 300.ms)
                  .moveX(begin: -6, delay: Duration(milliseconds: 50 + i * 30), duration: 300.ms);
            },
          ),
        );
      },
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Backlog Tray ─────────────────────────────────────
// ══════════════════════════════════════════════════════

class _BacklogTray extends StatefulWidget {
  final List<Job> jobs;
  final WidgetRef ref;
  final void Function(Job) onDragStarted;
  final VoidCallback onDragEnd;

  const _BacklogTray({
    required this.jobs,
    required this.ref,
    required this.onDragStarted,
    required this.onDragEnd,
  });

  @override
  State<_BacklogTray> createState() => _BacklogTrayState();
}

class _BacklogTrayState extends State<_BacklogTray> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final count = widget.jobs.length;

    return GestureDetector(
      onVerticalDragUpdate: (details) {
        if (details.primaryDelta! < -5) {
          HapticFeedback.mediumImpact();
          setState(() => _expanded = true);
        } else if (details.primaryDelta! > 5) {
          HapticFeedback.lightImpact();
          setState(() => _expanded = false);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutQuart,
        height: _expanded ? 320 + bottomPad : 52 + bottomPad,
        decoration: BoxDecoration(
          color: ObsidianTheme.void_.withValues(alpha: 0.95),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          border: const Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Column(
              children: [
                // Handle
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _expanded = !_expanded);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Icon(PhosphorIconsLight.tray, size: 16, color: ObsidianTheme.amber),
                        const SizedBox(width: 8),
                        Text('Backlog', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusFull, color: ObsidianTheme.amberDim),
                          child: Text('$count', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.amber, fontWeight: FontWeight.w500)),
                        ),
                        if (_expanded) ...[
                          const SizedBox(width: 8),
                          Text(
                            'DRAG TO SCHEDULE',
                            style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.textTertiary, letterSpacing: 1),
                          ),
                        ],
                        const Spacer(),
                        AnimatedRotation(
                          turns: _expanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 250),
                          child: Icon(PhosphorIconsLight.caretUp, size: 16, color: ObsidianTheme.textTertiary),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_expanded)
                  Expanded(
                    child: count == 0
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 48, height: 48,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                                  ),
                                  child: Icon(PhosphorIconsLight.checkCircle, size: 24, color: ObsidianTheme.emerald),
                                ),
                                const SizedBox(height: 10),
                                Text('Backlog clear', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.emerald)),
                                const SizedBox(height: 4),
                                Text('All jobs have been dispatched', style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary)),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: count,
                            separatorBuilder: (_, __) => const SizedBox(height: 6),
                            itemBuilder: (_, i) {
                              final job = widget.jobs[i];
                              return _DraggableBacklogCard(
                                job: job,
                                index: i,
                                ref: widget.ref,
                                onDragStarted: () => widget.onDragStarted(job),
                                onDragEnd: widget.onDragEnd,
                              );
                            },
                          ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Draggable backlog card — long press to pick up, drag to timeline.
class _DraggableBacklogCard extends StatelessWidget {
  final Job job;
  final int index;
  final WidgetRef ref;
  final VoidCallback onDragStarted;
  final VoidCallback onDragEnd;

  const _DraggableBacklogCard({
    required this.job,
    required this.index,
    required this.ref,
    required this.onDragStarted,
    required this.onDragEnd,
  });

  @override
  Widget build(BuildContext context) {
    return LongPressDraggable<Job>(
      data: job,
      delay: const Duration(milliseconds: 250),
      hapticFeedbackOnStart: true,
      onDragStarted: () {
        HapticFeedback.heavyImpact();
        onDragStarted();
      },
      onDragEnd: (_) => onDragEnd(),
      onDraggableCanceled: (_, __) => onDragEnd(),
      feedback: Material(
        color: Colors.transparent,
        child: Transform.scale(
          scale: 1.05,
          child: SizedBox(
            width: MediaQuery.of(context).size.width - 80,
            child: _buildCard(isDragging: true),
          ),
        ),
      ),
      childWhenDragging: Opacity(
        opacity: 0.3,
        child: _buildCard(),
      ),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          context.push('/jobs/${job.id}');
        },
        child: _buildCard(),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 50 + index * 30), duration: 300.ms)
        .moveY(begin: 8, end: 0, delay: Duration(milliseconds: 50 + index * 30), duration: 300.ms, curve: Curves.easeOutQuart);
  }

  Widget _buildCard({bool isDragging = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: isDragging ? ObsidianTheme.surface2 : ObsidianTheme.surface1,
        border: Border.all(
          color: isDragging ? ObsidianTheme.emerald.withValues(alpha: 0.4) : ObsidianTheme.amber.withValues(alpha: 0.15),
          width: isDragging ? 2 : 1,
        ),
        boxShadow: isDragging
            ? [
                BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.15), blurRadius: 20),
                BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 30),
              ]
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 3, height: 32,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.amber),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(job.title, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(job.displayId, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                    if (job.clientName != null) ...[
                      const SizedBox(width: 6),
                      Text(job.clientName!, style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                    if (job.estimatedDurationMinutes != null) ...[
                      const Spacer(),
                      Icon(PhosphorIconsLight.clock, size: 10, color: ObsidianTheme.textTertiary),
                      const SizedBox(width: 3),
                      Text('${job.estimatedDurationMinutes}m', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (!isDragging)
            Icon(PhosphorIconsLight.dotsSixVertical, size: 16, color: ObsidianTheme.textTertiary),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Mission Brief Sheet ──────────────────────────────
// ══════════════════════════════════════════════════════

class _MissionBriefSheet extends StatelessWidget {
  final ScheduleBlock block;
  const _MissionBriefSheet({required this.block});

  Color _statusColor() {
    switch (block.status) {
      case ScheduleBlockStatus.inProgress: return ObsidianTheme.emerald;
      case ScheduleBlockStatus.enRoute: return ObsidianTheme.amber;
      case ScheduleBlockStatus.complete: return ObsidianTheme.textTertiary;
      case ScheduleBlockStatus.cancelled: return ObsidianTheme.rose;
      default: return ObsidianTheme.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
          decoration: BoxDecoration(
            color: ObsidianTheme.void_.withValues(alpha: 0.95),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            border: const Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.textTertiary))),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(width: 4, height: 20, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: _statusColor())),
                  const SizedBox(width: 10),
                  Expanded(child: Text(block.title, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white, letterSpacing: -0.2))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusFull, color: _statusColor().withValues(alpha: 0.1), border: Border.all(color: _statusColor().withValues(alpha: 0.2))),
                    child: Text(block.status.label, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w500, color: _statusColor())),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _BentoTile(icon: PhosphorIconsLight.clock, label: 'TIME', value: block.timeRange, isMono: true)),
                  const SizedBox(width: 8),
                  Expanded(child: _BentoTile(icon: PhosphorIconsLight.user, label: 'CLIENT', value: block.clientName ?? 'Unassigned')),
                ],
              ),
              const SizedBox(height: 8),
              if (block.location != null) _BentoTile(icon: PhosphorIconsLight.mapPin, label: 'LOCATION', value: block.location!, fullWidth: true),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () { HapticFeedback.mediumImpact(); Navigator.pop(context); if (block.jobId != null) context.push('/jobs/${block.jobId}'); },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusMd, border: Border.all(color: ObsidianTheme.borderMedium)),
                        child: Center(child: Text('View Dossier', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary))),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: () { HapticFeedback.heavyImpact(); Navigator.pop(context); },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusMd, color: ObsidianTheme.emerald),
                        child: Center(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(PhosphorIconsLight.navigationArrow, size: 14, color: Colors.white),
                              const SizedBox(width: 6),
                              Text('Start Travel', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
            ],
          ),
        ),
      ),
    ).animate().moveY(begin: 20, end: 0, duration: 300.ms, curve: Curves.easeOutQuart).fadeIn(duration: 200.ms);
  }
}

class _BentoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool isMono;
  final bool fullWidth;

  const _BentoTile({required this.icon, required this.label, required this.value, this.isMono = false, this.fullWidth = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusMd, color: ObsidianTheme.surface1, border: Border.all(color: ObsidianTheme.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 12, color: ObsidianTheme.textTertiary),
            const SizedBox(width: 6),
            Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
          ]),
          const SizedBox(height: 6),
          Text(value, style: isMono ? GoogleFonts.jetBrainsMono(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500) : GoogleFonts.inter(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _NavArrow extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _NavArrow({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusMd, border: Border.all(color: ObsidianTheme.borderMedium), color: ObsidianTheme.surface1),
        child: Icon(icon, size: 16, color: ObsidianTheme.textSecondary),
      ),
    );
  }
}
