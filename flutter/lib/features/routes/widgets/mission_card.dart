import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/map_launcher_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/route_run.dart';

/// Floating glass route stop card — shows next stop info + Navigate CTA.
class RouteStopCard extends StatelessWidget {
  final RouteStop stop;
  final int stopNumber;
  final int totalStops;
  final String? distanceLabel;
  final String? driveTimeLabel;
  final VoidCallback? onViewJob;

  const RouteStopCard({
    super.key,
    required this.stop,
    required this.stopNumber,
    required this.totalStops,
    this.distanceLabel,
    this.driveTimeLabel,
    this.onViewJob,
  });

  @override
  Widget build(BuildContext context) {
    final hasCoords = stop.lat != null && stop.lng != null;
    final c = context.iColors;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            color: c.surface.withValues(alpha: 0.85),
            border: Border.all(color: c.borderMedium),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 24,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: stop indicator + title
              Row(
                children: [
                  // Stop number badge
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ObsidianTheme.emerald.withValues(alpha: 0.15),
                      border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.4)),
                    ),
                    child: Center(
                      child: Text(
                        '$stopNumber',
                        style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.emerald,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'NEXT STOP',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.emerald,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          stop.title,
                          style: GoogleFonts.inter(
                            color: c.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // Stop counter
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: c.border,
                    ),
                    child: Text(
                      '$stopNumber / $totalStops',
                      style: GoogleFonts.jetBrainsMono(
                        color: c.textTertiary,
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // Address + distance row
              Row(
                children: [
                  if (stop.address != null) ...[
                    Icon(PhosphorIconsLight.mapPin, size: 12, color: c.textTertiary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        stop.address!,
                        style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ] else
                    const Spacer(),
                  if (distanceLabel != null || driveTimeLabel != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(6),
                        color: ObsidianTheme.blue.withValues(alpha: 0.08),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(PhosphorIconsLight.car, size: 11, color: ObsidianTheme.blue),
                          const SizedBox(width: 4),
                          Text(
                            driveTimeLabel ?? distanceLabel ?? '',
                            style: GoogleFonts.jetBrainsMono(
                              color: ObsidianTheme.blue,
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),

              if (stop.clientName != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(PhosphorIconsLight.buildings, size: 12, color: c.textTertiary),
                    const SizedBox(width: 4),
                    Text(
                      stop.clientName!,
                      style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 16),

              // Action buttons
              Row(
                children: [
                  // View Job button
                  if (onViewJob != null)
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          onViewJob!();
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            color: c.border,
                            border: Border.all(color: c.borderMedium),
                          ),
                          child: Center(
                            child: Text(
                              'View Job',
                              style: GoogleFonts.inter(
                                color: Colors.white70,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (onViewJob != null) const SizedBox(width: 10),

                  // Navigate (Native) button
                  Expanded(
                    flex: onViewJob != null ? 2 : 1,
                    child: GestureDetector(
                      onTap: hasCoords
                          ? () async {
                              HapticFeedback.mediumImpact();
                              final ok = await MapLauncherService.navigate(
                                lat: stop.lat!,
                                lng: stop.lng!,
                                label: stop.title,
                              );
                              if (context.mounted) {
                                MapLauncherService.showLaunchFeedback(context, success: ok);
                              }
                            }
                          : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          gradient: hasCoords
                              ? LinearGradient(
                                  colors: [
                                    ObsidianTheme.emerald,
                                    ObsidianTheme.emerald.withValues(alpha: 0.85),
                                  ],
                                )
                              : null,
                          color: hasCoords ? null : c.surfaceSecondary,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              PhosphorIconsBold.navigationArrow,
                              size: 14,
                              color: hasCoords ? Colors.white : c.textTertiary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              hasCoords ? 'Navigate' : 'No Coordinates',
                              style: GoogleFonts.inter(
                                color: hasCoords ? Colors.white : c.textTertiary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 350.ms)
        .moveY(begin: 16, duration: 350.ms, curve: Curves.easeOutCubic);
  }
}
