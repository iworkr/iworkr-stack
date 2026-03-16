import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:iworkr_mobile/core/services/fleet_vehicle_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/slide_to_act.dart';

class FleetCheckoutScreen extends StatefulWidget {
  final String shiftId;
  const FleetCheckoutScreen({super.key, required this.shiftId});

  @override
  State<FleetCheckoutScreen> createState() => _FleetCheckoutScreenState();
}

class _FleetCheckoutScreenState extends State<FleetCheckoutScreen> {
  static const List<_InspectionZone> _zones = [
    _InspectionZone(id: 'front_bumper', label: 'Front Bumper', left: 0.38, top: 0.06, width: 0.24, height: 0.14),
    _InspectionZone(id: 'windshield', label: 'Windshield', left: 0.33, top: 0.24, width: 0.34, height: 0.16),
    _InspectionZone(id: 'rear_left_panel', label: 'Rear Left Panel', left: 0.06, top: 0.56, width: 0.24, height: 0.24),
    _InspectionZone(id: 'hoist', label: 'Hoist', left: 0.70, top: 0.56, width: 0.24, height: 0.24),
  ];

  ShiftVehicleBooking? _booking;
  bool _loading = true;
  bool _submitting = false;
  final _odoCtrl = TextEditingController();
  bool _hasDefects = false;
  bool _hoistSafe = true;
  bool _firstAidPresent = true;
  bool _cleanInterior = true;
  int _fuelLevel = 75;
  final List<_DamagePin> _damagePins = [];
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _odoCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final booking = await fetchShiftVehicleBooking(widget.shiftId);
    if (!mounted) return;
    setState(() {
      _booking = booking;
      _loading = false;
      _odoCtrl.text = ((booking?.currentOdometer ?? booking?.checkoutOdometer ?? 0).round()).toString();
    });
  }

  Future<void> _submitCheckout() async {
    final booking = _booking;
    if (booking == null || _submitting) return;
    final odometer = double.tryParse(_odoCtrl.text.trim());
    if (odometer == null || odometer < 0) {
      _showSnack('Enter a valid odometer reading.');
      return;
    }
    if (booking.currentOdometer != null && odometer < booking.currentOdometer!) {
      _showSnack('Odometer cannot be lower than last recorded value.');
      return;
    }
    if (_hasDefects && _damagePins.isEmpty) {
      _showSnack('Pin damage areas and capture a photo before continuing.');
      return;
    }

    setState(() => _submitting = true);
    try {
      await checkoutVehicleBooking(
        bookingId: booking.id,
        odometer: odometer,
        hasDefects: _hasDefects,
        fuelLevelPercent: _fuelLevel,
        inspectionData: {
          'hoist_safe': _hoistSafe,
          'first_aid_present': _firstAidPresent,
          'clean_interior': _cleanInterior,
          'has_new_damage': _hasDefects,
          'damage_pins': _damagePins
              .map((p) => {
                    'zone_id': p.zoneId,
                    'zone_label': p.zoneLabel,
                    'photo_path': p.photoPath,
                    'captured_at': p.capturedAt.toIso8601String(),
                  })
              .toList(),
        },
      );
      if (!mounted) return;
      _showSnack('Vehicle custody accepted.');
      context.pop(true);
    } catch (e) {
      _showSnack(e.toString().replaceFirst('Exception: ', ''));
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.iColors;
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_booking == null) {
      return Scaffold(
        backgroundColor: colors.canvas,
        appBar: AppBar(title: const Text('Vehicle Checkout')),
        body: Center(
          child: Text(
            'No vehicle booking assigned to this shift.',
            style: GoogleFonts.inter(color: colors.textMuted),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        title: const Text('Vehicle Checkout Gate'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _booking!.vehicleName ?? 'Assigned Vehicle',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colors.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  _booking!.registrationNumber ?? '',
                  style: GoogleFonts.inter(fontSize: 12, color: colors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _odoCtrl,
            keyboardType: TextInputType.number,
            style: GoogleFonts.inter(color: colors.textPrimary),
            decoration: InputDecoration(
              labelText: 'Odometer (km)',
              filled: true,
              fillColor: colors.surface,
            ),
          ),
          const SizedBox(height: 10),
          _checkTile('Hoist operates safely', _hoistSafe, (v) => setState(() => _hoistSafe = v)),
          _checkTile('First aid kit present', _firstAidPresent, (v) => setState(() => _firstAidPresent = v)),
          _checkTile('Interior clean and safe', _cleanInterior, (v) => setState(() => _cleanInterior = v)),
          _checkTile('New damage detected', _hasDefects, (v) => setState(() => _hasDefects = v)),
          if (_hasDefects) ...[
            const SizedBox(height: 10),
            _buildInspectionCanvas(),
          ],
          const SizedBox(height: 6),
          Text(
            'Fuel level: $_fuelLevel%',
            style: GoogleFonts.inter(fontSize: 12, color: colors.textMuted),
          ),
          Slider(
            min: 0,
            max: 100,
            value: _fuelLevel.toDouble(),
            divisions: 20,
            onChanged: (v) => setState(() => _fuelLevel = v.round()),
          ),
          const SizedBox(height: 18),
          SlideToAct(
            label: _submitting ? 'Submitting...' : 'Slide to Unlock & Accept Custody',
            onSlideComplete: _submitCheckout,
            enabled: !_submitting,
            color: ObsidianTheme.emerald,
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildInspectionCanvas() {
    final colors = context.iColors;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '360° Defect Mapping (tap zone to pin + camera)',
            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textPrimary),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 220,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final height = constraints.maxHeight;
                return Stack(
                  children: [
                    const Positioned.fill(child: CustomPaint(painter: _VanPainter())),
                    for (final zone in _zones)
                      Positioned(
                        left: width * zone.left,
                        top: height * zone.top,
                        width: width * zone.width,
                        height: height * zone.height,
                        child: GestureDetector(
                          onTap: () => _captureDamageForZone(zone),
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.35)),
                              borderRadius: BorderRadius.circular(8),
                              color: ObsidianTheme.rose.withValues(alpha: 0.06),
                            ),
                            child: Center(
                              child: Text(
                                zone.label,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: colors.textPrimary),
                              ),
                            ),
                          ),
                        ),
                      ),
                    for (final pin in _damagePins)
                      Positioned(
                        left: width * pin.left - 8,
                        top: height * pin.top - 8,
                        child: const Icon(Icons.location_on, color: Colors.redAccent, size: 18),
                      ),
                  ],
                );
              },
            ),
          ),
          if (_damagePins.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '${_damagePins.length} defect pin(s) captured',
              style: GoogleFonts.inter(fontSize: 11, color: colors.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _captureDamageForZone(_InspectionZone zone) async {
    final photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (photo == null) {
      _showSnack('Photo capture is required for defect logging.');
      return;
    }
    if (!mounted) return;
    setState(() {
      _damagePins.add(
        _DamagePin(
          zoneId: zone.id,
          zoneLabel: zone.label,
          left: zone.left + (zone.width / 2),
          top: zone.top + (zone.height / 2),
          photoPath: photo.path,
          capturedAt: DateTime.now().toUtc(),
        ),
      );
    });
  }

  Widget _checkTile(String label, bool value, ValueChanged<bool> onChanged) {
    final colors = context.iColors;
    return SwitchListTile(
      value: value,
      dense: true,
      title: Text(label, style: GoogleFonts.inter(fontSize: 13, color: colors.textPrimary)),
      onChanged: onChanged,
    );
  }
}

class _InspectionZone {
  final String id;
  final String label;
  final double left;
  final double top;
  final double width;
  final double height;
  const _InspectionZone({
    required this.id,
    required this.label,
    required this.left,
    required this.top,
    required this.width,
    required this.height,
  });
}

class _DamagePin {
  final String zoneId;
  final String zoneLabel;
  final double left;
  final double top;
  final String photoPath;
  final DateTime capturedAt;
  const _DamagePin({
    required this.zoneId,
    required this.zoneLabel,
    required this.left,
    required this.top,
    required this.photoPath,
    required this.capturedAt,
  });
}

class _VanPainter extends CustomPainter {
  const _VanPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final body = Paint()..color = Colors.white.withValues(alpha: 0.06);
    final outline = Paint()
      ..color = Colors.white.withValues(alpha: 0.22)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(size.width * 0.2, size.height * 0.04, size.width * 0.6, size.height * 0.9),
      const Radius.circular(16),
    );
    canvas.drawRRect(rect, body);
    canvas.drawRRect(rect, outline);

    final lane = Paint()
      ..color = Colors.white.withValues(alpha: 0.16)
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(size.width * 0.5, size.height * 0.08),
      Offset(size.width * 0.5, size.height * 0.9),
      lane,
    );
  }

  @override
  bool shouldRepaint(covariant _VanPainter oldDelegate) => false;
}
