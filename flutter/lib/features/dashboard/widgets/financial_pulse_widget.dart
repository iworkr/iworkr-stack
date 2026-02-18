import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/state_machine_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Financial Pulse — real-time revenue vs outstanding debt visualization.
class FinancialPulseWidget extends ConsumerWidget {
  final bool expanded;
  const FinancialPulseWidget({super.key, this.expanded = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgIdAsync = ref.watch(organizationIdProvider);

    return orgIdAsync.when(
      loading: () => const _PulseShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (orgId) {
        if (orgId == null) return const SizedBox.shrink();
        return _PulseContent(orgId: orgId, expanded: expanded);
      },
    );
  }
}

class _PulseContent extends ConsumerWidget {
  final String orgId;
  final bool expanded;
  const _PulseContent({required this.orgId, required this.expanded});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pulseAsync = ref.watch(financialPulseProvider(orgId));

    return pulseAsync.when(
      loading: () => const _PulseShimmer(),
      error: (_, __) => const SizedBox.shrink(),
      data: (pulse) => _PulseView(pulse: pulse, expanded: expanded),
    );
  }
}

class _PulseView extends StatefulWidget {
  final Map<String, double> pulse;
  final bool expanded;
  const _PulseView({required this.pulse, required this.expanded});

  @override
  State<_PulseView> createState() => _PulseViewState();
}

class _PulseViewState extends State<_PulseView>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final collected = widget.pulse['collected'] ?? 0;
    final outstanding = widget.pulse['outstanding'] ?? 0;
    final rate = widget.pulse['collection_rate'] ?? 100;
    final fmt = NumberFormat.currency(symbol: '\$', decimalDigits: 0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(PhosphorIconsLight.heartbeat, size: 12, color: ObsidianTheme.emerald),
            const SizedBox(width: 6),
            Text(
              'FINANCIAL PULSE',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.textTertiary,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
        SizedBox(height: widget.expanded ? 16 : 10),
        // Collection rate arc
        Center(
          child: SizedBox(
            width: widget.expanded ? 100 : 70,
            height: widget.expanded ? 56 : 40,
            child: AnimatedBuilder(
              animation: _ctrl,
              builder: (_, __) => CustomPaint(
                painter: _CollectionArcPainter(
                  rate: rate * _ctrl.value,
                  collected: collected,
                  outstanding: outstanding,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            '${(rate * _ctrl.value).toStringAsFixed(0)}%',
            style: GoogleFonts.jetBrainsMono(
              fontSize: widget.expanded ? 24 : 18,
              fontWeight: FontWeight.w700,
              color: _rateColor(rate),
              letterSpacing: -1,
            ),
          ),
        ),
        Center(
          child: Text(
            'collection rate',
            style: GoogleFonts.inter(
              fontSize: 10,
              color: ObsidianTheme.textTertiary,
            ),
          ),
        ),
        if (widget.expanded) ...[
          const SizedBox(height: 16),
          Container(height: 1, color: ObsidianTheme.border),
          const SizedBox(height: 12),
          _PulseStat(
            label: 'COLLECTED',
            value: fmt.format(collected),
            color: ObsidianTheme.emerald,
            icon: PhosphorIconsLight.checkCircle,
          ),
          const SizedBox(height: 8),
          _PulseStat(
            label: 'OUTSTANDING',
            value: fmt.format(outstanding),
            color: outstanding > 0 ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
            icon: PhosphorIconsLight.clock,
          ),
        ] else ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _MiniStat(
                label: 'IN',
                value: fmt.format(collected),
                color: ObsidianTheme.emerald,
              ),
              Container(width: 1, height: 20, color: ObsidianTheme.border),
              _MiniStat(
                label: 'OUT',
                value: fmt.format(outstanding),
                color: outstanding > 0 ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
              ),
            ],
          ),
        ],
      ],
    );
  }

  Color _rateColor(double rate) {
    if (rate >= 80) return ObsidianTheme.emerald;
    if (rate >= 50) return ObsidianTheme.amber;
    return ObsidianTheme.rose;
  }
}

class _PulseStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  const _PulseStat({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: color.withValues(alpha: 0.1),
          ),
          child: Icon(icon, size: 14, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 9,
              color: ObsidianTheme.textTertiary,
              letterSpacing: 1,
            ),
          ),
        ),
        Text(
          value,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 7,
            color: ObsidianTheme.textTertiary,
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }
}

/// Arc painter showing collection rate as a semicircular gauge.
class _CollectionArcPainter extends CustomPainter {
  final double rate;
  final double collected;
  final double outstanding;

  _CollectionArcPainter({
    required this.rate,
    required this.collected,
    required this.outstanding,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height);
    final radius = min(size.width / 2, size.height) - 4;

    // Background arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      pi,
      pi,
      false,
      Paint()
        ..color = ObsidianTheme.surface2
        ..strokeWidth = 6
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Collection arc
    final sweep = (rate / 100) * pi;
    if (sweep > 0) {
      final Color arcColor;
      if (rate >= 80) {
        arcColor = ObsidianTheme.emerald;
      } else if (rate >= 50) {
        arcColor = ObsidianTheme.amber;
      } else {
        arcColor = ObsidianTheme.rose;
      }

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        pi,
        sweep,
        false,
        Paint()
          ..color = arcColor
          ..strokeWidth = 6
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );

      // Glow
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        pi,
        sweep,
        false,
        Paint()
          ..color = arcColor.withValues(alpha: 0.2)
          ..strokeWidth = 12
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
    }
  }

  @override
  bool shouldRepaint(_CollectionArcPainter old) => old.rate != rate;
}

class _PulseShimmer extends StatelessWidget {
  const _PulseShimmer();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          color: ObsidianTheme.textTertiary,
          strokeWidth: 1.5,
        ),
      ),
    );
  }
}
