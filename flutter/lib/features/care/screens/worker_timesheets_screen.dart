import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Worker Timesheets — Pay Transparency Dashboard ───────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// Workers can view their raw clock times alongside interpreted
// hours (base rate, evening loading, overtime). Builds trust
// between the workforce and management.

class WorkerTimesheetsScreen extends ConsumerStatefulWidget {
  const WorkerTimesheetsScreen({super.key});

  @override
  ConsumerState<WorkerTimesheetsScreen> createState() => _WorkerTimesheetsScreenState();
}

class _WorkerTimesheetsScreenState extends ConsumerState<WorkerTimesheetsScreen> {
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;
  double _weeklyHours = 0;

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    try {
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) return;

      final fourWeeksAgo = DateTime.now().subtract(const Duration(days: 28)).toIso8601String();
      final data = await SupabaseService.client
          .from('time_entries')
          .select()
          .eq('user_id', userId)
          .gte('clock_in', fourWeeksAgo)
          .order('clock_in', ascending: false)
          .limit(60);

      // Calculate this week's hours
      final now = DateTime.now();
      final weekStart = now.subtract(Duration(days: now.weekday - 1));
      final startOfWeek = DateTime(weekStart.year, weekStart.month, weekStart.day);
      double weekMinutes = 0;

      for (final e in (data as List)) {
        final clockIn = DateTime.tryParse(e['clock_in']?.toString() ?? '');
        if (clockIn != null && clockIn.isAfter(startOfWeek)) {
          weekMinutes += (e['total_minutes'] as int? ?? 0);
        }
      }

      if (mounted) {
        setState(() {
          _entries = data.cast<Map<String, dynamic>>();
          _weeklyHours = weekMinutes / 60;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); context.canPop() ? context.pop() : context.go('/'); },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text('My Timesheets', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3)),
            flexibleSpace: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24), child: Container(color: c.canvas.withValues(alpha: 0.85)))),
          ),

          // ── Weekly Summary ──────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  _SumCard(label: 'This Week', value: '${_weeklyHours.toStringAsFixed(1)}h', color: ObsidianTheme.careBlue),
                  const SizedBox(width: 8),
                  _SumCard(label: 'Entries', value: '${_entries.length}', color: ObsidianTheme.emerald),
                ],
              ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
            ),
          ),

          if (_loading)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
          else if (_entries.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(PhosphorIconsLight.clock, size: 48, color: c.textDisabled),
                    const SizedBox(height: 12),
                    Text('No timesheet entries', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textSecondary)),
                    Text('Your shift hours will appear here.', style: GoogleFonts.inter(fontSize: 14, color: c.textTertiary)),
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList.separated(
                itemCount: _entries.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final entry = _entries[index];
                  return _TimesheetCard(entry: entry)
                      .animate()
                      .fadeIn(delay: (index * 30).ms, duration: 300.ms)
                      .moveY(begin: 10, end: 0);
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _SumCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _SumCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: GoogleFonts.jetBrainsMono(fontSize: 26, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
          ],
        ),
      ),
    );
  }
}

class _TimesheetCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _TimesheetCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final clockIn = DateTime.tryParse(entry['clock_in']?.toString() ?? '');
    final clockOut = entry['clock_out'] != null ? DateTime.tryParse(entry['clock_out'].toString()) : null;
    final totalMin = entry['total_minutes'] as int? ?? 0;
    final hours = totalMin ~/ 60;
    final mins = totalMin % 60;
    final status = entry['status'] as String? ?? 'completed';
    final isOverride = entry['is_geofence_override'] == true;

    final statusColor = switch (status) {
      'active' => ObsidianTheme.emerald,
      'break' => ObsidianTheme.amber,
      'completed' => ObsidianTheme.careBlue,
      _ => c.textTertiary,
    };

    // Parse award interpretation if available
    final interpretation = entry['award_interpretation'] as Map<String, dynamic>?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                clockIn != null ? DateFormat('EEE, d MMM').format(clockIn) : '--',
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(status.toUpperCase(), style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(PhosphorIconsLight.signIn, size: 14, color: c.textTertiary),
              const SizedBox(width: 6),
              Text(
                clockIn != null ? DateFormat('h:mm a').format(clockIn) : '--',
                style: GoogleFonts.jetBrainsMono(fontSize: 13, color: c.textSecondary),
              ),
              const SizedBox(width: 16),
              Icon(PhosphorIconsLight.signOut, size: 14, color: c.textTertiary),
              const SizedBox(width: 6),
              Text(
                clockOut != null ? DateFormat('h:mm a').format(clockOut) : '--',
                style: GoogleFonts.jetBrainsMono(fontSize: 13, color: c.textSecondary),
              ),
              const Spacer(),
              Text(
                '${hours}h ${mins}m',
                style: GoogleFonts.jetBrainsMono(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary),
              ),
            ],
          ),
          if (interpretation != null && interpretation['payroll_categories'] is List) ...[
            const SizedBox(height: 8),
            Divider(height: 1, color: c.border),
            const SizedBox(height: 8),
            ...(interpretation['payroll_categories'] as List).map((cat) {
              final code = cat['code'] as String? ?? '';
              final catHours = (cat['hours'] as num?)?.toStringAsFixed(1) ?? '0';
              final multiplier = (cat['rate_multiplier'] as num?)?.toString() ?? '1.0';
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: multiplier == '1.0' ? ObsidianTheme.emerald : ObsidianTheme.amber)),
                    const SizedBox(width: 8),
                    Text(code.replaceAll('_', ' '), style: GoogleFonts.jetBrainsMono(fontSize: 11, color: c.textSecondary)),
                    const Spacer(),
                    Text('${catHours}h × $multiplier', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textPrimary)),
                  ],
                ),
              );
            }),
          ],
          if (isOverride) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(PhosphorIconsLight.mapPinLine, size: 12, color: ObsidianTheme.amber),
                const SizedBox(width: 4),
                Text('Geofence override', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.amber)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
