import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/services/market_intelligence_provider.dart';
import 'package:iworkr_mobile/models/market_benchmark.dart';

/// The Market Gauge — horizontal gradient bar showing where a price sits
/// relative to the local market (Low → Median → High).
///
/// Inserted below the "Total Price" field in the quote creator.
class MarketGaugeWidget extends ConsumerStatefulWidget {
  final double currentPrice;
  final String jobTitle;
  final bool isProUser;

  const MarketGaugeWidget({
    super.key,
    required this.currentPrice,
    required this.jobTitle,
    this.isProUser = true,
  });

  @override
  ConsumerState<MarketGaugeWidget> createState() => _MarketGaugeWidgetState();
}

class _MarketGaugeWidgetState extends ConsumerState<MarketGaugeWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _needleAnim;
  double _lastPercentile = 50;
  bool _didHapticOnMedian = false;

  @override
  void initState() {
    super.initState();
    _needleAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void dispose() {
    _needleAnim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.currentPrice <= 0 || widget.jobTitle.trim().isEmpty) {
      return const SizedBox.shrink();
    }

    final category = extractServiceCategory(widget.jobTitle);
    final query = MarketQuery(category: category);
    final benchmarkAsync = ref.watch(marketBenchmarkProvider(query));

    return benchmarkAsync.when(
      data: (benchmark) {
        if (benchmark == null || !benchmark.hasEnoughData) {
          return const SizedBox.shrink();
        }
        return _buildGauge(benchmark);
      },
      loading: () => _buildShimmer(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  Widget _buildGauge(MarketBenchmark benchmark) {
    final c = context.iColors;
    final percentile = benchmark.percentileFor(widget.currentPrice);
    final winProb = benchmark.winProbabilityFor(widget.currentPrice);
    final position = benchmark.positionLabel(widget.currentPrice);

    if (!_didHapticOnMedian && percentile >= 45 && percentile <= 55) {
      _didHapticOnMedian = true;
      HapticFeedback.mediumImpact();
    } else if (percentile < 40 || percentile > 60) {
      _didHapticOnMedian = false;
    }

    if ((_lastPercentile - percentile).abs() > 1) {
      _needleAnim.forward(from: 0);
      _lastPercentile = percentile;
    }

    Color zoneColor;
    if (percentile < 25) {
      zoneColor = ObsidianTheme.amber;
    } else if (percentile < 60) {
      zoneColor = ObsidianTheme.emerald;
    } else {
      zoneColor = ObsidianTheme.violet;
    }

    Color winColor;
    String winLabel;
    if (winProb >= 70) {
      winColor = ObsidianTheme.emerald;
      winLabel = 'High Win Rate';
    } else if (winProb >= 40) {
      winColor = ObsidianTheme.amber;
      winLabel = 'Medium Win Rate';
    } else {
      winColor = ObsidianTheme.rose;
      winLabel = 'Low Win Rate';
    }

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(PhosphorIconsLight.chartLineUp, size: 14, color: zoneColor),
            const SizedBox(width: 6),
            Text(
              'THE INDEX',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: c.textTertiary,
                letterSpacing: 1.5,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusFull,
                color: winColor.withValues(alpha: 0.12),
                border: Border.all(color: winColor.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    winProb >= 70
                        ? PhosphorIconsFill.trendUp
                        : winProb >= 40
                            ? PhosphorIconsLight.minus
                            : PhosphorIconsFill.trendDown,
                    size: 10,
                    color: winColor,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${winProb.toStringAsFixed(0)}% $winLabel',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 8,
                      color: winColor,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        SizedBox(
          height: 32,
          child: LayoutBuilder(builder: (context, constraints) {
            final width = constraints.maxWidth;
            final needleX = (percentile / 100).clamp(0.0, 1.0) * width;

            return Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: 6,
                  margin: const EdgeInsets.only(top: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    gradient: const LinearGradient(
                      colors: [
                        ObsidianTheme.amber,
                        ObsidianTheme.emerald,
                        ObsidianTheme.violet,
                      ],
                      stops: [0.0, 0.5, 1.0],
                    ),
                  ),
                ),

                Positioned(
                  left: width * 0.5 - 0.5,
                  top: 6,
                  child: Container(
                    width: 1,
                    height: 14,
                    color: c.borderMedium,
                  ),
                ),

                Positioned(
                  left: width * 0.25 - 0.5,
                  top: 8,
                  child: Container(
                    width: 1,
                    height: 10,
                    color: c.borderActive,
                  ),
                ),

                Positioned(
                  left: width * 0.75 - 0.5,
                  top: 8,
                  child: Container(
                    width: 1,
                    height: 10,
                    color: c.borderActive,
                  ),
                ),

                AnimatedPositioned(
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.easeOutExpo,
                  left: needleX - 6,
                  top: 0,
                  child: Column(
                    children: [
                      CustomPaint(
                        size: const Size(12, 6),
                        painter: _NeedlePainter(color: Colors.white),
                      ),
                      Container(
                        width: 2,
                        height: 18,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(1),
                          boxShadow: [
                            BoxShadow(
                              color: zoneColor.withValues(alpha: 0.5),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }),
        ),

        const SizedBox(height: 6),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '\$${benchmark.priceLow.toStringAsFixed(0)}',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.amber.withValues(alpha: 0.7),
              ),
            ),
            Text(
              'Avg \$${benchmark.priceMedian.toStringAsFixed(0)}',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.emerald.withValues(alpha: 0.7),
                fontWeight: FontWeight.w500,
              ),
            ),
            Text(
              '\$${benchmark.priceHigh.toStringAsFixed(0)}',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.violet.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: zoneColor,
                boxShadow: [
                  BoxShadow(color: zoneColor.withValues(alpha: 0.4), blurRadius: 6),
                ],
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '$position • ${percentile.toStringAsFixed(0)}th percentile • ${benchmark.sampleSize} quotes in area',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  color: c.textMuted,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );

    if (!widget.isProUser) {
      return _buildBlurredState(content);
    }

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: content,
    ).animate().fadeIn(duration: 400.ms).moveY(begin: 8, end: 0);
  }

  Widget _buildBlurredState(Widget content) {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: ObsidianTheme.radiusMd,
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: content,
              ),
            ),
          ),

          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: c.canvas.withValues(alpha: 0.6),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(PhosphorIconsLight.lock, size: 20, color: ObsidianTheme.violet),
                  const SizedBox(height: 8),
                  Text(
                    'Market Data Locked',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: c.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Unlock The Index to see what competitors charge',
                    style: GoogleFonts.inter(fontSize: 10, color: c.textMuted),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusFull,
                      gradient: const LinearGradient(
                        colors: [ObsidianTheme.amber, ObsidianTheme.emerald, ObsidianTheme.violet],
                      ),
                    ),
                    child: Text(
                      'Upgrade to Pro',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  Widget _buildShimmer() {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      height: 80,
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
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

// ── Needle Painter ───────────────────────────────────────

class _NeedlePainter extends CustomPainter {
  final Color color;
  _NeedlePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(size.width / 2, size.height)
      ..lineTo(0, 0)
      ..lineTo(size.width, 0)
      ..close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _NeedlePainter old) => color != old.color;
}
