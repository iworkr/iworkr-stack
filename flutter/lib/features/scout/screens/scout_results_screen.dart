import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/scout_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/site_scan.dart';

/// Scout Results — Site Health Dashboard with circular gauge,
/// breakdown scores, detection snag list, and opportunity engine.
class ScoutResultsScreen extends ConsumerStatefulWidget {
  final String scanId;
  const ScoutResultsScreen({super.key, required this.scanId});

  @override
  ConsumerState<ScoutResultsScreen> createState() => _ScoutResultsScreenState();
}

class _ScoutResultsScreenState extends ConsumerState<ScoutResultsScreen>
    with TickerProviderStateMixin {
  int _tabIndex = 0; // 0=Health, 1=Detections, 2=Opportunities
  late AnimationController _gaugeAnim;

  @override
  void initState() {
    super.initState();
    _gaugeAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))
      ..forward();
  }

  @override
  void dispose() {
    _gaugeAnim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildTabs(),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _tabIndex == 0
                    ? _HealthTab(key: const ValueKey(0), scanId: widget.scanId, gaugeAnim: _gaugeAnim)
                    : _tabIndex == 1
                        ? _DetectionsTab(key: const ValueKey(1), scanId: widget.scanId)
                        : _OpportunitiesTab(key: const ValueKey(2), scanId: widget.scanId),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 20),
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SITE REPORT',
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'Scout Analysis Results',
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildTabs() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: Colors.white.withValues(alpha: 0.03),
      ),
      child: Row(
        children: [
          _Tab(label: 'HEALTH', active: _tabIndex == 0, onTap: () => setState(() => _tabIndex = 0)),
          _Tab(label: 'DETECTIONS', active: _tabIndex == 1, onTap: () => setState(() => _tabIndex = 1)),
          _Tab(label: 'REVENUE', active: _tabIndex == 2, onTap: () => setState(() => _tabIndex = 2)),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 300.ms);
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Tab({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: active ? Colors.white.withValues(alpha: 0.06) : Colors.transparent,
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                color: active ? Colors.white : ObsidianTheme.textTertiary,
                fontSize: 9,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                letterSpacing: 1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Health Tab ───────────────────────────────────────
class _HealthTab extends ConsumerWidget {
  final String scanId;
  final AnimationController gaugeAnim;
  const _HealthTab({super.key, required this.scanId, required this.gaugeAnim});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthAsync = ref.watch(scanHealthProvider(scanId));

    return healthAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.gold, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (score) {
        if (score == null) {
          return Center(
            child: Text(
              'No health data available',
              style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          children: [
            // Circular gauge
            Center(
              child: SizedBox(
                width: 200,
                height: 200,
                child: AnimatedBuilder(
                  animation: gaugeAnim,
                  builder: (context, child) {
                    return CustomPaint(
                      painter: _HealthGaugePainter(
                        score: score.overallScore,
                        grade: score.grade,
                        progress: gaugeAnim.value,
                      ),
                    );
                  },
                ),
              ),
            )
                .animate()
                .fadeIn(delay: 200.ms, duration: 500.ms)
                .scaleXY(begin: 0.9, delay: 200.ms, duration: 500.ms, curve: Curves.easeOutCubic),

            const SizedBox(height: 24),

            // Breakdown scores
            _ScoreBar(label: 'SAFETY', score: score.safetyScore, color: _scoreColor(score.safetyScore), delay: 400),
            _ScoreBar(label: 'EFFICIENCY', score: score.efficiencyScore, color: _scoreColor(score.efficiencyScore), delay: 500),
            _ScoreBar(label: 'COMPLIANCE', score: score.complianceScore, color: _scoreColor(score.complianceScore), delay: 600),

            const SizedBox(height: 24),

            // Summary stats
            Row(
              children: [
                _SummaryChip(label: 'DETECTIONS', value: '${score.totalDetections}', color: ObsidianTheme.textSecondary),
                const SizedBox(width: 8),
                _SummaryChip(label: 'CRITICAL', value: '${score.criticalCount}', color: ObsidianTheme.rose),
                const SizedBox(width: 8),
                _SummaryChip(label: 'POTENTIAL', value: '\$${score.totalOpportunityValue.toStringAsFixed(0)}', color: ObsidianTheme.gold),
              ],
            )
                .animate()
                .fadeIn(delay: 700.ms, duration: 400.ms),
          ],
        );
      },
    );
  }

  Color _scoreColor(int score) {
    if (score >= 80) return ObsidianTheme.emerald;
    if (score >= 60) return ObsidianTheme.amber;
    return ObsidianTheme.rose;
  }
}

class _ScoreBar extends StatelessWidget {
  final String label;
  final int score;
  final Color color;
  final int delay;
  const _ScoreBar({required this.label, required this.score, required this.color, required this.delay});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 9, letterSpacing: 1.5),
              ),
              const Spacer(),
              Text(
                '$score/100',
                style: GoogleFonts.jetBrainsMono(color: color, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: SizedBox(
              height: 6,
              child: LinearProgressIndicator(
                value: score / 100,
                backgroundColor: Colors.white.withValues(alpha: 0.06),
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: delay), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: delay), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _SummaryChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: color.withValues(alpha: 0.06),
          border: Border.all(color: color.withValues(alpha: 0.12)),
        ),
        child: Column(
          children: [
            Text(value, style: GoogleFonts.jetBrainsMono(color: color, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 7, letterSpacing: 1)),
          ],
        ),
      ),
    );
  }
}

// ── Detections Tab ───────────────────────────────────
class _DetectionsTab extends ConsumerWidget {
  final String scanId;
  const _DetectionsTab({super.key, required this.scanId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detsAsync = ref.watch(scanDetectionsProvider(scanId));

    return detsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: ObsidianTheme.gold, strokeWidth: 2)),
      error: (_, __) => const SizedBox.shrink(),
      data: (detections) {
        if (detections.isEmpty) {
          return Center(
            child: Text('No detections', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary)),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          itemCount: detections.length,
          itemBuilder: (context, index) {
            return _DetectionCard(detection: detections[index], index: index);
          },
        );
      },
    );
  }
}

class _DetectionCard extends StatelessWidget {
  final ScanDetection detection;
  final int index;
  const _DetectionCard({required this.detection, required this.index});

  Color get _typeColor {
    if (detection.isHazard) return ObsidianTheme.rose;
    if (detection.isOpportunity) return ObsidianTheme.gold;
    if (detection.isCritical) return ObsidianTheme.rose;
    return ObsidianTheme.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(color: _typeColor.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          // Type indicator
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: _typeColor.withValues(alpha: 0.1),
            ),
            child: Center(
              child: Text(
                detection.typeIcon,
                style: GoogleFonts.jetBrainsMono(color: _typeColor, fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  detection.label,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        color: _typeColor.withValues(alpha: 0.1),
                      ),
                      child: Text(
                        detection.conditionLabel.toUpperCase(),
                        style: GoogleFonts.jetBrainsMono(color: _typeColor, fontSize: 8, fontWeight: FontWeight.w600, letterSpacing: 0.5),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      detection.confidenceLabel,
                      style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10),
                    ),
                    if (detection.make != null) ...[
                      const SizedBox(width: 6),
                      Text(detection.make!, style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 10)),
                    ],
                    if (detection.estimatedAgeYears != null) ...[
                      const SizedBox(width: 6),
                      Text('${detection.estimatedAgeYears}yo', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (detection.opportunityValue > 0)
            Text(
              '\$${detection.opportunityValue.toStringAsFixed(0)}',
              style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.gold, fontSize: 14, fontWeight: FontWeight.w600),
            ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 60 * index), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: 60 * index), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ── Opportunities Tab ────────────────────────────────
class _OpportunitiesTab extends ConsumerWidget {
  final String scanId;
  const _OpportunitiesTab({super.key, required this.scanId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final oppsAsync = ref.watch(scanOpportunitiesProvider(scanId));

    return oppsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: ObsidianTheme.gold, strokeWidth: 2)),
      error: (_, __) => const SizedBox.shrink(),
      data: (opportunities) {
        if (opportunities.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.currencyDollar, color: ObsidianTheme.gold.withValues(alpha: 0.4), size: 32),
                const SizedBox(height: 12),
                Text('No opportunities found', style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 14)),
              ],
            ),
          );
        }

        final totalValue = opportunities.fold(0.0, (sum, o) => sum + o.estimatedValue);

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          children: [
            // Revenue hero
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: LinearGradient(
                  colors: [ObsidianTheme.gold.withValues(alpha: 0.08), ObsidianTheme.gold.withValues(alpha: 0.02)],
                ),
                border: Border.all(color: ObsidianTheme.gold.withValues(alpha: 0.15)),
              ),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('TOTAL OPPORTUNITY', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.gold.withValues(alpha: 0.7), fontSize: 9, letterSpacing: 1.5)),
                      const SizedBox(height: 4),
                      Text(
                        '\$${totalValue.toStringAsFixed(0)}',
                        style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.gold, fontSize: 32, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${opportunities.length}', style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w600)),
                      Text('ITEMS', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 8, letterSpacing: 1)),
                    ],
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms)
                .scaleXY(begin: 0.97, duration: 400.ms, curve: Curves.easeOutCubic),

            // Opportunity cards
            ...opportunities.asMap().entries.map((e) {
              return _OpportunityCard(opportunity: e.value, index: e.key, ref: ref);
            }),
          ],
        );
      },
    );
  }
}

class _OpportunityCard extends StatelessWidget {
  final ScanOpportunity opportunity;
  final int index;
  final WidgetRef ref;
  const _OpportunityCard({required this.opportunity, required this.index, required this.ref});

  @override
  Widget build(BuildContext context) {
    final isAccepted = opportunity.isAccepted;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(
          color: isAccepted
              ? ObsidianTheme.emerald.withValues(alpha: 0.15)
              : (opportunity.isCritical ? ObsidianTheme.rose.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.06)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  opportunity.title,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                ),
              ),
              Text(
                opportunity.valueLabel,
                style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.gold, fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          if (opportunity.description != null) ...[
            const SizedBox(height: 4),
            Text(opportunity.description!, style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12)),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (opportunity.isCritical)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    color: ObsidianTheme.rose.withValues(alpha: 0.1),
                  ),
                  child: Text('CRITICAL', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.rose, fontSize: 8, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                ),
              if (opportunity.roiAnnual != null)
                Text('Saves ${opportunity.roiLabel}', style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 11)),
              const Spacer(),
              if (!isAccepted && opportunity.status != 'declined') ...[
                GestureDetector(
                  onTap: () async {
                    HapticFeedback.mediumImpact();
                    await acceptOpportunity(opportunity.id);
                    ref.invalidate(scanOpportunitiesProvider(opportunity.scanId));
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: ObsidianTheme.gold.withValues(alpha: 0.1),
                      border: Border.all(color: ObsidianTheme.gold.withValues(alpha: 0.2)),
                    ),
                    child: Text('Add to Quote', style: GoogleFonts.inter(color: ObsidianTheme.gold, fontSize: 11, fontWeight: FontWeight.w500)),
                  ),
                ),
              ] else if (isAccepted)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsBold.check, size: 10, color: ObsidianTheme.emerald),
                      const SizedBox(width: 4),
                      Text('Quoted', style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 11, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 100 + index * 70), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: 100 + index * 70), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

/// Circular health gauge painter — FICO-style score display
class _HealthGaugePainter extends CustomPainter {
  final int score;
  final String grade;
  final double progress;

  _HealthGaugePainter({required this.score, required this.grade, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 12;

    // Background arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi * 0.75,
      math.pi * 1.5,
      false,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.06)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8
        ..strokeCap = StrokeCap.round,
    );

    // Score arc (animated)
    final scoreAngle = (score / 100) * math.pi * 1.5 * progress;
    final color = score >= 80
        ? ObsidianTheme.emerald
        : (score >= 60 ? ObsidianTheme.amber : ObsidianTheme.rose);

    // Glow arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi * 0.75,
      scoreAngle,
      false,
      Paint()
        ..color = color.withValues(alpha: 0.15)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 14
        ..strokeCap = StrokeCap.round,
    );

    // Main arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi * 0.75,
      scoreAngle,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8
        ..strokeCap = StrokeCap.round,
    );

    // Score text
    final displayScore = (score * progress).round();
    final scoreTp = TextPainter(
      text: TextSpan(
        text: '$displayScore',
        style: TextStyle(
          color: Colors.white,
          fontSize: 42,
          fontWeight: FontWeight.w700,
          fontFamily: 'JetBrains Mono',
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    scoreTp.paint(canvas, Offset(center.dx - scoreTp.width / 2, center.dy - scoreTp.height / 2 - 6));

    // Grade text
    final gradeTp = TextPainter(
      text: TextSpan(
        text: 'Grade $grade',
        style: TextStyle(
          color: color.withValues(alpha: 0.8),
          fontSize: 12,
          fontWeight: FontWeight.w500,
          letterSpacing: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    gradeTp.paint(canvas, Offset(center.dx - gradeTp.width / 2, center.dy + 22));
  }

  @override
  bool shouldRepaint(covariant _HealthGaugePainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.score != score;
}
