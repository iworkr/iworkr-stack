import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/map_launcher_service.dart';
import 'package:iworkr_mobile/core/services/route_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/route_run.dart';

/// Route Run detail screen — shows the full optimized route.
class RouteScreen extends ConsumerWidget {
  const RouteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routeAsync = ref.watch(todayRouteProvider);
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: routeAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: ObsidianTheme.blue, strokeWidth: 2),
          ),
          error: (e, _) => Center(
            child: Text('Error loading route', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary)),
          ),
          data: (route) {
            if (route == null) {
              return _EmptyRoute(ref: ref);
            }
            return _RouteBody(route: route, mq: mq);
          },
        ),
      ),
    );
  }
}

class _EmptyRoute extends StatelessWidget {
  final WidgetRef ref;
  const _EmptyRoute({required this.ref});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _RouteHeader(),
        Expanded(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.blue.withValues(alpha: 0.08),
                    border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.15)),
                  ),
                  child: Icon(PhosphorIconsLight.path, color: ObsidianTheme.blue, size: 28),
                )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .scaleXY(begin: 1.0, end: 1.06, duration: 2500.ms),
                const SizedBox(height: 20),
                Text(
                  'No route optimized yet',
                  style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 15, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tap optimize to plan your day',
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 13),
                ),
                const SizedBox(height: 24),
                GestureDetector(
                  onTap: () async {
                    HapticFeedback.mediumImpact();
                    await generateOptimizedRoute();
                    ref.invalidate(todayRouteProvider);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: ObsidianTheme.blue.withValues(alpha: 0.12),
                      border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.sparkle, color: ObsidianTheme.blue, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'Optimize Route',
                          style: GoogleFonts.inter(color: ObsidianTheme.blue, fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _RouteBody extends StatelessWidget {
  final RouteRun route;
  final MediaQueryData mq;

  const _RouteBody({required this.route, required this.mq});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _RouteHeader(),
        // Stats bar
        _StatsBar(route: route),
        // Job sequence list
        Expanded(
          child: ListView.builder(
            padding: EdgeInsets.fromLTRB(20, 8, 20, mq.padding.bottom + 20),
            itemCount: route.jobSequence.length,
            itemBuilder: (context, index) {
              final stop = route.jobSequence[index];
              return _StopCard(
                stop: stop,
                index: index,
                isLast: index == route.jobSequence.length - 1,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _RouteHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(PhosphorIconsLight.arrowLeft, color: Colors.white70, size: 20),
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'THE NAVIGATOR',
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'Optimized Route',
                style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
              ),
            ],
          ),
          const Spacer(),
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              context.push('/flight-path');
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(PhosphorIconsLight.mapTrifold, color: ObsidianTheme.emerald, size: 12),
                  const SizedBox(width: 4),
                  Text(
                    'MAP',
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.emerald,
                      fontSize: 10,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: ObsidianTheme.blue.withValues(alpha: 0.1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.sparkle, color: ObsidianTheme.blue, size: 12),
                const SizedBox(width: 4),
                Text(
                  'AI',
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.blue,
                    fontSize: 10,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

class _StatsBar extends StatelessWidget {
  final RouteRun route;
  const _StatsBar({required this.route});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(
          colors: [
            ObsidianTheme.blue.withValues(alpha: 0.06),
            const Color(0xFF8B5CF6).withValues(alpha: 0.04),
          ],
        ),
        border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _StatItem(label: 'STOPS', value: '${route.jobSequence.length}', color: ObsidianTheme.blue),
          _Divider(),
          _StatItem(label: 'DISTANCE', value: route.distanceLabel, color: ObsidianTheme.blue),
          _Divider(),
          _StatItem(label: 'DRIVE', value: route.driveTimeLabel, color: ObsidianTheme.blue),
          _Divider(),
          _StatItem(label: 'FINISH', value: route.finishTimeLabel, color: ObsidianTheme.emerald),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 400.ms)
        .moveY(begin: 6, delay: 200.ms, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatItem({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: GoogleFonts.jetBrainsMono(
            color: color,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: GoogleFonts.jetBrainsMono(
            color: ObsidianTheme.textTertiary,
            fontSize: 8,
            letterSpacing: 1.5,
          ),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 28, color: Colors.white.withValues(alpha: 0.06));
  }
}

class _StopCard extends StatelessWidget {
  final RouteStop stop;
  final int index;
  final bool isLast;

  const _StopCard({required this.stop, required this.index, required this.isLast});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Timeline column
        SizedBox(
          width: 32,
          child: Column(
            children: [
              // Numbered circle
              Container(
                width: 28, height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: stop.isCompleted
                      ? ObsidianTheme.emerald.withValues(alpha: 0.15)
                      : ObsidianTheme.blue.withValues(alpha: 0.12),
                  border: Border.all(
                    color: stop.isCompleted
                        ? ObsidianTheme.emerald.withValues(alpha: 0.4)
                        : ObsidianTheme.blue.withValues(alpha: 0.3),
                  ),
                ),
                child: Center(
                  child: stop.isCompleted
                      ? Icon(PhosphorIconsBold.check, size: 12, color: ObsidianTheme.emerald)
                      : Text(
                          '${index + 1}',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.blue,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
              // Connecting line
              if (!isLast)
                Container(
                  width: 1.5,
                  height: 40,
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        ObsidianTheme.blue.withValues(alpha: 0.2),
                        ObsidianTheme.blue.withValues(alpha: 0.05),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),

        const SizedBox(width: 12),

        // Stop details
        Expanded(
          child: GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/jobs/${stop.jobId}');
            },
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: Colors.white.withValues(alpha: 0.03),
                border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stop.title,
                    style: GoogleFonts.inter(
                      color: stop.isCompleted ? ObsidianTheme.textTertiary : Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      decoration: stop.isCompleted ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (stop.clientName != null) ...[
                        Text(
                          stop.clientName!,
                          style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
                        ),
                      ],
                      if (stop.estimatedMinutes != null) ...[
                        if (stop.clientName != null) _Dot(),
                        Icon(PhosphorIconsLight.timer, size: 10, color: ObsidianTheme.textTertiary),
                        const SizedBox(width: 3),
                        Text(
                          '~${stop.estimatedMinutes}m',
                          style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textTertiary, fontSize: 10),
                        ),
                      ],
                    ],
                  ),
                  if (stop.address != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(PhosphorIconsLight.mapPin, size: 10, color: ObsidianTheme.textTertiary),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            stop.address!,
                            style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                  // Navigate button for stops with coordinates
                  if (stop.lat != null && stop.lng != null && !stop.isCompleted) ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () async {
                        HapticFeedback.mediumImpact();
                        final ok = await MapLauncherService.navigate(
                          lat: stop.lat!,
                          lng: stop.lng!,
                          label: stop.title,
                        );
                        if (context.mounted) {
                          MapLauncherService.showLaunchFeedback(context, success: ok);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(6),
                          color: ObsidianTheme.emerald.withValues(alpha: 0.08),
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(PhosphorIconsBold.navigationArrow, size: 10, color: ObsidianTheme.emerald),
                            const SizedBox(width: 4),
                            Text(
                              'Navigate',
                              style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 10, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 100 + index * 80),
          duration: 400.ms,
        )
        .moveX(
          begin: 12,
          delay: Duration(milliseconds: 100 + index * 80),
          duration: 400.ms,
          curve: Curves.easeOutCubic,
        );
  }
}

class _Dot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Container(
        width: 3, height: 3,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: ObsidianTheme.textTertiary.withValues(alpha: 0.5),
        ),
      ),
    );
  }
}
