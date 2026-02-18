import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Opens full-screen signature pad. Returns SVG path data string or null.
Future<String?> showSignaturePad(BuildContext context) async {
  HapticFeedback.mediumImpact();
  return await Navigator.of(context, rootNavigator: true).push<String?>(
    PageRouteBuilder(
      opaque: true,
      pageBuilder: (_, __, ___) => const _SignaturePadScreen(),
      transitionsBuilder: (_, a, __, child) {
        return FadeTransition(opacity: a, child: child);
      },
      transitionDuration: const Duration(milliseconds: 250),
    ),
  );
}

class _SignaturePadScreen extends StatefulWidget {
  const _SignaturePadScreen();

  @override
  State<_SignaturePadScreen> createState() => _SignaturePadScreenState();
}

class _SignaturePadScreenState extends State<_SignaturePadScreen> {
  final List<_StrokePoint> _points = [];
  final List<int> _strokeBreaks = []; // indices where strokes end
  bool _isEmpty = true;
  Offset? _lastPosition;
  DateTime? _lastTime;

  void _onPanStart(DragStartDetails details) {
    HapticFeedback.selectionClick();
    _lastPosition = details.localPosition;
    _lastTime = DateTime.now();
    _points.add(_StrokePoint(position: details.localPosition, width: 2.0));
    setState(() => _isEmpty = false);
  }

  void _onPanUpdate(DragUpdateDetails details) {
    final now = DateTime.now();
    final pos = details.localPosition;

    // Calculate velocity-based width (fountain pen effect)
    double width = 2.0;
    if (_lastPosition != null && _lastTime != null) {
      final distance = (pos - _lastPosition!).distance;
      final elapsed = now.difference(_lastTime!).inMilliseconds.toDouble();
      if (elapsed > 0) {
        final velocity = distance / elapsed;
        // Higher velocity = thinner line (fast strokes are thin)
        width = (3.5 - velocity * 2.5).clamp(0.8, 4.0);
      }
    }

    _points.add(_StrokePoint(position: pos, width: width));
    _lastPosition = pos;
    _lastTime = now;
    setState(() {});
  }

  void _onPanEnd(DragEndDetails details) {
    _strokeBreaks.add(_points.length - 1);
    _lastPosition = null;
    _lastTime = null;
  }

  void _clear() {
    HapticFeedback.lightImpact();
    setState(() {
      _points.clear();
      _strokeBreaks.clear();
      _isEmpty = true;
    });
  }

  void _confirm() {
    if (_isEmpty) return;
    HapticFeedback.heavyImpact();

    // Convert to simplified SVG path data
    final svgPath = _toSvgPath();
    Navigator.pop(context, svgPath);
  }

  String _toSvgPath() {
    if (_points.isEmpty) return '';

    final buf = StringBuffer();
    int strokeStart = 0;

    for (final breakIdx in [..._strokeBreaks, _points.length - 1]) {
      if (strokeStart >= _points.length) break;
      final first = _points[strokeStart];
      buf.write('M${first.position.dx.toStringAsFixed(1)},${first.position.dy.toStringAsFixed(1)} ');

      for (int i = strokeStart + 1; i <= breakIdx && i < _points.length; i++) {
        final p = _points[i];
        buf.write('L${p.position.dx.toStringAsFixed(1)},${p.position.dy.toStringAsFixed(1)} ');
      }
      strokeStart = breakIdx + 1;
    }

    return buf.toString().trim();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () { HapticFeedback.lightImpact(); Navigator.pop(context); },
                    child: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle, color: ObsidianTheme.hoverBg,
                        border: Border.all(color: ObsidianTheme.border),
                      ),
                      child: const Center(child: Icon(PhosphorIconsLight.x, size: 16, color: ObsidianTheme.textSecondary)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text('Sign Below', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
                  const Spacer(),
                  GestureDetector(
                    onTap: _clear,
                    child: Text('Clear', style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary)),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),

            const SizedBox(height: 16),

            // Signature canvas
            Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusLg,
                  color: ObsidianTheme.surface1,
                  border: Border.all(color: ObsidianTheme.borderMedium),
                ),
                child: ClipRRect(
                  borderRadius: ObsidianTheme.radiusLg,
                  child: Stack(
                    children: [
                      // Baseline
                      Positioned(
                        left: 20, right: 20, bottom: 60,
                        child: Container(height: 1, color: ObsidianTheme.border),
                      ),

                      // "X" marker
                      Positioned(
                        left: 20, bottom: 68,
                        child: Text('×', style: GoogleFonts.inter(fontSize: 18, color: ObsidianTheme.textTertiary)),
                      ),

                      // Drawing surface
                      GestureDetector(
                        onPanStart: _onPanStart,
                        onPanUpdate: _onPanUpdate,
                        onPanEnd: _onPanEnd,
                        child: CustomPaint(
                          painter: _SignaturePainter(points: _points, strokeBreaks: _strokeBreaks),
                          size: Size.infinite,
                        ),
                      ),

                      // Hint text
                      if (_isEmpty)
                        Center(
                          child: Text(
                            'Sign with your finger',
                            style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textDisabled),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Confirm button
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: GestureDetector(
                onTap: _confirm,
                child: AnimatedContainer(
                  duration: ObsidianTheme.fast,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: _isEmpty ? ObsidianTheme.shimmerBase : Colors.white,
                  ),
                  child: Center(
                    child: Text(
                      'Confirm Signature',
                      style: GoogleFonts.inter(
                        fontSize: 15, fontWeight: FontWeight.w600,
                        color: _isEmpty ? ObsidianTheme.textTertiary : Colors.black,
                      ),
                    ),
                  ),
                ),
              ),
            ),

            Text(
              'By signing, you agree to the terms of this quote.',
              style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary),
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
          ],
        ),
      ),
    );
  }
}

// ── Data ─────────────────────────────────────────────

class _StrokePoint {
  final Offset position;
  final double width;
  const _StrokePoint({required this.position, required this.width});
}

// ── Painter ──────────────────────────────────────────

class _SignaturePainter extends CustomPainter {
  final List<_StrokePoint> points;
  final List<int> strokeBreaks;

  _SignaturePainter({required this.points, required this.strokeBreaks});

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    final breakSet = strokeBreaks.toSet();

    for (int i = 0; i < points.length - 1; i++) {
      if (breakSet.contains(i)) continue;

      final p1 = points[i];
      final p2 = points[i + 1];

      // Smoothly interpolate width between adjacent points
      final avgWidth = (p1.width + p2.width) / 2;

      final paint = Paint()
        ..color = Colors.white.withValues(alpha: 0.9)
        ..strokeWidth = avgWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      canvas.drawLine(p1.position, p2.position, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter old) => true;
}
