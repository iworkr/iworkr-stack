import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/iot_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/models/iot_device.dart';

/// IoT Telemetry — BLE device discovery radar, live ECG-style graphs,
/// and alert thresholds. "Medical Monitor" aesthetic.
class IoTTelemetryScreen extends ConsumerStatefulWidget {
  const IoTTelemetryScreen({super.key});

  @override
  ConsumerState<IoTTelemetryScreen> createState() => _IoTTelemetryScreenState();
}

class _IoTTelemetryScreenState extends ConsumerState<IoTTelemetryScreen>
    with TickerProviderStateMixin {
  IoTDevice? _selectedDevice;
  late AnimationController _radarSweep;
  late AnimationController _ecgScroll;

  @override
  void initState() {
    super.initState();
    _radarSweep = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat();
    _ecgScroll = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
  }

  @override
  void dispose() {
    _radarSweep.dispose();
    _ecgScroll.dispose();
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
            Expanded(
              child: _selectedDevice == null
                  ? _DeviceList(
                      onSelect: (d) {
                        HapticFeedback.mediumImpact();
                        setState(() => _selectedDevice = d);
                      },
                      radarController: _radarSweep,
                    )
                  : _DeviceStream(
                      device: _selectedDevice!,
                      ecgController: _ecgScroll,
                      onBack: () => setState(() => _selectedDevice = null),
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
            onTap: () {
              if (_selectedDevice != null) {
                setState(() => _selectedDevice = null);
              } else {
                Navigator.of(context).pop();
              }
            },
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
                _selectedDevice != null ? _selectedDevice!.name.toUpperCase() : 'THE PULSE',
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                _selectedDevice != null ? _selectedDevice!.typeLabel : 'IoT Telemetry',
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
              ),
            ],
          ),
          const Spacer(),
          if (_selectedDevice != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6, height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ObsidianTheme.emerald,
                      boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 4)],
                    ),
                  )
                      .animate(onPlay: (c) => c.repeat(reverse: true))
                      .scaleXY(begin: 1, end: 0.6, duration: 1000.ms),
                  const SizedBox(width: 6),
                  Text(
                    'LIVE',
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.emerald,
                      fontSize: 9,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

/// Device discovery with radar animation
class _DeviceList extends ConsumerWidget {
  final ValueChanged<IoTDevice> onSelect;
  final AnimationController radarController;

  const _DeviceList({required this.onSelect, required this.radarController});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devicesAsync = ref.watch(iotDevicesProvider);

    return devicesAsync.when(
      loading: () => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 120, height: 120,
              child: AnimatedBuilder(
                animation: radarController,
                builder: (context, child) {
                  return CustomPaint(
                    painter: _RadarPainter(sweep: radarController.value),
                    size: const Size(120, 120),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Scanning for devices...',
              style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
            ),
          ],
        ),
      ),
      error: (_, __) => const AnimatedEmptyState(
        type: EmptyStateType.radar,
        title: 'Scan Failed',
        subtitle: 'Check Bluetooth is enabled',
      ),
      data: (devices) {
        if (devices.isEmpty) {
          return Column(
            children: [
              const SizedBox(height: 40),
              // Radar animation
              SizedBox(
                width: 160, height: 160,
                child: AnimatedBuilder(
                  animation: radarController,
                  builder: (context, child) {
                    return CustomPaint(
                      painter: _RadarPainter(sweep: radarController.value),
                      size: const Size(160, 160),
                    );
                  },
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'No IoT devices found',
                style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 15, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              Text(
                'Bring BLE sensors within range\nand ensure Bluetooth is on',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
              ),
            ],
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          itemCount: devices.length + 1,
          itemBuilder: (context, index) {
            if (index == 0) {
              return SizedBox(
                height: 120,
                child: Center(
                  child: AnimatedBuilder(
                    animation: radarController,
                    builder: (context, child) {
                      return CustomPaint(
                        painter: _RadarPainter(sweep: radarController.value),
                        size: const Size(100, 100),
                      );
                    },
                  ),
                ),
              );
            }
            final device = devices[index - 1];
            return _DeviceCard(device: device, index: index - 1, onTap: () => onSelect(device));
          },
        );
      },
    );
  }
}

class _DeviceCard extends StatelessWidget {
  final IoTDevice device;
  final int index;
  final VoidCallback onTap;
  const _DeviceCard({required this.device, required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white.withValues(alpha: 0.03),
          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.08)),
        ),
        child: Row(
          children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.12)),
              ),
              child: Icon(
                device.deviceType == 'manifold'
                    ? PhosphorIconsLight.thermometerHot
                    : device.deviceType == 'vibration'
                        ? PhosphorIconsLight.waveform
                        : PhosphorIconsLight.pulse,
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
                    device.name,
                    style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        device.typeLabel,
                        style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                      ),
                      if (device.batteryLevel != null) ...[
                        const SizedBox(width: 8),
                        Icon(
                          device.lowBattery ? PhosphorIconsLight.batteryLow : PhosphorIconsLight.batteryFull,
                          color: device.lowBattery ? ObsidianTheme.rose : ObsidianTheme.textTertiary,
                          size: 12,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          '${device.batteryLevel}%',
                          style: GoogleFonts.jetBrainsMono(
                            color: device.lowBattery ? ObsidianTheme.rose : ObsidianTheme.textTertiary,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Icon(PhosphorIconsLight.caretRight, color: ObsidianTheme.textTertiary, size: 16),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 100 + index * 60), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: 100 + index * 60), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

/// Live data stream view for a device
class _DeviceStream extends ConsumerWidget {
  final IoTDevice device;
  final AnimationController ecgController;
  final VoidCallback onBack;

  const _DeviceStream({
    required this.device,
    required this.ecgController,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readingsAsync = ref.watch(deviceReadingsProvider(device.id));

    return readingsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (readings) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            // ECG-style graph
            _ECGGraph(readings: readings, ecgController: ecgController),
            const SizedBox(height: 16),

            // Current values
            if (readings.isNotEmpty) ...[
              _ReadingCards(readings: readings.take(4).toList()),
              const SizedBox(height: 16),
            ],

            // Reading history
            Text(
              'READING HISTORY',
              style: GoogleFonts.jetBrainsMono(
                color: ObsidianTheme.textTertiary,
                fontSize: 9,
                letterSpacing: 1.5,
              ),
            ).animate().fadeIn(delay: 400.ms, duration: 300.ms),
            const SizedBox(height: 8),

            if (readings.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                alignment: Alignment.center,
                child: Text(
                  'No readings yet.\nConnect sensor to start capturing.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
                ),
              )
            else
              ...readings.take(20).toList().asMap().entries.map((e) {
                return _ReadingRow(reading: e.value, index: e.key);
              }),
          ],
        );
      },
    );
  }
}

/// ECG-style scrolling graph
class _ECGGraph extends StatelessWidget {
  final List<IoTReading> readings;
  final AnimationController ecgController;

  const _ECGGraph({required this.readings, required this.ecgController});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: const Color(0xFF050508),
        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.1)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: AnimatedBuilder(
          animation: ecgController,
          builder: (context, child) {
            return CustomPaint(
              painter: _ECGPainter(
                readings: readings,
                scrollOffset: ecgController.value,
              ),
              size: const Size(double.infinity, 160),
            );
          },
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 500.ms)
        .scaleXY(begin: 0.97, delay: 200.ms, duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

/// Current reading value cards
class _ReadingCards extends StatelessWidget {
  final List<IoTReading> readings;
  const _ReadingCards({required this.readings});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: readings.asMap().entries.map((entry) {
        final r = entry.value;
        final isAlert = r.isOutOfRange;
        final color = isAlert ? ObsidianTheme.rose : ObsidianTheme.emerald;

        return Container(
          width: (MediaQuery.of(context).size.width - 48) / 2,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: color.withValues(alpha: 0.04),
            border: Border.all(color: color.withValues(alpha: 0.12)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                r.typeLabel.toUpperCase(),
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.textTertiary,
                  fontSize: 8,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                r.valueLabel,
                style: GoogleFonts.jetBrainsMono(
                  color: color,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (isAlert) ...[
                const SizedBox(height: 4),
                Text(
                  'ALERT',
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.rose,
                    fontSize: 8,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ],
          ),
        )
            .animate()
            .fadeIn(delay: Duration(milliseconds: 300 + entry.key * 80), duration: 400.ms);
      }).toList(),
    );
  }
}

/// Single reading row in the history
class _ReadingRow extends StatelessWidget {
  final IoTReading reading;
  final int index;
  const _ReadingRow({required this.reading, required this.index});

  @override
  Widget build(BuildContext context) {
    final isAlert = reading.isOutOfRange;

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: isAlert ? ObsidianTheme.rose.withValues(alpha: 0.04) : Colors.white.withValues(alpha: 0.02),
      ),
      child: Row(
        children: [
          Container(
            width: 4, height: 4,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isAlert ? ObsidianTheme.rose : ObsidianTheme.emerald,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              reading.typeLabel,
              style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 12),
            ),
          ),
          Text(
            reading.valueLabel,
            style: GoogleFonts.jetBrainsMono(
              color: isAlert ? ObsidianTheme.rose : Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${reading.recordedAt.hour.toString().padLeft(2, '0')}:${reading.recordedAt.minute.toString().padLeft(2, '0')}',
            style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 500 + index * 30), duration: 300.ms);
  }
}

/// BLE radar sweep painter
class _RadarPainter extends CustomPainter {
  final double sweep;
  _RadarPainter({required this.sweep});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // Grid rings
    for (int i = 1; i <= 3; i++) {
      canvas.drawCircle(
        center,
        radius * i / 3,
        Paint()
          ..color = ObsidianTheme.emerald.withValues(alpha: 0.08)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5,
      );
    }

    // Crosshair
    final crossPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.06)
      ..strokeWidth = 0.5;
    canvas.drawLine(Offset(center.dx, 0), Offset(center.dx, size.height), crossPaint);
    canvas.drawLine(Offset(0, center.dy), Offset(size.width, center.dy), crossPaint);

    // Sweep line
    final sweepAngle = sweep * 2 * math.pi;
    final endX = center.dx + radius * math.cos(sweepAngle);
    final endY = center.dy + radius * math.sin(sweepAngle);
    canvas.drawLine(
      center,
      Offset(endX, endY),
      Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.4)
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round,
    );

    // Sweep glow arc
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: sweepAngle - 0.5,
        endAngle: sweepAngle,
        colors: [
          Colors.transparent,
          ObsidianTheme.emerald.withValues(alpha: 0.12),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, sweepPaint);

    // Center dot
    canvas.drawCircle(center, 3, Paint()..color = ObsidianTheme.emerald);
    canvas.drawCircle(center, 6, Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.2));
  }

  @override
  bool shouldRepaint(covariant _RadarPainter oldDelegate) => oldDelegate.sweep != sweep;
}

/// ECG-style graph painter
class _ECGPainter extends CustomPainter {
  final List<IoTReading> readings;
  final double scrollOffset;

  _ECGPainter({required this.readings, required this.scrollOffset});

  @override
  void paint(Canvas canvas, Size size) {
    // Grid
    final gridPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.04)
      ..strokeWidth = 0.5;

    for (double y = 0; y < size.height; y += 20) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    for (double x = 0; x < size.width; x += 20) {
      final xShifted = (x + scrollOffset * 20) % size.width;
      canvas.drawLine(Offset(xShifted, 0), Offset(xShifted, size.height), gridPaint);
    }

    // ECG trace line
    if (readings.isEmpty) {
      // Flatline
      canvas.drawLine(
        Offset(0, size.height / 2),
        Offset(size.width, size.height / 2),
        Paint()
          ..color = ObsidianTheme.emerald.withValues(alpha: 0.3)
          ..strokeWidth = 1.5,
      );
      return;
    }

    final path = Path();
    final glowPath = Path();
    final points = math.min(readings.length, 50);
    final xStep = size.width / (points - 1).clamp(1, 50);

    // Normalize values
    final values = readings.take(points).map((r) => r.value).toList().reversed.toList();
    final minVal = values.reduce(math.min);
    final maxVal = values.reduce(math.max);
    final range = maxVal - minVal;

    for (int i = 0; i < values.length; i++) {
      final x = i * xStep;
      final normalized = range > 0 ? (values[i] - minVal) / range : 0.5;
      final y = size.height * 0.1 + (1.0 - normalized) * size.height * 0.8;

      if (i == 0) {
        path.moveTo(x, y);
        glowPath.moveTo(x, y);
      } else {
        path.lineTo(x, y);
        glowPath.lineTo(x, y);
      }
    }

    // Glow
    canvas.drawPath(
      glowPath,
      Paint()
        ..color = ObsidianTheme.emerald.withValues(alpha: 0.08)
        ..strokeWidth = 8
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Main trace
    canvas.drawPath(
      path,
      Paint()
        ..color = ObsidianTheme.emerald
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Tip dot (scan line)
    if (values.isNotEmpty) {
      final lastX = (values.length - 1) * xStep;
      final lastNorm = range > 0 ? (values.last - minVal) / range : 0.5;
      final lastY = size.height * 0.1 + (1.0 - lastNorm) * size.height * 0.8;
      canvas.drawCircle(
        Offset(lastX, lastY),
        4,
        Paint()..color = ObsidianTheme.emerald,
      );
      canvas.drawCircle(
        Offset(lastX, lastY),
        8,
        Paint()..color = ObsidianTheme.emerald.withValues(alpha: 0.2),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ECGPainter oldDelegate) =>
      oldDelegate.scrollOffset != scrollOffset || oldDelegate.readings.length != readings.length;
}
