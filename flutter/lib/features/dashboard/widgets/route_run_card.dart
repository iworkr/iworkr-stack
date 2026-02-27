import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/route_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/route_run.dart';

/// Optimized Run Card — dashboard widget showing today's route.
///
/// Displays a mini map snippet with glowing polyline, stats (distance,
/// drive time, finish time), and a "Start Run" button.
class RouteRunCard extends ConsumerWidget {
  const RouteRunCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routeAsync = ref.watch(todayRouteProvider);

    return routeAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (route) {
        if (route == null) return _NoRouteCard(ref: ref);
        return _RouteCard(route: route);
      },
    );
  }
}

class _NoRouteCard extends StatelessWidget {
  final WidgetRef ref;
  const _NoRouteCard({required this.ref});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.white.withValues(alpha: 0.02),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: Colors.white.withValues(alpha: 0.04),
            ),
            child: Icon(PhosphorIconsLight.path, color: ObsidianTheme.textSecondary, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No route planned',
                  style: GoogleFonts.inter(
                    color: ObsidianTheme.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  'Optimize your day\'s schedule',
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () async {
              HapticFeedback.mediumImpact();
              await generateOptimizedRoute();
              ref.invalidate(todayRouteProvider);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
              ),
              child: Text(
                'Optimize',
                style: GoogleFonts.inter(
                  color: ObsidianTheme.emerald,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 500.ms, duration: 500.ms)
        .moveY(begin: 8, delay: 500.ms, duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

class _RouteCard extends StatelessWidget {
  final RouteRun route;
  const _RouteCard({required this.route});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/route');
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: Colors.white.withValues(alpha: 0.02),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Column(
          children: [
            // Map snippet
            SizedBox(
              height: 100,
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                child: CustomPaint(
                  painter: _RouteMapPainter(stops: route.jobSequence),
                  size: const Size(double.infinity, 100),
                ),
              ),
            ),

            // Stats row
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Row(
                children: [
                  _RouteStat(
                    icon: PhosphorIconsLight.path,
                    value: route.distanceLabel,
                    label: 'DISTANCE',
                  ),
                  _RouteStat(
                    icon: PhosphorIconsLight.car,
                    value: route.driveTimeLabel,
                    label: 'DRIVE',
                  ),
                  _RouteStat(
                    icon: PhosphorIconsLight.clockAfternoon,
                    value: route.finishTimeLabel,
                    label: 'FINISH',
                  ),
                  const Spacer(),
                  // Start Run button
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: ObsidianTheme.emerald.withValues(alpha: 0.12),
                      border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.navigationArrow, color: ObsidianTheme.emerald, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          route.isActive ? 'Continue' : 'Start Run',
                          style: GoogleFonts.inter(
                            color: ObsidianTheme.emerald,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 500.ms, duration: 500.ms)
        .moveY(begin: 8, delay: 500.ms, duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

class _RouteStat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _RouteStat({required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: ObsidianTheme.textTertiary, size: 12),
              const SizedBox(width: 4),
              Text(
                value,
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.jetBrainsMono(
              color: ObsidianTheme.textTertiary,
              fontSize: 8,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Mini route map painter — draws job dots connected by a glowing polyline
class _RouteMapPainter extends CustomPainter {
  final List<RouteStop> stops;
  _RouteMapPainter({required this.stops});

  @override
  void paint(Canvas canvas, Size size) {
    // Dark background
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF050508),
    );

    // Grid lines
    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..strokeWidth = 0.5;
    for (double y = 0; y < size.height; y += 20) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 20) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    if (stops.isEmpty) return;

    // Map actual lat/lng to widget coordinates
    final points = <Offset>[];
    const padding = 24.0;
    final usableWidth = size.width - padding * 2;
    final usableHeight = size.height - padding * 2;

    final validStops = stops.where((s) => s.lat != null && s.lng != null).toList();
    if (validStops.isEmpty) return;

    double minLat = double.infinity, maxLat = -double.infinity;
    double minLng = double.infinity, maxLng = -double.infinity;
    for (final s in validStops) {
      minLat = math.min(minLat, s.lat!);
      maxLat = math.max(maxLat, s.lat!);
      minLng = math.min(minLng, s.lng!);
      maxLng = math.max(maxLng, s.lng!);
    }
    final latRange = maxLat - minLat == 0 ? 0.01 : maxLat - minLat;
    final lngRange = maxLng - minLng == 0 ? 0.01 : maxLng - minLng;

    for (final s in stops) {
      if (s.lat == null || s.lng == null) {
        points.add(Offset(size.width / 2, size.height / 2));
        continue;
      }
      final x = padding + ((s.lng! - minLng) / lngRange) * usableWidth;
      // Invert Y: lat increases north but screen Y increases downward
      final y = padding + ((maxLat - s.lat!) / latRange) * usableHeight;
      points.add(Offset(x, y));
    }

    // Draw polyline (blue -> purple gradient)
    if (points.length > 1) {
      // Glow line
      final glowPaint = Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.1)
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      final glowPath = Path()..moveTo(points.first.dx, points.first.dy);
      for (int i = 1; i < points.length; i++) {
        final prev = points[i - 1];
        final curr = points[i];
        final cp1 = Offset(prev.dx + (curr.dx - prev.dx) * 0.5, prev.dy);
        final cp2 = Offset(prev.dx + (curr.dx - prev.dx) * 0.5, curr.dy);
        glowPath.cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, curr.dx, curr.dy);
      }
      canvas.drawPath(glowPath, glowPaint);

      // Main line — solid emerald stroke
      final linePaint = Paint()
        ..color = ObsidianTheme.emerald
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;
      canvas.drawPath(glowPath, linePaint);
    }

    // Draw stop dots
    for (int i = 0; i < points.length; i++) {
      final p = points[i];
      final isCompleted = i < stops.length && stops[i].isCompleted;

      // Outer ring — subtle emerald glow
      canvas.drawCircle(
        p,
        6,
        Paint()
          ..color = ObsidianTheme.emerald.withValues(alpha: isCompleted ? 0.2 : 0.12),
      );

      // Inner dot — solid emerald 4px radius (8px diameter)
      canvas.drawCircle(
        p,
        4,
        Paint()..color = ObsidianTheme.emerald,
      );

      // Number label
      final textPainter = TextPainter(
        text: TextSpan(
          text: '${i + 1}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 8,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(p.dx - textPainter.width / 2, p.dy - 16));
    }
  }

  @override
  bool shouldRepaint(covariant _RouteMapPainter oldDelegate) =>
      oldDelegate.stops.length != stops.length;
}
