import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/dispatch_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/obsidian_map.dart';
import 'package:iworkr_mobile/models/fleet_position.dart';

/// The Overwatch — Live Tactical Dispatch Map.
///
/// Admin-only screen showing real-time technician positions,
/// breadcrumb trails, job status overlays, and route replay.
class OverwatchScreen extends ConsumerStatefulWidget {
  const OverwatchScreen({super.key});

  @override
  ConsumerState<OverwatchScreen> createState() => _OverwatchScreenState();
}

class _OverwatchScreenState extends ConsumerState<OverwatchScreen>
    with TickerProviderStateMixin {
  int? _selectedTechIndex;
  bool _showHistory = false;
  double _replayProgress = 0;
  late AnimationController _pulseCtrl;
  late AnimationController _scanCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _scanCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _scanCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fleetAsync = ref.watch(fleetPositionsProvider);
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: Stack(
        children: [
          // Google Maps tactical canvas
          Positioned.fill(
            child: fleetAsync.when(
              data: (positions) {
                final markers = <Marker>{};
                for (int i = 0; i < positions.length; i++) {
                  final p = positions[i];
                  markers.add(Marker(
                    markerId: MarkerId('tech-$i'),
                    position: LatLng(p.lat, p.lng),
                    icon: BitmapDescriptor.defaultMarkerWithHue(
                      _selectedTechIndex == i ? BitmapDescriptor.hueGreen : BitmapDescriptor.hueAzure,
                    ),
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _selectedTechIndex = _selectedTechIndex == i ? null : i);
                    },
                  ));
                }
                final center = positions.isNotEmpty
                    ? LatLng(
                        positions.map((p) => p.lat).reduce((a, b) => a + b) / positions.length,
                        positions.map((p) => p.lng).reduce((a, b) => a + b) / positions.length,
                      )
                    : const LatLng(-27.4698, 153.0251);
                return ObsidianMap(
                  center: center,
                  zoom: 12,
                  markers: markers,
                  padding: EdgeInsets.only(
                    bottom: mq.padding.bottom + 100,
                    top: mq.padding.top + 80,
                  ),
                  onMapCreated: (controller) {
                    if (positions.length >= 2) {
                      double minLat = double.infinity, maxLat = -double.infinity;
                      double minLng = double.infinity, maxLng = -double.infinity;
                      for (final p in positions) {
                        minLat = min(minLat, p.lat);
                        maxLat = max(maxLat, p.lat);
                        minLng = min(minLng, p.lng);
                        maxLng = max(maxLng, p.lng);
                      }
                      controller.animateCamera(CameraUpdate.newLatLngBounds(
                        LatLngBounds(
                          southwest: LatLng(minLat, minLng),
                          northeast: LatLng(maxLat, maxLng),
                        ),
                        60,
                      ));
                    }
                  },
                );
              },
              loading: () => ObsidianMap(
                center: const LatLng(-27.4698, 153.0251),
                zoom: 12,
                interactive: false,
              ),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ),

          // Top bar
          Positioned(
            top: mq.padding.top + 8,
            left: 16,
            right: 16,
            child: _TopBar(
              techCount: fleetAsync.valueOrNull?.length ?? 0,
              showHistory: _showHistory,
              onToggleHistory: () {
                HapticFeedback.selectionClick();
                setState(() => _showHistory = !_showHistory);
              },
              onClose: () => Navigator.of(context).pop(),
            ),
          ),

          // Tech roster (left sidebar chips)
          Positioned(
            top: mq.padding.top + 72,
            left: 12,
            bottom: _selectedTechIndex != null ? 320 : 100,
            child: fleetAsync.when(
              data: (positions) => _TechRoster(
                positions: positions,
                selectedIndex: _selectedTechIndex,
                onSelect: (i) {
                  HapticFeedback.mediumImpact();
                  setState(() => _selectedTechIndex = _selectedTechIndex == i ? null : i);
                },
              ),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ),

          // Mission Card (peek sheet) for selected tech
          if (_selectedTechIndex != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: fleetAsync.when(
                data: (positions) {
                  if (_selectedTechIndex! >= positions.length) return const SizedBox.shrink();
                  return _MissionCard(
                    position: positions[_selectedTechIndex!],
                    onClose: () => setState(() => _selectedTechIndex = null),
                    onCall: () => HapticFeedback.mediumImpact(),
                    onMessage: () => HapticFeedback.mediumImpact(),
                  );
                },
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ),

          // Route replay scrubber (when history is active)
          if (_showHistory)
            Positioned(
              bottom: mq.padding.bottom + 16,
              left: 20,
              right: 20,
              child: _ReplayScrubber(
                progress: _replayProgress,
                onChanged: (v) => setState(() => _replayProgress = v),
              ),
            ),

          // Loading overlay
          if (fleetAsync.isLoading)
            Positioned.fill(
              child: _LoadingOverlay(),
            ),

          // Empty state
          if (fleetAsync.valueOrNull?.isEmpty == true && !fleetAsync.isLoading)
            Positioned.fill(
              child: _EmptyState(),
            ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Tactical Map Painter ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _TacticalMapPainter extends CustomPainter {
  final List<FleetPosition> positions;
  final int? selectedIndex;
  final double pulseValue;
  final double scanValue;
  final bool showHistory;

  _TacticalMapPainter({
    required this.positions,
    required this.selectedIndex,
    required this.pulseValue,
    required this.scanValue,
    required this.showHistory,
  });

  static const _emerald = Color(0xFF10B981);
  static const _emeraldGlow = Color(0x4010B981);
  static const _blue = Color(0xFF3B82F6);
  static const _amber = Color(0xFFF59E0B);
  static const _rose = Color(0xFFF43F5E);
  static const _zinc700 = Color(0xFF3F3F46);
  static const _zinc800 = Color(0xFF27272A);
  static const _zinc900 = Color(0xFF18181B);

  @override
  void paint(Canvas canvas, Size size) {
    _drawBackground(canvas, size);
    _drawGrid(canvas, size);
    _drawScanLine(canvas, size);

    if (positions.isEmpty) return;

    final offsets = _computePositions(size);

    if (showHistory) {
      _drawBreadcrumbTrails(canvas, offsets);
    }

    _drawTechMarkers(canvas, size, offsets);
  }

  void _drawBackground(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF050505),
    );

    // Subtle radial gradient from center
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      size.width * 0.7,
      Paint()
        ..shader = RadialGradient(
          colors: [
            _zinc900.withValues(alpha: 0.3),
            Colors.transparent,
          ],
        ).createShader(
          Rect.fromCircle(
            center: Offset(size.width / 2, size.height / 2),
            radius: size.width * 0.7,
          ),
        ),
    );
  }

  void _drawGrid(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.02)
      ..strokeWidth = 0.5;

    const spacing = 40.0;

    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    // Crosshair at center
    final crossPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(size.width / 2, 0),
      Offset(size.width / 2, size.height),
      crossPaint,
    );
    canvas.drawLine(
      Offset(0, size.height / 2),
      Offset(size.width, size.height / 2),
      crossPaint,
    );
  }

  void _drawScanLine(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height * 0.45;
    final r = size.width * 0.42;
    final angle = scanValue * pi * 2;

    // Sweep arc
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: angle - 0.5,
        endAngle: angle,
        colors: [
          Colors.transparent,
          _emerald.withValues(alpha: 0.06),
        ],
        tileMode: TileMode.clamp,
      ).createShader(
        Rect.fromCircle(center: Offset(cx, cy), radius: r),
      );

    canvas.drawCircle(Offset(cx, cy), r, sweepPaint);

    // Range rings
    final ringPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;

    for (double factor = 0.25; factor <= 1.0; factor += 0.25) {
      canvas.drawCircle(Offset(cx, cy), r * factor, ringPaint);
    }
  }

  List<Offset> _computePositions(Size size) {
    if (positions.isEmpty) return [];

    double minLat = positions.first.lat, maxLat = positions.first.lat;
    double minLng = positions.first.lng, maxLng = positions.first.lng;

    for (final p in positions) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    final latRange = max(maxLat - minLat, 0.005);
    final lngRange = max(maxLng - minLng, 0.005);
    final padding = 80.0;

    return positions.map((p) {
      final x = padding + ((p.lng - minLng) / lngRange) * (size.width - padding * 2);
      final y = padding + ((maxLat - p.lat) / latRange) * (size.height - padding * 2 - 100);
      return Offset(x, y + 80);
    }).toList();
  }

  void _drawBreadcrumbTrails(Canvas canvas, List<Offset> offsets) {
    if (offsets.length < 2) return;

    // Draw connecting lines between positions as a simplified trail
    final trailPaint = Paint()
      ..color = _amber.withValues(alpha: 0.25)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path()..moveTo(offsets[0].dx, offsets[0].dy);
    for (int i = 1; i < offsets.length; i++) {
      path.lineTo(offsets[i].dx, offsets[i].dy);
    }
    canvas.drawPath(path, trailPaint);

    // Draw stop dots
    final dotPaint = Paint()..color = _amber.withValues(alpha: 0.4);
    for (final o in offsets) {
      canvas.drawCircle(o, 3, dotPaint);
    }
  }

  void _drawTechMarkers(Canvas canvas, Size size, List<Offset> offsets) {
    for (int i = 0; i < offsets.length && i < positions.length; i++) {
      final pos = positions[i];
      final offset = offsets[i];
      final isSelected = i == selectedIndex;

      _drawSingleMarker(canvas, offset, pos, isSelected);
    }
  }

  void _drawSingleMarker(Canvas canvas, Offset center, FleetPosition pos, bool isSelected) {
    final markerRadius = isSelected ? 22.0 : 18.0;

    // Heading cone
    if (pos.isDriving || pos.isWorking) {
      final headingRad = pos.heading * pi / 180;
      final conePath = Path();
      final coneLength = markerRadius * 2.5;
      final coneWidth = pi / 6;

      conePath.moveTo(center.dx, center.dy);
      conePath.lineTo(
        center.dx + coneLength * sin(headingRad - coneWidth),
        center.dy - coneLength * cos(headingRad - coneWidth),
      );
      conePath.lineTo(
        center.dx + coneLength * sin(headingRad + coneWidth),
        center.dy - coneLength * cos(headingRad + coneWidth),
      );
      conePath.close();

      canvas.drawPath(
        conePath,
        Paint()
          ..color = (pos.isDriving ? _blue : _emerald).withValues(alpha: 0.08)
          ..style = PaintingStyle.fill,
      );
    }

    // Pulse glow for active techs
    if (pos.isOnline) {
      final pulseRadius = markerRadius + 8 + pulseValue * 12;
      canvas.drawCircle(
        center,
        pulseRadius,
        Paint()
          ..color = _emeraldGlow.withValues(alpha: 0.15 * (1 - pulseValue)),
      );
    }

    // Outer ring
    canvas.drawCircle(
      center,
      markerRadius + 2,
      Paint()
        ..color = isSelected
            ? _emerald
            : (pos.isOnline ? Colors.white.withValues(alpha: 0.3) : _zinc700)
        ..style = PaintingStyle.stroke
        ..strokeWidth = isSelected ? 2.5 : 1.5,
    );

    // Avatar circle
    final Color bgColor;
    if (!pos.isOnline) {
      bgColor = _zinc800;
    } else if (pos.isDriving) {
      bgColor = const Color(0xFF1E3A5F);
    } else if (pos.isWorking) {
      bgColor = const Color(0xFF1A3D2E);
    } else {
      bgColor = _zinc800;
    }

    canvas.drawCircle(center, markerRadius, Paint()..color = bgColor);

    // Initials
    final textPainter = TextPainter(
      text: TextSpan(
        text: pos.initials,
        style: TextStyle(
          color: pos.isOnline ? Colors.white : _zinc700,
          fontSize: isSelected ? 11 : 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    textPainter.paint(
      canvas,
      Offset(
        center.dx - textPainter.width / 2,
        center.dy - textPainter.height / 2,
      ),
    );

    // Status dot
    final dotColor = pos.isDriving
        ? _blue
        : (pos.isWorking ? _emerald : (pos.isOnline ? _amber : _rose));
    canvas.drawCircle(
      Offset(center.dx + markerRadius * 0.7, center.dy - markerRadius * 0.7),
      4,
      Paint()..color = const Color(0xFF050505),
    );
    canvas.drawCircle(
      Offset(center.dx + markerRadius * 0.7, center.dy - markerRadius * 0.7),
      3,
      Paint()..color = dotColor,
    );

    // Speed label for driving techs
    if (pos.isDriving && pos.speed > 0) {
      final speedPainter = TextPainter(
        text: TextSpan(
          text: pos.speedLabel,
          style: TextStyle(
            color: _blue.withValues(alpha: 0.8),
            fontSize: 8,
            fontWeight: FontWeight.w600,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      speedPainter.paint(
        canvas,
        Offset(center.dx - speedPainter.width / 2, center.dy + markerRadius + 6),
      );
    }

    // Name label
    if (isSelected) {
      final namePainter = TextPainter(
        text: TextSpan(
          text: pos.displayName,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      // Label background
      final labelRect = RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(center.dx, center.dy - markerRadius - 16),
          width: namePainter.width + 16,
          height: 20,
        ),
        const Radius.circular(6),
      );
      canvas.drawRRect(
        labelRect,
        Paint()..color = const Color(0xE6050505),
      );
      canvas.drawRRect(
        labelRect,
        Paint()
          ..color = _emerald.withValues(alpha: 0.3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5,
      );

      namePainter.paint(
        canvas,
        Offset(
          center.dx - namePainter.width / 2,
          center.dy - markerRadius - 16 - namePainter.height / 2,
        ),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _TacticalMapPainter old) => true;
}

// ═══════════════════════════════════════════════════════════
// ── Top Bar ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  final int techCount;
  final bool showHistory;
  final VoidCallback onToggleHistory;
  final VoidCallback onClose;

  const _TopBar({
    required this.techCount,
    required this.showHistory,
    required this.onToggleHistory,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF050505).withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Row(
            children: [
              GestureDetector(
                onTap: onClose,
                child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 20),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'THE OVERWATCH',
                    style: GoogleFonts.jetBrainsMono(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                    ),
                  ),
                  Text(
                    '$techCount active · Live',
                    style: GoogleFonts.inter(
                      color: ObsidianTheme.emerald,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              // History toggle
              GestureDetector(
                onTap: onToggleHistory,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: showHistory
                        ? ObsidianTheme.amber.withValues(alpha: 0.1)
                        : Colors.white.withValues(alpha: 0.04),
                    border: Border.all(
                      color: showHistory
                          ? ObsidianTheme.amber.withValues(alpha: 0.2)
                          : Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        PhosphorIconsLight.clockCounterClockwise,
                        size: 14,
                        color: showHistory ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'TRAIL',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 9,
                          color: showHistory ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Live indicator
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald,
                  boxShadow: [
                    BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 6),
                  ],
                ),
              ),
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

// ═══════════════════════════════════════════════════════════
// ── Tech Roster (Left Sidebar) ───────────────────────────
// ═══════════════════════════════════════════════════════════

class _TechRoster extends StatelessWidget {
  final List<FleetPosition> positions;
  final int? selectedIndex;
  final ValueChanged<int> onSelect;

  const _TechRoster({
    required this.positions,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 52,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: positions.length,
        itemBuilder: (_, i) {
          final pos = positions[i];
          final isSelected = i == selectedIndex;
          final Color statusColor;
          if (pos.isDriving) {
            statusColor = ObsidianTheme.blue;
          } else if (pos.isWorking) {
            statusColor = ObsidianTheme.emerald;
          } else {
            statusColor = ObsidianTheme.amber;
          }

          return GestureDetector(
            onTap: () => onSelect(i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.only(bottom: 8),
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? statusColor.withValues(alpha: 0.15)
                    : const Color(0xFF0A0A0A).withValues(alpha: 0.8),
                border: Border.all(
                  color: isSelected ? statusColor : Colors.white.withValues(alpha: 0.08),
                  width: isSelected ? 2 : 1,
                ),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Text(
                      pos.initials,
                      style: GoogleFonts.inter(
                        color: isSelected ? statusColor : ObsidianTheme.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 2,
                    right: 2,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: statusColor,
                        border: Border.all(color: const Color(0xFF050505), width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(delay: Duration(milliseconds: 100 + i * 60), duration: 400.ms)
              .moveX(begin: -16, delay: Duration(milliseconds: 100 + i * 60), duration: 400.ms, curve: Curves.easeOutCubic);
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Mission Card (Peek Sheet) ────────────────────────────
// ═══════════════════════════════════════════════════════════

class _MissionCard extends StatelessWidget {
  final FleetPosition position;
  final VoidCallback onClose;
  final VoidCallback onCall;
  final VoidCallback onMessage;

  const _MissionCard({
    required this.position,
    required this.onClose,
    required this.onCall,
    required this.onMessage,
  });

  Color get _statusColor {
    if (position.isDriving) return ObsidianTheme.blue;
    if (position.isWorking) return ObsidianTheme.emerald;
    return ObsidianTheme.amber;
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: EdgeInsets.fromLTRB(20, 16, 20, mq.padding.bottom + 20),
          decoration: BoxDecoration(
            color: const Color(0xFF0A0A0A).withValues(alpha: 0.92),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: ObsidianTheme.borderMedium,
                ),
              ),
              const SizedBox(height: 16),

              // Header row
              Row(
                children: [
                  // Avatar
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _statusColor.withValues(alpha: 0.12),
                      border: Border.all(color: _statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Center(
                      child: Text(
                        position.initials,
                        style: GoogleFonts.inter(
                          color: _statusColor,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          position.displayName,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _statusColor,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              position.statusLabel,
                              style: GoogleFonts.inter(
                                color: _statusColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: onClose,
                    child: Icon(PhosphorIconsLight.x, color: ObsidianTheme.textTertiary, size: 20),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Stats row
              Row(
                children: [
                  _StatChip(
                    icon: PhosphorIconsLight.speedometer,
                    label: position.speedLabel,
                    color: position.isDriving ? ObsidianTheme.blue : ObsidianTheme.textTertiary,
                  ),
                  const SizedBox(width: 8),
                  _StatChip(
                    icon: PhosphorIconsLight.batteryHigh,
                    label: position.batteryLabel,
                    color: position.battery > 0.2 ? ObsidianTheme.emerald : ObsidianTheme.rose,
                  ),
                  const SizedBox(width: 8),
                  _StatChip(
                    icon: PhosphorIconsLight.crosshair,
                    label: position.accuracy != null
                        ? '${position.accuracy!.toInt()}m'
                        : '--',
                    color: ObsidianTheme.textTertiary,
                  ),
                ],
              ),

              // Current job section
              if (position.jobTitle != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: Colors.white.withValues(alpha: 0.03),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(PhosphorIconsLight.briefcase, color: ObsidianTheme.emerald, size: 14),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              position.jobTitle!,
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      if (position.jobTasksTotal != null && position.jobTasksTotal! > 0) ...[
                        const SizedBox(height: 10),
                        // Subtask progress bar
                        Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(3),
                                child: LinearProgressIndicator(
                                  value: position.taskProgress,
                                  backgroundColor: Colors.white.withValues(alpha: 0.06),
                                  valueColor: const AlwaysStoppedAnimation(ObsidianTheme.emerald),
                                  minHeight: 6,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              '${position.jobTasksCompleted ?? 0}/${position.jobTasksTotal}',
                              style: GoogleFonts.jetBrainsMono(
                                color: ObsidianTheme.emerald,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: onCall,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(PhosphorIconsBold.phone, size: 14, color: ObsidianTheme.emerald),
                            const SizedBox(width: 8),
                            Text(
                              'Call',
                              style: GoogleFonts.inter(
                                color: ObsidianTheme.emerald,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: onMessage,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: ObsidianTheme.blue.withValues(alpha: 0.08),
                          border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(PhosphorIconsBold.chatCircle, size: 14, color: ObsidianTheme.blue),
                            const SizedBox(width: 8),
                            Text(
                              'Message',
                              style: GoogleFonts.inter(
                                color: ObsidianTheme.blue,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 300.ms)
        .moveY(begin: 40, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _StatChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: color.withValues(alpha: 0.06),
          border: Border.all(color: color.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Route Replay Scrubber ────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ReplayScrubber extends StatelessWidget {
  final double progress;
  final ValueChanged<double> onChanged;

  const _ReplayScrubber({required this.progress, required this.onChanged});

  String _timeLabel(double t) {
    final hour = 8 + (t * 9).toInt();
    final min = ((t * 9 * 60) % 60).toInt();
    return '${hour.toString().padLeft(2, '0')}:${min.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: BoxDecoration(
            color: const Color(0xFF050505).withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.15)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Icon(PhosphorIconsLight.play, color: ObsidianTheme.amber, size: 14),
                  const SizedBox(width: 8),
                  Text(
                    'ROUTE REPLAY',
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.amber,
                      fontSize: 9,
                      letterSpacing: 1.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _timeLabel(progress),
                    style: GoogleFonts.jetBrainsMono(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              SliderTheme(
                data: SliderThemeData(
                  activeTrackColor: ObsidianTheme.amber,
                  inactiveTrackColor: Colors.white.withValues(alpha: 0.06),
                  thumbColor: ObsidianTheme.amber,
                  overlayColor: ObsidianTheme.amber.withValues(alpha: 0.1),
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                  trackHeight: 3,
                ),
                child: Slider(
                  value: progress,
                  onChanged: onChanged,
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('08:00', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 9)),
                  Text('17:00', style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 9)),
                ],
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 300.ms)
        .moveY(begin: 20, duration: 300.ms, curve: Curves.easeOutCubic);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Loading Overlay ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _LoadingOverlay extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 80,
            height: 80,
            child: CustomPaint(painter: _RadarPainter())
                .animate(onPlay: (c) => c.repeat())
                .rotate(duration: 3000.ms),
          ),
          const SizedBox(height: 20),
          Text(
            'ACQUIRING SIGNALS',
            style: GoogleFonts.jetBrainsMono(
              color: ObsidianTheme.emerald,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: FontWeight.w600,
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fadeIn(duration: 800.ms)
              .then()
              .fadeOut(duration: 800.ms),
        ],
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width * 0.4;

    final ringPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    canvas.drawCircle(Offset(cx, cy), r, ringPaint);
    canvas.drawCircle(Offset(cx, cy), r * 0.6, ringPaint);
    canvas.drawCircle(Offset(cx, cy), r * 0.3, ringPaint);

    // Sweep
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        colors: [
          Colors.transparent,
          ObsidianTheme.emerald.withValues(alpha: 0.3),
        ],
      ).createShader(
        Rect.fromCircle(center: Offset(cx, cy), radius: r),
      );
    canvas.drawCircle(Offset(cx, cy), r, sweepPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ═══════════════════════════════════════════════════════════
// ── Empty State ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 100,
            height: 100,
            child: CustomPaint(painter: _SatellitePainter())
                .animate(onPlay: (c) => c.repeat())
                .rotate(duration: 8000.ms),
          ),
          const SizedBox(height: 24),
          Text(
            'NO SIGNALS DETECTED',
            style: GoogleFonts.jetBrainsMono(
              color: ObsidianTheme.textSecondary,
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No active technicians on duty.\nPositions will appear when team members start their shift.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: ObsidianTheme.textTertiary,
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 500.ms, duration: 600.ms);
  }
}

class _SatellitePainter extends CustomPainter {
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
        ..color = Colors.white.withValues(alpha: 0.05)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    // Center dot
    canvas.drawCircle(
      Offset(cx, cy),
      4,
      Paint()..color = ObsidianTheme.textTertiary.withValues(alpha: 0.3),
    );

    // Satellite dot on orbit
    canvas.drawCircle(
      Offset(cx + r, cy),
      5,
      Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.5),
    );
    canvas.drawCircle(
      Offset(cx + r, cy),
      3,
      Paint()..color = ObsidianTheme.emerald,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
