import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/ar_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/ar_measurement.dart';

/// AR Measurement — HUD-style tape measure, area calculator,
/// and measurement history. Uses a full-screen "viewfinder" interface
/// with emerald guidelines and floating distance labels.
class ARMeasureScreen extends ConsumerStatefulWidget {
  final String? jobId;
  const ARMeasureScreen({super.key, this.jobId});

  @override
  ConsumerState<ARMeasureScreen> createState() => _ARMeasureScreenState();
}

class _ARMeasureScreenState extends ConsumerState<ARMeasureScreen>
    with TickerProviderStateMixin {
  int _tabIndex = 0; // 0 = Measure, 1 = History
  final List<Offset> _points = [];
  double? _currentDistance;
  double? _currentArea;
  bool _measuring = false;
  late AnimationController _reticleController;
  late AnimationController _lineGlowController;

  @override
  void initState() {
    super.initState();
    _reticleController = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
    _lineGlowController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _reticleController.dispose();
    _lineGlowController.dispose();
    super.dispose();
  }

  void _addPoint(Offset localPosition) {
    HapticFeedback.lightImpact();
    setState(() {
      _points.add(localPosition);
      _measuring = true;
      if (_points.length >= 2) {
        _calculateDistance();
      }
      if (_points.length >= 4) {
        _calculateArea();
      }
    });
  }

  void _calculateDistance() {
    if (_points.length < 2) return;
    final last = _points[_points.length - 1];
    final prev = _points[_points.length - 2];
    final pixelDist = (last - prev).distance;
    // Simulate scale: 1 pixel ≈ 0.003m (adjustable based on AR calibration)
    _currentDistance = pixelDist * 0.003;
  }

  void _calculateArea() {
    if (_points.length < 3) return;
    // Shoelace formula for polygon area
    double area = 0;
    for (int i = 0; i < _points.length; i++) {
      final j = (i + 1) % _points.length;
      area += _points[i].dx * _points[j].dy;
      area -= _points[j].dx * _points[i].dy;
    }
    _currentArea = (area.abs() / 2) * 0.003 * 0.003; // Convert pixel area to m²
  }

  void _reset() {
    HapticFeedback.mediumImpact();
    setState(() {
      _points.clear();
      _currentDistance = null;
      _currentArea = null;
      _measuring = false;
    });
  }

  Future<void> _saveMeasurement() async {
    if (_currentDistance == null && _currentArea == null) return;
    HapticFeedback.heavyImpact();

    final isArea = _currentArea != null && _points.length >= 4;
    await saveMeasurement(
      measurementType: isArea ? 'area' : 'distance',
      value: isArea ? _currentArea! : _currentDistance!,
      unit: isArea ? 'm²' : 'm',
      points: _points.map((p) => {'x': p.dx, 'y': p.dy}).toList(),
      jobId: widget.jobId,
      accuracyCm: 5.0,
    );

    ref.invalidate(arMeasurementsProvider);
    _reset();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Measurement saved'),
          backgroundColor: ObsidianTheme.emerald,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
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
                    ? _buildMeasureTab()
                    : _HistoryTab(key: const ValueKey(1), jobId: widget.jobId),
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
                'SPATIAL TOOLS',
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'AR Measurement',
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: ObsidianTheme.emerald.withValues(alpha: 0.08),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.cube, color: ObsidianTheme.emerald, size: 12),
                const SizedBox(width: 4),
                Text(
                  'HUD',
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.emerald,
                    fontSize: 9,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
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
          _Tab(label: 'MEASURE', active: _tabIndex == 0, onTap: () => setState(() => _tabIndex = 0)),
          _Tab(label: 'HISTORY', active: _tabIndex == 1, onTap: () => setState(() => _tabIndex = 1)),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 300.ms);
  }

  Widget _buildMeasureTab() {
    return Column(
      key: const ValueKey(0),
      children: [
        Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: const Color(0xFF050508),
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.08)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: GestureDetector(
                onTapDown: (details) => _addPoint(details.localPosition),
                child: AnimatedBuilder(
                  animation: Listenable.merge([_reticleController, _lineGlowController]),
                  builder: (context, child) {
                    return CustomPaint(
                      painter: _HUDPainter(
                        points: _points,
                        reticlePhase: _reticleController.value,
                        lineGlow: _lineGlowController.value,
                        currentDistance: _currentDistance,
                        currentArea: _currentArea,
                      ),
                      size: Size.infinite,
                    );
                  },
                ),
              ),
            ),
          )
              .animate()
              .fadeIn(delay: 200.ms, duration: 500.ms)
              .scaleXY(begin: 0.97, delay: 200.ms, duration: 500.ms, curve: Curves.easeOutCubic),
        ),

        const SizedBox(height: 12),

        // Current measurement display
        if (_currentDistance != null || _currentArea != null)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: ObsidianTheme.emerald.withValues(alpha: 0.06),
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
            ),
            child: Row(
              children: [
                if (_currentDistance != null) ...[
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DISTANCE',
                        style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.textTertiary,
                          fontSize: 8,
                          letterSpacing: 1.5,
                        ),
                      ),
                      Text(
                        '${_currentDistance!.toStringAsFixed(2)} m',
                        style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.emerald,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
                if (_currentArea != null) ...[
                  const SizedBox(width: 24),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AREA',
                        style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.textTertiary,
                          fontSize: 8,
                          letterSpacing: 1.5,
                        ),
                      ),
                      Text(
                        '${_currentArea!.toStringAsFixed(2)} m\u00B2',
                        style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.emerald,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          )
              .animate()
              .fadeIn(duration: 300.ms),

        const SizedBox(height: 12),

        // Action buttons
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Row(
            children: [
              // Reset
              Expanded(
                child: GestureDetector(
                  onTap: _reset,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: Colors.white.withValues(alpha: 0.04),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                    ),
                    child: Center(
                      child: Text(
                        'RESET',
                        style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.textSecondary,
                          fontSize: 11,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Save
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: (_currentDistance != null || _currentArea != null) ? _saveMeasurement : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: _measuring
                          ? ObsidianTheme.emerald.withValues(alpha: 0.12)
                          : Colors.white.withValues(alpha: 0.04),
                      border: Border.all(
                        color: _measuring
                            ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                            : Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        'SAVE MEASUREMENT',
                        style: GoogleFonts.jetBrainsMono(
                          color: _measuring ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
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

/// History tab showing saved measurements
class _HistoryTab extends ConsumerWidget {
  final String? jobId;
  const _HistoryTab({super.key, this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final measureAsync = ref.watch(arMeasurementsProvider);

    return measureAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (measurements) {
        if (measurements.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.ruler, color: ObsidianTheme.emerald.withValues(alpha: 0.5), size: 32),
                const SizedBox(height: 12),
                Text(
                  'No measurements yet',
                  style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tap points in the viewer to measure',
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          itemCount: measurements.length,
          itemBuilder: (context, index) {
            final m = measurements[index];
            return _MeasurementCard(measurement: m, index: index);
          },
        );
      },
    );
  }
}

class _MeasurementCard extends StatelessWidget {
  final ARMeasurement measurement;
  final int index;
  const _MeasurementCard({required this.measurement, required this.index});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: ObsidianTheme.emerald.withValues(alpha: 0.08),
            ),
            child: Icon(
              measurement.measurementType == 'area'
                  ? PhosphorIconsLight.squaresFour
                  : PhosphorIconsLight.ruler,
              color: ObsidianTheme.emerald,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  measurement.valueLabel,
                  style: GoogleFonts.jetBrainsMono(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      measurement.typeLabel,
                      style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                    ),
                    if (measurement.accuracyCm != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        measurement.accuracyLabel,
                        style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10),
                      ),
                    ],
                    if (measurement.usedLidar) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(3),
                          color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                        ),
                        child: Text(
                          'LiDAR',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.emerald,
                            fontSize: 8,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 60 * index), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: 60 * index), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

/// HUD painter — draws the measurement viewfinder with grid, reticle,
/// points, lines, and floating distance/area labels.
class _HUDPainter extends CustomPainter {
  final List<Offset> points;
  final double reticlePhase;
  final double lineGlow;
  final double? currentDistance;
  final double? currentArea;

  _HUDPainter({
    required this.points,
    required this.reticlePhase,
    required this.lineGlow,
    this.currentDistance,
    this.currentArea,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Dark background
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF030308),
    );

    // Grid
    final gridPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.03)
      ..strokeWidth = 0.5;

    for (double y = 0; y < size.height; y += 24) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 24) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    // Center reticle (breathing)
    final center = Offset(size.width / 2, size.height / 2);
    final reticleSize = 16 + reticlePhase * 4;
    final reticlePaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.3 + reticlePhase * 0.2)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    // Reticle corners
    canvas.drawLine(Offset(center.dx - reticleSize, center.dy), Offset(center.dx - reticleSize + 8, center.dy), reticlePaint);
    canvas.drawLine(Offset(center.dx + reticleSize, center.dy), Offset(center.dx + reticleSize - 8, center.dy), reticlePaint);
    canvas.drawLine(Offset(center.dx, center.dy - reticleSize), Offset(center.dx, center.dy - reticleSize + 8), reticlePaint);
    canvas.drawLine(Offset(center.dx, center.dy + reticleSize), Offset(center.dx, center.dy + reticleSize - 8), reticlePaint);

    // Center dot
    canvas.drawCircle(center, 2, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.5));

    // Draw lines between points
    if (points.length >= 2) {
      final linePaint = Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.7 + lineGlow * 0.3)
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      final glowLinePaint = Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.1 + lineGlow * 0.08)
        ..strokeWidth = 8
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      for (int i = 0; i < points.length - 1; i++) {
        canvas.drawLine(points[i], points[i + 1], glowLinePaint);
        canvas.drawLine(points[i], points[i + 1], linePaint);
      }

      // Close polygon if 4+ points
      if (points.length >= 4) {
        canvas.drawLine(points.last, points.first, glowLinePaint);
        canvas.drawLine(points.last, points.first, linePaint);
      }
    }

    // Draw measurement points
    for (int i = 0; i < points.length; i++) {
      final p = points[i];
      canvas.drawCircle(p, 8, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.15));
      canvas.drawCircle(p, 4, Paint()..color = ObsidianTheme.emerald);

      // Number label
      final textPainter = TextPainter(
        text: TextSpan(
          text: '${i + 1}',
          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(p.dx + 8, p.dy - 14));
    }

    // Draw distance label at midpoint of last segment
    if (points.length >= 2 && currentDistance != null) {
      final p1 = points[points.length - 2];
      final p2 = points[points.length - 1];
      final mid = Offset((p1.dx + p2.dx) / 2, (p1.dy + p2.dy) / 2 - 14);

      final label = '${currentDistance!.toStringAsFixed(2)}m';
      final tp = TextPainter(
        text: TextSpan(
          text: label,
          style: TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            shadows: [Shadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 8)],
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      // Background pill
      final bgRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(mid.dx, mid.dy), width: tp.width + 16, height: tp.height + 8),
        const Radius.circular(6),
      );
      canvas.drawRRect(bgRect, Paint()..color = const Color(0xCC050508));
      canvas.drawRRect(bgRect, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.2)..style = PaintingStyle.stroke..strokeWidth = 0.5);
      tp.paint(canvas, Offset(mid.dx - tp.width / 2, mid.dy - tp.height / 2));
    }

    // HUD corner markers
    final hudPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.15)
      ..strokeWidth = 1;
    const m = 12.0;
    const l = 20.0;
    // Top-left
    canvas.drawLine(const Offset(m, m), const Offset(m + l, m), hudPaint);
    canvas.drawLine(const Offset(m, m), const Offset(m, m + l), hudPaint);
    // Top-right
    canvas.drawLine(Offset(size.width - m, m), Offset(size.width - m - l, m), hudPaint);
    canvas.drawLine(Offset(size.width - m, m), Offset(size.width - m, m + l), hudPaint);
    // Bottom-left
    canvas.drawLine(Offset(m, size.height - m), Offset(m + l, size.height - m), hudPaint);
    canvas.drawLine(Offset(m, size.height - m), Offset(m, size.height - m - l), hudPaint);
    // Bottom-right
    canvas.drawLine(Offset(size.width - m, size.height - m), Offset(size.width - m - l, size.height - m), hudPaint);
    canvas.drawLine(Offset(size.width - m, size.height - m), Offset(size.width - m, size.height - m - l), hudPaint);

    // "TAP TO PLACE POINT" instruction (only when no points)
    if (points.isEmpty) {
      final tp = TextPainter(
        text: const TextSpan(
          text: 'TAP TO PLACE POINT',
          style: TextStyle(
            color: Color(0xFF52525B),
            fontSize: 11,
            fontWeight: FontWeight.w500,
            letterSpacing: 2,
            fontFamily: 'JetBrains Mono',
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(center.dx - tp.width / 2, size.height - 40));
    }
  }

  @override
  bool shouldRepaint(covariant _HUDPainter oldDelegate) => true;
}
