import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Animated empty state — rich, Lottie-style animations built natively.
///
/// Each [EmptyStateType] produces a unique animated illustration:
/// - radar:    Orbiting dot with scanning line (search, no results)
/// - inbox:    Tray with rising sparkles (inbox zero)
/// - calendar: Pulsing grid with orbiting clock (clear schedule)
/// - briefcase: Scanning line over wireframe case (no jobs)
/// - crate:    Rotating wireframe box (no assets)
/// - clipboard: Laser drawing lines (no forms)
/// - team:     Connected nodes pulsing (no team)
/// - generic:  Breathing ring with orbiting particles
enum EmptyStateType { radar, inbox, calendar, briefcase, crate, clipboard, team, shield, contactless, cortex, archive, generic }

class AnimatedEmptyState extends StatelessWidget {
  final EmptyStateType type;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const AnimatedEmptyState({
    super.key,
    this.type = EmptyStateType.generic,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 120,
              height: 120,
              child: _buildAnimation(),
            ),

            const SizedBox(height: 28),

            Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: ObsidianTheme.textSecondary,
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 300.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

            const SizedBox(height: 8),

            Text(
              subtitle,
              style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 400.ms, duration: 500.ms),

            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onAction!();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    border: Border.all(color: ObsidianTheme.borderMedium),
                  ),
                  child: Text(
                    actionLabel!,
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary),
                  ),
                ),
              ).animate().fadeIn(delay: 500.ms, duration: 400.ms),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAnimation() {
    switch (type) {
      case EmptyStateType.radar:
        return const _RadarAnimation();
      case EmptyStateType.inbox:
        return const _InboxZeroAnimation();
      case EmptyStateType.calendar:
        return const _CalendarAnimation();
      case EmptyStateType.briefcase:
        return const _BriefcaseAnimation();
      case EmptyStateType.crate:
        return const _CrateAnimation();
      case EmptyStateType.clipboard:
        return const _ClipboardAnimation();
      case EmptyStateType.team:
        return const _TeamAnimation();
      case EmptyStateType.shield:
        return const _ShieldAnimation();
      case EmptyStateType.contactless:
        return const _ContactlessAnimation();
      case EmptyStateType.cortex:
        return const _CortexAnimation();
      case EmptyStateType.archive:
        return const _ArchiveAnimation();
      case EmptyStateType.generic:
        return const _GenericAnimation();
    }
  }
}

// ── Radar Sweep (Search / No Results) ─────────────────

class _RadarAnimation extends StatelessWidget {
  const _RadarAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer ring
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.border, width: 1),
          ),
        ),
        // Middle ring
        Container(
          width: 66, height: 66,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0x08FFFFFF), width: 1),
          ),
        ),
        // Inner ring
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0x06FFFFFF), width: 1),
          ),
        ),
        // Sweep line
        SizedBox(
          width: 100, height: 100,
          child: CustomPaint(painter: _SweepPainter()),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 3000.ms, curve: Curves.linear),
        // Center dot
        Container(
          width: 6, height: 6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emerald,
            boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 8)],
          ),
        ),
        // Orbiting blip
        SizedBox(
          width: 80, height: 80,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 4, height: 4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emerald.withValues(alpha: 0.6),
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 4000.ms, curve: Curves.linear)
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .fadeIn(begin: 0.2, duration: 1500.ms),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

class _SweepPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final paint = Paint()
      ..shader = SweepGradient(
        startAngle: -0.1,
        endAngle: 0.8,
        colors: [
          Colors.transparent,
          ObsidianTheme.emerald.withValues(alpha: 0.15),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -pi / 2, 0.8, true, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Inbox Zero (Triage) ──────────────────────────────

class _InboxZeroAnimation extends StatelessWidget {
  const _InboxZeroAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Glow ring
        Container(
          width: 90, height: 90,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.08)),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .scaleXY(begin: 0.9, end: 1.4, duration: 2500.ms, curve: Curves.easeOut)
            .fadeOut(duration: 2500.ms),
        // Card container
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusLg,
            border: Border.all(color: ObsidianTheme.border),
            color: ObsidianTheme.surface1,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(PhosphorIconsLight.tray, size: 28, color: ObsidianTheme.textTertiary),
              // Rising sparkle
              Positioned(
                top: 12,
                right: 14,
                child: Container(
                  width: 5, height: 5,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.emerald,
                    boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 6)],
                  ),
                )
                    .animate(onPlay: (c) => c.repeat())
                    .moveY(begin: 0, end: -18, duration: 2000.ms, curve: Curves.easeOut)
                    .fadeOut(delay: 1200.ms, duration: 800.ms)
                    .scaleXY(begin: 1, end: 0.3, duration: 2000.ms),
              ),
              // Second sparkle
              Positioned(
                top: 16,
                left: 16,
                child: Container(
                  width: 3, height: 3,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald.withValues(alpha: 0.6)),
                )
                    .animate(onPlay: (c) => c.repeat(), delay: 800.ms)
                    .moveY(begin: 0, end: -14, duration: 1800.ms, curve: Curves.easeOut)
                    .fadeOut(delay: 1000.ms, duration: 800.ms),
              ),
            ],
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 1.05, duration: 3000.ms, curve: Curves.easeInOut),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Calendar / Schedule ──────────────────────────────

class _CalendarAnimation extends StatelessWidget {
  const _CalendarAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer orbit ring
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0x06FFFFFF)),
          ),
        ),
        // Orbiting clock
        SizedBox(
          width: 100, height: 100,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 16, height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.surface1,
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
              ),
              child: Icon(PhosphorIconsLight.clock, size: 9, color: ObsidianTheme.emerald.withValues(alpha: 0.6)),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 6000.ms, curve: Curves.linear),
        // Calendar card
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusLg,
            border: Border.all(color: ObsidianTheme.border),
            color: ObsidianTheme.surface1,
          ),
          child: Column(
            children: [
              // Header bar
              Container(
                height: 14,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(11),
                    topRight: Radius.circular(11),
                  ),
                  color: ObsidianTheme.borderMedium,
                ),
              ),
              const SizedBox(height: 6),
              // Grid dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(3, (i) =>
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: ObsidianTheme.shimmerBase,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(3, (i) =>
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: i == 1 ? ObsidianTheme.emerald.withValues(alpha: 0.2) : ObsidianTheme.shimmerBase,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 1.06, duration: 3000.ms, curve: Curves.easeInOut),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Briefcase / No Jobs ──────────────────────────────

class _BriefcaseAnimation extends StatelessWidget {
  const _BriefcaseAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Pulse ring
        Container(
          width: 96, height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.border),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .scaleXY(begin: 0.85, end: 1.5, duration: 2500.ms, curve: Curves.easeOut)
            .fadeOut(duration: 2500.ms),
        // Briefcase container
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusLg,
            border: Border.all(color: ObsidianTheme.border),
            color: ObsidianTheme.surface1,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(PhosphorIconsLight.briefcase, size: 28, color: ObsidianTheme.textTertiary),
              // Scanning line
              Positioned(
                left: 8, right: 8,
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        ObsidianTheme.emerald.withValues(alpha: 0.5),
                        Colors.transparent,
                      ],
                    ),
                  ),
                )
                    .animate(onPlay: (c) => c.repeat())
                    .moveY(begin: -20, end: 20, duration: 2000.ms, curve: Curves.easeInOut),
              ),
            ],
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 1.04, duration: 3000.ms, curve: Curves.easeInOut),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Crate / No Assets ────────────────────────────────

class _CrateAnimation extends StatelessWidget {
  const _CrateAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Shadow/glow
        Container(
          width: 50, height: 8,
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusFull,
            color: ObsidianTheme.border,
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 0.7, duration: 3000.ms, curve: Curves.easeInOut),
        // Floating crate
        Positioned(
          bottom: 20,
          child: SizedBox(
            width: 64, height: 64,
            child: CustomPaint(painter: _WireframeCratePainter()),
          )
              .animate(onPlay: (c) => c.repeat())
              .rotate(begin: 0, end: 1, duration: 12000.ms, curve: Curves.linear)
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .moveY(begin: 0, end: -8, duration: 3000.ms, curve: Curves.easeInOut),
        ),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

class _WireframeCratePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = ObsidianTheme.textTertiary
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    final cx = size.width / 2;
    final cy = size.height / 2;
    final s = size.width * 0.35;

    // Front face
    final path = Path()
      ..moveTo(cx - s, cy - s * 0.3)
      ..lineTo(cx, cy - s * 0.8)
      ..lineTo(cx + s, cy - s * 0.3)
      ..lineTo(cx, cy + s * 0.2)
      ..close();
    canvas.drawPath(path, paint);

    // Bottom edges
    final bottom = Path()
      ..moveTo(cx - s, cy - s * 0.3)
      ..lineTo(cx - s, cy + s * 0.4)
      ..lineTo(cx, cy + s * 0.9)
      ..lineTo(cx + s, cy + s * 0.4)
      ..lineTo(cx + s, cy - s * 0.3);
    canvas.drawPath(bottom, paint);

    // Center vertical
    canvas.drawLine(Offset(cx, cy + s * 0.2), Offset(cx, cy + s * 0.9), paint);

    // Emerald accent line
    final accentPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.3)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(cx, cy - s * 0.8), Offset(cx, cy + s * 0.2), accentPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Clipboard / No Forms ─────────────────────────────

class _ClipboardAnimation extends StatelessWidget {
  const _ClipboardAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 56, height: 72,
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusLg,
            border: Border.all(color: ObsidianTheme.border),
            color: ObsidianTheme.surface1,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 18, 10, 10),
            child: Column(
              children: [
                // Lines drawing in
                _LaserLine(delay: 0),
                const SizedBox(height: 6),
                _LaserLine(delay: 400),
                const SizedBox(height: 6),
                _LaserLine(delay: 800),
                const SizedBox(height: 6),
                _LaserLine(delay: 1200, short: true),
              ],
            ),
          ),
        ),
        // Clip at top
        Positioned(
          top: 18,
          child: Container(
            width: 20, height: 8,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: ObsidianTheme.borderMedium),
              color: ObsidianTheme.surface1,
            ),
          ),
        ),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

class _LaserLine extends StatelessWidget {
  final int delay;
  final bool short;
  const _LaserLine({required this.delay, this.short = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 3,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(2),
        color: ObsidianTheme.shimmerBase,
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: short ? 0.6 : 1.0,
          child: Container(
            height: 3,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              gradient: LinearGradient(
                colors: [
                  ObsidianTheme.emerald.withValues(alpha: 0.3),
                  ObsidianTheme.emerald.withValues(alpha: 0.05),
                ],
              ),
            ),
          )
              .animate(onPlay: (c) => c.repeat(), delay: Duration(milliseconds: delay))
              .scaleX(begin: 0, end: 1, alignment: Alignment.centerLeft, duration: 800.ms, curve: Curves.easeOut)
              .then()
              .fadeOut(duration: 600.ms)
              .then(delay: 1000.ms),
        ),
      ),
    );
  }
}

// ── Team / No Members ────────────────────────────────

class _TeamAnimation extends StatelessWidget {
  const _TeamAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Connection lines
        SizedBox(
          width: 100, height: 100,
          child: CustomPaint(painter: _NodesPainter()),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .fadeIn(begin: 0.4, duration: 2000.ms),
        // Center node
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
            color: ObsidianTheme.surface1,
          ),
          child: Icon(PhosphorIconsLight.usersThree, size: 16, color: ObsidianTheme.textTertiary),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 1.1, duration: 2500.ms, curve: Curves.easeInOut),
        // Orbiting nodes
        for (int i = 0; i < 3; i++)
          SizedBox(
            width: 90, height: 90,
            child: Transform.rotate(
              angle: i * (2 * pi / 3),
              child: Align(
                alignment: Alignment.topCenter,
                child: Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: ObsidianTheme.border),
                    color: ObsidianTheme.surface1,
                  ),
                ),
              ),
            ),
          )
              .animate(onPlay: (c) => c.repeat(), delay: Duration(milliseconds: i * 300))
              .rotate(duration: 8000.ms, curve: Curves.linear),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

class _NodesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = ObsidianTheme.border
      ..strokeWidth = 0.8;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width * 0.4;
    for (int i = 0; i < 3; i++) {
      final angle = i * (2 * pi / 3) - pi / 2;
      final x = cx + r * cos(angle);
      final y = cy + r * sin(angle);
      canvas.drawLine(Offset(cx, cy), Offset(x, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Shield Animation (Security / Fortress) ───────────

class _ShieldAnimation extends StatelessWidget {
  const _ShieldAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer shield ring — breathing
        Container(
          width: 96, height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15), width: 1.5),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 0.95, end: 1.1, duration: 2500.ms, curve: Curves.easeInOut)
            .fadeIn(duration: 600.ms),
        // Middle ring
        Container(
          width: 70, height: 70,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.08)),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1.0, end: 0.92, duration: 3000.ms, curve: Curves.easeInOut),
        // Shield core
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emeraldDim,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
          ),
          child: const Center(
            child: Icon(PhosphorIconsLight.shieldCheck, size: 22, color: ObsidianTheme.emerald),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1.0, end: 1.06, duration: 2000.ms, curve: Curves.easeInOut),
        // Orbiting lock particle
        SizedBox(
          width: 88, height: 88,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 6, height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emerald.withValues(alpha: 0.6),
                boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.3), blurRadius: 4)],
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 4000.ms, curve: Curves.linear),
        // Second orbiting particle (opposite)
        SizedBox(
          width: 88, height: 88,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: 4, height: 4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emerald.withValues(alpha: 0.3),
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 6000.ms, curve: Curves.linear, begin: 0.5),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Contactless / NFC Radar (Payments) ────────────────

class _ContactlessAnimation extends StatelessWidget {
  const _ContactlessAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outermost ripple
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.08)),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .scaleXY(begin: 0.6, end: 1.5, duration: 2500.ms, curve: Curves.easeOut)
            .fadeOut(duration: 2500.ms),
        // Second ripple (offset)
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.06)),
          ),
        )
            .animate(onPlay: (c) => c.repeat(), delay: 800.ms)
            .scaleXY(begin: 0.6, end: 1.5, duration: 2500.ms, curve: Curves.easeOut)
            .fadeOut(duration: 2500.ms),
        // Inner solid circle
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emeraldDim,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
          ),
          child: const Center(
            child: Icon(PhosphorIconsLight.contactlessPayment, size: 24, color: ObsidianTheme.emerald),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1.0, end: 1.08, duration: 2000.ms, curve: Curves.easeInOut),
        // Orbiting card particle
        SizedBox(
          width: 88, height: 88,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 14, height: 10,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: ObsidianTheme.surface1,
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.4)),
              ),
              child: Center(
                child: Container(
                  width: 6, height: 1.5,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(1),
                    color: ObsidianTheme.emerald.withValues(alpha: 0.6),
                  ),
                ),
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 5000.ms, curve: Curves.linear),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Cortex / AI Neural Cloud ──────────────────────────

class _CortexAnimation extends StatelessWidget {
  const _CortexAnimation();

  @override
  Widget build(BuildContext context) {
    const indigo = Color(0xFF6366F1);
    const violet = Color(0xFF8B5CF6);

    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer neural ring
        Container(
          width: 96, height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: indigo.withValues(alpha: 0.1)),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 0.92, end: 1.12, duration: 2800.ms, curve: Curves.easeInOut),
        // Middle glow
        Container(
          width: 70, height: 70,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                indigo.withValues(alpha: 0.06),
                Colors.transparent,
              ],
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1.0, end: 0.9, duration: 3000.ms, curve: Curves.easeInOut),
        // Core orb
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [indigo.withValues(alpha: 0.3), violet.withValues(alpha: 0.3)],
            ),
            border: Border.all(color: indigo.withValues(alpha: 0.25)),
            boxShadow: [BoxShadow(color: indigo.withValues(alpha: 0.15), blurRadius: 16)],
          ),
          child: const Center(
            child: Icon(PhosphorIconsLight.brain, size: 22, color: Colors.white70),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1.0, end: 1.08, duration: 2200.ms, curve: Curves.easeInOut),
        // Orbiting particle 1
        SizedBox(
          width: 84, height: 84,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 6, height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: indigo.withValues(alpha: 0.6),
                boxShadow: [BoxShadow(color: indigo.withValues(alpha: 0.3), blurRadius: 4)],
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 4500.ms, curve: Curves.linear),
        // Orbiting particle 2
        SizedBox(
          width: 84, height: 84,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: 4, height: 4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: violet.withValues(alpha: 0.4),
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 6000.ms, curve: Curves.linear),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Archive / Knowledge Base ──────────────────────────

class _ArchiveAnimation extends StatelessWidget {
  const _ArchiveAnimation();

  @override
  Widget build(BuildContext context) {
    const indigo = Color(0xFF6366F1);

    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer ring
        Container(
          width: 90, height: 90,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: indigo.withValues(alpha: 0.08)),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .scaleXY(begin: 0.9, end: 1.4, duration: 2500.ms, curve: Curves.easeOut)
            .fadeOut(duration: 2500.ms),
        // Stacked documents
        for (int i = 2; i >= 0; i--)
          Positioned(
            top: 30.0 + i * 6,
            child: Container(
              width: 44 - i * 4,
              height: 54 - i * 4,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: indigo.withValues(alpha: 0.1 + (2 - i) * 0.08)),
                color: ObsidianTheme.surface1,
              ),
              child: i == 0
                  ? Padding(
                      padding: const EdgeInsets.all(6),
                      child: Column(
                        children: [
                          Container(
                            height: 2.5,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(1),
                              color: indigo.withValues(alpha: 0.2),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            height: 2,
                            width: 24,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(1),
                              color: ObsidianTheme.shimmerBase,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            height: 2,
                            width: 20,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(1),
                              color: ObsidianTheme.shimmerBase,
                            ),
                          ),
                        ],
                      ),
                    )
                  : null,
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .moveY(
                  begin: 0,
                  end: i == 0 ? -3 : -(i * 2.0),
                  duration: Duration(milliseconds: 2500 + i * 300),
                  curve: Curves.easeInOut,
                ),
          ),
        // Magnifying glass orbiting
        SizedBox(
          width: 94, height: 94,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 18, height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.surface1,
                border: Border.all(color: indigo.withValues(alpha: 0.3)),
              ),
              child: Icon(PhosphorIconsLight.magnifyingGlass, size: 10, color: indigo.withValues(alpha: 0.7)),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 7000.ms, curve: Curves.linear),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}

// ── Generic (Fallback) ───────────────────────────────

class _GenericAnimation extends StatelessWidget {
  const _GenericAnimation();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer pulse
        Container(
          width: 88, height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.border),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .scaleXY(begin: 0.8, end: 1.6, duration: 2500.ms, curve: Curves.easeOut)
            .fadeOut(duration: 2500.ms),
        // Inner container
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ObsidianTheme.border),
            color: ObsidianTheme.surface1,
          ),
          child: Icon(PhosphorIconsLight.circleNotch, size: 24, color: ObsidianTheme.textTertiary),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scaleXY(begin: 1, end: 1.08, duration: 3000.ms, curve: Curves.easeInOut),
        // Orbiting particle
        SizedBox(
          width: 80, height: 80,
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 4, height: 4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emerald.withValues(alpha: 0.5),
              ),
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .rotate(duration: 5000.ms, curve: Curves.linear),
      ],
    ).animate().fadeIn(duration: 600.ms).scaleXY(begin: 0.8, end: 1, duration: 700.ms, curve: Curves.easeOutBack);
  }
}
