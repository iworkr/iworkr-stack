import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

/// Visual indicator showing GPS satellite acquisition status.
/// Animates through states: searching → weak → locked.
class GpsLockIndicator extends StatefulWidget {
  final double? currentAccuracy;
  final bool isAcquiring;

  const GpsLockIndicator({
    super.key,
    this.currentAccuracy,
    this.isAcquiring = false,
  });

  @override
  State<GpsLockIndicator> createState() => _GpsLockIndicatorState();
}

class _GpsLockIndicatorState extends State<GpsLockIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    if (widget.isAcquiring) _pulseController.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(GpsLockIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isAcquiring && !oldWidget.isAcquiring) {
      _pulseController.repeat(reverse: true);
    } else if (!widget.isAcquiring && oldWidget.isAcquiring) {
      _pulseController.stop();
      _pulseController.value = 1.0;
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accuracy = widget.currentAccuracy;
    final Color color;
    final String label;
    final IconData icon;

    if (accuracy == null) {
      color = const Color(0xFF666666);
      label = 'Searching for GPS...';
      icon = Icons.gps_not_fixed;
    } else if (accuracy > 100) {
      color = Colors.orange;
      label = 'Weak signal (${accuracy.toStringAsFixed(0)}m)';
      icon = Icons.gps_not_fixed;
    } else if (accuracy > 30) {
      color = Colors.amber;
      label = 'Good signal (${accuracy.toStringAsFixed(0)}m)';
      icon = Icons.gps_fixed;
    } else {
      color = const Color(0xFF10B981);
      label = 'Locked (${accuracy.toStringAsFixed(0)}m)';
      icon = Icons.gps_fixed;
    }

    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final opacity = widget.isAcquiring
            ? 0.5 + (_pulseController.value * 0.5)
            : 1.0;
        return Opacity(
          opacity: opacity,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 16),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Standalone GPS accuracy stream for displaying real-time signal quality.
class GpsAccuracyStream {
  StreamSubscription<Position>? _sub;
  final _controller = StreamController<double>.broadcast();

  Stream<double> get stream => _controller.stream;

  void start() {
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
      ),
    ).listen(
      (pos) => _controller.add(pos.accuracy),
      onError: (_) {},
    );
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }

  void dispose() {
    stop();
    _controller.close();
  }
}
