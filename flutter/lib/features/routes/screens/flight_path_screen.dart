import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/route_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/obsidian_map.dart';
import 'package:iworkr_mobile/features/routes/widgets/mission_card.dart';
import 'package:iworkr_mobile/models/route_run.dart';

/// "Today's Run" — full-screen flight path map with mission card overlay.
class FlightPathScreen extends ConsumerStatefulWidget {
  const FlightPathScreen({super.key});

  @override
  ConsumerState<FlightPathScreen> createState() => _FlightPathScreenState();
}

class _FlightPathScreenState extends ConsumerState<FlightPathScreen> {
  int? _selectedStopIndex;

  @override
  Widget build(BuildContext context) {
    final routeAsync = ref.watch(todayRouteProvider);
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: routeAsync.when(
        loading: () => _LoadingState(),
        error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(todayRouteProvider)),
        data: (route) {
          if (route == null || route.jobSequence.isEmpty) {
            return _EmptyState(ref: ref);
          }

          final activeIdx = _findActiveStopIndex(route);
          final selectedIdx = _selectedStopIndex ?? activeIdx;
          final selectedStop = selectedIdx != null && selectedIdx < route.jobSequence.length
              ? route.jobSequence[selectedIdx]
              : null;

          final validStops = route.jobSequence.where((s) => s.lat != null && s.lng != null).toList();
          final center = validStops.isNotEmpty
              ? LatLng(
                  validStops.map((s) => s.lat!).reduce((a, b) => a + b) / validStops.length,
                  validStops.map((s) => s.lng!).reduce((a, b) => a + b) / validStops.length,
                )
              : const LatLng(-27.4698, 153.0251);

          final markers = <Marker>{};
          for (int i = 0; i < route.jobSequence.length; i++) {
            final s = route.jobSequence[i];
            if (s.lat == null || s.lng == null) continue;
            final isActive = i == activeIdx;
            final isCompleted = s.isCompleted;
            markers.add(Marker(
              markerId: MarkerId('stop-$i'),
              position: LatLng(s.lat!, s.lng!),
              icon: BitmapDescriptor.defaultMarkerWithHue(
                isCompleted ? BitmapDescriptor.hueAzure : isActive ? BitmapDescriptor.hueGreen : BitmapDescriptor.hueOrange,
              ),
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _selectedStopIndex = i);
              },
            ));
          }

          final polylinePoints = validStops.map((s) => LatLng(s.lat!, s.lng!)).toList();
          final polylines = <Polyline>{
            if (polylinePoints.length >= 2)
              Polyline(
                polylineId: const PolylineId('route'),
                points: polylinePoints,
                color: ObsidianTheme.emerald,
                width: 4,
              ),
          };

          return Stack(
            children: [
              Positioned.fill(
                child: ObsidianMap(
                  center: center,
                  zoom: 13,
                  markers: markers,
                  polylines: polylines,
                  padding: EdgeInsets.only(bottom: mq.padding.bottom + 180, top: mq.padding.top + 80),
                  onMapCreated: (controller) {
                    if (validStops.length >= 2) {
                      final bounds = _boundsFromStops(validStops);
                      controller.animateCamera(CameraUpdate.newLatLngBounds(bounds, 60));
                    }
                  },
                ),
              ),

              // Layer 1: Top bar (glass)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: _TopBar(route: route),
              ),

              // Layer 2: Mission Card at bottom
              if (selectedStop != null)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: mq.padding.bottom + 90,
                  child: MissionCard(
                    key: ValueKey(selectedStop.jobId),
                    stop: selectedStop,
                    stopNumber: (selectedIdx ?? 0) + 1,
                    totalStops: route.jobSequence.length,
                    distanceLabel: route.distanceLabel,
                    driveTimeLabel: route.driveTimeLabel,
                    onViewJob: () => context.push('/jobs/${selectedStop.jobId}'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  int? _findActiveStopIndex(RouteRun route) {
    for (int i = 0; i < route.jobSequence.length; i++) {
      if (!route.jobSequence[i].isCompleted) return i;
    }
    return null;
  }

  LatLngBounds _boundsFromStops(List<RouteStop> stops) {
    double minLat = double.infinity, maxLat = -double.infinity;
    double minLng = double.infinity, maxLng = -double.infinity;
    for (final s in stops) {
      if (s.lat == null || s.lng == null) continue;
      minLat = min(minLat, s.lat!);
      maxLat = max(maxLat, s.lat!);
      minLng = min(minLng, s.lng!);
      maxLng = max(maxLng, s.lng!);
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Top Bar ──────────────────────────────────────════════
// ═══════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  final RouteRun route;
  const _TopBar({required this.route});

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: EdgeInsets.fromLTRB(16, mq.padding.top + 8, 16, 12),
          decoration: BoxDecoration(
            color: ObsidianTheme.void_.withValues(alpha: 0.75),
            border: Border(
              bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
            ),
          ),
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
                  child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 18),
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'FLIGHT PATH',
                    style: GoogleFonts.jetBrainsMono(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                    ),
                  ),
                  Text(
                    "Today's optimized route",
                    style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                  ),
                ],
              ),
              const Spacer(),
              _StatChip(icon: PhosphorIconsLight.path, label: route.distanceLabel, color: ObsidianTheme.blue),
              const SizedBox(width: 6),
              _StatChip(icon: PhosphorIconsLight.timer, label: route.driveTimeLabel, color: ObsidianTheme.emerald),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -12, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: color.withValues(alpha: 0.08),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.jetBrainsMono(color: color, fontSize: 10, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── States ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _LoadingState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ObsidianTheme.emerald.withValues(alpha: 0.06),
            ),
            child: const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: ObsidianTheme.emerald,
                  strokeWidth: 2,
                ),
              ),
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scaleXY(begin: 1.0, end: 1.08, duration: 1500.ms),
          const SizedBox(height: 16),
          Text(
            'Computing flight path…',
            style: GoogleFonts.jetBrainsMono(
              color: ObsidianTheme.textTertiary,
              fontSize: 12,
              letterSpacing: 1,
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fadeIn(duration: 800.ms),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(PhosphorIconsLight.warning, color: ObsidianTheme.amber, size: 36),
          const SizedBox(height: 12),
          Text('Failed to load route', style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 14)),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: ObsidianTheme.surface2,
                border: Border.all(color: ObsidianTheme.borderMedium),
              ),
              child: Text('Retry', style: GoogleFonts.inter(color: Colors.white70, fontSize: 13)),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final WidgetRef ref;
  const _EmptyState({required this.ref});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 18),
                ),
              ),
            ),
            const Spacer(),
            _PathfinderEmptyAnimation(),
            const SizedBox(height: 24),
            Text(
              'No route planned yet',
              style: GoogleFonts.inter(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'Optimize your schedule to generate\nan efficient flight path for today.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: () async {
                HapticFeedback.mediumImpact();
                await generateOptimizedRoute();
                ref.invalidate(todayRouteProvider);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    colors: [ObsidianTheme.emerald, ObsidianTheme.emerald.withValues(alpha: 0.85)],
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(PhosphorIconsBold.sparkle, color: Colors.white, size: 16),
                    const SizedBox(width: 8),
                    Text(
                      'Optimize Route',
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            )
                .animate()
                .fadeIn(delay: 400.ms, duration: 400.ms)
                .moveY(begin: 8, delay: 400.ms, duration: 400.ms),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Pathfinder Empty Animation ───────────────────────────
// ═══════════════════════════════════════════════════════════

class _PathfinderEmptyAnimation extends StatefulWidget {
  @override
  State<_PathfinderEmptyAnimation> createState() => _PathfinderEmptyAnimationState();
}

class _PathfinderEmptyAnimationState extends State<_PathfinderEmptyAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      height: 140,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) => CustomPaint(painter: _PathfinderPainter(_ctrl.value)),
      ),
    )
        .animate()
        .fadeIn(duration: 600.ms)
        .scaleXY(begin: 0.9, end: 1.0, duration: 600.ms, curve: Curves.easeOutCubic);
  }
}

class _PathfinderPainter extends CustomPainter {
  final double t;
  _PathfinderPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width * 0.38;

    // Orbit ring
    canvas.drawCircle(
      Offset(cx, cy),
      r,
      Paint()
        ..color = const Color(0xFF10B981).withValues(alpha: 0.12)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    // Inner ring
    canvas.drawCircle(
      Offset(cx, cy),
      r * 0.55,
      Paint()
        ..color = const Color(0xFF3B82F6).withValues(alpha: 0.08)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    // Center pin
    canvas.drawCircle(Offset(cx, cy), 5, Paint()..color = const Color(0xFF10B981).withValues(alpha: 0.4));

    // Orbiting dot
    final angle = t * pi * 2;
    final dotX = cx + r * cos(angle);
    final dotY = cy + r * sin(angle);

    canvas.drawCircle(
      Offset(dotX, dotY),
      6,
      Paint()
        ..color = const Color(0xFF10B981).withValues(alpha: 0.2)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
    canvas.drawCircle(Offset(dotX, dotY), 3.5, Paint()..color = const Color(0xFF10B981));

    // Trail dots
    for (int i = 1; i <= 5; i++) {
      final trailAngle = angle - i * 0.15;
      final tx = cx + r * cos(trailAngle);
      final ty = cy + r * sin(trailAngle);
      canvas.drawCircle(
        Offset(tx, ty),
        2.0 - i * 0.3,
        Paint()..color = const Color(0xFF10B981).withValues(alpha: 0.3 - i * 0.05),
      );
    }

    // Static waypoint dots
    final waypoints = [0.0, pi / 2, pi, 3 * pi / 2];
    for (final w in waypoints) {
      final wx = cx + r * 0.55 * cos(w);
      final wy = cy + r * 0.55 * sin(w);
      canvas.drawCircle(Offset(wx, wy), 3, Paint()..color = const Color(0xFF27272A));
      canvas.drawCircle(
        Offset(wx, wy),
        3,
        Paint()
          ..color = const Color(0xFF3B82F6).withValues(alpha: 0.3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }
  }

  @override
  bool shouldRepaint(_PathfinderPainter old) => old.t != t;
}
