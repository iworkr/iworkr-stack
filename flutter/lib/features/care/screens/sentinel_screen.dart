import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/sentinel_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/sentinel_alert.dart';

// ═══════════════════════════════════════════════════════════
// ── Sentinel — Risk Radar Dashboard ──────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale Phase 4: Automated risk detection and
// alert triage. NLP keyword scanning, health baseline drift,
// medication compliance, credential expiry, and budget overrun
// alerts surfaced in real-time with severity-based routing.

class SentinelScreen extends ConsumerStatefulWidget {
  const SentinelScreen({super.key});

  @override
  ConsumerState<SentinelScreen> createState() => _SentinelScreenState();
}

class _SentinelScreenState extends ConsumerState<SentinelScreen> {
  SentinelSeverity? _filterSeverity;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final alertsAsync = ref.watch(sentinelAlertsStreamProvider);
    final stats = ref.watch(sentinelStatsProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: false,
            expandedHeight: 100,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).maybePop();
              },
              child: Center(
                child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22),
              ),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: FlexibleSpaceBar(
                  titlePadding: const EdgeInsets.only(left: 56, bottom: 14),
                  title: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RISK RADAR',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: ObsidianTheme.careBlue,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Sentinel',
                        style: GoogleFonts.inter(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: c.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ],
                  ),
                  background: Container(color: c.canvas.withValues(alpha: 0.85)),
                ),
              ),
            ),
            actions: [
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  // INCOMPLETE:TODO(Sentinel settings and scan history route not wired yet; action button is currently non-functional).
                },
                child: Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: Icon(PhosphorIconsLight.gear, color: c.textSecondary, size: 22),
                ),
              ),
            ],
          ),

          // ── Summary Stats Row ─────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  _SummaryStatCard(
                    label: 'Critical',
                    value: stats.critical,
                    icon: PhosphorIconsLight.warning,
                    color: ObsidianTheme.rose,
                    isCritical: true,
                  ),
                  const SizedBox(width: 8),
                  _SummaryStatCard(
                    label: 'Warnings',
                    value: stats.warnings,
                    icon: PhosphorIconsLight.shieldWarning,
                    color: ObsidianTheme.amber,
                  ),
                  const SizedBox(width: 8),
                  _SummaryStatCard(
                    label: 'Info',
                    value: stats.info,
                    icon: PhosphorIconsLight.info,
                    color: ObsidianTheme.blue,
                  ),
                  const SizedBox(width: 8),
                  _SummaryStatCard(
                    label: 'Active',
                    value: stats.active,
                    icon: PhosphorIconsLight.pulse,
                    color: ObsidianTheme.careBlue,
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
          ),

          // ── Filter Chips ──────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'All Active',
                      isActive: _filterSeverity == null,
                      onTap: () => setState(() => _filterSeverity = null),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Critical',
                      isActive: _filterSeverity == SentinelSeverity.critical,
                      color: ObsidianTheme.rose,
                      onTap: () => setState(() {
                        _filterSeverity = _filterSeverity == SentinelSeverity.critical
                            ? null
                            : SentinelSeverity.critical;
                      }),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Warnings',
                      isActive: _filterSeverity == SentinelSeverity.warning,
                      color: ObsidianTheme.amber,
                      onTap: () => setState(() {
                        _filterSeverity = _filterSeverity == SentinelSeverity.warning
                            ? null
                            : SentinelSeverity.warning;
                      }),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Info',
                      isActive: _filterSeverity == SentinelSeverity.info,
                      color: ObsidianTheme.blue,
                      onTap: () => setState(() {
                        _filterSeverity = _filterSeverity == SentinelSeverity.info
                            ? null
                            : SentinelSeverity.info;
                      }),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Alert Cards List ──────────────────────────
          alertsAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(
                child: Text('Error loading alerts: $e', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 14)),
              ),
            ),
            data: (allAlerts) {
              // Filter to active alerts, then by severity if selected
              var filtered = allAlerts.where((a) => a.isActive).toList();
              if (_filterSeverity != null) {
                filtered = filtered.where((a) => a.severity == _filterSeverity).toList();
              }

              if (filtered.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.shieldCheck, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text(
                          _filterSeverity != null ? 'No ${_filterSeverity!.label.toLowerCase()} alerts' : 'All clear — no active alerts',
                          style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Sentinel is monitoring in real-time',
                          style: GoogleFonts.inter(color: c.textDisabled, fontSize: 13),
                        ),
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
                    final alert = filtered[index];
                    return _SentinelAlertCard(
                      alert: alert,
                      onTap: () => _showAlertActionSheet(context, alert),
                    )
                        .animate()
                        .fadeIn(delay: (index * 50).ms, duration: 300.ms)
                        .moveY(begin: 10, end: 0);
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showAlertActionSheet(BuildContext context, SentinelAlert alert) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AlertActionSheet(alert: alert),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Summary Stat Card ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _SummaryStatCard extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  final bool isCritical;

  const _SummaryStatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.isCritical = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final card = Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isCritical && value > 0 ? color.withValues(alpha: 0.3) : c.border,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color.withValues(alpha: 0.7)),
            const SizedBox(height: 6),
            Text(
              '$value',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: value > 0 ? color : c.textTertiary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );

    // Breathing glow for critical when count > 0
    if (isCritical && value > 0) {
      return Expanded(
        child: _BreathingGlow(
          color: color,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Icon(icon, size: 18, color: color.withValues(alpha: 0.7)),
                const SizedBox(height: 6),
                Text(
                  '$value',
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: color,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return card;
  }
}

// ═══════════════════════════════════════════════════════════
// ── Breathing Glow Animation ─────────────────────────────
// ═══════════════════════════════════════════════════════════

class _BreathingGlow extends StatefulWidget {
  final Widget child;
  final Color color;

  const _BreathingGlow({required this.child, required this.color});

  @override
  State<_BreathingGlow> createState() => _BreathingGlowState();
}

class _BreathingGlowState extends State<_BreathingGlow> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.0, end: 0.12).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: _opacity.value),
                blurRadius: 16,
                spreadRadius: 2,
              ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Filter Chip ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isActive,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final activeColor = color ?? ObsidianTheme.careBlue;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? activeColor.withValues(alpha: 0.15) : c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? activeColor.withValues(alpha: 0.4) : c.border,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: isActive ? activeColor : c.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Sentinel Alert Card ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _SentinelAlertCard extends StatelessWidget {
  final SentinelAlert alert;
  final VoidCallback onTap;

  const _SentinelAlertCard({required this.alert, required this.onTap});

  Color get _severityColor => switch (alert.severity) {
    SentinelSeverity.critical => ObsidianTheme.rose,
    SentinelSeverity.warning => ObsidianTheme.amber,
    SentinelSeverity.info => ObsidianTheme.blue,
  };

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final sevColor = _severityColor;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: alert.isCritical ? sevColor.withValues(alpha: 0.3) : c.border,
          ),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Severity side bar ──
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: sevColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    bottomLeft: Radius.circular(12),
                  ),
                ),
              ),

              // ── Content ──
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title row
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              alert.title,
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: c.textPrimary,
                                letterSpacing: -0.3,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: sevColor.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              alert.severity.label.toUpperCase(),
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: sevColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Alert type label
                      Text(
                        alert.alertTypeLabel,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: c.textTertiary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Description
                      Text(
                        alert.description,
                        style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      // Triggered keywords pills
                      if (alert.hasKeywords) ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: alert.triggeredKeywords.take(5).map((kw) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: ObsidianTheme.roseDim,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                kw,
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 10,
                                  color: ObsidianTheme.rose.withValues(alpha: 0.9),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],

                      const SizedBox(height: 8),

                      // Bottom metadata row
                      Row(
                        children: [
                          if (alert.participantName != null) ...[
                            Icon(PhosphorIconsLight.user, size: 13, color: c.textTertiary),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                alert.participantName!,
                                style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 12),
                          ],
                          Icon(PhosphorIconsLight.clock, size: 13, color: c.textTertiary),
                          const SizedBox(width: 4),
                          Text(
                            _relativeTime(alert.createdAt),
                            style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                          ),
                          const Spacer(),
                          Icon(PhosphorIconsLight.caretRight, size: 16, color: c.textDisabled),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Alert Action Sheet ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _AlertActionSheet extends StatefulWidget {
  final SentinelAlert alert;
  const _AlertActionSheet({required this.alert});

  @override
  State<_AlertActionSheet> createState() => _AlertActionSheetState();
}

class _AlertActionSheetState extends State<_AlertActionSheet> {
  final _dismissReasonCtrl = TextEditingController();
  bool _showDismissField = false;
  bool _processing = false;

  SentinelAlert get alert => widget.alert;

  Color get _severityColor => switch (alert.severity) {
    SentinelSeverity.critical => ObsidianTheme.rose,
    SentinelSeverity.warning => ObsidianTheme.amber,
    SentinelSeverity.info => ObsidianTheme.blue,
  };

  @override
  void dispose() {
    _dismissReasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _acknowledge() async {
    setState(() => _processing = true);
    await acknowledgeSentinelAlert(alertId: alert.id);
    if (mounted) {
      Navigator.pop(context);
      _showSnackbar('Alert acknowledged');
    }
  }

  Future<void> _dismiss() async {
    final reason = _dismissReasonCtrl.text.trim();
    if (reason.isEmpty) return;
    setState(() => _processing = true);
    await dismissSentinelAlert(alertId: alert.id, reason: reason);
    if (mounted) {
      Navigator.pop(context);
      _showSnackbar('Alert dismissed as false positive');
    }
  }

  Future<void> _escalate() async {
    setState(() => _processing = true);
    await escalateSentinelAlert(alertId: alert.id);
    if (mounted) {
      Navigator.pop(context);
      _showSnackbar('Alert escalated to clinical team');
    }
  }

  void _createIncident() {
    HapticFeedback.mediumImpact();
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Incident creation coming soon',
          style: GoogleFonts.inter(fontSize: 14),
        ),
        backgroundColor: ObsidianTheme.rose.withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _showSnackbar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.inter(fontSize: 14)),
        backgroundColor: ObsidianTheme.careBlue.withValues(alpha: 0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final sevColor = _severityColor;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: c.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Handle ──
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: c.borderMedium,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // ── Header ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 32,
                  decoration: BoxDecoration(
                    color: sevColor,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        alert.severity.label.toUpperCase(),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: sevColor,
                          letterSpacing: 1.0,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        alert.title,
                        style: GoogleFonts.inter(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: c.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Scrollable content ──
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                // Alert type + time
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: c.border),
                      ),
                      child: Text(
                        alert.alertTypeLabel,
                        style: GoogleFonts.inter(fontSize: 12, color: c.textSecondary, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const Spacer(),
                    Icon(PhosphorIconsLight.clock, size: 14, color: c.textTertiary),
                    const SizedBox(width: 4),
                    Text(
                      _relativeTime(alert.createdAt),
                      style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Description
                Text(
                  alert.description,
                  style: GoogleFonts.inter(fontSize: 14, color: c.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 16),

                // Participant
                if (alert.participantName != null) ...[
                  _DetailRow(
                    icon: PhosphorIconsLight.user,
                    label: 'Participant',
                    value: alert.participantName!,
                  ),
                  const SizedBox(height: 8),
                ],

                // Worker
                if (alert.workerName != null) ...[
                  _DetailRow(
                    icon: PhosphorIconsLight.userCircle,
                    label: 'Worker',
                    value: alert.workerName!,
                  ),
                  const SizedBox(height: 8),
                ],

                // Status
                _DetailRow(
                  icon: PhosphorIconsLight.circleHalf,
                  label: 'Status',
                  value: alert.status.label,
                ),
                const SizedBox(height: 16),

                // Triggered keywords
                if (alert.hasKeywords) ...[
                  Text(
                    'TRIGGERED KEYWORDS',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: c.textTertiary,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: alert.triggeredKeywords.map((kw) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: ObsidianTheme.roseDim,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.25)),
                        ),
                        child: Text(
                          kw,
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: ObsidianTheme.rose.withValues(alpha: 0.9),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                ],

                // Dismiss field (revealed on tap)
                if (_showDismissField) ...[
                  Container(
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: c.border),
                    ),
                    child: TextField(
                      controller: _dismissReasonCtrl,
                      autofocus: true,
                      maxLines: 2,
                      style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Reason for dismissal…',
                        hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: _processing ? null : _dismiss,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: c.surface,
                        foregroundColor: c.textPrimary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: BorderSide(color: c.border),
                        ),
                        elevation: 0,
                      ),
                      child: _processing
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text('Confirm Dismiss', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500)),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Action Buttons ──
                if (!_showDismissField) ...[
                  // Acknowledge (only if still active)
                  if (alert.isActive) ...[
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: _processing ? null : _acknowledge,
                        icon: Icon(PhosphorIconsLight.checkCircle, size: 18, color: Colors.white.withValues(alpha: 0.9)),
                        label: Text('Acknowledge', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: ObsidianTheme.careBlue,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Create Incident
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _processing ? null : _createIncident,
                      icon: Icon(PhosphorIconsLight.warningOctagon, size: 18, color: Colors.white.withValues(alpha: 0.9)),
                      label: Text('Create Incident', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ObsidianTheme.rose,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Escalate
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _processing ? null : _escalate,
                      icon: Icon(PhosphorIconsLight.arrowUp, size: 18, color: Colors.white.withValues(alpha: 0.9)),
                      label: Text('Escalate', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ObsidianTheme.amber,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Dismiss — False Positive
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _processing
                          ? null
                          : () {
                              HapticFeedback.lightImpact();
                              setState(() => _showDismissField = true);
                            },
                      icon: Icon(PhosphorIconsLight.xCircle, size: 18, color: c.textSecondary),
                      label: Text(
                        'Dismiss — False Positive',
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: c.border),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ],
            ),
          ),

          // Bottom safe area
          SizedBox(height: MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Detail Row ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      children: [
        Icon(icon, size: 16, color: c.textTertiary),
        const SizedBox(width: 8),
        Text(
          '$label:',
          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary, fontWeight: FontWeight.w500),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

String _relativeTime(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
  return '${dt.day}/${dt.month}/${dt.year}';
}
