import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/features/knowledge/models/knowledge_models.dart';
import 'package:iworkr_mobile/features/knowledge/services/knowledge_provider.dart';

// ============================================================================
// Article Viewer Screen — Full-screen SOP / Video Viewer
// ============================================================================
// Displays a knowledge article with video placeholder or HTML content.
// Tracks watch time and provides an acknowledge button for mandatory reads.
// ============================================================================

class ArticleViewerScreen extends ConsumerStatefulWidget {
  final KnowledgeArticle article;
  final String? jobId;

  const ArticleViewerScreen({
    super.key,
    required this.article,
    this.jobId,
  });

  /// Convenience constructor from a RecommendedSop.
  factory ArticleViewerScreen.fromSop({
    Key? key,
    required RecommendedSop sop,
    String? jobId,
  }) {
    return ArticleViewerScreen(
      key: key,
      article: sop.toArticle(),
      jobId: jobId,
    );
  }

  @override
  ConsumerState<ArticleViewerScreen> createState() =>
      _ArticleViewerScreenState();
}

class _ArticleViewerScreenState extends ConsumerState<ArticleViewerScreen> {
  Timer? _watchTimer;
  int _watchTimeSeconds = 0;
  double _completionPercentage = 0.0;
  bool _isAcknowledged = false;
  bool _isAcknowledging = false;
  bool _isVideoPlaying = false;

  // Simulated video state (placeholder until video_player is added)
  int _simulatedPlaybackSeconds = 0;

  @override
  void initState() {
    super.initState();
    _startWatchTimer();
  }

  @override
  void dispose() {
    _watchTimer?.cancel();
    super.dispose();
  }

  void _startWatchTimer() {
    _watchTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _watchTimeSeconds++;
        _updateCompletion();
      });
    });
  }

  void _updateCompletion() {
    final article = widget.article;
    if (article.hasVideo && article.videoDurationSeconds != null) {
      // For video: completion based on simulated playback
      _completionPercentage =
          (_simulatedPlaybackSeconds / article.videoDurationSeconds!)
              .clamp(0.0, 1.0);
    } else if (article.estimatedReadMinutes != null) {
      // For text: completion based on estimated read time
      final estimatedSeconds = article.estimatedReadMinutes! * 60;
      _completionPercentage =
          (_watchTimeSeconds / estimatedSeconds).clamp(0.0, 1.0);
    } else {
      // No estimate — assume complete after 30 seconds
      _completionPercentage = (_watchTimeSeconds / 30).clamp(0.0, 1.0);
    }
  }

  Future<void> _acknowledge() async {
    if (_isAcknowledging || _isAcknowledged) return;

    setState(() => _isAcknowledging = true);

    try {
      final service = ref.read(acknowledgeArticleProvider);
      await service.acknowledge(
        widget.article.id,
        jobId: widget.jobId,
        watchTimeSeconds: _watchTimeSeconds,
        completionPercentage: _completionPercentage,
      );

      if (mounted) {
        setState(() {
          _isAcknowledged = true;
          _isAcknowledging = false;
        });
        HapticFeedback.heavyImpact();

        // Show success feedback
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Article acknowledged ✓',
              style: GoogleFonts.inter(color: Colors.white),
            ),
            backgroundColor: ObsidianTheme.emerald,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isAcknowledging = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Failed to acknowledge: $e',
              style: GoogleFonts.inter(color: Colors.white),
            ),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }
  }

  void _simulateVideoToggle() {
    setState(() {
      _isVideoPlaying = !_isVideoPlaying;
    });

    if (_isVideoPlaying) {
      // Start simulated playback timer
      Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted || !_isVideoPlaying) {
          timer.cancel();
          return;
        }
        setState(() {
          _simulatedPlaybackSeconds++;
          _updateCompletion();
        });
        // Auto-stop at end of duration
        if (widget.article.videoDurationSeconds != null &&
            _simulatedPlaybackSeconds >= widget.article.videoDurationSeconds!) {
          timer.cancel();
          setState(() => _isVideoPlaying = false);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final article = widget.article;
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ─────────────────────────────────────
            _ViewerHeader(
              article: article,
              watchTimeSeconds: _watchTimeSeconds,
            ),

            // ── Content ────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(20, 16, 20, mq.padding.bottom + 100),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Video section
                    if (article.hasVideo)
                      _VideoPlaceholder(
                        videoUrl: article.videoHlsUrl!,
                        durationSeconds: article.videoDurationSeconds,
                        isPlaying: _isVideoPlaying,
                        playbackSeconds: _simulatedPlaybackSeconds,
                        onTogglePlay: _simulateVideoToggle,
                      ),

                    // Mandatory progress bar
                    if (article.isMandatoryRead) ...[
                      const SizedBox(height: 16),
                      _CompletionProgressBar(
                        percentage: _completionPercentage,
                        isAcknowledged: _isAcknowledged,
                      ),
                    ],

                    // HTML content
                    if (article.contentHtml != null &&
                        article.contentHtml!.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _HtmlContentSection(html: article.contentHtml!),
                    ],

                    // Description fallback (if no HTML content)
                    if ((article.contentHtml == null ||
                            article.contentHtml!.isEmpty) &&
                        article.description != null) ...[
                      const SizedBox(height: 20),
                      Text(
                        article.description!,
                        style: GoogleFonts.inter(
                          color: c.textSecondary,
                          fontSize: 14,
                          height: 1.6,
                        ),
                      ),
                    ],

                    // Metadata
                    const SizedBox(height: 24),
                    _MetadataSection(article: article),
                  ],
                ),
              ),
            ),

            // ── Bottom Acknowledge Bar ─────────────────────
            _AcknowledgeBar(
              article: article,
              isAcknowledged: _isAcknowledged,
              isAcknowledging: _isAcknowledging,
              completionPercentage: _completionPercentage,
              onAcknowledge: _acknowledge,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header ───────────────────────────────────────────────────────────────

class _ViewerHeader extends StatelessWidget {
  final KnowledgeArticle article;
  final int watchTimeSeconds;

  const _ViewerHeader({
    required this.article,
    required this.watchTimeSeconds,
  });

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: c.activeBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                PhosphorIconsLight.arrowLeft,
                color: c.textSecondary,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  article.category?.toUpperCase() ?? 'SOP',
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.emerald,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  article.title,
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
          const SizedBox(width: 10),

          // Watch time indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: c.activeBg,
              border: Border.all(color: c.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(PhosphorIconsLight.timer, size: 12, color: ObsidianTheme.emerald),
                const SizedBox(width: 4),
                Text(
                  _formatTime(watchTimeSeconds),
                  style: GoogleFonts.jetBrainsMono(
                    color: ObsidianTheme.emerald,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
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

// ── Video Placeholder ────────────────────────────────────────────────────
// Placeholder until the `video_player` package is added to pubspec.

class _VideoPlaceholder extends StatelessWidget {
  final String videoUrl;
  final int? durationSeconds;
  final bool isPlaying;
  final int playbackSeconds;
  final VoidCallback onTogglePlay;

  const _VideoPlaceholder({
    required this.videoUrl,
    this.durationSeconds,
    required this.isPlaying,
    required this.playbackSeconds,
    required this.onTogglePlay,
  });

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final progress = durationSeconds != null && durationSeconds! > 0
        ? (playbackSeconds / durationSeconds!).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: ObsidianTheme.surface2,
        border: Border.all(color: c.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Video area
          Container(
            height: 200,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  ObsidianTheme.emerald.withValues(alpha: 0.08),
                  ObsidianTheme.indigo.withValues(alpha: 0.05),
                  ObsidianTheme.surface2,
                ],
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Play/Pause button
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    onTogglePlay();
                  },
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ObsidianTheme.emerald.withValues(alpha: 0.15),
                      border: Border.all(
                        color: ObsidianTheme.emerald.withValues(alpha: 0.4),
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      isPlaying
                          ? PhosphorIconsFill.pause
                          : PhosphorIconsFill.play,
                      color: ObsidianTheme.emerald,
                      size: 28,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  isPlaying ? 'Playing...' : 'Tap to Play',
                  style: GoogleFonts.inter(
                    color: c.textTertiary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  videoUrl,
                  style: GoogleFonts.jetBrainsMono(
                    color: c.textTertiary,
                    fontSize: 9,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),

          // Progress bar + time
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
            child: Column(
              children: [
                // Progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 4,
                    backgroundColor: c.border,
                    valueColor: const AlwaysStoppedAnimation(ObsidianTheme.emerald),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatDuration(playbackSeconds),
                      style: GoogleFonts.jetBrainsMono(
                        color: c.textTertiary,
                        fontSize: 10,
                      ),
                    ),
                    if (durationSeconds != null)
                      Text(
                        _formatDuration(durationSeconds!),
                        style: GoogleFonts.jetBrainsMono(
                          color: c.textTertiary,
                          fontSize: 10,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms)
        .scale(begin: const Offset(0.98, 0.98), duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

// ── Completion Progress Bar ──────────────────────────────────────────────

class _CompletionProgressBar extends StatelessWidget {
  final double percentage;
  final bool isAcknowledged;
  const _CompletionProgressBar({
    required this.percentage,
    required this.isAcknowledged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isAcknowledged
            ? ObsidianTheme.emeraldDim
            : ObsidianTheme.amberDim,
        border: Border.all(
          color: isAcknowledged
              ? ObsidianTheme.emerald.withValues(alpha: 0.3)
              : ObsidianTheme.amber.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isAcknowledged
                ? PhosphorIconsFill.checkCircle
                : PhosphorIconsFill.shieldCheck,
            size: 16,
            color: isAcknowledged ? ObsidianTheme.emerald : ObsidianTheme.amber,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isAcknowledged
                      ? 'COMPLETED'
                      : 'MANDATORY READ — ${(percentage * 100).toInt()}%',
                  style: GoogleFonts.jetBrainsMono(
                    color: isAcknowledged
                        ? ObsidianTheme.emerald
                        : ObsidianTheme.amber,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: isAcknowledged ? 1.0 : percentage,
                    minHeight: 4,
                    backgroundColor: c.border,
                    valueColor: AlwaysStoppedAnimation(
                      isAcknowledged
                          ? ObsidianTheme.emerald
                          : ObsidianTheme.amber,
                    ),
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

// ── HTML Content Section ─────────────────────────────────────────────────
// Basic rendering of HTML content as styled text.
// For full HTML rendering, consider adding `flutter_html` or `flutter_widget_from_html`.

class _HtmlContentSection extends StatelessWidget {
  final String html;
  const _HtmlContentSection({required this.html});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    // Strip basic HTML tags for plain text display
    // TODO: Replace with flutter_html package for full HTML rendering
    final plainText = html
        .replaceAll(RegExp(r'<br\s*/?>'), '\n')
        .replaceAll(RegExp(r'<p[^>]*>'), '\n')
        .replaceAll(RegExp(r'</p>'), '\n')
        .replaceAll(RegExp(r'<h[1-6][^>]*>'), '\n\n')
        .replaceAll(RegExp(r'</h[1-6]>'), '\n')
        .replaceAll(RegExp(r'<li[^>]*>'), '\n  • ')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Text(
        plainText,
        style: GoogleFonts.inter(
          color: c.textSecondary,
          fontSize: 14,
          height: 1.7,
        ),
      ),
    );
  }
}

// ── Metadata Section ─────────────────────────────────────────────────────

class _MetadataSection extends StatelessWidget {
  final KnowledgeArticle article;
  const _MetadataSection({required this.article});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DETAILS',
            style: GoogleFonts.jetBrainsMono(
              color: c.textTertiary,
              fontSize: 9,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 10),

          if (article.authorName != null)
            _MetaRow(
              icon: PhosphorIconsLight.user,
              label: 'Author',
              value: article.authorName!,
            ),
          if (article.category != null)
            _MetaRow(
              icon: PhosphorIconsLight.folder,
              label: 'Category',
              value: article.category!,
            ),
          if (article.difficultyLevel != null)
            _MetaRow(
              icon: PhosphorIconsLight.gauge,
              label: 'Difficulty',
              value: article.difficultyLevel!,
            ),
          _MetaRow(
            icon: PhosphorIconsLight.eye,
            label: 'Views',
            value: '${article.viewCount}',
          ),

          if (article.tags != null && article.tags!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: article.tags!.map((tag) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: ObsidianTheme.emeraldDim,
                  ),
                  child: Text(
                    tag,
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.emerald,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _MetaRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 14, color: c.textTertiary),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
          ),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.inter(
              color: c.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Acknowledge Bottom Bar ───────────────────────────────────────────────

class _AcknowledgeBar extends StatelessWidget {
  final KnowledgeArticle article;
  final bool isAcknowledged;
  final bool isAcknowledging;
  final double completionPercentage;
  final VoidCallback onAcknowledge;

  const _AcknowledgeBar({
    required this.article,
    required this.isAcknowledged,
    required this.isAcknowledging,
    required this.completionPercentage,
    required this.onAcknowledge,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SafeArea(
        top: false,
        child: GestureDetector(
          onTap: isAcknowledging || isAcknowledged ? null : onAcknowledge,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: isAcknowledged
                  ? null
                  : LinearGradient(
                      colors: [
                        ObsidianTheme.emerald,
                        ObsidianTheme.emerald.withValues(alpha: 0.85),
                      ],
                    ),
              color: isAcknowledged ? ObsidianTheme.emeraldDim : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isAcknowledging)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                else
                  Icon(
                    isAcknowledged
                        ? PhosphorIconsFill.checkCircle
                        : PhosphorIconsBold.checkCircle,
                    size: 18,
                    color: isAcknowledged ? ObsidianTheme.emerald : Colors.white,
                  ),
                const SizedBox(width: 10),
                Text(
                  isAcknowledged
                      ? 'Acknowledged ✓'
                      : 'Acknowledge & Mark Understood',
                  style: GoogleFonts.inter(
                    color: isAcknowledged ? ObsidianTheme.emerald : Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
