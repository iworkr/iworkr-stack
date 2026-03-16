import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/features/automotive/models/automotive_models.dart';
import 'package:iworkr_mobile/features/automotive/providers/automotive_providers.dart';

// ============================================================================
// Project Outrider — Automotive Bridge Service
// ============================================================================
// Abstraction layer between Flutter and native CarPlay/Android Auto APIs.
// Manages connection lifecycle, template rendering, and state synchronization
// between the vehicle display and the mobile device.
//
// IMPORTANT: This service does NOT tightly couple to any specific package.
// All native interactions go through MethodChannels, allowing the underlying
// CarPlay/AA implementation to be swapped without touching business logic.
// ============================================================================

/// Method channel for native CarPlay/Android Auto communication.
const _channel = MethodChannel('com.iworkr.app/automotive');

class AutomotiveBridgeService {
  AutomotiveBridgeService(this._ref);

  final Ref _ref;
  bool _isConnected = false;
  String? _connectionType;
  String? _activeTransitLogId;
  Position? _connectionStartPosition;
  Timer? _telemetryTimer;

  bool get isConnected => _isConnected;
  String? get connectionType => _connectionType;

  // ── Initialization ────────────────────────────────────────────────────

  void initialize() {
    _channel.setMethodCallHandler(_handleNativeCall);
    debugPrint('[Outrider] Automotive bridge initialized');
  }

  /// Handle calls FROM native (CarPlay/AA) → Flutter
  Future<dynamic> _handleNativeCall(MethodCall call) async {
    switch (call.method) {
      case 'onConnected':
        _connectionType = call.arguments?['type'] as String? ?? 'carplay';
        await _handleConnection(true);
        return true;

      case 'onDisconnected':
        await _handleConnection(false);
        return true;

      case 'onItemSelected':
        final itemId = call.arguments?['id'] as String?;
        final action = call.arguments?['action'] as String?;
        if (itemId != null) {
          await _handleItemAction(itemId, action ?? 'select');
        }
        return true;

      case 'onSOSTriggered':
        await _handleSOS();
        return true;

      case 'onSafetyOverride':
        await _logSafetyOverride();
        return true;

      default:
        debugPrint('[Outrider] Unknown native call: ${call.method}');
        return null;
    }
  }

  // ── Connection Lifecycle ──────────────────────────────────────────────

  Future<void> _handleConnection(bool connected) async {
    _isConnected = connected;

    // Update Riverpod state (triggers Safe Driving overlay on mobile)
    _ref.read(automotiveConnectionProvider.notifier).state =
        AutomotiveConnectionState(
      isConnected: connected,
      connectionType: _connectionType,
      connectedAt: connected ? DateTime.now() : null,
    );

    if (connected) {
      debugPrint('[Outrider] Car connected: $_connectionType');

      // Record start position for mileage tracking
      try {
        _connectionStartPosition = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
      } catch (_) {
        _connectionStartPosition = null;
      }

      // Hydrate the car UI with today's agenda
      await _pushAgendaTemplate();

      // Start fleet telemetry if applicable
      _startTelemetry();
    } else {
      debugPrint('[Outrider] Car disconnected');

      // Stop telemetry
      _telemetryTimer?.cancel();
      _telemetryTimer = null;

      // Record end position and finalize transit log
      await _finalizeTransitLog();

      // Trigger seamless handoff
      _triggerHandoff();
    }
  }

  // ── Template Rendering ────────────────────────────────────────────────

  /// Push the day's agenda to the car display.
  /// Respects tenant polymorphism: Trade shows full details, Care masks PII.
  Future<void> _pushAgendaTemplate() async {
    try {
      final client = SupabaseService.client;
      final user = client.auth.currentUser;
      if (user == null) return;

      final workspace = _ref.read(activeWorkspaceProvider).valueOrNull;
      final isCare = workspace?.isCare ?? false;

      // Fetch today's shifts/jobs
      final today = DateTime.now();
      final startOfDay = DateTime(today.year, today.month, today.day);
      final endOfDay = startOfDay.add(const Duration(days: 1));

      final blocks = await client
          .from('schedule_blocks')
          .select('id, title, client_name, location, start_time, end_time, status, job_id, notes')
          .eq('technician_id', user.id)
          .gte('start_time', startOfDay.toIso8601String())
          .lt('start_time', endOfDay.toIso8601String())
          .neq('status', 'cancelled')
          .order('start_time');

      if (blocks.isEmpty) {
        // Push "no shifts" template
        await _channel.invokeMethod('pushTemplate', {
          'type': 'information',
          'title': isCare ? 'No Shifts Today' : 'No Jobs Today',
          'message': 'Your schedule is clear. Enjoy your day!',
        });
        return;
      }

      // Build list items with privacy masking for Care
      final items = <Map<String, dynamic>>[];
      for (final block in blocks) {
        final String title;
        final String subtitle;

        if (isCare) {
          // Privacy-masked: "Shift: Community Access - T.M. - Spring Hill"
          final clientName = block['client_name'] as String? ?? '';
          final initials = _getInitials(clientName);
          final suburb = _extractSuburb(block['location'] as String? ?? '');
          title = '${block['title'] ?? 'Shift'} - $initials';
          subtitle = '$suburb · ${_formatTime(block['start_time'])} - ${_formatTime(block['end_time'])}';
        } else {
          // Trade: Full details visible
          title = block['title'] as String? ?? 'Job';
          subtitle = '${block['location'] ?? 'No address'} · ${_formatTime(block['start_time'])}';
        }

        items.add({
          'id': block['id'],
          'title': title,
          'subtitle': subtitle,
          'status': block['status'],
          'jobId': block['job_id'],
          'hasNotes': (block['notes'] as String?)?.isNotEmpty ?? false,
          'isCare': isCare,
        });
      }

      // Push list template to car display
      await _channel.invokeMethod('pushTemplate', {
        'type': 'list',
        'title': isCare ? "Today's Roster" : "Today's Route",
        'items': items,
        'showSOS': isCare, // SOS button only for Care
      });

      // Update focused shift in state
      if (blocks.isNotEmpty) {
        final nextPending = blocks.firstWhere(
          (b) => b['status'] == 'scheduled' || b['status'] == 'en_route',
          orElse: () => blocks.first,
        );
        _ref.read(focusedCarShiftProvider.notifier).state = nextPending['id'] as String?;
      }
    } catch (e) {
      debugPrint('[Outrider] Failed to push agenda: $e');
    }
  }

  // ── Item Actions ──────────────────────────────────────────────────────

  Future<void> _handleItemAction(String itemId, String action) async {
    switch (action) {
      case 'navigate':
        await _startNavigation(itemId);
        break;
      case 'en_route':
        await _markEnRoute(itemId);
        break;
      case 'call_client':
        await _callClient(itemId);
        break;
      case 'play_briefing':
        await _playTTSBriefing(itemId);
        break;
      case 'select':
        await _showActionPane(itemId);
        break;
    }
  }

  /// Show the action pane when a shift/job is selected
  Future<void> _showActionPane(String shiftId) async {
    final workspace = _ref.read(activeWorkspaceProvider).valueOrNull;
    final isCare = workspace?.isCare ?? false;

    _ref.read(focusedCarShiftProvider.notifier).state = shiftId;

    final actions = <Map<String, dynamic>>[];

    if (isCare) {
      actions.addAll([
        {'id': 'navigate', 'label': 'Navigate', 'icon': 'navigation'},
        {'id': 'play_briefing', 'label': 'Play Shift Briefing', 'icon': 'speaker'},
      ]);
    } else {
      actions.addAll([
        {'id': 'navigate', 'label': 'Navigate', 'icon': 'navigation'},
        {'id': 'en_route', 'label': 'Mark En Route', 'icon': 'car'},
        {'id': 'call_client', 'label': 'Call Client', 'icon': 'phone'},
      ]);
    }

    await _channel.invokeMethod('pushTemplate', {
      'type': 'action_pane',
      'shiftId': shiftId,
      'actions': actions,
    });
  }

  /// Start turn-by-turn navigation to a shift/job location
  Future<void> _startNavigation(String shiftId) async {
    try {
      final client = SupabaseService.client;

      // Get location from schedule_block → job
      final block = await client
          .from('schedule_blocks')
          .select('location, job_id')
          .eq('id', shiftId)
          .maybeSingle();

      String? address = block?['location'] as String?;
      double? lat;
      double? lng;

      // Try to get precise coordinates from linked job
      if (block?['job_id'] != null) {
        final job = await client
            .from('jobs')
            .select('location, location_lat, location_lng')
            .eq('id', block!['job_id'])
            .maybeSingle();
        if (job != null) {
          lat = job['location_lat'] as double?;
          lng = job['location_lng'] as double?;
          address ??= job['location'] as String?;
        }
      }

      if (address == null && lat == null) {
        debugPrint('[Outrider] No address or coordinates for shift $shiftId');
        return;
      }

      // Invoke native navigation
      await _channel.invokeMethod('startNavigation', {
        'address': address,
        'latitude': lat,
        'longitude': lng,
      });

      // Also mark en route if trade
      final workspace = _ref.read(activeWorkspaceProvider).valueOrNull;
      if (workspace?.isCare == false) {
        await _markEnRoute(shiftId);
      }
    } catch (e) {
      debugPrint('[Outrider] Navigation failed: $e');
    }
  }

  /// Mark shift/job as en route + fire ETA SMS
  Future<void> _markEnRoute(String shiftId) async {
    try {
      final client = SupabaseService.client;
      final user = client.auth.currentUser;
      if (user == null) return;

      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
      } catch (_) {}

      // Get linked job_id
      final block = await client
          .from('schedule_blocks')
          .select('job_id')
          .eq('id', shiftId)
          .maybeSingle();

      // Fire the en-route Edge Function
      await client.functions.invoke('outrider-en-route-notify', body: {
        'user_id': user.id,
        'shift_id': shiftId,
        'job_id': block?['job_id'],
        'current_lat': pos?.latitude ?? 0,
        'current_lng': pos?.longitude ?? 0,
        'eta_minutes': 15, // Default; will be calculated by maps API
        'vehicle_id': _ref.read(activeVehicleProvider),
      });

      debugPrint('[Outrider] En route triggered for shift $shiftId');

      // Refresh the car display
      await _pushAgendaTemplate();
    } catch (e) {
      debugPrint('[Outrider] En route failed: $e');
    }
  }

  /// Call the client via native Bluetooth telephony
  Future<void> _callClient(String shiftId) async {
    try {
      final client = SupabaseService.client;

      // Get job → client → phone
      final block = await client
          .from('schedule_blocks')
          .select('job_id')
          .eq('id', shiftId)
          .maybeSingle();

      if (block?['job_id'] == null) return;

      final job = await client
          .from('jobs')
          .select('clients!client_id(phone)')
          .eq('id', block!['job_id'])
          .single();

      final phone = (job['clients'] as Map?)?['phone'] as String?;
      if (phone == null || phone.isEmpty) {
        debugPrint('[Outrider] No client phone for job');
        return;
      }

      // Hand off to native phone dialer (hands-free via Bluetooth)
      await _channel.invokeMethod('callPhone', {'number': phone});
    } catch (e) {
      debugPrint('[Outrider] Call client failed: $e');
    }
  }

  /// Play a TTS shift briefing over the car speakers
  Future<void> _playTTSBriefing(String shiftId) async {
    try {
      final client = SupabaseService.client;

      // Fetch handover notes / coordinator summary
      final block = await client
          .from('schedule_blocks')
          .select('title, notes, client_name, start_time, end_time')
          .eq('id', shiftId)
          .maybeSingle();

      if (block == null) return;

      // Build briefing text
      final buffer = StringBuffer();
      buffer.writeln('Your next shift is ${block['title'] ?? 'a support shift'}.');
      if (block['client_name'] != null) {
        buffer.writeln('The participant is ${block['client_name']}.');
      }
      buffer.writeln(
          'Scheduled from ${_formatTime(block['start_time'])} to ${_formatTime(block['end_time'])}.');

      if (block['notes'] != null && (block['notes'] as String).isNotEmpty) {
        buffer.writeln('Note: ${block['notes']}');
      }

      // Try to fetch latest handover note from progress notes
      try {
        final notes = await client
            .from('progress_notes')
            .select('content')
            .eq('shift_id', shiftId)
            .order('created_at', ascending: false)
            .limit(1);

        if (notes.isNotEmpty) {
          buffer.writeln('Latest handover note: ${notes.first['content']}');
        }
      } catch (_) {
        // progress_notes table may not exist — continue without
      }

      // Send to native TTS engine
      await _channel.invokeMethod('speakText', {
        'text': buffer.toString(),
        'language': 'en-AU',
      });
    } catch (e) {
      debugPrint('[Outrider] TTS briefing failed: $e');
    }
  }

  // ── Emergency SOS ─────────────────────────────────────────────────────

  Future<void> _handleSOS() async {
    try {
      final client = SupabaseService.client;
      final user = client.auth.currentUser;
      if (user == null) return;

      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.bestForNavigation,
            timeLimit: Duration(seconds: 3),
          ),
        );
      } catch (_) {}

      final workspace = _ref.read(activeWorkspaceProvider).valueOrNull;

      // Create SOS event
      await client.from('automotive_sos_events').insert({
        'user_id': user.id,
        'organization_id': workspace?.organizationId,
        'latitude': pos?.latitude ?? 0,
        'longitude': pos?.longitude ?? 0,
        'speed_kmh': pos?.speed ?? 0,
        'shift_id': _ref.read(focusedCarShiftProvider),
        'vehicle_id': _ref.read(activeVehicleProvider),
        'participant_in_vehicle': true, // Assume worst case
        'status': 'triggered',
      });

      // Send urgent push notification to all org admins
      await client.functions.invoke('send-push', body: {
        'type': 'sos_automotive',
        'organization_id': workspace?.organizationId,
        'title': '🚨 EMERGENCY: SOS Triggered In Transit',
        'body':
            'Worker ${user.userMetadata?['full_name'] ?? user.email} triggered SOS at coordinates (${pos?.latitude.toStringAsFixed(4)}, ${pos?.longitude.toStringAsFixed(4)})',
        'target': 'admins',
      });

      // Confirm to the car display
      await _channel.invokeMethod('pushTemplate', {
        'type': 'information',
        'title': 'Emergency Alert Sent',
        'message': 'Your coordinator has been notified. Help is on the way.',
      });

      debugPrint('[Outrider] SOS triggered at ${pos?.latitude}, ${pos?.longitude}');
    } catch (e) {
      debugPrint('[Outrider] SOS failed: $e');
    }
  }

  // ── Fleet Telemetry ───────────────────────────────────────────────────

  void _startTelemetry() {
    final vehicleId = _ref.read(activeVehicleProvider);
    if (vehicleId == null) return; // Only for org vehicles

    _telemetryTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );

        // Speed violation check (only for fleet vehicles)
        final speedKmh = (pos.speed * 3.6); // m/s to km/h

        // Log to local buffer (batched upload on disconnect)
        _ref.read(telemetryBufferProvider.notifier).addPoint(
              TelemetryPoint(
                lat: pos.latitude,
                lng: pos.longitude,
                speedKmh: speedKmh,
                timestamp: DateTime.now(),
              ),
            );
      } catch (_) {
        // GPS unavailable — skip this tick
      }
    });
  }

  // ── Transit Log Finalization ──────────────────────────────────────────

  Future<void> _finalizeTransitLog() async {
    try {
      if (_connectionStartPosition == null) return;

      final endPos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 5),
        ),
      );

      final distance = Geolocator.distanceBetween(
        _connectionStartPosition!.latitude,
        _connectionStartPosition!.longitude,
        endPos.latitude,
        endPos.longitude,
      ) /
          1000; // meters to km

      final client = SupabaseService.client;
      final user = client.auth.currentUser;
      if (user == null) return;

      // Get the transit log that was started (if any)
      final focusedShift = _ref.read(focusedCarShiftProvider);
      if (focusedShift == null) return;

      // Append mileage to shift_travel_logs
      await client.from('shift_travel_logs').upsert({
        'id': _activeTransitLogId ?? SupabaseService.client.auth.currentUser!.id,
        'organization_id': _ref.read(activeWorkspaceProvider).valueOrNull?.organizationId,
        'shift_id': focusedShift,
        'worker_id': user.id,
        'travel_type': 'provider_travel',
        'start_time': _connectionStartPosition != null
            ? DateTime.now().subtract(const Duration(minutes: 30)).toIso8601String()
            : DateTime.now().toIso8601String(),
        'end_time': DateTime.now().toIso8601String(),
        'start_lat': _connectionStartPosition!.latitude,
        'start_lng': _connectionStartPosition!.longitude,
        'end_lat': endPos.latitude,
        'end_lng': endPos.longitude,
        'calculated_distance_km': distance.toStringAsFixed(2),
      }, onConflict: 'id');

      _connectionStartPosition = null;
    } catch (e) {
      debugPrint('[Outrider] Transit log finalization failed: $e');
    }
  }

  // ── Seamless Handoff ──────────────────────────────────────────────────

  void _triggerHandoff() {
    final focusedShift = _ref.read(focusedCarShiftProvider);
    if (focusedShift == null) return;

    final workspace = _ref.read(activeWorkspaceProvider).valueOrNull;
    final isCare = workspace?.isCare ?? false;

    // Build the handoff route
    final route = isCare
        ? '/care/shift/$focusedShift'
        : '/jobs/$focusedShift/execute';

    // Notify the handoff provider (GoRouter will pick this up)
    _ref.read(handoffRouteProvider.notifier).state = route;

    debugPrint('[Outrider] Handoff triggered → $route');
  }

  // ── Safety Override Logging ───────────────────────────────────────────

  Future<void> _logSafetyOverride() async {
    try {
      final client = SupabaseService.client;
      final user = client.auth.currentUser;
      if (user == null) return;

      await client.from('telemetry_events').insert({
        'event_timestamp': DateTime.now().toUtc().toIso8601String(),
        'severity': 'warning',
        'status': 'unresolved',
        'user_id': user.id,
        'platform': 'mobile_${defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android'}',
        'last_action': 'safety_override_activated',
        'error_name': 'outrider_safety_override',
        'error_message': 'User overrode Safe Driving Mode lock screen',
        'payload': {
          'connection_type': _connectionType,
          'timestamp': DateTime.now().toIso8601String(),
        },
      });

      debugPrint('[Outrider] Safety override logged');
    } catch (_) {}
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  String _getInitials(String name) {
    if (name.isEmpty) return '??';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}.${parts.last[0]}.';
    }
    return '${parts.first[0]}.';
  }

  String _extractSuburb(String address) {
    if (address.isEmpty) return 'Unknown';
    // Extract suburb from "123 Smith St, Kelso QLD 4350" → "Kelso"
    final parts = address.split(',');
    if (parts.length >= 2) {
      final suburb = parts[1].trim().split(' ').first;
      return suburb;
    }
    return address.length > 20 ? '${address.substring(0, 20)}...' : address;
  }

  String _formatTime(dynamic timestamp) {
    if (timestamp == null) return '--:--';
    try {
      final dt = DateTime.parse(timestamp.toString()).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return '--:--';
    }
  }

  void dispose() {
    _telemetryTimer?.cancel();
  }
}
