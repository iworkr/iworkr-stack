import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import '../services/location_service.dart';
import '../services/ntp_service.dart';
import '../services/spatial_gate_service.dart';
import '../widgets/anomaly_override_modal.dart';
import '../widgets/gps_lock_indicator.dart';

const _uuid = Uuid();

/// Chronos-Lock enabled clock-in/out screen.
/// Enforces the spatial gate before allowing time entry creation.
class ChronosClockScreen extends ConsumerStatefulWidget {
  final String organizationId;
  final String? jobId;
  final String? jobTitle;
  final double? jobLat;
  final double? jobLng;
  final String? shiftId;

  const ChronosClockScreen({
    super.key,
    required this.organizationId,
    this.jobId,
    this.jobTitle,
    this.jobLat,
    this.jobLng,
    this.shiftId,
  });

  @override
  ConsumerState<ChronosClockScreen> createState() => _ChronosClockScreenState();
}

class _ChronosClockScreenState extends ConsumerState<ChronosClockScreen> {
  bool _isProcessing = false;
  String? _statusMessage;
  SpatialGateResult? _lastGateResult;
  double? _gpsAccuracy;
  final _gpsStream = GpsAccuracyStream();

  @override
  void initState() {
    super.initState();
    _gpsStream.start();
    _gpsStream.stream.listen((accuracy) {
      if (mounted) setState(() => _gpsAccuracy = accuracy);
    });
    NtpService.instance.synchronize();
  }

  @override
  void dispose() {
    _gpsStream.dispose();
    super.dispose();
  }

  Future<void> _performClockIn() async {
    if (_isProcessing) return;
    setState(() {
      _isProcessing = true;
      _statusMessage = 'Acquiring GPS lock...';
    });

    try {
      final jobLat = widget.jobLat;
      final jobLng = widget.jobLng;

      if (jobLat == null || jobLng == null) {
        _clockInWithoutSpatialGate();
        return;
      }

      final gateResult = await SpatialGateService.checkGate(
        jobLat: jobLat,
        jobLng: jobLng,
      );

      setState(() => _lastGateResult = gateResult);

      if (gateResult.passed) {
        await _commitClockIn(gateResult, isSpatialViolation: false);
        HapticFeedback.heavyImpact();
        _showSuccess('Clocked in — ${gateResult.distanceMeters}m from site');
      } else {
        HapticFeedback.vibrate();

        final justification = await AnomalyOverrideModal.show(
          context,
          gateResult: gateResult,
          jobTitle: widget.jobTitle ?? 'Job',
        );

        if (justification != null && mounted) {
          await _commitClockInWithAnomaly(gateResult, justification);
          _showSuccess('Provisional clock-in — pending approval');
        } else {
          setState(() {
            _statusMessage = 'Clock-in cancelled';
            _isProcessing = false;
          });
        }
      }
    } on LocationAccuracyException catch (e) {
      _showError(e.message);
    } on MockLocationException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Clock-in failed: ${e.toString()}');
    }
  }

  Future<void> _clockInWithoutSpatialGate() async {
    try {
      final position = await LocationService.getHighAccuracyPosition(
        accuracyThreshold: 500,
      );
      final ntpNow = NtpService.instance.now;

      final entryId = _uuid.v4();
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) return;

      final syncEngine = ref.read(syncEngineProvider);
      await syncEngine.clockInTimeEntry(
        entryId: entryId,
        organizationId: widget.organizationId,
        userId: userId,
        jobId: widget.jobId,
        shiftId: widget.shiftId,
        trueTime: ntpNow,
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
        distanceMeters: null,
        isSpatialViolation: false,
        clockOffsetMs: NtpService.instance.offset.inMilliseconds,
      );
      HapticFeedback.heavyImpact();
      _showSuccess('Clocked in');
    } catch (e) {
      _showError('Clock-in failed: $e');
    }
  }

  Future<void> _commitClockIn(
    SpatialGateResult gate, {
    required bool isSpatialViolation,
  }) async {
    final entryId = _uuid.v4();
    final userId = SupabaseService.auth.currentUser?.id;
    if (userId == null) return;

    final syncEngine = ref.read(syncEngineProvider);
    await syncEngine.clockInTimeEntry(
      entryId: entryId,
      organizationId: widget.organizationId,
      userId: userId,
      jobId: widget.jobId,
      shiftId: widget.shiftId,
      trueTime: gate.trueTime,
      lat: gate.workerLat,
      lng: gate.workerLng,
      accuracy: gate.accuracy,
      distanceMeters: gate.distanceMeters,
      isSpatialViolation: isSpatialViolation,
      clockOffsetMs: gate.clockOffsetMs,
    );
  }

  Future<void> _commitClockInWithAnomaly(
    SpatialGateResult gate,
    String justification,
  ) async {
    final entryId = _uuid.v4();
    final anomalyId = _uuid.v4();
    final userId = SupabaseService.auth.currentUser?.id;
    if (userId == null) return;

    final syncEngine = ref.read(syncEngineProvider);

    await syncEngine.clockInTimeEntry(
      entryId: entryId,
      organizationId: widget.organizationId,
      userId: userId,
      jobId: widget.jobId,
      shiftId: widget.shiftId,
      trueTime: gate.trueTime,
      lat: gate.workerLat,
      lng: gate.workerLng,
      accuracy: gate.accuracy,
      distanceMeters: gate.distanceMeters,
      isSpatialViolation: true,
      clockOffsetMs: gate.clockOffsetMs,
    );

    await syncEngine.createAnomaly(
      anomalyId: anomalyId,
      organizationId: widget.organizationId,
      timeEntryId: entryId,
      workerId: userId,
      jobId: widget.jobId,
      anomalyType: 'GEOFENCE_BREACH',
      distanceMeters: gate.distanceMeters,
      workerLat: gate.workerLat,
      workerLng: gate.workerLng,
      jobLat: gate.jobLat,
      jobLng: gate.jobLng,
      accuracy: gate.accuracy,
      justification: justification,
    );
  }

  void _showSuccess(String msg) {
    if (!mounted) return;
    setState(() {
      _statusMessage = msg;
      _isProcessing = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showError(String msg) {
    if (!mounted) return;
    setState(() {
      _statusMessage = msg;
      _isProcessing = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        title: const Text(
          'Clock In',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: GpsLockIndicator(
              currentAccuracy: _gpsAccuracy,
              isAcquiring: _isProcessing,
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Job info card
              if (widget.jobTitle != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0A0A0A),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF1A1A1A)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.jobTitle!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (widget.jobLat != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Geofence: ${SpatialGateService.geofenceRadiusMeters}m radius',
                          style: const TextStyle(
                            color: Color(0xFF666666),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

              const Spacer(),

              // Status message
              if (_statusMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Text(
                    _statusMessage!,
                    style: TextStyle(
                      color: _statusMessage!.contains('failed') ||
                              _statusMessage!.contains('cancelled')
                          ? Colors.redAccent
                          : const Color(0xFF10B981),
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),

              // Clock-in button
              GestureDetector(
                onTap: _isProcessing ? null : _performClockIn,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isProcessing
                        ? const Color(0xFF1A3D2E)
                        : const Color(0xFF10B981),
                    boxShadow: _isProcessing
                        ? []
                        : [
                            BoxShadow(
                              color: const Color(0xFF10B981).withValues(alpha: 0.3),
                              blurRadius: 40,
                              spreadRadius: 5,
                            ),
                          ],
                  ),
                  child: Center(
                    child: _isProcessing
                        ? const SizedBox(
                            width: 32,
                            height: 32,
                            child: CircularProgressIndicator(
                              color: Color(0xFF10B981),
                              strokeWidth: 3,
                            ),
                          )
                        : const Icon(
                            Icons.fingerprint_rounded,
                            color: Colors.black,
                            size: 64,
                          ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              Text(
                _isProcessing ? 'Verifying location...' : 'Tap to clock in',
                style: const TextStyle(
                  color: Color(0xFF888888),
                  fontSize: 14,
                ),
              ),

              const Spacer(),

              // NTP sync status
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    NtpService.instance.isInitialized
                        ? Icons.access_time_filled
                        : Icons.access_time,
                    color: NtpService.instance.isInitialized
                        ? const Color(0xFF10B981)
                        : const Color(0xFF666666),
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    NtpService.instance.isInitialized
                        ? 'Time verified (offset: ${NtpService.instance.offset.inMilliseconds}ms)'
                        : 'Time sync pending...',
                    style: const TextStyle(
                      color: Color(0xFF555555),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
