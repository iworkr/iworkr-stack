import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Wraps children with staggered slide-up-fade animation.
///
/// Web spec (widget-shell / FadeIn):
/// - Duration: 500ms
/// - Distance: 10px (y offset)
/// - Easing: [0.16, 1, 0.3, 1] — easeOutExpo
/// - Stagger: 20ms per item (100ms in web's staggerChildren: 0.1)
class StaggeredList extends StatelessWidget {
  final List<Widget> children;
  final Duration staggerDelay;
  final Duration itemDuration;
  final double slideOffset;

  const StaggeredList({
    super.key,
    required this.children,
    this.staggerDelay = const Duration(milliseconds: 20),
    this.itemDuration = const Duration(milliseconds: 500),
    this.slideOffset = 10,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(children.length, (i) {
        return children[i]
            .animate()
            .fadeIn(
              duration: itemDuration,
              delay: staggerDelay * i,
              curve: const Cubic(0.16, 1, 0.3, 1),
            )
            .moveY(
              begin: slideOffset,
              end: 0,
              duration: itemDuration,
              delay: staggerDelay * i,
              curve: const Cubic(0.16, 1, 0.3, 1),
            );
      }),
    );
  }
}

/// Extension to add stagger animation to any widget.
///
/// Uses the web's expo ease curve for smoother entry.
extension StaggerAnimateExtension on Widget {
  Widget staggerIn({
    required int index,
    Duration delay = const Duration(milliseconds: 20),
    double distance = 10,
  }) {
    return animate()
        .fadeIn(
          duration: 500.ms,
          delay: delay * index,
          curve: const Cubic(0.16, 1, 0.3, 1),
        )
        .moveY(
          begin: distance,
          end: 0,
          duration: 500.ms,
          delay: delay * index,
          curve: const Cubic(0.16, 1, 0.3, 1),
        );
  }
}
