import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Permission Soft Prompt — Obsidian Standard ───────────
// ═══════════════════════════════════════════════════════════
//
// Just-In-Time (JIT) bottom sheet shown before the native OS
// permission dialog. Explains *why* the permission is needed
// in our Obsidian design language, dramatically increasing
// the grant rate on the subsequent OS prompt.

/// Shows the soft prompt. Returns true if the user tapped Continue.
Future<bool> showPermissionSoftPrompt(
  BuildContext context, {
  required dynamic icon,
  required String title,
  required String body,
  required String ctaLabel,
}) async {
  HapticFeedback.mediumImpact();
  final result = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    isDismissible: true,
    builder: (_) => _SoftPromptSheet(
      iconType: icon,
      title: title,
      body: body,
      ctaLabel: ctaLabel,
    ),
  );
  return result ?? false;
}

/// Shows the recovery sheet for permanently denied permissions.
Future<void> showPermissionRecoverySheet(
  BuildContext context, {
  required String title,
  required String body,
}) async {
  HapticFeedback.heavyImpact();
  await showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _RecoverySheet(title: title, body: body),
  );
}

// ── Soft Prompt Sheet ────────────────────────────────────

class _SoftPromptSheet extends StatelessWidget {
  final dynamic iconType;
  final String title;
  final String body;
  final String ctaLabel;

  const _SoftPromptSheet({
    required this.iconType,
    required this.title,
    required this.body,
    required this.ctaLabel,
  });

  IconData get _iconData {
    final t = iconType.toString();
    if (t.contains('camera')) return PhosphorIconsBold.camera;
    if (t.contains('photos')) return PhosphorIconsBold.images;
    if (t.contains('location')) return PhosphorIconsBold.mapPin;
    if (t.contains('notifications')) return PhosphorIconsBold.bell;
    return PhosphorIconsBold.shieldCheck;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: c.border),
          left: BorderSide(color: c.border),
          right: BorderSide(color: c.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 16, 24, bottomPad + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: c.borderHover,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 28),

              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: ObsidianTheme.emeraldDim,
                  border: Border.all(
                    color: ObsidianTheme.emerald.withValues(alpha: 0.2),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: ObsidianTheme.emerald.withValues(alpha: 0.12),
                      blurRadius: 32,
                    ),
                  ],
                ),
                child: Icon(_iconData, size: 26, color: ObsidianTheme.emerald),
              )
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .scale(
                    begin: const Offset(0.85, 0.85),
                    end: const Offset(1, 1),
                    duration: 400.ms,
                    curve: Curves.easeOutBack,
                  ),

              const SizedBox(height: 22),

              Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: c.textPrimary,
                  letterSpacing: -0.4,
                ),
              ).animate().fadeIn(delay: 100.ms, duration: 300.ms),

              const SizedBox(height: 10),

              Text(
                body,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: c.textMuted,
                  height: 1.55,
                ),
              ).animate().fadeIn(delay: 150.ms, duration: 300.ms),

              const SizedBox(height: 28),

              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).pop(true);
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(
                      ctaLabel,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ),
              ).animate().fadeIn(delay: 250.ms, duration: 300.ms),

              const SizedBox(height: 12),

              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  Navigator.of(context).pop(false);
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Not Now',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: c.textMuted,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Recovery Sheet (Permanently Denied) ──────────────────
// Rose-tinted variant for when the OS has locked us out.

class _RecoverySheet extends StatelessWidget {
  final String title;
  final String body;

  const _RecoverySheet({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: Color(0x1AF43F5E)),
          left: BorderSide(color: c.border),
          right: BorderSide(color: c.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 16, 24, bottomPad + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: c.borderHover,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 28),

              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: ObsidianTheme.roseDim,
                  border: Border.all(
                    color: ObsidianTheme.rose.withValues(alpha: 0.2),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: ObsidianTheme.rose.withValues(alpha: 0.1),
                      blurRadius: 32,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.lock_fill,
                  size: 24,
                  color: ObsidianTheme.rose,
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .shake(duration: 500.ms, hz: 3, offset: const Offset(2, 0)),

              const SizedBox(height: 22),

              Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: c.textPrimary,
                  letterSpacing: -0.4,
                ),
              ),

              const SizedBox(height: 10),

              Text(
                body,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: c.textMuted,
                  height: 1.55,
                ),
              ),

              const SizedBox(height: 28),

              GestureDetector(
                onTap: () async {
                  HapticFeedback.mediumImpact();
                  await openAppSettings();
                  if (context.mounted) Navigator.of(context).pop();
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(
                      'Open Settings',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 12),

              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: c.textMuted,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
