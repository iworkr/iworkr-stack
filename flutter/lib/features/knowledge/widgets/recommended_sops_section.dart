import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/features/knowledge/models/knowledge_models.dart';
import 'package:iworkr_mobile/features/knowledge/screens/article_viewer_screen.dart';
import 'package:iworkr_mobile/features/knowledge/services/knowledge_provider.dart';
import 'package:iworkr_mobile/features/knowledge/widgets/sop_card.dart';

// ============================================================================
// Recommended SOPs Section — Mission HUD Component
// ============================================================================
// Horizontal scrolling section that displays contextually-recommended SOPs
// for the current job. Shows mandatory read warnings when applicable.
// ============================================================================

class RecommendedSopsSection extends ConsumerWidget {
  final String jobId;

  const RecommendedSopsSection({
    super.key,
    required this.jobId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sopsAsync = ref.watch(jobRecommendedSopsProvider(jobId));
    final c = context.iColors;

    return sopsAsync.when(
      loading: () => _ShimmerPlaceholder(),
      error: (_, __) => const SizedBox.shrink(),
      data: (sops) {
        if (sops.isEmpty) return const SizedBox.shrink();

        final hasMandatoryUnread =
            sops.any((s) => s.isMandatoryRead);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Mandatory Warning Banner ────────────────────
            if (hasMandatoryUnread)
              _MandatoryWarningBanner()
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .moveY(begin: -6, duration: 400.ms, curve: Curves.easeOutCubic),

            // ── Section Header ──────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: ObsidianTheme.emeraldDim,
                    ),
                    child: const Icon(
                      PhosphorIconsLight.book,
                      size: 14,
                      color: ObsidianTheme.emerald,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Recommended Guides for this Job',
                        style: GoogleFonts.inter(
                          color: ObsidianTheme.emerald,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '${sops.length} ${sops.length == 1 ? 'guide' : 'guides'} matched',
                        style: GoogleFonts.jetBrainsMono(
                          color: c.textTertiary,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: ObsidianTheme.emeraldDim,
                    ),
                    child: Text(
                      '${sops.length}',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.emerald,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms)
                .moveY(begin: -6, duration: 400.ms, curve: Curves.easeOutCubic),

            // ── Horizontal Card List ────────────────────────
            SizedBox(
              height: 210,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: sops.length,
                itemBuilder: (context, index) {
                  final sop = sops[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      right: index < sops.length - 1 ? 12 : 0,
                    ),
                    child: SopCard(
                      sop: sop,
                      animationDelay: index,
                      onTap: () => _openArticleViewer(context, sop),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  void _openArticleViewer(BuildContext context, RecommendedSop sop) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ArticleViewerScreen.fromSop(
          sop: sop,
          jobId: jobId,
        ),
      ),
    );
  }
}

// ── Mandatory Warning Banner ─────────────────────────────────────────────

class _MandatoryWarningBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: ObsidianTheme.amberDim,
        border: Border.all(
          color: ObsidianTheme.amber.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            PhosphorIconsFill.warning,
            size: 16,
            color: ObsidianTheme.amber,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'MANDATORY GUIDES PENDING',
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.amber,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Review and acknowledge required SOPs before starting this job.',
                  style: GoogleFonts.inter(
                    color: c.textSecondary,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shimmer Loading Placeholder ──────────────────────────────────────────

class _ShimmerPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header shimmer
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: ObsidianTheme.shimmerBase,
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 180,
                height: 14,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: ObsidianTheme.shimmerBase,
                ),
              ),
            ],
          ),
        ),

        // Cards shimmer
        SizedBox(
          height: 210,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: 3,
            itemBuilder: (context, index) {
              return Padding(
                padding: EdgeInsets.only(right: index < 2 ? 12 : 0),
                child: Container(
                  width: 220,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: ObsidianTheme.shimmerBase,
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Thumbnail shimmer
                      Container(
                        height: 110,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(16),
                          ),
                          color: ObsidianTheme.shimmerHighlight,
                        ),
                      ),
                      // Content shimmer
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 160,
                              height: 12,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: ObsidianTheme.shimmerHighlight,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              width: 100,
                              height: 10,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: ObsidianTheme.shimmerHighlight,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Container(
                                  width: 50,
                                  height: 18,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(6),
                                    color: ObsidianTheme.shimmerHighlight,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  width: 32,
                                  height: 18,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(6),
                                    color: ObsidianTheme.shimmerHighlight,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              )
                  .animate(
                    onPlay: (c) => c.repeat(reverse: true),
                  )
                  .shimmer(
                    delay: Duration(milliseconds: 200 * index),
                    duration: 1200.ms,
                    color: ObsidianTheme.shimmerHighlight.withValues(alpha: 0.3),
                  );
            },
          ),
        ),
      ],
    );
  }
}
