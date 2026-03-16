import 'dart:async';
import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/governance_policy_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/routines_provider.dart';
import 'package:iworkr_mobile/core/services/fleet_vehicle_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/slide_to_act.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

// ═══════════════════════════════════════════════════════════
// ── Shift Detail — Pre-Shift Briefing + Active Shift HUD ─
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// When not clocked in: shows critical alerts, care plan snapshot,
// handover notes, and a "SLIDE TO CLOCK IN" widget.
// When clocked in: shows chronometer ring + care action grid
// (Medications, Health Obs, Log Incident, End Shift).

class ShiftDetailScreen extends ConsumerStatefulWidget {
  final String shiftId;
  const ShiftDetailScreen({super.key, required this.shiftId});

  @override
  ConsumerState<ShiftDetailScreen> createState() => _ShiftDetailScreenState();
}

class _ShiftDetailScreenState extends ConsumerState<ShiftDetailScreen> {
  bool _isClockedIn = false;
  bool _isClockingIn = false;
  DateTime? _clockInTime;
  String? _timeEntryId; // ignore: unused_field — used in clock-out flow via debrief
  Timer? _chronoTimer;
  Duration _elapsed = Duration.zero;
  double? _clockInLat; // ignore: unused_field — stored for EVV compliance
  double? _clockInLng; // ignore: unused_field — stored for EVV compliance

  CareShift? _shift;
  bool _loading = true;
  bool _criticalAlertsScrolled = false;
  bool _briefingAcknowledged = false;
  Map<String, dynamic>? _participantDossier;
  RealtimeChannel? _criticalUpdateChannel;

  @override
  void initState() {
    super.initState();
    _loadShift();
  }

  @override
  void dispose() {
    _chronoTimer?.cancel();
    if (_criticalUpdateChannel != null) {
      SupabaseService.client.removeChannel(_criticalUpdateChannel!);
      _criticalUpdateChannel = null;
    }
    super.dispose();
  }

  Future<void> _loadShift() async {
    try {
      final data = await SupabaseService.client
          .from('schedule_blocks')
          .select('*, participant_profiles(preferred_name, critical_alerts)')
          .eq('id', widget.shiftId)
          .maybeSingle();

      if (data != null && mounted) {
        final shift = CareShift.fromJson(data);
        setState(() {
          _shift = shift;
          _loading = false;
          if (shift.status == CareShiftStatus.inProgress) {
            _isClockedIn = true;
            _clockInTime = shift.actualStart ?? DateTime.now();
            _startChronometer();
            ref.read(activeShiftProvider.notifier).state = shift;
            ref.read(activeShiftStateProvider.notifier).state = ActiveShiftState(
              shiftId: shift.id,
              participantId: shift.participantId,
              clockInTime: _clockInTime,
              status: ActiveShiftStatus.active,
            );
          }
        });
        await _loadParticipantDossier();
        _subscribeCriticalMedicalUpdates();
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startChronometer() {
    _chronoTimer?.cancel();
    _chronoTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _clockInTime != null) {
        setState(() {
          _elapsed = DateTime.now().difference(_clockInTime!);
        });
      }
    });
  }

  Future<void> _loadParticipantDossier() async {
    final shift = _shift;
    if (shift == null || shift.participantId == null) return;
    try {
      final res = await SupabaseService.client.functions.invoke(
        'fetch-participant-dossier',
        body: {'participant_id': shift.participantId},
      );
      final data = (res.data as Map?)?.cast<String, dynamic>();
      if (data == null || !mounted) return;
      setState(() {
        _participantDossier = data;
      });
    } catch (_) {
      // Keep shift flow available even if dossier hydration fails.
    }
  }

  void _subscribeCriticalMedicalUpdates() {
    final shift = _shift;
    if (shift == null || shift.participantId == null) return;
    if (_criticalUpdateChannel != null) {
      SupabaseService.client.removeChannel(_criticalUpdateChannel!);
      _criticalUpdateChannel = null;
    }

    _criticalUpdateChannel = SupabaseService.client
        .channel('persona-critical-${shift.participantId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'participant_medical_alerts',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'participant_id',
            value: shift.participantId!,
          ),
          callback: (_) async {
            await _loadParticipantDossier();
            if (!mounted) return;
            if (_isClockedIn) {
              await _showCriticalUpdateModal();
            }
          },
        )
        .subscribe();
  }

  Future<void> _showCriticalUpdateModal() async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) {
        final colors = context.iColors;
        return AlertDialog(
          backgroundColor: colors.surface,
          title: Text(
            'CRITICAL UPDATE',
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w700,
              color: ObsidianTheme.rose,
            ),
          ),
          content: Text(
            'Participant medical alerts changed by management. Review and acknowledge before continuing.',
            style: GoogleFonts.inter(fontSize: 13, color: colors.textPrimary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Review now'),
            ),
          ],
        );
      },
    );
    if (mounted) {
      _openProfileSheet();
    }
  }

  void _openProfileSheet() {
    final colors = context.iColors;
    final preferences = (_participantDossier?['preferences'] as Map?)?.cast<String, dynamic>() ?? {};
    final goals = ((_participantDossier?['goals'] as List?) ?? const []);
    final alerts = ((_participantDossier?['medical_alerts'] as List?) ?? const []);

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        constraints: const BoxConstraints(maxHeight: 560),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          border: Border.all(color: colors.border),
        ),
        child: DefaultTabController(
          length: 4,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Participant Profile',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colors.textPrimary)),
              const SizedBox(height: 8),
              const TabBar(
                tabs: [
                  Tab(text: 'Snapshot'),
                  Tab(text: 'About'),
                  Tab(text: 'Clinical'),
                  Tab(text: 'Goals'),
                ],
              ),
              const SizedBox(height: 10),
              Expanded(
                child: TabBarView(
                  children: [
                    ListView(
                      children: alerts.take(8).map((a) => ListTile(
                        dense: true,
                        title: Text((a as Map)['title']?.toString() ?? 'Alert'),
                        subtitle: Text(a['description']?.toString() ?? ''),
                      )).toList(),
                    ),
                    ListView(
                      children: [
                        ListTile(title: const Text('Likes'), subtitle: Text((preferences['likes'] as List?)?.join(', ') ?? '—')),
                        ListTile(title: const Text('Dislikes'), subtitle: Text((preferences['dislikes'] as List?)?.join(', ') ?? '—')),
                        ListTile(title: const Text('Comfort'), subtitle: Text(preferences['routines_and_comfort']?.toString() ?? '—')),
                      ],
                    ),
                    ListView(
                      children: [
                        ListTile(title: const Text('Communication method'), subtitle: Text(preferences['communication_primary_method']?.toString() ?? '—')),
                        ListTile(title: const Text('Receptive notes'), subtitle: Text(preferences['communication_receptive_notes']?.toString() ?? '—')),
                        ListTile(title: const Text('Expressive notes'), subtitle: Text(preferences['communication_expressive_notes']?.toString() ?? '—')),
                      ],
                    ),
                    ListView(
                      children: goals.map((g) => ListTile(
                        title: Text((g as Map)['goal_statement']?.toString() ?? 'Goal'),
                        subtitle: Text('${g['ndis_goal_category'] ?? 'Goal'} • ${g['status'] ?? ''}'),
                      )).toList(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool get _isShadowTrainingShift => _shift?.isShadowShift == true;

  Future<void> _acknowledgeBriefing() async {
    final shift = _shift;
    if (shift == null || shift.participantId == null) {
      // No participant — just mark acknowledged locally
      if (mounted) setState(() => _briefingAcknowledged = true);
      return;
    }
    try {
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) {
        if (mounted) setState(() => _briefingAcknowledged = true);
        return;
      }
      await SupabaseService.client.from('worker_profile_acknowledgments').upsert({
        'organization_id': shift.organizationId,
        'shift_id': shift.id,
        'worker_id': userId,
        'participant_id': shift.participantId,
        'acknowledged_at': DateTime.now().toUtc().toIso8601String(),
      }, onConflict: 'shift_id,worker_id');
    } catch (_) {
      // DB write failed (RLS/missing function) — proceed anyway
    }
    if (mounted) {
      setState(() => _briefingAcknowledged = true);
    }
  }

  Future<void> _handleClockIn() async {
    if (_shift == null || _isClockingIn) return;
    setState(() => _isClockingIn = true);

    try {
      // Project Solon gate: block clock-in if overdue critical policies exist.
      // Wrapped in try/catch so a broken edge function doesn't block clock-in.
      try {
        final pendingCritical = await fetchPendingCriticalPolicies();
        if (pendingCritical.isNotEmpty) {
          if (mounted) {
            await _showPolicyClockInBlockedModal(pendingCritical.length);
            setState(() => _isClockingIn = false);
          }
          return;
        }
      } catch (_) {
        // Policy gate unavailable — proceed with clock-in
      }

      // Project Convoy gate: require vehicle checkout before clock-in when booking exists.
      // Wrapped in try/catch so a missing table/RLS doesn't block clock-in.
      try {
        final booking = await fetchShiftVehicleBooking(widget.shiftId);
        if (booking != null && booking.status != 'checked_out') {
          if (mounted) {
            await _showFleetCheckoutRequiredModal(booking.vehicleName ?? 'Assigned vehicle');
            setState(() => _isClockingIn = false);
          }
          return;
        }
      } catch (_) {
        // Fleet gate unavailable — proceed with clock-in
      }

      // Project Doppelganger safety gate: shadow trainee cannot commence without primary worker active.
      if (_shift?.isShadowShift == true && (_shift?.parentShiftId?.isNotEmpty ?? false)) {
        final parent = await SupabaseService.client
            .from('schedule_blocks')
            .select('status, technician_id')
            .eq('id', _shift!.parentShiftId!)
            .maybeSingle();
        final parentStatus = (parent?['status'] ?? '').toString();
        final parentReady = parentStatus == 'in_progress' || parentStatus == 'on_site' || parentStatus == 'en_route';
        if (!parentReady) {
          if (!mounted) return;
          await showDialog<void>(
            context: context,
            builder: (_) => AlertDialog(
              title: const Text('Primary Worker Not Active'),
              content: Text(
                'This is a shadow shift. Wait for the primary worker to commence before clock-in.',
                style: GoogleFonts.inter(fontSize: 13),
              ),
              actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
            ),
          );
          setState(() => _isClockingIn = false);
          return;
        }
      }

      // Get GPS position
      Position position;
      try {
        final permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          await Geolocator.requestPermission();
        }
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 10),
          ),
        );
      } catch (_) {
        // Fallback position if GPS fails
        position = Position(
          latitude: 0,
          longitude: 0,
          timestamp: DateTime.now(),
          accuracy: 0,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        );
      }

      // Check mock location
      if (position.isMocked) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Mock location detected. Clock-in blocked.',
                  style: GoogleFonts.inter(color: Colors.white)),
              backgroundColor: ObsidianTheme.rose,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        setState(() => _isClockingIn = false);
        return;
      }

      // Calculate distance from participant location
      bool isGeofenceOverride = false;
      String? overrideReason;
      if (_shift!.locationLat != null && _shift!.locationLng != null) {
        final distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          _shift!.locationLat!,
          _shift!.locationLng!,
        );

        if (distance > 100) {
          // Show geofence override sheet
          if (mounted) {
            final result = await _showGeofenceOverrideSheet(distance);
            if (result == null) {
              setState(() => _isClockingIn = false);
              return;
            }
            isGeofenceOverride = true;
            overrideReason = result;
          }
        }
      }

      // Execute clock-in
      final createdTimeEntryId = await clockInToShift(
        shiftId: _shift!.id,
        organizationId: _shift!.organizationId,
        lat: position.latitude,
        lng: position.longitude,
        isGeofenceOverride: isGeofenceOverride,
        overrideReason: overrideReason,
      );

      String? resolvedTimeEntryId = createdTimeEntryId;
      if (resolvedTimeEntryId == null) {
        final fallbackEntries = await SupabaseService.client
            .from('time_entries')
            .select('id')
            .eq('shift_id', _shift!.id)
            .eq('worker_id', SupabaseService.auth.currentUser?.id ?? '')
            .eq('status', 'active')
            .order('clock_in', ascending: false)
            .limit(1);
        if (fallbackEntries.isNotEmpty) {
          resolvedTimeEntryId = fallbackEntries[0]['id'] as String?;
        }
      }

      if (mounted) {
        setState(() {
          _isClockedIn = true;
          _isClockingIn = false;
          _clockInTime = DateTime.now();
          _clockInLat = position.latitude;
          _clockInLng = position.longitude;
          _timeEntryId = resolvedTimeEntryId;
        });
        ref.read(activeShiftProvider.notifier).state = _shift;
        final newShiftState = ActiveShiftState(
          shiftId: _shift?.id,
          participantId: _shift?.participantId,
          timeEntryId: resolvedTimeEntryId,
          clockInTime: _clockInTime,
          status: ActiveShiftStatus.active,
        );
        ref.read(activeShiftStateProvider.notifier).state = newShiftState;
        ref.read(activeShiftTimeEntryIdProvider.notifier).state = resolvedTimeEntryId;
        // Persist workspace state for cold-start rehydration
        unawaited(persistWorkspaceState(newShiftState));
        _startChronometer();
        HapticFeedback.heavyImpact();
        final bundle = await fetchShiftRoutineBundle(widget.shiftId);
        if (mounted) {
          final colors = context.iColors;
          showModalBottomSheet(
            context: context,
            useRootNavigator: true,
            backgroundColor: Colors.transparent,
            builder: (_) => Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Daily Briefing',
                      style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary)),
                  const SizedBox(height: 6),
                  Text(
                    'You have ${bundle.pendingMandatoryCount} mandatory task(s) and ${bundle.pendingCount} total pending.',
                    style: GoogleFonts.inter(fontSize: 13, color: colors.textTertiary),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          context.go('/active-workspace');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.emeraldDim,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.35)),
                          ),
                          child: Text('Enter Workspace',
                              style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: ObsidianTheme.emerald)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          context.push('/care/shift/${widget.shiftId}/routines');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: ObsidianTheme.careBlue.withValues(alpha: 0.35)),
                          ),
                          child: Text('View Tasks',
                              style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: ObsidianTheme.careBlue)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isClockingIn = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Clock-in failed: $e',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _showFleetCheckoutRequiredModal(String vehicleName) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        final colors = context.iColors;
        return AlertDialog(
          backgroundColor: colors.surface,
          title: Text(
            'VEHICLE CHECKOUT REQUIRED',
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w700,
              color: ObsidianTheme.amber,
            ),
          ),
          content: Text(
            'Before clocking in, complete the pre-drive checkout for $vehicleName.',
            style: GoogleFonts.inter(fontSize: 13, color: colors.textPrimary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Later'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(ctx);
                context.push('/care/shift/${widget.shiftId}/vehicle-checkout');
              },
              child: const Text('Begin Checkout'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _showPolicyClockInBlockedModal(int pendingCount) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: Text(
          'CLOCK IN BLOCKED',
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w800,
            color: ObsidianTheme.rose,
          ),
        ),
        content: Text(
          'You have $pendingCount critical policy acknowledgement(s) pending. '
          'Complete governance signing before starting this shift.',
          style: GoogleFonts.inter(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Later'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              context.push('/care/governance/policies');
            },
            child: const Text('Open Governance'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleClockOutGate() async {
    try {
      final walletGate = await SupabaseService.client.rpc(
        'get_shift_wallet_gate',
        params: {'p_shift_id': widget.shiftId},
      );
      final walletGateJson = (walletGate as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final walletCanClose = walletGateJson['can_clock_out'] == true;
      final openWalletSessions = (walletGateJson['open_wallet_sessions'] as num?)?.toInt() ?? 0;
      if (!walletCanClose) {
        if (!mounted) return;
        HapticFeedback.mediumImpact();
        await showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Wallet Reconciliation Required'),
            content: Text(
              'You still have $openWalletSessions wallet session(s) open. Complete closing blind count before clock-out.',
              style: GoogleFonts.inter(fontSize: 13),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/care/shift/${widget.shiftId}/wallets');
                },
                child: const Text('Open Wallets'),
              ),
            ],
          ),
        );
        return;
      }

      final gate = await getShiftMandatoryTaskGateStatus(widget.shiftId);
      final canClockOut = gate['can_clock_out'] == true;
      final pendingMandatory = gate['pending_mandatory_count'] as int? ?? 0;
      if (canClockOut) {
        if (mounted) context.push('/care/shift/${widget.shiftId}/debrief');
        return;
      }
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Cannot Clock Out'),
          content: Text(
            'You have $pendingMandatory mandatory task(s) incomplete. Complete them or mark with exemption reason.',
            style: GoogleFonts.inter(fontSize: 13),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/care/shift/${widget.shiftId}/routines');
              },
              child: const Text('Open Tasks'),
            ),
          ],
        ),
      );
    } catch (_) {
      if (mounted) context.push('/care/shift/${widget.shiftId}/debrief');
    }
  }

  Future<String?> _showGeofenceOverrideSheet(double distance) async {
    final c = context.iColors;
    final reasons = [
      'Participant at community event',
      'Meeting at different location',
      'GPS inaccurate',
      'Incorrect address in system',
    ];
    final distanceKm = (distance / 1000).toStringAsFixed(1);

    return showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: c.canvas,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
          border:
              Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: c.borderMedium,
                    borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Icon(PhosphorIconsLight.mapPinLine,
                size: 40, color: ObsidianTheme.amber),
            const SizedBox(height: 12),
            Text('Geofence Override',
                style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary)),
            const SizedBox(height: 6),
            Text(
              'You are ${distanceKm}km from the scheduled location.\nSelect a reason to proceed.',
              style: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ...reasons.map((reason) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context, reason),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: c.border),
                      ),
                      child: Text(reason,
                          style: GoogleFonts.inter(
                              fontSize: 15, color: c.textPrimary)),
                    ),
                  ),
                )),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => Navigator.pop(context, null),
              child: Text('Cancel',
                  style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.rose)),
            ),
            SizedBox(
                height: MediaQuery.of(context).viewPadding.bottom + 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    if (_loading) {
      return Scaffold(
        backgroundColor: c.canvas,
        body:
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    if (_shift == null) {
      return Scaffold(
        backgroundColor: c.canvas,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(
            icon:
                Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary),
            onPressed: () =>
                context.canPop() ? context.pop() : context.go('/'),
          ),
        ),
        body: Center(
          child: Text('Shift not found',
              style: GoogleFonts.inter(color: c.textTertiary)),
        ),
      );
    }

    // ── Active Shift HUD (clocked in) ─────────────────
    if (_isClockedIn) {
      return Scaffold(
        backgroundColor: c.canvas,
        body: _buildActiveHUD(c),
      );
    }

    // ── Pre-Shift Briefing (not clocked in) ───────────
    return Scaffold(
      backgroundColor: c.canvas,
      body: _buildPreShift(c),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, MediaQuery.of(context).viewPadding.bottom + 12),
        decoration: BoxDecoration(
          color: c.canvas,
          border: Border(top: BorderSide(color: c.border)),
        ),
        child: _isClockingIn
            ? const Center(
                child: SizedBox(
                    height: 56,
                    child: Center(
                        child:
                            CircularProgressIndicator(strokeWidth: 2))))
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/care/shift/${widget.shiftId}/travel?mode=provider'),
                      icon: Icon(PhosphorIconsLight.carProfile, size: 16, color: c.textSecondary),
                      label: Text(
                        'Start Travel to Participant',
                        style: GoogleFonts.inter(fontSize: 13, color: c.textPrimary, fontWeight: FontWeight.w600),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: c.border),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SlideToAct(
                    label: 'Slide to Clock In',
                    color: ObsidianTheme.careBlue,
                    icon: PhosphorIconsLight.signIn,
                    onSlideComplete: _handleClockIn,
                    enabled: (_shift?.isToday ?? false) &&
                        (_shift?.criticalAlerts.isEmpty == true || _briefingAcknowledged),
                  ),
                ],
              ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════
  // ── PRE-SHIFT BRIEFING ────────────────────────────────
  // ═══════════════════════════════════════════════════════

  Widget _buildPreShift(IWorkrColors c) {
    final shift = _shift!;
    final preferences =
        (_participantDossier?['preferences'] as Map?)?.cast<String, dynamic>() ?? {};
    final goals = ((_participantDossier?['goals'] as List?) ?? const []);

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (shift.criticalAlerts.isNotEmpty &&
            notification.metrics.pixels > 140 &&
            !_criticalAlertsScrolled) {
          setState(() => _criticalAlertsScrolled = true);
        }
        return false;
      },
      child: CustomScrollView(
        slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.canPop() ? context.pop() : context.go('/');
            },
            child: Center(
                child: Icon(PhosphorIconsLight.arrowLeft,
                    color: c.textPrimary, size: 22)),
          ),
          title: Text('Shift Briefing',
              style: GoogleFonts.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: c.textPrimary,
                  letterSpacing: -0.3)),
          flexibleSpace: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
              child:
                  Container(color: c.canvas.withValues(alpha: 0.85)),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // ── Critical Alerts Banner ──────────────────
              if (shift.criticalAlerts.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.rose.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color:
                            ObsidianTheme.rose.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(PhosphorIconsFill.warning,
                              size: 18, color: ObsidianTheme.rose),
                          const SizedBox(width: 8),
                          Text('CRITICAL ALERTS',
                              style: GoogleFonts.jetBrainsMono(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: ObsidianTheme.rose,
                                  letterSpacing: 0.8)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: shift.criticalAlerts
                            .map((alert) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: ObsidianTheme.rose
                                        .withValues(alpha: 0.15),
                                    borderRadius:
                                        BorderRadius.circular(8),
                                  ),
                                  child: Text(alert,
                                      style: GoogleFonts.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: ObsidianTheme.rose)),
                                ))
                            .toList(),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 300.ms)
                    .shakeX(hz: 2, amount: 2, duration: 400.ms),

              // ── Participant & Schedule Card ─────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: ObsidianTheme.careBlue
                                .withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              shift.participantInitials,
                              style: GoogleFonts.inter(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: ObsidianTheme.careBlue),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              Text(shift.participantName ?? 'Unknown',
                                  style: GoogleFonts.inter(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w700,
                                      color: c.textPrimary)),
                              if (shift.serviceType != null)
                                Text(shift.serviceType!,
                                    style: GoogleFonts.inter(
                                        fontSize: 13,
                                        color: c.textTertiary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _InfoRow(
                        icon: PhosphorIconsLight.clock,
                        label: 'Schedule',
                        value:
                            '${DateFormat('h:mm a').format(shift.scheduledStart)} – ${DateFormat('h:mm a').format(shift.scheduledEnd)} (${shift.formattedDuration})'),
                    if (shift.location != null)
                      _InfoRow(
                          icon: PhosphorIconsLight.mapPin,
                          label: 'Location',
                          value: shift.location!),
                    if (shift.ndisLineItem != null)
                      _InfoRow(
                          icon: PhosphorIconsLight.tag,
                          label: 'NDIS Line Item',
                          value: shift.ndisLineItem!),
                  ],
                ),
              )
                  .animate()
                  .fadeIn(duration: 300.ms)
                  .moveY(begin: 10, end: 0),
              const SizedBox(height: 16),

              // ── Handover Notes ──────────────────────────
              if (shift.handoverNotes != null &&
                  shift.handoverNotes!.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: ObsidianTheme.careBlue
                            .withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(PhosphorIconsLight.notepad,
                              size: 16,
                              color: ObsidianTheme.careBlue),
                          const SizedBox(width: 8),
                          Text('HANDOVER NOTES',
                              style: GoogleFonts.jetBrainsMono(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: ObsidianTheme.careBlue,
                                  letterSpacing: 0.8)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(shift.handoverNotes!,
                          style: GoogleFonts.inter(
                              fontSize: 14,
                              color: c.textSecondary,
                              height: 1.5)),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: 100.ms, duration: 300.ms)
                    .moveY(begin: 10, end: 0),
                const SizedBox(height: 16),
              ],

              // ── Quick Glance Cards ─────────────────────
              if (preferences.isNotEmpty || goals.isNotEmpty) ...[
                Text('PERSONA QUICK GLANCE',
                    style: GoogleFonts.jetBrainsMono(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: c.textTertiary,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Likes: ${(preferences['likes'] as List?)?.take(4).join(', ') ?? '—'}',
                        style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Dislikes: ${(preferences['dislikes'] as List?)?.take(4).join(', ') ?? '—'}',
                        style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Top Goal: ${goals.isNotEmpty ? (goals.first as Map)['goal_statement'] : 'No active goals'}',
                        style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── Mandatory acknowledgment for critical alerts ──────
              if (shift.criticalAlerts.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.35)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Profile Acknowledgment Required',
                          style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: c.textPrimary)),
                      const SizedBox(height: 6),
                      Text(
                        _criticalAlertsScrolled
                            ? 'Confirm you reviewed the critical alerts.'
                            : 'Scroll past alerts to unlock acknowledgment.',
                        style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                      ),
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: (_criticalAlertsScrolled && !_briefingAcknowledged)
                            ? () async => _acknowledgeBriefing()
                            : null,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: _briefingAcknowledged
                                ? ObsidianTheme.emerald.withValues(alpha: 0.15)
                                : (_criticalAlertsScrolled
                                    ? ObsidianTheme.careBlue.withValues(alpha: 0.15)
                                    : c.canvas),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _briefingAcknowledged
                                  ? ObsidianTheme.emerald.withValues(alpha: 0.45)
                                  : (_criticalAlertsScrolled
                                      ? ObsidianTheme.careBlue.withValues(alpha: 0.45)
                                      : c.border),
                            ),
                          ),
                          child: Text(
                            _briefingAcknowledged
                                ? 'Acknowledged'
                                : 'I have reviewed the profile updates',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _briefingAcknowledged
                                  ? ObsidianTheme.emerald
                                  : (_criticalAlertsScrolled ? ObsidianTheme.careBlue : c.textDisabled),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── Quick Links ─────────────────────────────
              Text('QUICK LINKS',
                  style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: c.textTertiary,
                      letterSpacing: 0.8)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _QuickLink(
                      icon: PhosphorIconsLight.target,
                      label: 'Care Goals',
                      onTap: () => context.push('/care/plans')),
                  const SizedBox(width: 8),
                  _QuickLink(
                      icon: PhosphorIconsLight.pill,
                      label: 'Medications',
                      onTap: () => context.push(
                          '/care/medications?shift_id=${widget.shiftId}&participant_id=${shift.participantId ?? ''}')),
                  const SizedBox(width: 8),
                  _QuickLink(
                      icon: PhosphorIconsLight.heartbeat,
                      label: 'Observations',
                      onTap: () => context.push(
                          '/care/observations?participant_id=${shift.participantId ?? ''}')),
                ],
              )
                  .animate()
                  .fadeIn(delay: 200.ms, duration: 300.ms)
                  .moveY(begin: 10, end: 0),
            ]),
          ),
        ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════
  // ── ACTIVE SHIFT HUD (Clocked In) ────────────────────
  // ═══════════════════════════════════════════════════════

  Widget _buildActiveHUD(IWorkrColors c) {
    final shift = _shift!;
    final hours = _elapsed.inHours;
    final minutes = _elapsed.inMinutes.remainder(60);
    final seconds = _elapsed.inSeconds.remainder(60);

    return SafeArea(
      child: Column(
        children: [
          // ── Header ──────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    context.canPop()
                        ? context.pop()
                        : context.go('/');
                  },
                  child: Icon(PhosphorIconsLight.arrowLeft,
                      size: 22, color: c.textPrimary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                          shift.participantName ?? 'Active Shift',
                          style: GoogleFonts.inter(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              color: c.textPrimary)),
                      Text(shift.serviceType ?? '',
                          style: GoogleFonts.inter(
                              fontSize: 13,
                              color: c.textTertiary)),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: _openProfileSheet,
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: c.border),
                    ),
                    child: Icon(PhosphorIconsLight.userCircle, size: 18, color: c.textSecondary),
                  ),
                ),
                GestureDetector(
                  onTap: () => context.push('/care/shift/${widget.shiftId}/travel?mode=participant'),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: c.border),
                    ),
                    child: Icon(PhosphorIconsLight.car, size: 18, color: ObsidianTheme.careBlue),
                  ),
                ),
                GestureDetector(
                  onTap: () => context.push('/care/shift/${widget.shiftId}/wallets'),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: c.border),
                    ),
                    child: Icon(PhosphorIconsLight.wallet, size: 18, color: ObsidianTheme.emerald),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.emerald.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald),
                      ),
                      const SizedBox(width: 6),
                      Text('ON SHIFT',
                          style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: ObsidianTheme.emerald,
                              letterSpacing: 0.8)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Spacer(),

          // ── Chronometer Ring ────────────────────────
          SizedBox(
            width: 200,
            height: 200,
            child: CustomPaint(
              painter: _ChronoPainter(
                progress: min(
                    _elapsed.inMinutes /
                        shift.scheduledDuration.inMinutes,
                    1.0),
                color: ObsidianTheme.careBlue,
                bgColor: c.border,
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}',
                      style: GoogleFonts.jetBrainsMono(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: c.textPrimary),
                    ),
                    Text('ELAPSED',
                        style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: c.textTertiary,
                            letterSpacing: 1)),
                  ],
                ),
              ),
            ),
          )
              .animate()
              .fadeIn(duration: 500.ms)
              .scale(begin: const Offset(0.9, 0.9)),

          const SizedBox(height: 8),
          Text(
            'Scheduled: ${DateFormat('h:mm a').format(shift.scheduledStart)} – ${DateFormat('h:mm a').format(shift.scheduledEnd)}',
            style:
                GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
          ),

          const Spacer(),

          // ── Care Action Grid (Bento) ───────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                if (_isShadowTrainingShift)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: ObsidianTheme.amber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      'TRAINING MODE - clinical execution controls are read-only for shadow shifts.',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: ObsidianTheme.amber,
                      ),
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                        child: _ActionTile(
                      icon: PhosphorIconsLight.pill,
                      label: 'Medications\n(eMAR)',
                      color: ObsidianTheme.careBlue,
                      enabled: !_isShadowTrainingShift,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/medications?shift_id=${widget.shiftId}&participant_id=${shift.participantId ?? ''}');
                      },
                    )),
                    const SizedBox(width: 10),
                    Expanded(
                        child: _ActionTile(
                      icon: PhosphorIconsLight.heartbeat,
                      label: 'Health\nObservations',
                      color: ObsidianTheme.blue,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/observations?participant_id=${shift.participantId ?? ''}');
                      },
                    )),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                        child: _ActionTile(
                      icon: PhosphorIconsLight.listChecks,
                      label: 'Routines &\nTasks',
                      color: ObsidianTheme.careBlue,
                      enabled: !_isShadowTrainingShift,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/shift/${widget.shiftId}/routines');
                      },
                    )),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                        child: _ActionTile(
                      icon: PhosphorIconsLight.warningCircle,
                      label: 'Log\nIncident',
                      color: ObsidianTheme.amber,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.push('/care/incidents/new');
                      },
                    )),
                    const SizedBox(width: 10),
                    Expanded(
                        child: _ActionTile(
                      icon: PhosphorIconsLight.signOut,
                      label: 'End Shift\n& Debrief',
                      color: ObsidianTheme.rose,
                      onTap: () {
                        HapticFeedback.mediumImpact();
                        _handleClockOutGate();
                      },
                    )),
                  ],
                ),
              ],
            )
                .animate()
                .fadeIn(delay: 200.ms, duration: 400.ms)
                .moveY(begin: 20, end: 0),
          ),

          const SizedBox(height: 24),

          // ── Slide to Clock Out ──────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: SlideToAct(
              label: 'Slide to Clock Out',
              color: ObsidianTheme.rose,
              icon: PhosphorIconsLight.signOut,
              onSlideComplete: _handleClockOutGate,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Helper Widgets ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: c.textTertiary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: GoogleFonts.inter(
                        fontSize: 11, color: c.textTertiary)),
                Text(value,
                    style: GoogleFonts.inter(
                        fontSize: 14, color: c.textPrimary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickLink(
      {required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.border),
          ),
          child: Column(
            children: [
              Icon(icon, size: 22, color: ObsidianTheme.careBlue),
              const SizedBox(height: 6),
              Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 12, color: c.textSecondary),
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final bool enabled;
  const _ActionTile(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap,
      this.enabled = true});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        height: 100,
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 24, color: color),
            ),
            const SizedBox(height: 8),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: c.textSecondary),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    ));
  }
}

// ═══════════════════════════════════════════════════════════
// ── Chronometer Ring Painter ─────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ChronoPainter extends CustomPainter {
  final double progress;
  final Color color;
  final Color bgColor;

  _ChronoPainter(
      {required this.progress,
      required this.color,
      required this.bgColor});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;
    const strokeWidth = 6.0;

    // Background ring
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = bgColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );

    // Progress arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -pi / 2,
      2 * pi * progress.clamp(0, 1),
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _ChronoPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
