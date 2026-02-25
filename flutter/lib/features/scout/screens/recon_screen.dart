import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/scout_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/models/site_scan.dart';

/// Recon Mode — "Terminator Vision" viewfinder with real-time detection
/// simulation, yield counter, bounding boxes, and grid overlay.
class ReconScreen extends ConsumerStatefulWidget {
  final String? jobId;
  const ReconScreen({super.key, this.jobId});

  @override
  ConsumerState<ReconScreen> createState() => _ReconScreenState();
}

class _ReconScreenState extends ConsumerState<ReconScreen>
    with TickerProviderStateMixin {
  SiteScan? _currentScan;
  bool _scanning = false;
  double _yieldCounter = 0;
  int _detectionCount = 0;
  final List<_LiveDetection> _detections = [];
  late AnimationController _gridPulse;
  late AnimationController _scanLine;

  @override
  void initState() {
    super.initState();
    _gridPulse = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
    _scanLine = AnimationController(vsync: this, duration: const Duration(seconds: 3))
      ..repeat();
  }

  @override
  void dispose() {
    _gridPulse.dispose();
    _scanLine.dispose();
    super.dispose();
  }

  Future<void> _startRecon() async {
    HapticFeedback.heavyImpact();
    final scan = await startSiteScan(jobId: widget.jobId);
    if (scan != null) {
      setState(() {
        _currentScan = scan;
        _scanning = true;
      });
    }
  }

  Future<void> _simulateDetection() async {
    if (_currentScan == null) return;
    HapticFeedback.mediumImpact();

    final rng = math.Random();
    final template = _detectionTemplates[rng.nextInt(_detectionTemplates.length)];

    final detection = await addDetection(
      scanId: _currentScan!.id,
      detectionType: template['type'] as String,
      label: template['label'] as String,
      confidence: 0.7 + rng.nextDouble() * 0.25,
      condition: template['condition'] as String?,
      severity: template['severity'] as String?,
      category: template['category'] as String?,
      make: template['make'] as String?,
      estimatedAgeYears: template['age'] as int?,
      opportunityValue: (template['value'] as num?)?.toDouble() ?? 0,
      suggestedAction: template['action'] as String?,
      boundingBox: {
        'x': 0.1 + rng.nextDouble() * 0.4,
        'y': 0.1 + rng.nextDouble() * 0.4,
        'w': 0.2 + rng.nextDouble() * 0.2,
        'h': 0.15 + rng.nextDouble() * 0.15,
      },
    );

    if (detection != null) {
      setState(() {
        _detectionCount++;
        _yieldCounter += detection.opportunityValue;
        _detections.add(_LiveDetection(
          label: detection.label,
          condition: detection.conditionLabel,
          type: detection.detectionType,
          confidence: detection.confidence,
          value: detection.opportunityValue,
          x: (detection.boundingBox?['x'] as num?)?.toDouble() ?? 0.3,
          y: (detection.boundingBox?['y'] as num?)?.toDouble() ?? 0.3,
          w: (detection.boundingBox?['w'] as num?)?.toDouble() ?? 0.3,
          h: (detection.boundingBox?['h'] as num?)?.toDouble() ?? 0.2,
        ));
      });
    }
  }

  Future<void> _completeRecon() async {
    if (_currentScan == null) return;
    HapticFeedback.heavyImpact();

    setState(() => _scanning = false);
    final score = await completeScan(_currentScan!.id);
    ref.invalidate(recentScansProvider);

    if (mounted && score != null) {
      context.push('/scout/results/${_currentScan!.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: _scanning ? _buildViewfinder() : _buildPreRecon(),
    );
  }

  Widget _buildPreRecon() {
    final c = context.iColors;
    return SafeArea(
      child: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 140,
                    height: 140,
                    child: AnimatedBuilder(
                      animation: _gridPulse,
                      builder: (context, child) {
                        return CustomPaint(
                          painter: _TargetReticlePainter(phase: _gridPulse.value),
                        );
                      },
                    ),
                  )
                      .animate(onPlay: (ctrl) => ctrl.repeat(reverse: true))
                      .scaleXY(begin: 1.0, end: 1.04, duration: 2500.ms),
                  const SizedBox(height: 24),
                  Text(
                    'Visual Opportunity AI',
                    style: GoogleFonts.inter(
                      color: c.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Walk the site. The Scout identifies\nassets, defects, and revenue opportunities.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                  ),
                  const SizedBox(height: 32),
                  GestureDetector(
                    onTap: _startRecon,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: ObsidianTheme.gold.withValues(alpha: 0.12),
                        border: Border.all(color: ObsidianTheme.gold.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(PhosphorIconsLight.crosshair, color: ObsidianTheme.gold, size: 18),
                          const SizedBox(width: 10),
                          Text(
                            'START RECON',
                            style: GoogleFonts.jetBrainsMono(
                              color: ObsidianTheme.gold,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(delay: 400.ms, duration: 500.ms)
                      .moveY(begin: 8, delay: 400.ms, duration: 500.ms),
                ],
              ),
            ),
          ),

          _RecentScansSection(),
        ],
      ),
    );
  }

  Widget _buildViewfinder() {
    final c = context.iColors;
    return Stack(
      children: [
        Positioned.fill(
          child: AnimatedBuilder(
            animation: Listenable.merge([_gridPulse, _scanLine]),
            builder: (context, child) {
              return CustomPaint(
                painter: _ViewfinderPainter(
                  gridPulse: _gridPulse.value,
                  scanLinePos: _scanLine.value,
                  detections: _detections,
                ),
              );
            },
          ),
        ),

        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 20),
                    ),
                  ),
                  const SizedBox(width: 10),

                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: ObsidianTheme.rose.withValues(alpha: 0.15),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6, height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ObsidianTheme.rose,
                            boxShadow: [BoxShadow(color: ObsidianTheme.rose.withValues(alpha: 0.5), blurRadius: 4)],
                          ),
                        )
                            .animate(onPlay: (ctrl) => ctrl.repeat(reverse: true))
                            .scaleXY(begin: 1, end: 0.5, duration: 800.ms),
                        const SizedBox(width: 6),
                        Text(
                          'RECON',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.rose,
                            fontSize: 9,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),

                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: Colors.black.withValues(alpha: 0.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.eye, color: ObsidianTheme.gold, size: 12),
                        const SizedBox(width: 5),
                        Text(
                          '$_detectionCount',
                          style: GoogleFonts.jetBrainsMono(color: c.textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms),
        ),

        Positioned(
          top: 0,
          right: 16,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  gradient: LinearGradient(
                    colors: [
                      ObsidianTheme.gold.withValues(alpha: 0.12),
                      ObsidianTheme.gold.withValues(alpha: 0.05),
                    ],
                  ),
                  border: Border.all(color: ObsidianTheme.gold.withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'POTENTIAL',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.gold.withValues(alpha: 0.7),
                        fontSize: 8,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Text(
                      '\$${_yieldCounter.toStringAsFixed(0)}',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.gold,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
              .animate()
              .fadeIn(delay: 200.ms, duration: 400.ms),
        ),

        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _simulateDetection,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: ObsidianTheme.gold.withValues(alpha: 0.1),
                          border: Border.all(color: ObsidianTheme.gold.withValues(alpha: 0.2)),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(PhosphorIconsLight.crosshair, color: ObsidianTheme.gold, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                'DETECT',
                                style: GoogleFonts.jetBrainsMono(
                                  color: ObsidianTheme.gold,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: _completeRecon,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.25)),
                        ),
                        child: Center(
                          child: Text(
                            'COMPLETE',
                            style: GoogleFonts.jetBrainsMono(
                              color: ObsidianTheme.emerald,
                              fontSize: 12,
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
          )
              .animate()
              .fadeIn(delay: 300.ms, duration: 400.ms)
              .moveY(begin: 12, delay: 300.ms, duration: 400.ms),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(PhosphorIconsLight.arrowLeft, color: c.textSecondary, size: 20),
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'THE SCOUT',
                style: GoogleFonts.jetBrainsMono(
                  color: c.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'Visual Opportunity AI',
                style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: ObsidianTheme.gold.withValues(alpha: 0.08),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.eye, color: ObsidianTheme.gold, size: 12),
                const SizedBox(width: 4),
                Text(
                  'HUNTER',
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.gold,
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
}

class _RecentScansSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final scansAsync = ref.watch(recentScansProvider);

    return scansAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (scans) {
        final completed = scans.where((s) => s.isCompleted).take(3).toList();
        if (completed.isEmpty) return const SizedBox(height: 20);

        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RECENT SCANS',
                style: GoogleFonts.jetBrainsMono(
                  color: c.textTertiary,
                  fontSize: 9,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              ...completed.asMap().entries.map((e) {
                final scan = e.value;
                return GestureDetector(
                  onTap: () => context.push('/scout/results/${scan.id}'),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: c.hoverBg,
                      border: Border.all(color: c.border),
                    ),
                    child: Row(
                      children: [
                        Icon(PhosphorIconsLight.eye, color: ObsidianTheme.gold, size: 16),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${scan.detectionCount} detections',
                                style: GoogleFonts.inter(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                              Text(
                                scan.durationLabel,
                                style: GoogleFonts.jetBrainsMono(color: c.textTertiary, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          scan.opportunityLabel,
                          style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.gold, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(delay: Duration(milliseconds: 600 + e.key * 80), duration: 400.ms);
              }),
            ],
          ),
        );
      },
    );
  }
}

const _detectionTemplates = [
  {'type': 'asset', 'label': 'Split System A/C', 'condition': 'poor', 'severity': 'high', 'category': 'HVAC', 'make': 'Panasonic', 'age': 12, 'value': 450, 'action': 'Replace aging unit'},
  {'type': 'defect', 'label': 'Corroded Bracket', 'condition': 'critical', 'severity': 'critical', 'category': 'Structural', 'make': null, 'age': null, 'value': 145, 'action': 'Supply & Install Galv Bracket'},
  {'type': 'hazard', 'label': 'Blocked Fire Exit', 'condition': 'critical', 'severity': 'critical', 'category': 'Safety', 'make': null, 'age': null, 'value': 0, 'action': 'Clear obstruction'},
  {'type': 'asset', 'label': 'VRV Outdoor Unit', 'condition': 'fair', 'severity': 'medium', 'category': 'HVAC', 'make': 'Daikin', 'age': 8, 'value': 800, 'action': 'Schedule major service'},
  {'type': 'defect', 'label': 'Frayed Wiring', 'condition': 'poor', 'severity': 'high', 'category': 'Electrical', 'make': null, 'age': null, 'value': 320, 'action': 'Rewire distribution board'},
  {'type': 'compliance', 'label': 'Missing Exit Sign', 'condition': 'critical', 'severity': 'high', 'category': 'Compliance', 'make': null, 'age': null, 'value': 85, 'action': 'Install illuminated exit sign'},
  {'type': 'opportunity', 'label': 'Switchboard', 'condition': 'poor', 'severity': 'medium', 'category': 'Electrical', 'make': 'Clipsal', 'age': 20, 'value': 1200, 'action': 'Full switchboard upgrade'},
  {'type': 'asset', 'label': 'Fire Extinguisher', 'condition': 'fair', 'severity': 'low', 'category': 'Safety', 'make': 'Kidde', 'age': 4, 'value': 65, 'action': 'Replace expired extinguisher'},
  {'type': 'defect', 'label': 'Leaking Pipe Joint', 'condition': 'poor', 'severity': 'high', 'category': 'Plumbing', 'make': null, 'age': null, 'value': 280, 'action': 'Repair pipe joint'},
  {'type': 'opportunity', 'label': 'Lighting Panels', 'condition': 'fair', 'severity': 'low', 'category': 'Electrical', 'make': 'Philips', 'age': 10, 'value': 650, 'action': 'LED upgrade package'},
];

class _LiveDetection {
  final String label;
  final String condition;
  final String type;
  final double confidence;
  final double value;
  final double x, y, w, h;

  const _LiveDetection({
    required this.label,
    required this.condition,
    required this.type,
    required this.confidence,
    required this.value,
    required this.x,
    required this.y,
    required this.w,
    required this.h,
  });
}

class _ViewfinderPainter extends CustomPainter {
  final double gridPulse;
  final double scanLinePos;
  final List<_LiveDetection> detections;

  _ViewfinderPainter({required this.gridPulse, required this.scanLinePos, required this.detections});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = const Color(0xFF030306));

    final gridPaint = Paint()
      ..color = ObsidianTheme.gold.withValues(alpha: 0.02 + gridPulse * 0.015)
      ..strokeWidth = 0.5;
    for (double y = 0; y < size.height; y += 30) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 30) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    final scanY = scanLinePos * size.height;
    canvas.drawLine(
      Offset(0, scanY),
      Offset(size.width, scanY),
      Paint()
        ..color = ObsidianTheme.gold.withValues(alpha: 0.15)
        ..strokeWidth = 1,
    );
    canvas.drawRect(
      Rect.fromLTWH(0, scanY - 10, size.width, 20),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            ObsidianTheme.gold.withValues(alpha: 0.05),
            Colors.transparent,
          ],
        ).createShader(Rect.fromLTWH(0, scanY - 10, size.width, 20)),
    );

    _drawHUDCorners(canvas, size);

    for (final d in detections) {
      _drawBoundingBox(canvas, size, d);
    }
  }

  void _drawHUDCorners(Canvas canvas, Size size) {
    final p = Paint()
      ..color = ObsidianTheme.gold.withValues(alpha: 0.12)
      ..strokeWidth = 1;
    const m = 14.0;
    const l = 24.0;
    canvas.drawLine(const Offset(m, m), const Offset(m + l, m), p);
    canvas.drawLine(const Offset(m, m), const Offset(m, m + l), p);
    canvas.drawLine(Offset(size.width - m, m), Offset(size.width - m - l, m), p);
    canvas.drawLine(Offset(size.width - m, m), Offset(size.width - m, m + l), p);
    canvas.drawLine(Offset(m, size.height - m), Offset(m + l, size.height - m), p);
    canvas.drawLine(Offset(m, size.height - m), Offset(m, size.height - m - l), p);
    canvas.drawLine(Offset(size.width - m, size.height - m), Offset(size.width - m - l, size.height - m), p);
    canvas.drawLine(Offset(size.width - m, size.height - m), Offset(size.width - m, size.height - m - l), p);
  }

  void _drawBoundingBox(Canvas canvas, Size size, _LiveDetection d) {
    final rect = Rect.fromLTWH(d.x * size.width, d.y * size.height, d.w * size.width, d.h * size.height);

    final Color boxColor;
    if (d.type == 'hazard') {
      boxColor = ObsidianTheme.rose;
    } else if (d.value > 0) {
      boxColor = ObsidianTheme.gold;
    } else {
      boxColor = Colors.white.withValues(alpha: 0.5);
    }

    canvas.drawRect(rect, Paint()..color = boxColor.withValues(alpha: 0.06));
    final bp = Paint()
      ..color = boxColor.withValues(alpha: 0.6)
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    const cl = 10.0;
    canvas.drawLine(rect.topLeft, Offset(rect.left + cl, rect.top), bp);
    canvas.drawLine(rect.topLeft, Offset(rect.left, rect.top + cl), bp);
    canvas.drawLine(rect.topRight, Offset(rect.right - cl, rect.top), bp);
    canvas.drawLine(rect.topRight, Offset(rect.right, rect.top + cl), bp);
    canvas.drawLine(rect.bottomLeft, Offset(rect.left + cl, rect.bottom), bp);
    canvas.drawLine(rect.bottomLeft, Offset(rect.left, rect.bottom - cl), bp);
    canvas.drawLine(rect.bottomRight, Offset(rect.right - cl, rect.bottom), bp);
    canvas.drawLine(rect.bottomRight, Offset(rect.right, rect.bottom - cl), bp);

    final labelText = '${d.label} • ${d.condition}';
    final tp = TextPainter(
      text: TextSpan(
        text: labelText,
        style: TextStyle(color: boxColor, fontSize: 9, fontWeight: FontWeight.w600),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    final labelBg = RRect.fromRectAndRadius(
      Rect.fromLTWH(rect.left, rect.top - tp.height - 6, tp.width + 10, tp.height + 4),
      const Radius.circular(3),
    );
    canvas.drawRRect(labelBg, Paint()..color = const Color(0xDD050505));
    tp.paint(canvas, Offset(rect.left + 5, rect.top - tp.height - 4));

    if (d.value > 0) {
      final valueText = '\$${d.value.toStringAsFixed(0)}';
      final vp = TextPainter(
        text: TextSpan(
          text: valueText,
          style: TextStyle(color: ObsidianTheme.gold, fontSize: 10, fontWeight: FontWeight.w700),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final valBg = RRect.fromRectAndRadius(
        Rect.fromLTWH(rect.right - vp.width - 10, rect.bottom + 4, vp.width + 10, vp.height + 4),
        const Radius.circular(3),
      );
      canvas.drawRRect(valBg, Paint()..color = ObsidianTheme.gold.withValues(alpha: 0.15));
      vp.paint(canvas, Offset(rect.right - vp.width - 5, rect.bottom + 6));
    }
  }

  @override
  bool shouldRepaint(covariant _ViewfinderPainter oldDelegate) => true;
}

class _TargetReticlePainter extends CustomPainter {
  final double phase;
  _TargetReticlePainter({required this.phase});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;

    canvas.drawCircle(
      center, radius,
      Paint()
        ..color = ObsidianTheme.gold.withValues(alpha: 0.08 + phase * 0.06)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    canvas.drawCircle(
      center, radius * 0.6,
      Paint()
        ..color = ObsidianTheme.gold.withValues(alpha: 0.05 + phase * 0.04)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.5,
    );

    final cp = Paint()
      ..color = ObsidianTheme.gold.withValues(alpha: 0.25)
      ..strokeWidth = 0.5;
    canvas.drawLine(Offset(center.dx, center.dy - radius * 0.4), Offset(center.dx, center.dy + radius * 0.4), cp);
    canvas.drawLine(Offset(center.dx - radius * 0.4, center.dy), Offset(center.dx + radius * 0.4, center.dy), cp);

    canvas.drawCircle(center, 3, Paint()..color = ObsidianTheme.gold.withValues(alpha: 0.4 + phase * 0.3));

    final tickPaint = Paint()
      ..color = ObsidianTheme.gold.withValues(alpha: 0.15)
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.round;
    for (int i = 0; i < 12; i++) {
      final angle = (i * math.pi / 6) + phase * math.pi * 0.1;
      final inner = radius * 0.85;
      final outer = radius * 0.95;
      canvas.drawLine(
        Offset(center.dx + inner * math.cos(angle), center.dy + inner * math.sin(angle)),
        Offset(center.dx + outer * math.cos(angle), center.dy + outer * math.sin(angle)),
        tickPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _TargetReticlePainter oldDelegate) => oldDelegate.phase != phase;
}
