import 'dart:async';
import 'dart:math';

import 'package:drift/drift.dart' as drift;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:uuid/uuid.dart';

class ShiftTravelScreen extends StatefulWidget {
  final String shiftId;
  final String mode; // provider | participant
  const ShiftTravelScreen({
    super.key,
    required this.shiftId,
    required this.mode,
  });

  @override
  State<ShiftTravelScreen> createState() => _ShiftTravelScreenState();
}

class _ShiftTravelScreenState extends State<ShiftTravelScreen> {
  static const _uuid = Uuid();
  final _db = AppDatabase();
  StreamSubscription<Position>? _positionSub;

  Map<String, dynamic>? _shift;
  String? _travelLogId;
  bool _loading = true;
  bool _tracking = false;
  DateTime? _startedAt;
  List<Map<String, dynamic>> _breadcrumbs = [];
  double _distanceKm = 0;

  bool get _isProviderTravel => widget.mode == "provider";

  @override
  void initState() {
    super.initState();
    _loadShiftAndResume();
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _db.close();
    super.dispose();
  }

  Future<void> _loadShiftAndResume() async {
    try {
      final shift = await SupabaseService.client
          .from('schedule_blocks')
          .select('id, organization_id, metadata')
          .eq('id', widget.shiftId)
          .maybeSingle();

      final active = await SupabaseService.client
          .from('shift_travel_logs')
          .select('*')
          .eq('shift_id', widget.shiftId)
          .eq('travel_type', _isProviderTravel ? 'provider_travel' : 'participant_transport')
          .isFilter('end_time', null)
          .order('start_time', ascending: false)
          .limit(1)
          .maybeSingle();

      if (!mounted) return;
      setState(() {
        _shift = shift;
        _loading = false;
      });

      if (active != null) {
        _travelLogId = active['id'] as String;
        _startedAt = DateTime.tryParse(active['start_time']?.toString() ?? '');
        _tracking = true;
        _startStream();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _startTracking() async {
    final user = SupabaseService.auth.currentUser;
    if (user == null || _shift == null) return;

    final permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return;

    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );

    final participantId = (_shift!['metadata'] as Map?)?['participant_id']?.toString();

    final inserted = await SupabaseService.client.from('shift_travel_logs').insert({
      'organization_id': _shift!['organization_id'],
      'shift_id': widget.shiftId,
      'worker_id': user.id,
      'participant_id': participantId,
      'travel_type': _isProviderTravel ? 'provider_travel' : 'participant_transport',
      'start_time': DateTime.now().toUtc().toIso8601String(),
      'start_lat': pos.latitude,
      'start_lng': pos.longitude,
      'raw_breadcrumbs': <Map<String, dynamic>>[],
      'claimed_distance_km': 0,
    }).select().single();

    setState(() {
      _travelLogId = inserted['id'] as String;
      _startedAt = DateTime.now();
      _tracking = true;
      _breadcrumbs = [];
      _distanceKm = 0;
    });

    HapticFeedback.mediumImpact();
    _startStream();
  }

  void _startStream() {
    _positionSub?.cancel();
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((position) async {
      final point = {
        'lat': position.latitude,
        'lng': position.longitude,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
        'speed': (position.speed * 3.6),
      };

      if (!mounted) return;
      setState(() {
        if (_breadcrumbs.isNotEmpty) {
          final prev = _breadcrumbs.last;
          _distanceKm += _haversineKm(
            (prev['lat'] as num).toDouble(),
            (prev['lng'] as num).toDouble(),
            position.latitude,
            position.longitude,
          );
        }
        _breadcrumbs.add(point);
      });

      await _db.insertTelemetry(TelemetryLogsCompanion(
        id: drift.Value(_uuid.v4()),
        timestampUtc: drift.Value(DateTime.now().toUtc()),
        latitude: drift.Value(position.latitude),
        longitude: drift.Value(position.longitude),
        speedKmh: drift.Value(position.speed * 3.6),
        heading: drift.Value(position.heading),
        accuracyMeters: drift.Value(position.accuracy),
        isMockLocation: drift.Value(position.isMocked),
      ));
    });
  }

  Future<void> _endTracking() async {
    if (_travelLogId == null) return;
    _positionSub?.cancel();

    final endPos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.best),
    );

    final claimed = double.parse(_distanceKm.toStringAsFixed(2));
    await SupabaseService.client.from('shift_travel_logs').update({
      'end_time': DateTime.now().toUtc().toIso8601String(),
      'end_lat': endPos.latitude,
      'end_lng': endPos.longitude,
      'raw_breadcrumbs': _breadcrumbs,
      'claimed_distance_km': claimed,
      'calculated_distance_km': claimed,
    }).eq('id', _travelLogId!);

    await SupabaseService.client.functions.invoke(
      'calculate-travel-financials',
      body: {'log_id': _travelLogId},
    );

    if (!mounted) return;
    setState(() => _tracking = false);
    HapticFeedback.heavyImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Travel complete: ${claimed.toStringAsFixed(2)} km recorded.',
          style: GoogleFonts.inter(color: Colors.white),
        ),
        backgroundColor: ObsidianTheme.emerald,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final elapsed = _startedAt == null ? Duration.zero : DateTime.now().difference(_startedAt!);
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          onPressed: () => context.canPop() ? context.pop() : context.go('/care/my-shifts'),
          icon: Icon(PhosphorIconsLight.arrowLeft, color: Colors.white),
        ),
        title: Text(
          _isProviderTravel ? 'Provider Travel' : 'Participant Transport',
          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.03),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Telemetry', style: GoogleFonts.jetBrainsMono(fontSize: 11, color: Colors.white70)),
                  const SizedBox(height: 8),
                  Text('Distance: ${_distanceKm.toStringAsFixed(2)} km', style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                  Text('Elapsed: ${elapsed.inMinutes} min', style: GoogleFonts.inter(color: Colors.white70)),
                  Text('Breadcrumbs: ${_breadcrumbs.length}', style: GoogleFonts.inter(color: Colors.white70)),
                ],
              ),
            ),
            const Spacer(),
            if (!_tracking)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _startTracking,
                  icon: Icon(PhosphorIconsLight.play, color: Colors.black),
                  label: Text(
                    _isProviderTravel ? 'Start Travel To Participant' : 'Start Client Transport',
                    style: GoogleFonts.inter(color: Colors.black, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ObsidianTheme.careBlue,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _endTracking,
                  icon: Icon(PhosphorIconsLight.stop, color: Colors.white),
                  label: Text(
                    _isProviderTravel ? 'Arrive & Finalize Travel' : 'End Transport',
                    style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ObsidianTheme.rose,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371.0;
  final dLat = _toRad(lat2 - lat1);
  final dLon = _toRad(lon2 - lon1);
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(_toRad(lat1)) * cos(_toRad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
  final c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return r * c;
}

double _toRad(double deg) => deg * pi / 180;

