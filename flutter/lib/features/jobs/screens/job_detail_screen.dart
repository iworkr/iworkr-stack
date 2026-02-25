import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/core/widgets/status_pip.dart';
import 'package:iworkr_mobile/models/job.dart';
import 'package:iworkr_mobile/core/services/map_launcher_service.dart';
import 'package:iworkr_mobile/core/widgets/obsidian_map.dart';
import 'package:iworkr_mobile/features/quotes/screens/quote_create_screen.dart';
import 'package:iworkr_mobile/features/safety/screens/safety_shield_screen.dart';
import 'package:iworkr_mobile/features/ai/screens/ai_cortex_screen.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

/// Job detail — "The Dossier" Bento Grid layout.
///
/// Web spec:
/// - Slide-in from right (spring x: 100% -> 0%)
/// - Properties in GlassCard bento grid
/// - Tasks with strikethrough animation
/// - Activity as chat stream
class JobDetailScreen extends ConsumerWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final jobAsync = ref.watch(jobDetailProvider(jobId));
    final subtasksAsync = ref.watch(jobSubtasksProvider(jobId));
    final activityAsync = ref.watch(jobActivityProvider(jobId));

    return Scaffold(
      body: jobAsync.when(
        data: (job) {
          if (job == null) {
            return Center(
              child: Text('Job not found', style: TextStyle(color: c.textTertiary)),
            );
          }
          return _JobDetailBody(job: job, subtasksAsync: subtasksAsync, activityAsync: activityAsync);
        },
        loading: () => const SafeArea(child: PageSkeleton()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: ObsidianTheme.rose))),
      ),
    );
  }
}

class _JobDetailBody extends StatelessWidget {
  final Job job;
  final AsyncValue<List<Map<String, dynamic>>> subtasksAsync;
  final AsyncValue<List<Map<String, dynamic>>> activityAsync;

  const _JobDetailBody({
    required this.job,
    required this.subtasksAsync,
    required this.activityAsync,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: c.canvas,
          leading: IconButton(
            icon: const Icon(PhosphorIconsLight.arrowLeft, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Text(
            job.displayId,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 13,
              color: c.textTertiary,
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(PhosphorIconsLight.dotsThree, size: 20),
              onPressed: () => HapticFeedback.lightImpact(),
            ),
          ],
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title
                Text(
                  job.title,
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                    letterSpacing: -0.5,
                  ),
                )
                    .animate()
                    .fadeIn(duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

                if (job.description != null && job.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    job.description!,
                    style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary, height: 1.6),
                  )
                      .animate()
                      .fadeIn(delay: 80.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
                ],

                const SizedBox(height: 20),

                // Properties Bento Grid — web: GlassCard bento layout
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _PropertyCard(
                      label: 'STATUS',
                      index: 0,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          StatusPip.fromJobStatus(job.status),
                          const SizedBox(width: 8),
                          Text(job.status.label, style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                    _PropertyCard(
                      label: 'PRIORITY',
                      index: 1,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          PriorityIcon(priority: job.priority, size: 14),
                          const SizedBox(width: 8),
                          Text(
                            job.priority.name.toUpperCase(),
                            style: GoogleFonts.jetBrainsMono(fontSize: 11, color: c.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    if (job.clientName != null)
                      _PropertyCard(
                        label: 'CLIENT',
                        index: 2,
                        child: Text(job.clientName!, style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500)),
                      ),
                    if (job.assigneeName != null)
                      _PropertyCard(
                        label: 'ASSIGNEE',
                        index: 3,
                        child: Text(job.assigneeName!, style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500)),
                      ),
                    if (job.dueDate != null)
                      _PropertyCard(
                        label: 'DUE',
                        index: 4,
                        child: Text(
                          timeago.format(job.dueDate!),
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 11,
                            color: job.dueDate!.isBefore(DateTime.now()) ? ObsidianTheme.rose : c.textSecondary,
                          ),
                        ),
                      ),
                    if (job.location != null)
                      _PropertyCard(
                        label: 'LOCATION',
                        index: 5,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(PhosphorIconsLight.mapPin, size: 12, color: c.textTertiary),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                job.location!,
                                style: GoogleFonts.inter(fontSize: 12, color: c.textSecondary),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 20),

                // Execute Job Button
                GestureDetector(
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    context.push('/jobs/${job.id}/execute');
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      gradient: LinearGradient(
                        colors: [
                          ObsidianTheme.emerald.withValues(alpha: 0.1),
                          ObsidianTheme.emerald.withValues(alpha: 0.05),
                        ],
                      ),
                      border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(PhosphorIconsLight.play, size: 18, color: ObsidianTheme.emerald),
                        const SizedBox(width: 10),
                        Text(
                          'EXECUTE JOB',
                          style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.emerald,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(delay: 250.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                    .moveY(begin: 6, delay: 250.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

                // Inline map preview
                if (job.locationLat != null && job.locationLng != null) ...[
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: ObsidianTheme.radiusMd,
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: c.border),
                      ),
                      child: ObsidianInlineMap(
                        lat: job.locationLat!,
                        lng: job.locationLng!,
                        zoom: 15,
                        height: 140,
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(delay: 260.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
                ],

                // Navigate Button — launches native maps
                if (job.locationLat != null && job.locationLng != null) ...[
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: () async {
                      HapticFeedback.mediumImpact();
                      final ok = await MapLauncherService.navigate(
                        lat: job.locationLat!,
                        lng: job.locationLng!,
                        label: job.title,
                      );
                      if (context.mounted) {
                        MapLauncherService.showLaunchFeedback(context, success: ok);
                      }
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: ObsidianTheme.blue.withValues(alpha: 0.06),
                        border: Border.all(color: ObsidianTheme.blue.withValues(alpha: 0.15)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(PhosphorIconsLight.navigationArrow, size: 16, color: ObsidianTheme.blue),
                          const SizedBox(width: 8),
                          Text(
                            'NAVIGATE',
                            style: GoogleFonts.jetBrainsMono(
                              color: ObsidianTheme.blue,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: ObsidianTheme.blue.withValues(alpha: 0.1),
                            ),
                            child: Text(
                              'NATIVE',
                              style: GoogleFonts.jetBrainsMono(
                                color: ObsidianTheme.blue.withValues(alpha: 0.6),
                                fontSize: 8,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(delay: 280.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                      .moveY(begin: 6, delay: 280.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
                ],

                const SizedBox(height: 28),

                // Tasks section
                _SectionLabel(label: 'TASKS', delayMs: 300),
                const SizedBox(height: 10),

                subtasksAsync.when(
                  data: (tasks) {
                    if (tasks.isEmpty) {
                      return _EmptySection(text: 'No tasks yet');
                    }
                    return Column(
                      children: List.generate(tasks.length, (i) {
                        final task = tasks[i];
                        final done = task['completed'] as bool? ?? false;
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border(bottom: BorderSide(color: c.border)),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                done ? PhosphorIconsFill.checkSquare : PhosphorIconsRegular.square,
                                size: 16,
                                color: done ? ObsidianTheme.emerald : c.textTertiary,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  task['title'] as String? ?? '',
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    color: done ? c.textTertiary : c.textPrimary,
                                    decoration: done ? TextDecoration.lineThrough : null,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                            .animate()
                            .fadeIn(delay: Duration(milliseconds: 350 + i * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                            .moveX(begin: -8, end: 0, delay: Duration(milliseconds: 350 + i * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
                      }),
                    );
                  },
                  loading: () => Column(
                    children: List.generate(3, (_) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: ShimmerLoading(height: 40, borderRadius: ObsidianTheme.radiusSm),
                    )),
                  ),
                  error: (_, __) => const SizedBox.shrink(),
                ),

                const SizedBox(height: 28),

                // Safety & Intelligence
                _SectionLabel(label: 'FIELD INTELLIGENCE', delayMs: 330),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () async {
                          HapticFeedback.mediumImpact();
                          await showSafetyShield(context, jobId: job.id);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.3)),
                            color: ObsidianTheme.amber.withValues(alpha: 0.06),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(PhosphorIconsLight.shieldWarning, size: 15, color: ObsidianTheme.amber),
                              const SizedBox(width: 6),
                              Text('Safety Shield', style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.amber, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          showAiCortex(context, jobId: job.id);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.3)),
                            color: const Color(0xFF6366F1).withValues(alpha: 0.06),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(PhosphorIconsLight.brain, size: 15, color: const Color(0xFF6366F1)),
                              const SizedBox(width: 6),
                              Text('AI Cortex', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF6366F1), fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                )
                    .animate()
                    .fadeIn(delay: 340.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

                const SizedBox(height: 28),

                // Commerce Actions
                _SectionLabel(label: 'COMMERCE', delayMs: 350),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => showQuoteCreator(
                          context,
                          jobId: job.id,
                          clientId: job.clientId,
                          clientName: job.clientName,
                          jobTitle: job.title,
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            border: Border.all(color: c.borderMedium),
                            color: c.hoverBg,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(PhosphorIconsLight.fileText, size: 14, color: c.textSecondary),
                              const SizedBox(width: 6),
                              Text('Create Quote', style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => HapticFeedback.lightImpact(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            border: Border.all(color: c.borderMedium),
                            color: c.hoverBg,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(PhosphorIconsLight.receipt, size: 14, color: c.textSecondary),
                              const SizedBox(width: 6),
                              Text('Invoice', style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                )
                    .animate()
                    .fadeIn(delay: 370.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

                const SizedBox(height: 28),

                // Activity Feed
                _SectionLabel(label: 'ACTIVITY', delayMs: 400),
                const SizedBox(height: 10),

                activityAsync.when(
                  data: (activities) {
                    if (activities.isEmpty) {
                      return _EmptySection(text: 'No activity yet');
                    }
                    return Column(
                      children: List.generate(activities.length, (i) {
                        final a = activities[i];
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                margin: const EdgeInsets.only(top: 6),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: c.textTertiary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      a['text'] as String? ?? '',
                                      style: GoogleFonts.inter(fontSize: 12, color: c.textSecondary),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      a['created_at'] != null ? timeago.format(DateTime.parse(a['created_at'] as String)) : '',
                                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        )
                            .animate()
                            .fadeIn(delay: Duration(milliseconds: 450 + i * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
                      }),
                    );
                  },
                  loading: () => Column(
                    children: List.generate(3, (_) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ShimmerLoading(height: 32, borderRadius: ObsidianTheme.radiusSm),
                    )),
                  ),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PropertyCard extends StatelessWidget {
  final String label;
  final Widget child;
  final int index;
  const _PropertyCard({required this.label, required this.child, required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      borderRadius: ObsidianTheme.radiusLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 9, color: c.textTertiary, letterSpacing: 1)),
          const SizedBox(height: 6),
          child,
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 150 + index * 40), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 150 + index * 40), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  final int delayMs;
  const _SectionLabel({required this.label, required this.delayMs});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Text(
      label,
      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5),
    ).animate().fadeIn(delay: Duration(milliseconds: delayMs), duration: 300.ms);
  }
}

class _EmptySection extends StatelessWidget {
  final String text;
  const _EmptySection({required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(color: c.border),
        color: c.surface,
      ),
      child: Center(
        child: Text(text, style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
      ),
    );
  }
}
