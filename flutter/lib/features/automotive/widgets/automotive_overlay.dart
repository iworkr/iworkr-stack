import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:iworkr_mobile/features/automotive/models/automotive_models.dart';
import 'package:iworkr_mobile/features/automotive/providers/automotive_providers.dart';
import 'package:iworkr_mobile/features/automotive/screens/safe_driving_screen.dart';

// ============================================================================
// Project Outrider — Automotive Overlay Widget
// ============================================================================
// Wraps the app's root widget. When CarPlay/Android Auto connects:
// 1. Pushes the Safe Driving Mode full-screen overlay
// 2. On disconnect, pops the overlay + triggers seamless handoff
// ============================================================================

class AutomotiveOverlay extends ConsumerStatefulWidget {
  const AutomotiveOverlay({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  ConsumerState<AutomotiveOverlay> createState() => _AutomotiveOverlayState();
}

class _AutomotiveOverlayState extends ConsumerState<AutomotiveOverlay> {
  bool _isOverlayShowing = false;

  @override
  Widget build(BuildContext context) {
    // Listen to connection state
    ref.listen<AutomotiveConnectionState>(
      automotiveConnectionProvider,
      (previous, next) {
        if (next.isConnected && !_isOverlayShowing) {
          _showSafeDrivingMode();
        } else if (!next.isConnected && _isOverlayShowing) {
          _dismissSafeDrivingMode();
        }
      },
    );

    // Listen for handoff route
    ref.listen<String?>(
      handoffRouteProvider,
      (previous, next) {
        if (next != null && next.isNotEmpty) {
          // Navigate to the handoff route
          Future.microtask(() {
            if (context.mounted) {
              context.go(next);
              ref.read(handoffRouteProvider.notifier).state = null;
            }
          });
        }
      },
    );

    return widget.child;
  }

  void _showSafeDrivingMode() {
    _isOverlayShowing = true;
    Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder(
        opaque: true,
        fullscreenDialog: true,
        pageBuilder: (_, __, ___) => const SafeDrivingScreen(),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 500),
      ),
    );
  }

  void _dismissSafeDrivingMode() {
    _isOverlayShowing = false;
    if (Navigator.of(context, rootNavigator: true).canPop()) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }
}
