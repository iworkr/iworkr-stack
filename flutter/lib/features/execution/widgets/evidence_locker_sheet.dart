import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/job_execution_provider.dart';
import 'package:iworkr_mobile/core/services/telemetry_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/job_media.dart';
import 'package:iworkr_mobile/models/telemetry_event.dart';

/// Evidence Locker — shows captured photos and allows rapid-fire capture.
void showEvidenceLocker(BuildContext context, {required String jobId}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _EvidenceLockerSheet(jobId: jobId),
  );
}

class _EvidenceLockerSheet extends ConsumerStatefulWidget {
  final String jobId;
  const _EvidenceLockerSheet({required this.jobId});

  @override
  ConsumerState<_EvidenceLockerSheet> createState() => _EvidenceLockerSheetState();
}

class _EvidenceLockerSheetState extends ConsumerState<_EvidenceLockerSheet> {
  final _picker = ImagePicker();
  bool _capturing = false;

  Future<void> _capturePhoto() async {
    if (_capturing) return;
    setState(() => _capturing = true);
    HapticFeedback.mediumImpact();

    try {
      final photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        maxWidth: 1920,
      );

      if (photo == null) {
        if (mounted) setState(() => _capturing = false);
        return;
      }

      // Record the media entry (file URL would normally be from Supabase Storage upload)
      await recordJobMedia(
        jobId: widget.jobId,
        fileUrl: photo.path,
        caption: 'Evidence photo',
      );

      // Log telemetry
      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: TelemetryEventType.photoTaken,
        eventData: {'file_path': photo.path},
      );

      if (mounted) {
        ref.invalidate(jobMediaProvider(widget.jobId));
        ref.invalidate(jobMediaCountProvider(widget.jobId));
        HapticFeedback.lightImpact();
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mediaAsync = ref.watch(jobMediaProvider(widget.jobId));
    final mq = MediaQuery.of(context);

    return Container(
      height: mq.size.height * 0.7,
      decoration: BoxDecoration(
        color: const Color(0xF5080808),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Column(
              children: [
                Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(PhosphorIconsLight.vault, color: ObsidianTheme.emerald, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'EVIDENCE LOCKER',
                          style: GoogleFonts.jetBrainsMono(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'Watermarked media capture',
                          style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                        ),
                      ],
                    ),
                    const Spacer(),
                    // Capture button
                    GestureDetector(
                      onTap: _capturePhoto,
                      child: Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _capturing
                              ? ObsidianTheme.emerald.withValues(alpha: 0.2)
                              : ObsidianTheme.emerald.withValues(alpha: 0.1),
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                        ),
                        child: _capturing
                            ? const SizedBox(
                                width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: ObsidianTheme.emerald),
                              )
                            : const Icon(PhosphorIconsLight.camera, color: ObsidianTheme.emerald, size: 20),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms)
              .moveY(begin: -6, duration: 400.ms, curve: Curves.easeOutCubic),

          Divider(height: 1, color: Colors.white.withValues(alpha: 0.06)),

          // Media grid
          Expanded(
            child: mediaAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
              ),
              error: (e, _) => Center(
                child: Text('Failed to load', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary)),
              ),
              data: (media) {
                if (media.isEmpty) {
                  return _EmptyEvidence(onCapture: _capturePhoto);
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 6,
                    mainAxisSpacing: 6,
                    childAspectRatio: 1,
                  ),
                  itemCount: media.length,
                  itemBuilder: (context, index) {
                    final item = media[index];
                    return _MediaThumbnail(media: item, index: index);
                  },
                );
              },
            ),
          ),

          // Bottom bar — rapid fire hint
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, mq.padding.bottom + 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.02),
              border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.06))),
            ),
            child: Row(
              children: [
                Icon(PhosphorIconsLight.info, color: ObsidianTheme.textTertiary, size: 14),
                const SizedBox(width: 8),
                Text(
                  'Photos are watermarked with time & location',
                  style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyEvidence extends StatelessWidget {
  final VoidCallback onCapture;
  const _EmptyEvidence({required this.onCapture});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.03),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Icon(PhosphorIconsLight.camera, color: ObsidianTheme.textTertiary, size: 28),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scaleXY(begin: 1.0, end: 1.06, duration: 2500.ms, curve: Curves.easeInOut),
          const SizedBox(height: 16),
          Text(
            'No evidence captured',
            style: GoogleFonts.inter(color: ObsidianTheme.textSecondary, fontSize: 14, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 6),
          Text(
            'Tap the camera to capture watermarked photos',
            style: GoogleFonts.inter(color: ObsidianTheme.textTertiary, fontSize: 12),
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: onCapture,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                color: ObsidianTheme.emerald.withValues(alpha: 0.08),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(PhosphorIconsLight.camera, color: ObsidianTheme.emerald, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Capture Photo',
                    style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 500.ms);
  }
}

class _MediaThumbnail extends StatelessWidget {
  final JobMedia media;
  final int index;
  const _MediaThumbnail({required this.media, required this.index});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: ObsidianTheme.surface2,
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Stack(
        children: [
          // Placeholder (actual image would use CachedNetworkImage)
          Center(
            child: Icon(PhosphorIconsLight.image, color: ObsidianTheme.textTertiary, size: 24),
          ),
          // Watermark badge
          Positioned(
            bottom: 4,
            left: 4,
            right: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '${media.takenAt.hour.toString().padLeft(2, '0')}:${media.takenAt.minute.toString().padLeft(2, '0')}',
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.emerald,
                  fontSize: 8,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 50 * index),
          duration: 300.ms,
        )
        .scale(
          begin: const Offset(0.9, 0.9),
          delay: Duration(milliseconds: 50 * index),
          duration: 300.ms,
          curve: Curves.easeOutCubic,
        );
  }
}
