import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Dark shimmer skeleton for loading states.
///
/// Uses the web's shimmer layer colors:
/// - Base: #18181B (shimmer_layer)
/// - Highlight: #27272A (zinc-800)
class ShimmerLoading extends StatelessWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  const ShimmerLoading({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Shimmer.fromColors(
      baseColor: c.shimmerBase,
      highlightColor: c.shimmerHighlight,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: c.shimmerBase,
          borderRadius: borderRadius ?? ObsidianTheme.radiusMd,
        ),
      ),
    );
  }
}

/// Full page skeleton loader — matches web loading patterns
class PageSkeleton extends StatelessWidget {
  const PageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ShimmerLoading(width: 180, height: 28),
          const SizedBox(height: 24),
          ShimmerLoading(height: 120, borderRadius: ObsidianTheme.radiusLg),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: ShimmerLoading(height: 80, borderRadius: ObsidianTheme.radiusLg)),
              const SizedBox(width: 12),
              Expanded(child: ShimmerLoading(height: 80, borderRadius: ObsidianTheme.radiusLg)),
            ],
          ),
          const SizedBox(height: 24),
          const ShimmerLoading(width: 120, height: 14),
          const SizedBox(height: 12),
          ...List.generate(
            5,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ShimmerLoading(height: 48, borderRadius: ObsidianTheme.radiusMd),
            ),
          ),
        ],
      ),
    );
  }
}
