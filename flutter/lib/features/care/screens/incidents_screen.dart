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
// ── Incidents Dashboard ──────────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: View, report, and manage clinical
// safety incidents with severity tracking.

class IncidentsScreen extends ConsumerStatefulWidget {
  const IncidentsScreen({super.key});

  @override
  ConsumerState<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends ConsumerState<IncidentsScreen> {
  IncidentSeverity? _filterSeverity;
  IncidentStatus? _filterStatus;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final incidentsAsync = ref.watch(incidentsStreamProvider);
    final stats = ref.watch(incidentStatsProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showReportSheet(context),
        backgroundColor: ObsidianTheme.careBlue,
        child: const Icon(PhosphorIconsFill.plus, color: Colors.white, size: 24),
      ),
      body: CustomScrollView(
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
              'Incidents',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Stats Row ────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  _StatCard(label: 'Open', value: stats.open, color: ObsidianTheme.amber),
                  const SizedBox(width: 8),
                  _StatCard(label: 'Critical', value: stats.critical, color: ObsidianTheme.rose),
                  const SizedBox(width: 8),
                  _StatCard(label: 'Resolved', value: stats.resolved, color: ObsidianTheme.careBlue),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
          ),

          // ── Filter Chips ─────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _ToggleChip(
                      label: 'All',
                      isActive: _filterSeverity == null && _filterStatus == null,
                      onTap: () => setState(() { _filterSeverity = null; _filterStatus = null; }),
                    ),
                    const SizedBox(width: 6),
                    for (final sev in IncidentSeverity.values) ...[
                      _ToggleChip(
                        label: sev.label,
                        isActive: _filterSeverity == sev,
                        color: _severityColor(sev),
                        onTap: () => setState(() {
                          _filterSeverity = _filterSeverity == sev ? null : sev;
                        }),
                      ),
                      const SizedBox(width: 6),
                    ],
                  ],
                ),
              ),
            ),
          ),

          // ── Incident List ──────────────────────────────
          incidentsAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: TextStyle(color: c.textTertiary))),
            ),
            data: (incidents) {
              var filtered = incidents;
              if (_filterSeverity != null) {
                filtered = filtered.where((i) => i.severity == _filterSeverity).toList();
              }
              if (_filterStatus != null) {
                filtered = filtered.where((i) => i.status == _filterStatus).toList();
              }

              if (filtered.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.shieldCheck, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text('No incidents reported', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
                      ],
                    ),
                  ),
                );
              }

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                sliver: SliverList.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final incident = filtered[index];
                    return _IncidentCard(incident: incident)
                        .animate()
                        .fadeIn(delay: (index * 30).ms, duration: 300.ms)
                        .moveY(begin: 12, end: 0);
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Color _severityColor(IncidentSeverity sev) => switch (sev) {
    IncidentSeverity.low => ObsidianTheme.blue,
    IncidentSeverity.medium => ObsidianTheme.amber,
    IncidentSeverity.high => ObsidianTheme.rose.withValues(alpha: 0.8),
    IncidentSeverity.critical => ObsidianTheme.rose,
  };

  void _showReportSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ReportIncidentSheet(),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          children: [
            Text('$value', style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
          ],
        ),
      ),
    );
  }
}

class _ToggleChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final Color? color;
  final VoidCallback onTap;
  const _ToggleChip({required this.label, required this.isActive, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final activeColor = color ?? ObsidianTheme.careBlue;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? activeColor.withValues(alpha: 0.15) : c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isActive ? activeColor.withValues(alpha: 0.4) : c.border),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: isActive ? activeColor : c.textSecondary),
        ),
      ),
    );
  }
}

class _IncidentCard extends StatelessWidget {
  final Incident incident;
  const _IncidentCard({required this.incident});

  Color _severityColor() => switch (incident.severity) {
    IncidentSeverity.low => ObsidianTheme.blue,
    IncidentSeverity.medium => ObsidianTheme.amber,
    IncidentSeverity.high => ObsidianTheme.rose.withValues(alpha: 0.8),
    IncidentSeverity.critical => ObsidianTheme.rose,
  };

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final sevColor = _severityColor();

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/care/incidents/${incident.id}');
      },
      child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: incident.severity == IncidentSeverity.critical
            ? ObsidianTheme.rose.withValues(alpha: 0.3) : c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(shape: BoxShape.circle, color: sevColor),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  incident.title,
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: sevColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  incident.severity.label.toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: sevColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            incident.description,
            style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _MetaItem(icon: PhosphorIconsLight.tag, text: incident.category.label, color: c.textTertiary),
              const SizedBox(width: 12),
              _MetaItem(icon: PhosphorIconsLight.clock, text: _timeAgo(incident.occurredAt), color: c.textTertiary),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: c.border),
                ),
                child: Text(
                  incident.status.label,
                  style: GoogleFonts.inter(fontSize: 11, color: c.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

class _MetaItem extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;
  const _MetaItem({required this.icon, required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(text, style: GoogleFonts.inter(fontSize: 12, color: color)),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Report Incident Bottom Sheet ─────────────────────────
// ═══════════════════════════════════════════════════════════

class _ReportIncidentSheet extends ConsumerStatefulWidget {
  const _ReportIncidentSheet();

  @override
  ConsumerState<_ReportIncidentSheet> createState() => _ReportIncidentSheetState();
}

class _ReportIncidentSheetState extends ConsumerState<_ReportIncidentSheet> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _actionsCtrl = TextEditingController();
  IncidentCategory _category = IncidentCategory.other;
  IncidentSeverity _severity = IncidentSeverity.medium;
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _actionsCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty || _descCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);

    await createIncident(
      title: _titleCtrl.text.trim(),
      description: _descCtrl.text.trim(),
      category: _category,
      severity: _severity,
      immediateActions: _actionsCtrl.text.trim().isNotEmpty ? _actionsCtrl.text.trim() : null,
    );

    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: BoxDecoration(
        color: c.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: c.borderMedium, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Text('Report Incident', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 20),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _StealthField(controller: _titleCtrl, label: 'Title', hint: 'Brief description of incident'),
                const SizedBox(height: 12),
                _StealthField(controller: _descCtrl, label: 'Description', hint: 'What happened?', maxLines: 4),
                const SizedBox(height: 12),
                // Category selector
                Text('Category', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: IncidentCategory.values.map((cat) => GestureDetector(
                    onTap: () => setState(() => _category = cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: _category == cat ? ObsidianTheme.careBlue.withValues(alpha: 0.15) : c.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _category == cat ? ObsidianTheme.careBlue.withValues(alpha: 0.4) : c.border,
                        ),
                      ),
                      child: Text(cat.label, style: GoogleFonts.inter(fontSize: 13,
                          color: _category == cat ? ObsidianTheme.careBlue : c.textSecondary)),
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 12),
                // Severity selector
                Text('Severity', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary)),
                const SizedBox(height: 6),
                Row(
                  children: IncidentSeverity.values.map((sev) {
                    final sevColor = switch (sev) {
                      IncidentSeverity.low => ObsidianTheme.blue,
                      IncidentSeverity.medium => ObsidianTheme.amber,
                      IncidentSeverity.high => ObsidianTheme.rose.withValues(alpha: 0.8),
                      IncidentSeverity.critical => ObsidianTheme.rose,
                    };
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _severity = sev),
                        child: Container(
                          margin: const EdgeInsets.only(right: 6),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _severity == sev ? sevColor.withValues(alpha: 0.15) : c.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _severity == sev ? sevColor.withValues(alpha: 0.4) : c.border,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(sev.label, style: GoogleFonts.inter(fontSize: 13,
                              color: _severity == sev ? sevColor : c.textSecondary)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                _StealthField(controller: _actionsCtrl, label: 'Immediate Actions Taken', hint: 'What was done right away?', maxLines: 2),
                const SizedBox(height: 24),
              ],
            ),
          ),
          // Submit
          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 20),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ObsidianTheme.rose,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('Report Incident', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StealthField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;

  const _StealthField({
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: c.border),
          ),
          child: TextField(
            controller: controller,
            maxLines: maxLines,
            style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
        ),
      ],
    );
  }
}
