import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:iworkr_mobile/core/theme/brand_theme.dart';
import 'package:iworkr_mobile/features/automotive/providers/automotive_providers.dart';

// ============================================================================
// Project Outrider — Safe Driving Mode Screen
// ============================================================================
// Full-screen blocking overlay that activates when CarPlay/Android Auto
// connects. Prevents phone interaction while driving.
//
// Features:
// - Completely dark (Obsidian) to avoid driver distraction
// - Company logo + "Safe Driving Mode" text
// - Long-press unlock for passengers (generates telemetry log)
// - Auto-dismisses on car disconnect (seamless handoff)
// ============================================================================

class SafeDrivingScreen extends ConsumerStatefulWidget {
  const SafeDrivingScreen({super.key});

  @override
  ConsumerState<SafeDrivingScreen> createState() => _SafeDrivingScreenState();
}

class _SafeDrivingScreenState extends ConsumerState<SafeDrivingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _breatheController;
  bool _isOverriding = false;
  double _overrideProgress = 0;

  @override
  void initState() {
    super.initState();
    _breatheController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    // Lock to portrait and set system chrome
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    _breatheController.dispose();
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brand = context.brand;
    final connection = ref.watch(automotiveConnectionProvider);

    // If no longer connected, this screen should be popped
    // (handled by the router/overlay manager)
    if (!connection.isConnected) {
      // Will be handled by the automotive overlay widget
    }

    return PopScope(
      canPop: false, // Cannot be dismissed with back button
      child: Scaffold(
        backgroundColor: const Color(0xFF050505),
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // ── Breathing brand dot ──
                AnimatedBuilder(
                  animation: _breatheController,
                  builder: (context, child) {
                    return Container(
                      width: 60 + (_breatheController.value * 10),
                      height: 60 + (_breatheController.value * 10),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: brand.primary.withValues(
                          alpha: 0.2 + (_breatheController.value * 0.15),
                        ),
                        border: Border.all(
                          color: brand.primary.withValues(alpha: 0.4),
                          width: 1,
                        ),
                      ),
                      child: Icon(
                        Icons.directions_car_rounded,
                        color: brand.primary,
                        size: 28,
                      ),
                    );
                  },
                ),

                const SizedBox(height: 32),

                // ── Title ──
                Text(
                  'Safe Driving Mode',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.9),
                    letterSpacing: -0.5,
                  ),
                ),

                const SizedBox(height: 8),

                Text(
                  'Please use your vehicle\'s display.',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withValues(alpha: 0.35),
                  ),
                ),

                const SizedBox(height: 8),

                // Connection type indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    color: brand.primary.withValues(alpha: 0.1),
                    border: Border.all(
                      color: brand.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    connection.connectionType == 'android_auto'
                        ? 'Android Auto Connected'
                        : 'CarPlay Connected',
                    style: TextStyle(
                      fontSize: 11,
                      color: brand.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),

                const SizedBox(height: 80),

                // ── Passenger Override (long-press) ──
                GestureDetector(
                  onLongPressStart: (_) {
                    setState(() => _isOverriding = true);
                    _animateOverride();
                  },
                  onLongPressEnd: (_) {
                    setState(() {
                      _isOverriding = false;
                      _overrideProgress = 0;
                    });
                  },
                  child: Column(
                    children: [
                      SizedBox(
                        width: 48,
                        height: 48,
                        child: Stack(
                          children: [
                            CircularProgressIndicator(
                              value: _overrideProgress,
                              strokeWidth: 2,
                              backgroundColor: Colors.white10,
                              color: Colors.amber.withValues(alpha: 0.6),
                            ),
                            Center(
                              child: Icon(
                                Icons.lock_open_rounded,
                                color: Colors.white.withValues(alpha: 0.15),
                                size: 20,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Passenger? Hold to unlock',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.white.withValues(alpha: 0.12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _animateOverride() async {
    const duration = Duration(seconds: 3);
    const steps = 30;
    final stepDuration = duration ~/ steps;

    for (int i = 0; i <= steps; i++) {
      if (!_isOverriding || !mounted) return;

      setState(() {
        _overrideProgress = i / steps;
      });

      await Future.delayed(stepDuration);
    }

    if (_isOverriding && mounted) {
      // Override successful — log and dismiss
      const channel = MethodChannel('com.iworkr.app/automotive');
      await channel.invokeMethod('onSafetyOverride', null);

      if (mounted) {
        // Pop the safe driving screen
        Navigator.of(context, rootNavigator: true).pop();
      }
    }
  }
}
