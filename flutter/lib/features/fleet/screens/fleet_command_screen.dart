import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/fleet_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/vehicle.dart';

/// Fleet Command — pre-start vehicle check with interactive 3D-style van
/// and carbon fiber aesthetic.
class FleetCommandScreen extends ConsumerStatefulWidget {
  const FleetCommandScreen({super.key});

  @override
  ConsumerState<FleetCommandScreen> createState() => _FleetCommandScreenState();
}

class _FleetCommandScreenState extends ConsumerState<FleetCommandScreen>
    with TickerProviderStateMixin {
  final Map<String, bool?> _checkResults = {};
  int _odometerKm = 0;
  bool _submitting = false;
  late AnimationController _pulseController;

  static const _checkAreas = [
    _CheckArea('tires', 'Tires & Wheels', PhosphorIconsLight.tire),
    _CheckArea('lights', 'Lights & Indicators', PhosphorIconsLight.lightbulb),
    _CheckArea('brakes', 'Brakes & Handbrake', PhosphorIconsLight.stop),
    _CheckArea('fluids', 'Oil & Fluids', PhosphorIconsLight.drop),
    _CheckArea('windscreen', 'Windscreen & Wipers', PhosphorIconsLight.eyeglasses),
    _CheckArea('body', 'Body & Mirrors', PhosphorIconsLight.car),
    _CheckArea('interior', 'Interior & Seatbelts', PhosphorIconsLight.armchair),
    _CheckArea('equipment', 'Tools & Equipment', PhosphorIconsLight.wrench),
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  bool get _allChecked => _checkAreas.every((a) => _checkResults.containsKey(a.key));
  bool get _hasFails => _checkResults.values.any((v) => v == false);

  Future<void> _submit() async {
    if (_submitting || !_allChecked) return;
    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    final vehicle = await ref.read(myVehicleProvider.future);
    if (vehicle == null) {
      setState(() => _submitting = false);
      return;
    }

    final items = _checkAreas.map((a) {
      final passed = _checkResults[a.key] ?? true;
      return CheckItem(
        area: a.key,
        passed: passed,
        severity: passed ? null : 'minor',
      );
    }).toList();

    await submitVehicleCheck(
      vehicleId: vehicle.id,
      odometerKm: _odometerKm,
      items: items,
    );

    ref.invalidate(todayCheckProvider);
    ref.invalidate(myVehicleProvider);

    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final vehicleAsync = ref.watch(myVehicleProvider);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: vehicleAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: ObsidianTheme.amber, strokeWidth: 2),
                ),
                error: (_, __) => _buildNoVehicle(),
                data: (vehicle) {
                  if (vehicle == null) return _buildNoVehicle();
                  return _buildCheckContent(vehicle);
                },
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
                'FLEET COMMAND',
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'Pre-Start Vehicle Check',
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
              ),
            ],
          ),
          const Spacer(),
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: ObsidianTheme.amber.withValues(alpha: 0.05 + _pulseController.value * 0.08),
                  border: Border.all(
                    color: ObsidianTheme.amber.withValues(alpha: 0.1 + _pulseController.value * 0.15),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.amber,
                        boxShadow: [BoxShadow(color: ObsidianTheme.amber.withValues(alpha: 0.5), blurRadius: 4)],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'CHECK',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.amber,
                        fontSize: 9,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildNoVehicle() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ObsidianTheme.textTertiary.withValues(alpha: 0.08),
            ),
            child: const Icon(PhosphorIconsLight.car, color: ObsidianTheme.textTertiary, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            'No vehicle assigned',
            style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 15, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 6),
          Text(
            'Ask your admin to assign a fleet vehicle',
            style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckContent(Vehicle vehicle) {
    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        // Vehicle card with 3D-style visualization
        _VehicleCard(vehicle: vehicle),
        const SizedBox(height: 20),

        // Odometer input
        _OdometerInput(
          initialValue: vehicle.odometerKm,
          onChanged: (v) => _odometerKm = v,
        ),
        const SizedBox(height: 20),

        // Section label
        Text(
          'INSPECTION CHECKLIST',
          style: GoogleFonts.jetBrainsMono(
            color: ObsidianTheme.textTertiary,
            fontSize: 9,
            letterSpacing: 1.5,
          ),
        )
            .animate()
            .fadeIn(delay: 300.ms, duration: 300.ms),
        const SizedBox(height: 12),

        // Check items
        ...List.generate(_checkAreas.length, (i) {
          final area = _checkAreas[i];
          final result = _checkResults[area.key];
          return _CheckItemCard(
            area: area,
            result: result,
            index: i,
            onPass: () {
              HapticFeedback.lightImpact();
              setState(() => _checkResults[area.key] = true);
            },
            onFail: () {
              HapticFeedback.mediumImpact();
              setState(() => _checkResults[area.key] = false);
            },
          );
        }),

        const SizedBox(height: 24),

        // Service sentinel
        _ServiceSentinel(vehicle: vehicle),

        const SizedBox(height: 24),

        // Submit button
        GestureDetector(
          onTap: _allChecked ? _submit : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: _allChecked
                  ? (_hasFails
                      ? ObsidianTheme.amber.withValues(alpha: 0.12)
                      : ObsidianTheme.emerald.withValues(alpha: 0.12))
                  : Colors.white.withValues(alpha: 0.03),
              border: Border.all(
                color: _allChecked
                    ? (_hasFails
                        ? ObsidianTheme.amber.withValues(alpha: 0.3)
                        : ObsidianTheme.emerald.withValues(alpha: 0.3))
                    : Colors.white.withValues(alpha: 0.06),
              ),
            ),
            child: Center(
              child: _submitting
                  ? SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: _hasFails ? ObsidianTheme.amber : ObsidianTheme.emerald,
                      ),
                    )
                  : Text(
                      _allChecked
                          ? (_hasFails ? 'SIGN OFF (WITH FAULTS)' : 'SIGN OFF — ALL CLEAR')
                          : 'COMPLETE ALL CHECKS',
                      style: GoogleFonts.jetBrainsMono(
                        color: _allChecked
                            ? (_hasFails ? ObsidianTheme.amber : ObsidianTheme.emerald)
                            : ObsidianTheme.textTertiary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CheckArea {
  final String key;
  final String label;
  final IconData icon;
  const _CheckArea(this.key, this.label, this.icon);
}

/// Vehicle card with carbon-fiber styled visualization
class _VehicleCard extends StatelessWidget {
  final Vehicle vehicle;
  const _VehicleCard({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.white.withValues(alpha: 0.02),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          // Carbon fiber pattern header with van silhouette
          SizedBox(
            height: 120,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              child: CustomPaint(
                painter: _CarbonFiberPainter(),
                size: const Size(double.infinity, 120),
                child: Center(
                  child: Icon(PhosphorIconsLight.van, color: Colors.white.withValues(alpha: 0.25), size: 64)
                      .animate(onPlay: (c) => c.repeat(reverse: true))
                      .scaleXY(begin: 1.0, end: 1.03, duration: 3000.ms),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        vehicle.name,
                        style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (vehicle.registration != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: Colors.white.withValues(alpha: 0.06),
                              ),
                              child: Text(
                                vehicle.registration!,
                                style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textSecondary, fontSize: 11),
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Text(
                            '${vehicle.odometerKm.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')} km',
                            style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 100.ms, duration: 500.ms)
        .moveY(begin: 8, delay: 100.ms, duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

/// Odometer-style rolling number input
class _OdometerInput extends StatefulWidget {
  final int initialValue;
  final ValueChanged<int> onChanged;
  const _OdometerInput({required this.initialValue, required this.onChanged});

  @override
  State<_OdometerInput> createState() => _OdometerInputState();
}

class _OdometerInputState extends State<_OdometerInput> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue.toString());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: Colors.white.withValues(alpha: 0.02),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Icon(PhosphorIconsLight.gauge, color: ObsidianTheme.textTertiary, size: 18),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ODOMETER',
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.textTertiary,
                  fontSize: 9,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                width: 160,
                child: TextField(
                  controller: _controller,
                  keyboardType: TextInputType.number,
                  style: GoogleFonts.jetBrainsMono(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2,
                  ),
                  decoration: InputDecoration(
                    hintText: '000000',
                    hintStyle: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.textTertiary.withValues(alpha: 0.3),
                      fontSize: 24,
                      letterSpacing: 2,
                    ),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    isDense: true,
                  ),
                  onChanged: (v) {
                    widget.onChanged(int.tryParse(v) ?? 0);
                  },
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            'km',
            style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 14),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 400.ms);
  }
}

/// Individual check item with pass/fail toggles
class _CheckItemCard extends StatelessWidget {
  final _CheckArea area;
  final bool? result;
  final int index;
  final VoidCallback onPass;
  final VoidCallback onFail;

  const _CheckItemCard({
    required this.area,
    required this.result,
    required this.index,
    required this.onPass,
    required this.onFail,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.03),
        border: Border.all(
          color: result == null
              ? Colors.white.withValues(alpha: 0.06)
              : (result! ? ObsidianTheme.emerald.withValues(alpha: 0.15) : ObsidianTheme.rose.withValues(alpha: 0.2)),
        ),
      ),
      child: Row(
        children: [
          Icon(area.icon, color: ObsidianTheme.textTertiary, size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              area.label,
              style: GoogleFonts.inter(
                color: result == null ? Colors.white : (result! ? ObsidianTheme.emerald : ObsidianTheme.rose),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          // Pass button
          GestureDetector(
            onTap: onPass,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 36, height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: result == true ? ObsidianTheme.emerald.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.04),
                border: Border.all(
                  color: result == true ? ObsidianTheme.emerald.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.08),
                ),
              ),
              child: Icon(
                PhosphorIconsBold.check,
                size: 14,
                color: result == true ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
              ),
            ),
          ),
          const SizedBox(width: 6),
          // Fail button
          GestureDetector(
            onTap: onFail,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 36, height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: result == false ? ObsidianTheme.rose.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.04),
                border: Border.all(
                  color: result == false ? ObsidianTheme.rose.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.08),
                ),
              ),
              child: Icon(
                PhosphorIconsBold.x,
                size: 14,
                color: result == false ? ObsidianTheme.rose : ObsidianTheme.textTertiary,
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 300 + index * 50), duration: 400.ms)
        .moveX(begin: 10, delay: Duration(milliseconds: 300 + index * 50), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

/// Service sentinel — vehicle health bar
class _ServiceSentinel extends StatelessWidget {
  final Vehicle vehicle;
  const _ServiceSentinel({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final health = vehicle.healthPercent;
    final color = vehicle.serviceOverdue
        ? ObsidianTheme.rose
        : (vehicle.serviceSoon ? ObsidianTheme.amber : ObsidianTheme.emerald);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: color.withValues(alpha: 0.04),
        border: Border.all(color: color.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIconsLight.heartbeat, color: color, size: 16),
              const SizedBox(width: 8),
              Text(
                'SERVICE HEALTH',
                style: GoogleFonts.jetBrainsMono(
                  color: color,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                vehicle.serviceOverdue
                    ? 'OVERDUE'
                    : (vehicle.serviceSoon ? '${vehicle.kmToService}km TO GO' : '${vehicle.kmToService}km TO GO'),
                style: GoogleFonts.jetBrainsMono(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Health bar
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: SizedBox(
              height: 6,
              child: LinearProgressIndicator(
                value: health,
                backgroundColor: Colors.white.withValues(alpha: 0.06),
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 700.ms, duration: 400.ms);
  }
}

/// Carbon fiber texture painter for the vehicle card header
class _CarbonFiberPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF0A0A12),
    );

    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.015)
      ..strokeWidth = 0.5;

    // Cross-hatch pattern (carbon fiber)
    for (double i = -size.height; i < size.width + size.height; i += 8) {
      canvas.drawLine(Offset(i, 0), Offset(i + size.height, size.height), gridPaint);
      canvas.drawLine(Offset(i, size.height), Offset(i + size.height, 0), gridPaint);
    }

    // Subtle vignette
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()
        ..shader = RadialGradient(
          center: Alignment.center,
          radius: 0.8,
          colors: [
            Colors.transparent,
            Colors.black.withValues(alpha: 0.5),
          ],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );
  }

  @override
  bool shouldRepaint(covariant _CarbonFiberPainter oldDelegate) => false;
}
