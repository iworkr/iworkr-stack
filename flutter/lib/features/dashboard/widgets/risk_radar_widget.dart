import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/state_machine_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Risk Radar — highlights operational exceptions that need immediate attention.
/// "Time to Identify Risk" target: < 5 seconds.
class RiskRadarWidget extends ConsumerWidget {
  final bool expanded;
  const RiskRadarWidget({super.key, this.expanded = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgIdAsync = ref.watch(organizationIdProvider);

    return orgIdAsync.when(
      loading: () => const _RadarShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (orgId) {
        if (orgId == null) return const SizedBox.shrink();
        return _RiskContent(orgId: orgId, expanded: expanded);
      },
    );
  }
}

class _RiskContent extends ConsumerWidget {
  final String orgId;
  final bool expanded;
  const _RiskContent({required this.orgId, required this.expanded});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overdueAsync = ref.watch(overdueJobsProvider(orgId));
    final outstandingAsync = ref.watch(outstandingInvoicesProvider(orgId));

    final overdueJobs = overdueAsync.valueOrNull ?? [];
    final outstanding = outstandingAsync.valueOrNull ?? {};
    final overdueInvoices = (outstanding['overdue_count'] as int?) ?? 0;
    final totalDebt = (outstanding['total_outstanding'] as double?) ?? 0;

    final alerts = <_Alert>[];

    if (overdueJobs.isNotEmpty) {
      alerts.add(_Alert(
        icon: PhosphorIconsBold.warning,
        color: ObsidianTheme.rose,
        title: '${overdueJobs.length} Overdue Job${overdueJobs.length > 1 ? 's' : ''}',
        subtitle: 'Past due date, not completed',
        severity: _Severity.critical,
      ));
    }

    if (overdueInvoices > 0) {
      alerts.add(_Alert(
        icon: PhosphorIconsBold.currencyCircleDollar,
        color: ObsidianTheme.amber,
        title: '$overdueInvoices Unpaid Invoice${overdueInvoices > 1 ? 's' : ''}',
        subtitle: '\$${totalDebt.toStringAsFixed(0)} outstanding',
        severity: _Severity.warning,
      ));
    }

    if (alerts.isEmpty) {
      return _AllClearState(expanded: expanded);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _PulsingIcon(color: alerts.first.color),
            const SizedBox(width: 6),
            Text(
              'RISK RADAR',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: alerts.first.color,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: alerts.first.color.withValues(alpha: 0.1),
              ),
              child: Text(
                '${alerts.length} ALERT${alerts.length > 1 ? 'S' : ''}',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 8,
                  color: alerts.first.color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...alerts.asMap().entries.map((e) {
          return _AlertRow(alert: e.value, index: e.key, expanded: expanded)
              .animate()
              .fadeIn(delay: Duration(milliseconds: 100 + e.key * 100), duration: 400.ms)
              .moveY(begin: 6, delay: Duration(milliseconds: 100 + e.key * 100), duration: 400.ms);
        }),
        if (expanded && overdueJobs.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            height: 1,
            color: ObsidianTheme.border,
          ),
          const SizedBox(height: 10),
          Text(
            'OVERDUE JOBS',
            style: GoogleFonts.jetBrainsMono(
              fontSize: 8,
              color: ObsidianTheme.textTertiary,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          ...overdueJobs.take(3).map((job) {
            final dueDate = DateTime.tryParse(job['due_date']?.toString() ?? '');
            final daysOverdue = dueDate != null
                ? DateTime.now().difference(dueDate).inDays
                : 0;

            return GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                context.push('/jobs/${job['id']}');
              },
              child: Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 3,
                      height: 24,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: ObsidianTheme.rose,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        job['title'] as String? ?? 'Untitled',
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '${daysOverdue}d',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        color: ObsidianTheme.rose,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ],
    );
  }
}

class _AlertRow extends StatelessWidget {
  final _Alert alert;
  final int index;
  final bool expanded;

  const _AlertRow({required this.alert, required this.index, required this.expanded});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: alert.color.withValues(alpha: 0.1),
              border: Border.all(color: alert.color.withValues(alpha: 0.2)),
            ),
            child: Icon(alert.icon, size: 14, color: alert.color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.title,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                if (expanded)
                  Text(
                    alert.subtitle,
                    style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                  ),
              ],
            ),
          ),
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: alert.color,
              boxShadow: [
                BoxShadow(color: alert.color.withValues(alpha: 0.4), blurRadius: 6),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AllClearState extends StatelessWidget {
  final bool expanded;
  const _AllClearState({required this.expanded});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: expanded ? MainAxisAlignment.start : MainAxisAlignment.center,
      children: [
        Row(
          children: [
            Icon(PhosphorIconsLight.shieldCheck, size: 12, color: ObsidianTheme.emerald),
            const SizedBox(width: 6),
            Text(
              'RISK RADAR',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
        SizedBox(height: expanded ? 16 : 10),
        Center(
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                ),
                child: Icon(PhosphorIconsLight.shieldCheck, size: 20, color: ObsidianTheme.emerald),
              ),
              const SizedBox(height: 8),
              Text(
                'All Clear',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: ObsidianTheme.emerald,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'No exceptions detected',
                style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
              ),
            ],
          ),
        ),
      ],
    )
        .animate()
        .fadeIn(duration: 600.ms)
        .scale(begin: const Offset(0.95, 0.95), duration: 600.ms, curve: Curves.easeOutCubic);
  }
}

/// Pulsing alert indicator
class _PulsingIcon extends StatefulWidget {
  final Color color;
  const _PulsingIcon({required this.color});

  @override
  State<_PulsingIcon> createState() => _PulsingIconState();
}

class _PulsingIconState extends State<_PulsingIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.color,
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: 0.3 + _ctrl.value * 0.4),
                blurRadius: 4 + _ctrl.value * 6,
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RadarShimmer extends StatelessWidget {
  const _RadarShimmer();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(2, (i) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Container(
          height: 32,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: ObsidianTheme.shimmerBase,
          ),
        ),
      )),
    );
  }
}

enum _Severity { critical, warning }

class _Alert {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final _Severity severity;

  const _Alert({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.severity,
  });
}
