import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/services/market_intelligence_provider.dart';
import 'package:iworkr_mobile/models/market_benchmark.dart';
import 'package:iworkr_mobile/models/market_trend.dart';

class MarketIndexScreen extends ConsumerStatefulWidget {
  const MarketIndexScreen({super.key});

  @override
  ConsumerState<MarketIndexScreen> createState() => _MarketIndexScreenState();
}

class _MarketIndexScreenState extends ConsumerState<MarketIndexScreen>
    with TickerProviderStateMixin {
  String _selectedCategory = 'hvac_install';
  late AnimationController _bellCurveAnim;
  late AnimationController _pulseAnim;

  @override
  void initState() {
    super.initState();
    _bellCurveAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..forward();
    _pulseAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bellCurveAnim.dispose();
    _pulseAnim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final benchmarkAsync = ref.watch(
      marketBenchmarkProvider(MarketQuery(category: _selectedCategory)),
    );
    final trendsAsync = ref.watch(marketTrendsProvider(_selectedCategory));
    final categoriesAsync = ref.watch(serviceCategoriesProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                children: [
                  categoriesAsync.when(
                    data: (cats) => _buildCategorySelector(cats),
                    loading: () => const SizedBox(height: 40),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 24),

                  benchmarkAsync.when(
                    data: (b) => b != null
                        ? _buildBellCurveSection(b)
                        : _buildEmptyState(),
                    loading: () => _buildShimmerCard(),
                    error: (_, __) => _buildEmptyState(),
                  ),

                  const SizedBox(height: 20),

                  benchmarkAsync.when(
                    data: (b) => b != null
                        ? _buildMetricsRow(b)
                        : const SizedBox.shrink(),
                    loading: () => const SizedBox(height: 80),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 20),

                  trendsAsync.when(
                    data: (trends) => trends.isNotEmpty
                        ? _buildTrendSection(trends)
                        : const SizedBox.shrink(),
                    loading: () => _buildShimmerCard(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 20),

                  benchmarkAsync.when(
                    data: (b) => b != null
                        ? _buildWinRateSection(b)
                        : const SizedBox.shrink(),
                    loading: () => const SizedBox(height: 80),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 20),

                  _buildPrivacyNotice(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header ───────────────────────────────────────────

  Widget _buildHeader() {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).pop();
            },
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: c.hoverBg,
                border: Border.all(color: c.border),
              ),
              child: Center(
                child: Icon(PhosphorIconsLight.arrowLeft,
                    size: 16, color: c.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'The Index',
                  style: GoogleFonts.inter(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  'Market Intelligence',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: c.textMuted,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusFull,
              gradient: const LinearGradient(
                colors: [ObsidianTheme.amber, ObsidianTheme.emerald, ObsidianTheme.violet],
              ),
            ),
            child: Text(
              'PRO',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 1,
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  // ── Category Selector ────────────────────────────────

  Widget _buildCategorySelector(List<String> categories) {
    final c = context.iColors;
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final cat = categories[i];
          final selected = cat == _selectedCategory;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _selectedCategory = cat);
              _bellCurveAnim.forward(from: 0);
            },
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusFull,
                color: selected ? ObsidianTheme.emerald.withValues(alpha: 0.12) : c.surface,
                border: Border.all(
                  color: selected ? ObsidianTheme.emerald.withValues(alpha: 0.3) : c.border,
                ),
              ),
              child: Text(
                categoryLabel(cat),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected ? ObsidianTheme.emerald : c.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    ).animate().fadeIn(delay: 100.ms, duration: 400.ms);
  }

  // ── Bell Curve ───────────────────────────────────────

  Widget _buildBellCurveSection(MarketBenchmark benchmark) {
    final c = context.iColors;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIconsLight.chartBar, size: 14, color: ObsidianTheme.emerald),
              const SizedBox(width: 6),
              Text(
                'PRICE DISTRIBUTION',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: c.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Text(
                '${benchmark.sampleSize} quotes',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: c.textTertiary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          AnimatedBuilder(
            animation: _bellCurveAnim,
            builder: (context, _) {
              return SizedBox(
                height: 160,
                child: CustomPaint(
                  size: const Size(double.infinity, 160),
                  painter: _BellCurvePainter(
                    benchmark: benchmark,
                    progress: Curves.easeOutExpo.transform(
                      _bellCurveAnim.value.clamp(0.0, 1.0),
                    ),
                    pulseValue: _pulseAnim.value,
                    borderColor: c.border,
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _PriceLabel(
                label: 'Low',
                value: '\$${benchmark.priceLow.toStringAsFixed(0)}',
                color: ObsidianTheme.amber,
              ),
              _PriceLabel(
                label: 'P25',
                value: '\$${benchmark.priceP25.toStringAsFixed(0)}',
                color: ObsidianTheme.amber.withValues(alpha: 0.7),
              ),
              _PriceLabel(
                label: 'Median',
                value: '\$${benchmark.priceMedian.toStringAsFixed(0)}',
                color: ObsidianTheme.emerald,
                bold: true,
              ),
              _PriceLabel(
                label: 'P75',
                value: '\$${benchmark.priceP75.toStringAsFixed(0)}',
                color: ObsidianTheme.violet.withValues(alpha: 0.7),
              ),
              _PriceLabel(
                label: 'High',
                value: '\$${benchmark.priceHigh.toStringAsFixed(0)}',
                color: ObsidianTheme.violet,
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms, duration: 500.ms).moveY(begin: 12, end: 0);
  }

  // ── Key Metrics ──────────────────────────────────────

  Widget _buildMetricsRow(MarketBenchmark benchmark) {
    return Row(
      children: [
        Expanded(
          child: _MetricCard(
            icon: PhosphorIconsLight.currencyDollar,
            label: 'Average',
            value: '\$${benchmark.priceAvg.toStringAsFixed(0)}',
            color: ObsidianTheme.emerald,
            delay: 300,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _MetricCard(
            icon: PhosphorIconsLight.arrowsOutLineHorizontal,
            label: 'IQR Spread',
            value: '\$${benchmark.iqr.toStringAsFixed(0)}',
            color: ObsidianTheme.amber,
            delay: 350,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _MetricCard(
            icon: PhosphorIconsLight.database,
            label: 'Data Points',
            value: '${benchmark.sampleSize}',
            color: ObsidianTheme.violet,
            delay: 400,
          ),
        ),
      ],
    );
  }

  // ── Trend Chart ──────────────────────────────────────

  Widget _buildTrendSection(List<MarketTrend> trends) {
    final c = context.iColors;
    final latestChange = trends.isNotEmpty ? trends.last.priceChangePct : 0.0;
    final isUp = latestChange >= 0;

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIconsLight.trendUp, size: 14, color: ObsidianTheme.emerald),
              const SizedBox(width: 6),
              Text(
                'PRICING TRENDS',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: c.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusFull,
                  color: (isUp ? ObsidianTheme.emerald : ObsidianTheme.rose).withValues(alpha: 0.12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isUp ? PhosphorIconsFill.trendUp : PhosphorIconsFill.trendDown,
                      size: 10,
                      color: isUp ? ObsidianTheme.emerald : ObsidianTheme.rose,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${isUp ? '+' : ''}${latestChange.toStringAsFixed(1)}%',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9,
                        color: isUp ? ObsidianTheme.emerald : ObsidianTheme.rose,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          SizedBox(
            height: 120,
            child: CustomPaint(
              size: const Size(double.infinity, 120),
              painter: _TrendChartPainter(trends: trends, borderColor: c.border),
            ),
          ),

          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: trends.map((t) {
              return Text(
                t.monthLabel,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 8,
                  color: c.textTertiary,
                ),
              );
            }).toList(),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms, duration: 500.ms).moveY(begin: 12, end: 0);
  }

  // ── Win Rate Section ─────────────────────────────────

  Widget _buildWinRateSection(MarketBenchmark benchmark) {
    final c = context.iColors;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIconsLight.target, size: 14, color: ObsidianTheme.emerald),
              const SizedBox(width: 6),
              Text(
                'WIN PROBABILITY',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: c.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _WinRateRow(
            label: 'Below 25th percentile',
            winRate: 90,
            color: ObsidianTheme.emerald,
            subtitle: 'High chance but low margin',
          ),
          const SizedBox(height: 10),
          _WinRateRow(
            label: 'At Market Median',
            winRate: 65,
            color: ObsidianTheme.amber,
            subtitle: 'Sweet spot — fair value',
          ),
          const SizedBox(height: 10),
          _WinRateRow(
            label: 'Above 75th percentile',
            winRate: 20,
            color: ObsidianTheme.rose,
            subtitle: 'Premium pricing — hard sell',
          ),
        ],
      ),
    ).animate().fadeIn(delay: 500.ms, duration: 500.ms).moveY(begin: 12, end: 0);
  }

  // ── Privacy Notice ───────────────────────────────────

  Widget _buildPrivacyNotice() {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.surface.withValues(alpha: 0.5),
        border: Border.all(color: c.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIconsLight.shieldCheck, size: 16, color: c.textTertiary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Privacy Protected',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: c.textSecondary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'All data is anonymized and aggregated. Minimum 5 data points required. '
                  'No competitor names are ever shown. Updated every 24 hours.',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    color: c.textMuted,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 600.ms, duration: 400.ms);
  }

  // ── Empty State ──────────────────────────────────────

  Widget _buildEmptyState() {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(PhosphorIconsLight.chartBar,
              size: 48, color: c.textDisabled),
          const SizedBox(height: 16),
          Text(
            'Not enough data yet',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: c.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'We need at least 5 quotes in this category to show market intelligence.',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: c.textMuted,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  Widget _buildShimmerCard() {
    final c = context.iColors;
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: c.shimmerBase,
      ),
    )
        .animate(onPlay: (ctrl) => ctrl.repeat())
        .shimmer(
          duration: 1200.ms,
          color: c.shimmerHighlight.withValues(alpha: 0.3),
        );
  }
}

// ══════════════════════════════════════════════════════════
// PAINTERS
// ══════════════════════════════════════════════════════════

class _BellCurvePainter extends CustomPainter {
  final MarketBenchmark benchmark;
  final double progress;
  final double pulseValue;
  final Color borderColor;

  _BellCurvePainter({
    required this.benchmark,
    required this.progress,
    required this.pulseValue,
    required this.borderColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final padBottom = 20.0;
    final chartH = h - padBottom;

    final path = Path();
    final fillPath = Path();

    final mean = w / 2;
    final sigma = w / 5;

    path.moveTo(0, chartH);
    fillPath.moveTo(0, chartH);

    final steps = 100;
    for (int i = 0; i <= steps; i++) {
      final x = (i / steps) * w;
      final animX = x * progress;
      final z = (animX - mean) / sigma;
      final y = chartH - (chartH * 0.9 * math.exp(-0.5 * z * z) * progress);
      if (i == 0) {
        path.moveTo(animX, y);
        fillPath.moveTo(animX, y);
      } else {
        path.lineTo(animX, y);
        fillPath.lineTo(animX, y);
      }
    }

    fillPath.lineTo(w * progress, chartH);
    fillPath.close();

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          ObsidianTheme.amber.withValues(alpha: 0.15),
          ObsidianTheme.emerald.withValues(alpha: 0.2),
          ObsidianTheme.violet.withValues(alpha: 0.15),
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(fillPath, fillPaint);

    final strokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          ObsidianTheme.amber,
          ObsidianTheme.emerald,
          ObsidianTheme.violet,
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(path, strokePaint);

    if (progress > 0.4) {
      final medX = w * 0.5;
      final medPaint = Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.4)
        ..strokeWidth = 1
        ..style = PaintingStyle.stroke;
      canvas.drawLine(Offset(medX, 0), Offset(medX, chartH), medPaint);
    }

    if (progress > 0.6) {
      _drawDashedLine(canvas, w * 0.25, chartH,
          ObsidianTheme.amber.withValues(alpha: 0.25));
      _drawDashedLine(canvas, w * 0.75, chartH,
          ObsidianTheme.violet.withValues(alpha: 0.25));
    }

    final axisPaint = Paint()
      ..color = borderColor
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, chartH), Offset(w, chartH), axisPaint);
  }

  void _drawDashedLine(Canvas canvas, double x, double h, Color color) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (double y = 0; y < h; y += 6) {
      canvas.drawLine(Offset(x, y), Offset(x, (y + 3).clamp(0, h)), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _BellCurvePainter old) =>
      progress != old.progress || pulseValue != old.pulseValue;
}

class _TrendChartPainter extends CustomPainter {
  final List<MarketTrend> trends;
  final Color borderColor;

  _TrendChartPainter({required this.trends, required this.borderColor});

  @override
  void paint(Canvas canvas, Size size) {
    if (trends.isEmpty) return;

    final w = size.width;
    final h = size.height;
    final padBottom = 8.0;
    final chartH = h - padBottom;

    final prices = trends.map((t) => t.medianPrice).toList();
    final maxP = prices.reduce(math.max);
    final minP = prices.reduce(math.min);
    final range = (maxP - minP).clamp(1, double.infinity);

    final points = <Offset>[];
    for (int i = 0; i < trends.length; i++) {
      final x = (i / (trends.length - 1).clamp(1, trends.length)) * w;
      final y = chartH - ((prices[i] - minP) / range * chartH * 0.8 + chartH * 0.1);
      points.add(Offset(x, y));
    }

    final gridPaint = Paint()
      ..color = borderColor
      ..strokeWidth = 0.5;
    for (int i = 0; i <= 3; i++) {
      final y = (i / 3) * chartH;
      canvas.drawLine(Offset(0, y), Offset(w, y), gridPaint);
    }

    if (points.length >= 2) {
      final fillPath = Path()..moveTo(points.first.dx, chartH);
      for (final p in points) {
        fillPath.lineTo(p.dx, p.dy);
      }
      fillPath.lineTo(points.last.dx, chartH);
      fillPath.close();

      final fillPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            ObsidianTheme.emerald.withValues(alpha: 0.15),
            ObsidianTheme.emerald.withValues(alpha: 0.02),
          ],
        ).createShader(Rect.fromLTWH(0, 0, w, h));
      canvas.drawPath(fillPath, fillPaint);
    }

    if (points.length >= 2) {
      final linePath = Path()..moveTo(points.first.dx, points.first.dy);
      for (int i = 1; i < points.length; i++) {
        linePath.lineTo(points[i].dx, points[i].dy);
      }

      final linePaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = ObsidianTheme.emerald
        ..strokeCap = StrokeCap.round;
      canvas.drawPath(linePath, linePaint);
    }

    for (int i = 0; i < points.length; i++) {
      final dotPaint = Paint()..color = ObsidianTheme.emerald;
      canvas.drawCircle(points[i], 3, dotPaint);

      final glowPaint = Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.3)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
      canvas.drawCircle(points[i], 3, glowPaint);

      if (i == points.length - 1) {
        final tp = TextPainter(
          text: TextSpan(
            text: '\$${trends[i].medianPrice.toStringAsFixed(0)}',
            style: TextStyle(
              fontFamily: 'JetBrains Mono',
              fontSize: 9,
              color: ObsidianTheme.emerald,
              fontWeight: FontWeight.w500,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(points[i].dx - tp.width - 6, points[i].dy - tp.height / 2));
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TrendChartPainter old) => true;
}

// ══════════════════════════════════════════════════════════
// HELPER WIDGETS
// ══════════════════════════════════════════════════════════

class _PriceLabel extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool bold;

  const _PriceLabel({
    required this.label,
    required this.value,
    required this.color,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      children: [
        Text(
          value,
          style: GoogleFonts.jetBrainsMono(
            fontSize: bold ? 12 : 10,
            fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 8, color: c.textTertiary),
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final int delay;

  const _MetricCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: c.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 10, color: c.textMuted),
          ),
        ],
      ),
    ).animate().fadeIn(delay: Duration(milliseconds: delay), duration: 400.ms).moveY(begin: 8, end: 0);
  }
}

class _WinRateRow extends StatelessWidget {
  final String label;
  final double winRate;
  final Color color;
  final String subtitle;

  const _WinRateRow({
    required this.label,
    required this.winRate,
    required this.color,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: c.textSecondary,
                ),
              ),
              Text(
                subtitle,
                style: GoogleFonts.inter(fontSize: 10, color: c.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        SizedBox(
          width: 80,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${winRate.toStringAsFixed(0)}%',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: winRate / 100,
                  minHeight: 3,
                  backgroundColor: c.shimmerBase,
                  valueColor: AlwaysStoppedAnimation(color),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
