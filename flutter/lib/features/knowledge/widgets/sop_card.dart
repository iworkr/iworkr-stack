import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/features/knowledge/models/knowledge_models.dart';

// ============================================================================
// SOP Card — Knowledge Base Card for Mission HUD
// ============================================================================
// A compact, beautiful card for displaying an SOP article/video.
// Used in the Mission HUD's recommended guides section and knowledge library.
// ============================================================================

class SopCard extends StatelessWidget {
  final RecommendedSop sop;
  final VoidCallback? onTap;
  final int animationDelay;

  const SopCard({
    super.key,
    required this.sop,
    this.onTap,
    this.animationDelay = 0,
  });

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m}m ${s.toString().padLeft(2, '0')}s';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: Container(
        width: 220,
        decoration: BoxDecoration(
          color: c.hoverBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: sop.isMandatoryRead
                ? ObsidianTheme.amber.withValues(alpha: 0.3)
                : c.border,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Thumbnail / Video Preview ──────────────────
            _ThumbnailSection(sop: sop),

            // ── Content ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    sop.title,
                    style: GoogleFonts.inter(
                      color: c.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),

                  if (sop.description != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      sop.description!,
                      style: GoogleFonts.inter(
                        color: c.textTertiary,
                        fontSize: 11,
                        height: 1.3,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],

                  const SizedBox(height: 10),

                  // ── Bottom row: badges ───────────────────
                  Row(
                    children: [
                      // Duration / read time badge
                      _DurationBadge(sop: sop, formatDuration: _formatDuration),

                      const SizedBox(width: 6),

                      // Match type indicator
                      _MatchTypeBadge(matchType: sop.matchType),

                      const Spacer(),

                      // Mandatory badge
                      if (sop.isMandatoryRead) const _MandatoryBadge(),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 60 * animationDelay),
          duration: 400.ms,
        )
        .moveX(
          begin: 16,
          delay: Duration(milliseconds: 60 * animationDelay),
          duration: 400.ms,
          curve: Curves.easeOutCubic,
        );
  }
}

// ── Thumbnail Section ────────────────────────────────────────────────────

class _ThumbnailSection extends StatelessWidget {
  final RecommendedSop sop;
  const _ThumbnailSection({required this.sop});

  @override
  Widget build(BuildContext context) {
    if (sop.thumbnailUrl != null && sop.thumbnailUrl!.isNotEmpty) {
      return Stack(
        children: [
          SizedBox(
            height: 110,
            width: double.infinity,
            child: Image.network(
              sop.thumbnailUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _GradientPlaceholder(hasVideo: sop.hasVideo),
            ),
          ),
          if (sop.hasVideo) const _PlayOverlay(),
        ],
      );
    }

    return _GradientPlaceholder(hasVideo: sop.hasVideo);
  }
}

class _GradientPlaceholder extends StatelessWidget {
  final bool hasVideo;
  const _GradientPlaceholder({required this.hasVideo});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 110,
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: hasVideo
              ? [
                  ObsidianTheme.emerald.withValues(alpha: 0.12),
                  ObsidianTheme.indigo.withValues(alpha: 0.08),
                ]
              : [
                  ObsidianTheme.surface2,
                  ObsidianTheme.surface1,
                ],
        ),
      ),
      child: Center(
        child: hasVideo
            ? Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald.withValues(alpha: 0.15),
                  border: Border.all(
                    color: ObsidianTheme.emerald.withValues(alpha: 0.3),
                  ),
                ),
                child: const Icon(
                  PhosphorIconsFill.play,
                  color: ObsidianTheme.emerald,
                  size: 20,
                ),
              )
            : Icon(
                PhosphorIconsLight.article,
                color: ObsidianTheme.textMuted,
                size: 28,
              ),
      ),
    );
  }
}

class _PlayOverlay extends StatelessWidget {
  const _PlayOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.3),
        child: Center(
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withValues(alpha: 0.6),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.3),
              ),
            ),
            child: const Icon(
              PhosphorIconsFill.play,
              color: Colors.white,
              size: 18,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Duration Badge ───────────────────────────────────────────────────────

class _DurationBadge extends StatelessWidget {
  final RecommendedSop sop;
  final String Function(int) formatDuration;
  const _DurationBadge({required this.sop, required this.formatDuration});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final hasVideo = sop.hasVideo && sop.videoDurationSeconds != null;
    final label = hasVideo
        ? formatDuration(sop.videoDurationSeconds!)
        : sop.estimatedReadMinutes != null
            ? '${sop.estimatedReadMinutes} min read'
            : 'Article';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: c.activeBg,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hasVideo ? PhosphorIconsLight.play : PhosphorIconsLight.clock,
            size: 10,
            color: c.textTertiary,
          ),
          const SizedBox(width: 3),
          Text(
            label,
            style: GoogleFonts.jetBrainsMono(
              color: c.textTertiary,
              fontSize: 9,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Match Type Badge ─────────────────────────────────────────────────────

class _MatchTypeBadge extends StatelessWidget {
  final String matchType;
  const _MatchTypeBadge({required this.matchType});

  @override
  Widget build(BuildContext context) {
    final isSemantic = matchType == 'semantic';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: isSemantic
            ? ObsidianTheme.indigoDim
            : ObsidianTheme.emeraldDim,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isSemantic
                ? PhosphorIconsLight.sparkle
                : PhosphorIconsLight.tag,
            size: 10,
            color: isSemantic ? ObsidianTheme.indigo : ObsidianTheme.emerald,
          ),
          const SizedBox(width: 3),
          Text(
            isSemantic ? 'AI' : 'TAG',
            style: GoogleFonts.jetBrainsMono(
              color: isSemantic ? ObsidianTheme.indigo : ObsidianTheme.emerald,
              fontSize: 8,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Mandatory Badge ──────────────────────────────────────────────────────

class _MandatoryBadge extends StatelessWidget {
  const _MandatoryBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: ObsidianTheme.amberDim,
      ),
      child: const Icon(
        PhosphorIconsFill.shieldCheck,
        size: 12,
        color: ObsidianTheme.amber,
      ),
    );
  }
}
