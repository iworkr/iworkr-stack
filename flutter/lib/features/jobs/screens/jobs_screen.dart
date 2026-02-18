import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/core/widgets/status_pip.dart';
import 'package:iworkr_mobile/features/jobs/screens/create_job_sheet.dart';
import 'package:iworkr_mobile/models/job.dart';

/// The current filter state for jobs
final jobFilterProvider = StateProvider<JobStatus?>((ref) => null);

/// Jobs screen — "The Command List"
///
/// Web spec (jobs list):
/// - Table header: bg-[#0A0A0A] with border-b border-white/5
/// - Row hover: bg-white/[0.02]
/// - Row height: compact (40px)
/// - Stagger: 20ms per row
class JobsScreen extends ConsumerWidget {
  const JobsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(jobsProvider);
    final filter = ref.watch(jobFilterProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header — matches web control bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Text(
                    'Jobs',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  // Ghost "New" button — web spec: bg-white/[0.02], border-white/[0.08]
                  GestureDetector(
                    onTap: () {
                      showCreateJobSheet(context);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.borderMedium),
                        color: ObsidianTheme.hoverBg,
                      ),
                      child: Row(
                        children: [
                          const Icon(PhosphorIconsLight.plus, size: 14, color: ObsidianTheme.textSecondary),
                          const SizedBox(width: 6),
                          Text(
                            'New',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: ObsidianTheme.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
            ),

            const SizedBox(height: 14),

            // Filter pills — web spec: segmented control / minimal text buttons
            SizedBox(
              height: 32,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _FilterPill(label: 'All', isActive: filter == null, onTap: () => ref.read(jobFilterProvider.notifier).state = null),
                  _FilterPill(label: 'Active', isActive: filter == JobStatus.inProgress, onTap: () => ref.read(jobFilterProvider.notifier).state = JobStatus.inProgress),
                  _FilterPill(label: 'Scheduled', isActive: filter == JobStatus.scheduled, onTap: () => ref.read(jobFilterProvider.notifier).state = JobStatus.scheduled),
                  _FilterPill(label: 'To Do', isActive: filter == JobStatus.todo, onTap: () => ref.read(jobFilterProvider.notifier).state = JobStatus.todo),
                  _FilterPill(label: 'Done', isActive: filter == JobStatus.done, onTap: () => ref.read(jobFilterProvider.notifier).state = JobStatus.done),
                  _FilterPill(label: 'Invoiced', isActive: filter == JobStatus.invoiced, onTap: () => ref.read(jobFilterProvider.notifier).state = JobStatus.invoiced),
                  _FilterPill(label: 'Draft', isActive: filter == JobStatus.backlog, onTap: () => ref.read(jobFilterProvider.notifier).state = JobStatus.backlog),
                ],
              ),
            ).animate().fadeIn(delay: 80.ms, duration: 300.ms),

            const SizedBox(height: 8),

            // Table header — web spec: bg-[#0A0A0A], border-b border-white/5, text-xs Zinc-500
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: ObsidianTheme.surface1,
                border: const Border(bottom: BorderSide(color: ObsidianTheme.border)),
              ),
              child: Row(
                children: [
                  SizedBox(width: 24, child: Text('', style: _headerStyle)),
                  const SizedBox(width: 8),
                  SizedBox(width: 60, child: Text('ID', style: _headerStyle)),
                  const SizedBox(width: 8),
                  SizedBox(width: 20, child: Text('S', style: _headerStyle)),
                  const SizedBox(width: 10),
                  Expanded(child: Text('TITLE', style: _headerStyle)),
                  SizedBox(width: 80, child: Text('CLIENT', style: _headerStyle)),
                ],
              ),
            ).animate().fadeIn(delay: 120.ms, duration: 200.ms),

            // Job list
            Expanded(
              child: jobsAsync.when(
                data: (jobs) {
                  final filtered = filter == null ? jobs : jobs.where((j) => j.status == filter).toList();

                  if (filtered.isEmpty) {
                    return const AnimatedEmptyState(
                      type: EmptyStateType.briefcase,
                      title: 'No jobs found',
                      subtitle: 'Enjoy the silence.',
                    );
                  }

                  return RefreshIndicator(
                    color: ObsidianTheme.emerald,
                    backgroundColor: ObsidianTheme.surface1,
                    onRefresh: () async {
                      HapticFeedback.mediumImpact();
                      ref.invalidate(jobsProvider);
                    },
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 120),
                      itemCount: filtered.length,
                      itemBuilder: (context, i) => _JobRow(job: filtered[i], index: i),
                    ),
                  );
                },
                loading: () => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: List.generate(
                      10,
                      (_) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: ShimmerLoading(height: 40, borderRadius: ObsidianTheme.radiusSm),
                      ),
                    ),
                  ),
                ),
                error: (e, _) => Center(
                  child: Text('Error: $e', style: const TextStyle(color: ObsidianTheme.rose)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static final _headerStyle = GoogleFonts.jetBrainsMono(
    fontSize: 9,
    color: ObsidianTheme.textTertiary,
    letterSpacing: 1.5,
  );
}

/// Job row — web spec: h-10, border-b border-white/5, hover bg-white/[0.02]
class _JobRow extends StatelessWidget {
  final Job job;
  final int index;
  const _JobRow({required this.job, required this.index});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/jobs/${job.id}');
      },
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ObsidianTheme.border)),
        ),
        child: Row(
          children: [
            SizedBox(width: 24, child: PriorityIcon(priority: job.priority)),
            const SizedBox(width: 8),
            SizedBox(
              width: 60,
              child: Text(
                job.displayId,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: ObsidianTheme.textTertiary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(width: 20, child: Center(child: StatusPip.fromJobStatus(job.status))),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                job.title,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: ObsidianTheme.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            SizedBox(
              width: 80,
              child: Text(
                job.clientName ?? '',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: ObsidianTheme.textTertiary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 160 + index * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 160 + index * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

/// Filter pill — web spec: segmented control in bg-zinc-900 rounded-lg
class _FilterPill extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  const _FilterPill({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: isActive ? ObsidianTheme.shimmerBase : Colors.transparent,
          border: Border.all(
            color: isActive ? ObsidianTheme.borderMedium : ObsidianTheme.border,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            color: isActive ? ObsidianTheme.textPrimary : ObsidianTheme.textTertiary,
            fontWeight: isActive ? FontWeight.w500 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
