import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/admin_provider.dart';
import 'package:iworkr_mobile/core/services/quote_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revenueAsync = ref.watch(revenueTodayProvider);
    final outstandingAsync = ref.watch(outstandingProvider);
    final winRateAsync = ref.watch(quoteWinRateProvider);
    final membersAsync = ref.watch(orgMembersProvider);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () { HapticFeedback.lightImpact(); Navigator.pop(context); },
                    child: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle, color: ObsidianTheme.hoverBg,
                        border: Border.all(color: ObsidianTheme.border),
                      ),
                      child: const Center(child: Icon(PhosphorIconsLight.arrowLeft, size: 16, color: ObsidianTheme.textSecondary)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text('Command Center', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white, letterSpacing: -0.3)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusFull,
                      color: ObsidianTheme.emeraldDim,
                      border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 5, height: 5, decoration: const BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald)),
                        const SizedBox(width: 4),
                        Text('ADMIN', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600, letterSpacing: 1)),
                      ],
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
                children: [
                  // ── Business Pulse ─────────────────────
                  Text('BUSINESS PULSE', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                  const SizedBox(height: 10),

                  // Revenue card
                  GlassCard(
                    padding: const EdgeInsets.all(20),
                    borderRadius: ObsidianTheme.radiusLg,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text('REV TODAY', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                            const Spacer(),
                            Container(
                              width: 6, height: 6,
                              decoration: const BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        revenueAsync.when(
                          data: (rev) => Text(
                            _formatCurrency(rev),
                            style: GoogleFonts.inter(fontSize: 36, fontWeight: FontWeight.w700, color: ObsidianTheme.emerald, letterSpacing: -1.5),
                          ),
                          loading: () => Text('...', style: GoogleFonts.inter(fontSize: 36, color: ObsidianTheme.textTertiary)),
                          error: (_, __) => Text('\$-', style: GoogleFonts.inter(fontSize: 36, color: ObsidianTheme.textTertiary)),
                        ),
                        const SizedBox(height: 16),
                        // Sparkline
                        SizedBox(
                          height: 40,
                          child: CustomPaint(
                            painter: _SparklinePainter(color: ObsidianTheme.emerald),
                            size: const Size(double.infinity, 40),
                          ),
                        ).animate().fadeIn(delay: 200.ms, duration: 600.ms),
                      ],
                    ),
                  ).animate().fadeIn(duration: 500.ms, curve: ObsidianTheme.easeOutExpo).moveY(begin: 10, end: 0),

                  const SizedBox(height: 12),

                  // Two-column metrics
                  Row(
                    children: [
                      Expanded(
                        child: _MetricCard(
                          label: 'OUTSTANDING',
                          asyncValue: outstandingAsync,
                          color: ObsidianTheme.rose,
                          format: _formatCurrency,
                        ).animate().fadeIn(delay: 100.ms, duration: 500.ms).moveY(begin: 10, end: 0),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _MetricCard(
                          label: 'WIN RATE',
                          asyncValue: winRateAsync,
                          color: ObsidianTheme.blue,
                          format: (v) => '${v.toStringAsFixed(0)}%',
                        ).animate().fadeIn(delay: 160.ms, duration: 500.ms).moveY(begin: 10, end: 0),
                      ),
                    ],
                  ),

                  const SizedBox(height: 28),

                  // ── Team ───────────────────────────────
                  Row(
                    children: [
                      Text('TEAM', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                      const Spacer(),
                      GestureDetector(
                        onTap: () { HapticFeedback.lightImpact(); context.push('/admin/users'); },
                        child: Text('Manage', style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  membersAsync.when(
                    data: (members) {
                      final active = members.where((m) => m.status == 'active').toList();
                      return GlassCard(
                        padding: const EdgeInsets.all(16),
                        borderRadius: ObsidianTheme.radiusMd,
                        child: Column(
                          children: [
                            ...active.asMap().entries.map((entry) {
                              final m = entry.value;
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 28, height: 28,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: ObsidianTheme.shimmerBase,
                                        border: Border.all(color: ObsidianTheme.border),
                                      ),
                                      child: Center(
                                        child: Text(
                                          (m.profile?.displayName ?? 'U')[0].toUpperCase(),
                                          style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: ObsidianTheme.textSecondary),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(m.profile?.displayName ?? 'User', style: GoogleFonts.inter(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500)),
                                          Text(m.role, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      width: 6, height: 6,
                                      decoration: const BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald),
                                    ),
                                  ],
                                ),
                              ).animate().fadeIn(delay: Duration(milliseconds: 50 * entry.key), duration: 300.ms);
                            }),
                          ],
                        ),
                      );
                    },
                    loading: () => const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 28),

                  // ── Quick Links ────────────────────────
                  Text('QUICK LINKS', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                  const SizedBox(height: 10),

                  _AdminLink(icon: PhosphorIconsLight.currencyDollar, label: 'Finance', onTap: () => context.push('/finance'))
                      .animate().fadeIn(delay: 100.ms, duration: 300.ms),
                  _AdminLink(icon: PhosphorIconsLight.usersThree, label: 'User Management', onTap: () => context.push('/admin/users'))
                      .animate().fadeIn(delay: 140.ms, duration: 300.ms),
                  _AdminLink(icon: PhosphorIconsLight.shieldCheck, label: 'Security & Billing', onTap: () => context.push('/profile/security'))
                      .animate().fadeIn(delay: 180.ms, duration: 300.ms),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatCurrency(double amount) {
    final whole = amount.toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }
}

// ── Metric Card ──────────────────────────────────────

class _MetricCard extends StatelessWidget {
  final String label;
  final AsyncValue<double> asyncValue;
  final Color color;
  final String Function(double) format;

  const _MetricCard({required this.label, required this.asyncValue, required this.color, required this.format});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      borderRadius: ObsidianTheme.radiusMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 8),
          asyncValue.when(
            data: (v) => Text(format(v), style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w600, color: color, letterSpacing: -0.5)),
            loading: () => Text('...', style: GoogleFonts.inter(fontSize: 22, color: ObsidianTheme.textTertiary)),
            error: (_, __) => Text('-', style: GoogleFonts.inter(fontSize: 22, color: ObsidianTheme.textTertiary)),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 20,
            child: CustomPaint(
              painter: _SparklinePainter(color: color),
              size: const Size(double.infinity, 20),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Admin Link ───────────────────────────────────────

class _AdminLink extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _AdminLink({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () { HapticFeedback.lightImpact(); onTap(); },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: ObsidianTheme.border))),
        child: Row(
          children: [
            Icon(icon, size: 16, color: ObsidianTheme.textTertiary),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: GoogleFonts.inter(fontSize: 14, color: Colors.white, fontWeight: FontWeight.w500))),
            const Icon(PhosphorIconsLight.caretRight, size: 12, color: ObsidianTheme.textTertiary),
          ],
        ),
      ),
    );
  }
}

// ── Sparkline Painter ────────────────────────────────

class _SparklinePainter extends CustomPainter {
  final Color color;
  _SparklinePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final rng = Random(42);
    final points = List.generate(12, (i) {
      final x = size.width * i / 11;
      final y = size.height * 0.2 + rng.nextDouble() * size.height * 0.6;
      return Offset(x, y);
    });

    // Line
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      final cp1 = Offset(points[i - 1].dx + (points[i].dx - points[i - 1].dx) / 2, points[i - 1].dy);
      final cp2 = Offset(points[i - 1].dx + (points[i].dx - points[i - 1].dx) / 2, points[i].dy);
      path.cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, points[i].dx, points[i].dy);
    }

    canvas.drawPath(path, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round);

    // Fill gradient
    final fillPath = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fillPath, Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [color.withValues(alpha: 0.15), color.withValues(alpha: 0.0)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
