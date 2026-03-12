import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/incidents_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/incident.dart';

// ═══════════════════════════════════════════════════════════
// ── Incident Detail Screen ───────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: View full incident details and update
// status through the resolution workflow.

class IncidentDetailScreen extends ConsumerStatefulWidget {
  final String incidentId;
  const IncidentDetailScreen({super.key, required this.incidentId});

  @override
  ConsumerState<IncidentDetailScreen> createState() => _IncidentDetailScreenState();
}

class _IncidentDetailScreenState extends ConsumerState<IncidentDetailScreen> {
  IncidentStatus? _selectedStatus;
  final _resolutionNotesCtrl = TextEditingController();
  bool _updating = false;

  @override
  void dispose() {
    _resolutionNotesCtrl.dispose();
    super.dispose();
  }

  // ── Severity Colors ────────────────────────────────────
  Color _severityColor(IncidentSeverity sev) => switch (sev) {
    IncidentSeverity.low => const Color(0xFF10B981),
    IncidentSeverity.medium => const Color(0xFFF59E0B),
    IncidentSeverity.high => const Color(0xFFF97316),
    IncidentSeverity.critical => const Color(0xFFEF4444),
  };

  String _severityIcon(IncidentSeverity sev) => switch (sev) {
    IncidentSeverity.low => '●',
    IncidentSeverity.medium => '▲',
    IncidentSeverity.high => '◆',
    IncidentSeverity.critical => '⬟',
  };

  // ── Status Colors ──────────────────────────────────────
  Color _statusColor(IncidentStatus status) => switch (status) {
    IncidentStatus.reported => ObsidianTheme.amber,
    IncidentStatus.underReview => ObsidianTheme.blue,
    IncidentStatus.investigation => ObsidianTheme.indigo,
    IncidentStatus.resolved => ObsidianTheme.careBlue,
    IncidentStatus.closed => ObsidianTheme.textMuted,
  };

  IconData _statusIcon(IncidentStatus status) => switch (status) {
    IncidentStatus.reported => PhosphorIconsLight.megaphone,
    IncidentStatus.underReview => PhosphorIconsLight.magnifyingGlass,
    IncidentStatus.investigation => PhosphorIconsLight.detective,
    IncidentStatus.resolved => PhosphorIconsLight.checkCircle,
    IncidentStatus.closed => PhosphorIconsLight.lockSimple,
  };

  // ── Status Update ──────────────────────────────────────
  Future<void> _updateStatus(Incident incident) async {
    final newStatus = _selectedStatus;
    if (newStatus == null || newStatus == incident.status) return;

    setState(() => _updating = true);
    try {
      await updateIncidentStatus(
        incidentId: incident.id,
        status: newStatus,
        resolutionNotes: (newStatus == IncidentStatus.resolved || newStatus == IncidentStatus.closed)
            ? _resolutionNotesCtrl.text.trim().isNotEmpty
                ? _resolutionNotesCtrl.text.trim()
                : null
            : null,
      );

      HapticFeedback.mediumImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status updated to ${newStatus.label}',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.careBlue,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        setState(() => _selectedStatus = null);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update: $e',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final incidentsAsync = ref.watch(incidentsStreamProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: incidentsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(child: Text('Error: $e', style: TextStyle(color: c.textTertiary))),
        data: (incidents) {
          final incident = incidents.where((i) => i.id == widget.incidentId).firstOrNull;
          if (incident == null) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(PhosphorIconsLight.warning, size: 48, color: c.textDisabled),
                  const SizedBox(height: 12),
                  Text('Incident not found', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
                ],
              ),
            );
          }

          final sevColor = _severityColor(incident.severity);
          final statColor = _statusColor(incident.status);
          // Initialize selected status to current if not set
          final effectiveSelected = _selectedStatus ?? incident.status;
          final showResolutionField = effectiveSelected == IncidentStatus.resolved ||
              effectiveSelected == IncidentStatus.closed;

          return CustomScrollView(
            slivers: [
              // ── Glass App Bar ──────────────────────────────
              SliverAppBar(
                pinned: true,
                floating: false,
                backgroundColor: Colors.transparent,
                surfaceTintColor: Colors.transparent,
                elevation: 0,
                leading: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/');
                    }
                  },
                  child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
                ),
                title: Text(
                  'Incident Detail',
                  style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
                ),
                actions: [
                  if (incident.isReportable)
                    Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: ObsidianTheme.rose.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text('REPORTABLE',
                            style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: ObsidianTheme.rose)),
                      ),
                    ),
                ],
                flexibleSpace: ClipRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                    child: Container(color: c.canvas.withValues(alpha: 0.85)),
                  ),
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Severity + Status Badges ───────────────
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: sevColor.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: sevColor.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_severityIcon(incident.severity),
                                    style: TextStyle(fontSize: 10, color: sevColor)),
                                const SizedBox(width: 6),
                                Text(
                                  incident.severity.label.toUpperCase(),
                                  style: GoogleFonts.jetBrainsMono(
                                      fontSize: 11, fontWeight: FontWeight.w700, color: sevColor, letterSpacing: 0.5),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: statColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: statColor.withValues(alpha: 0.25)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(_statusIcon(incident.status), size: 14, color: statColor),
                                const SizedBox(width: 6),
                                Text(
                                  incident.status.label.toUpperCase(),
                                  style: GoogleFonts.jetBrainsMono(
                                      fontSize: 11, fontWeight: FontWeight.w600, color: statColor, letterSpacing: 0.5),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),

                      const SizedBox(height: 16),

                      // ── Title ──────────────────────────────────
                      Text(
                        incident.title,
                        style: GoogleFonts.inter(
                            fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary, letterSpacing: -0.5, height: 1.3),
                      ).animate().fadeIn(delay: 50.ms, duration: 300.ms).moveY(begin: 8, end: 0),

                      const SizedBox(height: 16),

                      // ── Description ────────────────────────────
                      _DetailSection(
                        label: 'DESCRIPTION',
                        child: Text(
                          incident.description,
                          style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, height: 1.5),
                        ),
                      ).animate().fadeIn(delay: 100.ms, duration: 300.ms).moveY(begin: 8, end: 0),

                      const SizedBox(height: 16),

                      // ── Meta Grid ──────────────────────────────
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: c.border),
                        ),
                        child: Column(
                          children: [
                            _MetaRow(
                              icon: PhosphorIconsLight.tag,
                              label: 'Category',
                              value: incident.category.label,
                            ),
                            Divider(height: 20, color: c.border),
                            _MetaRow(
                              icon: PhosphorIconsLight.user,
                              label: 'Reported By',
                              value: incident.workerName ?? 'Unknown',
                            ),
                            Divider(height: 20, color: c.border),
                            _MetaRow(
                              icon: PhosphorIconsLight.clock,
                              label: 'Occurred',
                              value: _formatDateTime(incident.occurredAt),
                            ),
                            Divider(height: 20, color: c.border),
                            _MetaRow(
                              icon: PhosphorIconsLight.calendarCheck,
                              label: 'Reported',
                              value: _formatDateTime(incident.reportedAt),
                            ),
                            if (incident.location != null) ...[
                              Divider(height: 20, color: c.border),
                              _MetaRow(
                                icon: PhosphorIconsLight.mapPin,
                                label: 'Location',
                                value: incident.location!,
                              ),
                            ],
                          ],
                        ),
                      ).animate().fadeIn(delay: 150.ms, duration: 300.ms).moveY(begin: 8, end: 0),

                      // ── Immediate Actions ──────────────────────
                      if (incident.immediateActions != null && incident.immediateActions!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _DetailSection(
                          label: 'IMMEDIATE ACTIONS TAKEN',
                          child: Text(
                            incident.immediateActions!,
                            style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, height: 1.5),
                          ),
                        ).animate().fadeIn(delay: 200.ms, duration: 300.ms).moveY(begin: 8, end: 0),
                      ],

                      // ── Resolution Notes (for resolved/closed) ─
                      if (incident.resolutionNotes != null && incident.resolutionNotes!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _DetailSection(
                          label: 'RESOLUTION NOTES',
                          accentColor: ObsidianTheme.careBlue,
                          child: Text(
                            incident.resolutionNotes!,
                            style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, height: 1.5),
                          ),
                        ).animate().fadeIn(delay: 250.ms, duration: 300.ms).moveY(begin: 8, end: 0),
                      ],

                      // ── Resolved At ────────────────────────────
                      if (incident.resolvedAt != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(PhosphorIconsLight.checkCircle, size: 14, color: ObsidianTheme.careBlue),
                            const SizedBox(width: 6),
                            Text('Resolved ${_formatDateTime(incident.resolvedAt!)}',
                                style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.careBlue)),
                          ],
                        ),
                      ],

                      const SizedBox(height: 24),

                      // ── Status Update Section ──────────────────
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: c.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('UPDATE STATUS',
                                style: GoogleFonts.jetBrainsMono(
                                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                            const SizedBox(height: 12),

                            // ── Status Selector Chips ────────────
                            Wrap(
                              spacing: 6,
                              runSpacing: 8,
                              children: IncidentStatus.values.map((status) {
                                final isSelected = effectiveSelected == status;
                                final color = _statusColor(status);
                                return GestureDetector(
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    setState(() => _selectedStatus = status);
                                  },
                                  child: AnimatedContainer(
                                    duration: ObsidianTheme.fast,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isSelected ? color.withValues(alpha: 0.15) : Colors.transparent,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isSelected ? color.withValues(alpha: 0.4) : c.border,
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(_statusIcon(status), size: 14, color: isSelected ? color : c.textTertiary),
                                        const SizedBox(width: 6),
                                        Text(
                                          status.label,
                                          style: GoogleFonts.inter(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: isSelected ? color : c.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),

                            // ── Resolution Notes Field ───────────
                            if (showResolutionField) ...[
                              const SizedBox(height: 14),
                              Text('RESOLUTION NOTES',
                                  style: GoogleFonts.jetBrainsMono(
                                      fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                              const SizedBox(height: 6),
                              Container(
                                decoration: BoxDecoration(
                                  color: c.surfaceSecondary,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: c.border),
                                ),
                                child: TextField(
                                  controller: _resolutionNotesCtrl,
                                  maxLines: 3,
                                  style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
                                  decoration: InputDecoration(
                                    hintText: 'Describe how this incident was resolved...',
                                    hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                                    border: InputBorder.none,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  ),
                                ),
                              ),
                            ],

                            const SizedBox(height: 16),

                            // ── Update Button ────────────────────
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: (_updating || _selectedStatus == null || _selectedStatus == incident.status)
                                    ? null
                                    : () => _updateStatus(incident),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _selectedStatus != null && _selectedStatus != incident.status
                                      ? _statusColor(_selectedStatus!)
                                      : c.surfaceSecondary,
                                  foregroundColor: _selectedStatus != null && _selectedStatus != incident.status
                                      ? Colors.white
                                      : c.textDisabled,
                                  disabledBackgroundColor: c.surfaceSecondary,
                                  disabledForegroundColor: c.textDisabled,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  elevation: 0,
                                ),
                                child: _updating
                                    ? const SizedBox(width: 20, height: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : Text('UPDATE STATUS',
                                        style: GoogleFonts.jetBrainsMono(
                                            fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1)),
                              ),
                            ),
                          ],
                        ),
                      ).animate().fadeIn(delay: 300.ms, duration: 300.ms).moveY(begin: 12, end: 0),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _formatDateTime(DateTime dt) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}, $hour:$minute';
  }
}

// ═══════════════════════════════════════════════════════════
// ── Detail Section Widget ────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _DetailSection extends StatelessWidget {
  final String label;
  final Widget child;
  final Color? accentColor;

  const _DetailSection({required this.label, required this.child, this.accentColor});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accentColor?.withValues(alpha: 0.2) ?? c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (accentColor != null) ...[
                Container(
                  width: 3,
                  height: 12,
                  decoration: BoxDecoration(
                    color: accentColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Text(label,
                  style: GoogleFonts.jetBrainsMono(
                      fontSize: 11, fontWeight: FontWeight.w600, color: accentColor ?? c.textTertiary, letterSpacing: 0.8)),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Meta Row Widget ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _MetaRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      children: [
        Icon(icon, size: 16, color: c.textTertiary),
        const SizedBox(width: 10),
        Text(label, style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
        const Spacer(),
        Flexible(
          child: Text(value,
              style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: c.textPrimary),
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
