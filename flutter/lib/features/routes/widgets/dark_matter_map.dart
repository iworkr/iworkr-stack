import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/route_run.dart';

/// "Dark Matter Map" — a custom-painted route visualization
/// showing the flight path with emerald polylines, numbered pucks,
/// and a pulsing current-location indicator.
class DarkMatterMap extends StatefulWidget {
  final List<RouteStop> stops;
  final int? activeStopIndex;
  final ValueChanged<int>? onStopTap;

  const DarkMatterMap({
    super.key,
    required this.stops,
    this.activeStopIndex,
    this.onStopTap,
  });

  @override
  State<DarkMatterMap> createState() => _DarkMatterMapState();
}

class _DarkMatterMapState extends State<DarkMatterMap>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Normalize lat/lng into the widget's coordinate space
  List<Offset> _computePositions(Size size) {
    final validStops = widget.stops.where((s) => s.lat != null && s.lng != null).toList();
    if (validStops.isEmpty) return [];

    final padding = 48.0;
    final usable = Size(size.width - padding * 2, size.height - padding * 2);

    double minLat = double.infinity, maxLat = -double.infinity;
    double minLng = double.infinity, maxLng = -double.infinity;

    for (final s in validStops) {
      minLat = min(minLat, s.lat!);
      maxLat = max(maxLat, s.lat!);
      minLng = min(minLng, s.lng!);
      maxLng = max(maxLng, s.lng!);
    }

    // Expand range slightly if all points are at same location
    final latRange = maxLat - minLat == 0 ? 0.01 : maxLat - minLat;
    final lngRange = maxLng - minLng == 0 ? 0.01 : maxLng - minLng;

    return widget.stops.map((s) {
      if (s.lat == null || s.lng == null) {
        return Offset(size.width / 2, size.height / 2);
      }
      final x = padding + ((s.lng! - minLng) / lngRange) * usable.width;
      // Invert Y because lat increases northward but screen Y increases downward
      final y = padding + ((maxLat - s.lat!) / latRange) * usable.height;
      return Offset(x, y);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.stops.isEmpty) {
      return _EmptyMapState();
    }

    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        return LayoutBuilder(
          builder: (context, constraints) {
            final size = Size(constraints.maxWidth, constraints.maxHeight);
            final positions = _computePositions(size);

            return GestureDetector(
              onTapDown: (details) {
                if (widget.onStopTap == null) return;
                final tapPoint = details.localPosition;
                for (int i = 0; i < positions.length; i++) {
                  if ((positions[i] - tapPoint).distance < 28) {
                    widget.onStopTap!(i);
                    return;
                  }
                }
              },
              child: CustomPaint(
                size: size,
                painter: _DarkMatterPainter(
                  positions: positions,
                  stops: widget.stops,
                  activeIndex: widget.activeStopIndex,
                  pulseValue: _pulseController.value,
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Dark Matter Painter ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _DarkMatterPainter extends CustomPainter {
  final List<Offset> positions;
  final List<RouteStop> stops;
  final int? activeIndex;
  final double pulseValue;

  _DarkMatterPainter({
    required this.positions,
    required this.stops,
    this.activeIndex,
    required this.pulseValue,
  });

  static const _emerald = Color(0xFF10B981);
  static const _emeraldGlow = Color(0x4010B981);
  static const _zinc800 = Color(0xFF27272A);
  static const _zinc600 = Color(0xFF52525B);
  static const _zinc400 = Color(0xFFA1A1AA);

  @override
  void paint(Canvas canvas, Size size) {
    _drawGrid(canvas, size);
    if (positions.length < 2) {
      if (positions.isNotEmpty) {
        _drawMarker(canvas, positions[0], 0, false, false);
      }
      return;
    }
    _drawRouteLines(canvas);
    _drawMarkers(canvas);
  }

  void _drawGrid(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = _zinc800.withValues(alpha: 0.3)
      ..strokeWidth = 0.5;

    const spacing = 40.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
  }

  void _drawRouteLines(Canvas canvas) {
    final path = Path();
    path.moveTo(positions[0].dx, positions[0].dy);

    for (int i = 1; i < positions.length; i++) {
      // Smooth curves via quadratic bezier
      final prev = positions[i - 1];
      final curr = positions[i];
      final midX = (prev.dx + curr.dx) / 2;
      final midY = (prev.dy + curr.dy) / 2;
      path.quadraticBezierTo(prev.dx, prev.dy, midX, midY);
    }
    path.lineTo(positions.last.dx, positions.last.dy);

    // Glow layer
    canvas.drawPath(
      path,
      Paint()
        ..color = _emeraldGlow
        ..strokeWidth = 10
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );

    // Main route line
    canvas.drawPath(
      path,
      Paint()
        ..color = _emerald
        ..strokeWidth = 3.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    // Draw direction arrows along the path
    for (int i = 0; i < positions.length - 1; i++) {
      final p1 = positions[i];
      final p2 = positions[i + 1];
      final mid = Offset((p1.dx + p2.dx) / 2, (p1.dy + p2.dy) / 2);
      final angle = atan2(p2.dy - p1.dy, p2.dx - p1.dx);

      canvas.save();
      canvas.translate(mid.dx, mid.dy);
      canvas.rotate(angle);

      final arrowPath = Path()
        ..moveTo(-5, -4)
        ..lineTo(5, 0)
        ..lineTo(-5, 4)
        ..close();

      canvas.drawPath(
        arrowPath,
        Paint()
          ..color = _emerald.withValues(alpha: 0.7)
          ..style = PaintingStyle.fill,
      );
      canvas.restore();
    }
  }

  void _drawMarkers(Canvas canvas) {
    for (int i = 0; i < positions.length; i++) {
      final isActive = i == activeIndex;
      final isCompleted = stops[i].isCompleted;
      _drawMarker(canvas, positions[i], i, isActive, isCompleted);
    }
  }

  void _drawMarker(Canvas canvas, Offset pos, int index, bool isActive, bool isCompleted) {
    final radius = isActive ? 18.0 + pulseValue * 4 : 16.0;

    if (isActive) {
      // Pulsing outer glow for active stop
      canvas.drawCircle(
        pos,
        radius + 8 + pulseValue * 6,
        Paint()
          ..color = _emerald.withValues(alpha: 0.08 + pulseValue * 0.06)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12),
      );
      canvas.drawCircle(
        pos,
        radius + 4,
        Paint()
          ..color = _emerald.withValues(alpha: 0.15)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
    }

    // Outer ring
    final ringColor = isCompleted
        ? _zinc600
        : isActive
            ? _emerald
            : _emerald.withValues(alpha: 0.6);

    canvas.drawCircle(
      pos,
      radius,
      Paint()
        ..color = ringColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );

    // Fill
    final fillColor = isCompleted
        ? _zinc800
        : const Color(0xFF0A0A0A);

    canvas.drawCircle(pos, radius - 2, Paint()..color = fillColor);

    // Number or check
    final textPainter = TextPainter(
      text: TextSpan(
        text: isCompleted ? '✓' : '${index + 1}',
        style: TextStyle(
          color: isCompleted ? _zinc400 : Colors.white,
          fontSize: isActive ? 13 : 11,
          fontWeight: FontWeight.w700,
          fontFamily: 'JetBrains Mono',
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(pos.dx - textPainter.width / 2, pos.dy - textPainter.height / 2),
    );
  }

  @override
  bool shouldRepaint(_DarkMatterPainter old) =>
      old.pulseValue != pulseValue ||
      old.activeIndex != activeIndex ||
      old.positions != positions;
}

// ═══════════════════════════════════════════════════════════
// ── Empty Map State ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _EmptyMapState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ObsidianTheme.emerald.withValues(alpha: 0.06),
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.12)),
            ),
            child: const Icon(PhosphorIconsLight.mapTrifold, color: ObsidianTheme.emerald, size: 28),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scaleXY(begin: 1.0, end: 1.06, duration: 2500.ms),
          const SizedBox(height: 16),
          Text(
            'No waypoints plotted',
            style: GoogleFonts.inter(
              color: ObsidianTheme.textSecondary,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Optimize a route to see the flight path',
            style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
