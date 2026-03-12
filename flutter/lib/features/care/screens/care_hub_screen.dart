import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/credentials_provider.dart';
import 'package:iworkr_mobile/core/services/incidents_provider.dart';
import 'package:iworkr_mobile/core/services/observations_provider.dart';
import 'package:iworkr_mobile/core/services/medications_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Care Hub — Central Care Dashboard ────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: Central hub for all care-sector
// features — credentials, medications, incidents, observations,
// and progress notes.

class CareHubScreen extends ConsumerWidget {
  const CareHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final credStats = ref.watch(credentialStatsProvider);
    final incidentStats = ref.watch(incidentStatsProvider);
    final todaysObs = ref.watch(todaysObservationsProvider);
    final medsAsync = ref.watch(medicationsStreamProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: false,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text(
              'Care Hub',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Compliance Section ─────────────────────
                _SectionHeader(title: 'Compliance', subtitle: 'Worker credentials & verification'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _QuickStatCard(
                      icon: PhosphorIconsLight.shieldCheck,
                      label: 'Verified',
                      value: '${credStats.verified}',
                      color: ObsidianTheme.careBlue,
                      onTap: () => context.push('/care/credentials'),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: _QuickStatCard(
                      icon: PhosphorIconsLight.warning,
                      label: 'Expiring',
                      value: '${credStats.expiring}',
                      color: ObsidianTheme.amber,
                      onTap: () => context.push('/care/credentials'),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: _QuickStatCard(
                      icon: PhosphorIconsLight.xCircle,
                      label: 'Expired',
                      value: '${credStats.expired}',
                      color: ObsidianTheme.rose,
                      onTap: () => context.push('/care/credentials'),
                    )),
                  ],
                ).animate().fadeIn(duration: 300.ms).moveY(begin: 10, end: 0),

                const SizedBox(height: 24),

                // ── Clinical Section ───────────────────────
                _SectionHeader(title: 'Clinical', subtitle: 'Medications, observations & incidents'),
                const SizedBox(height: 12),
                _NavTile(
                  icon: PhosphorIconsLight.pill,
                  title: 'Medications',
                  subtitle: medsAsync.when(
                    data: (meds) => '${meds.length} active prescriptions',
                    loading: () => 'Loading...',
                    error: (_, __) => '--',
                  ),
                  color: ObsidianTheme.careBlue,
                  onTap: () => context.push('/care/medications'),
                ).animate().fadeIn(delay: 100.ms, duration: 300.ms).moveY(begin: 10, end: 0),
                const SizedBox(height: 8),
                _NavTile(
                  icon: PhosphorIconsLight.heartbeat,
                  title: 'Health Observations',
                  subtitle: '${todaysObs.length} recorded today',
                  color: ObsidianTheme.blue,
                  onTap: () => context.push('/care/observations'),
                ).animate().fadeIn(delay: 150.ms, duration: 300.ms).moveY(begin: 10, end: 0),
                const SizedBox(height: 8),
                _NavTile(
                  icon: PhosphorIconsLight.warningCircle,
                  title: 'Incidents',
                  subtitle: '${incidentStats.open} open${incidentStats.critical > 0 ? ' · ${incidentStats.critical} critical' : ''}',
                  color: incidentStats.critical > 0 ? ObsidianTheme.rose : ObsidianTheme.amber,
                  onTap: () => context.push('/care/incidents'),
                ).animate().fadeIn(delay: 200.ms, duration: 300.ms).moveY(begin: 10, end: 0),

                const SizedBox(height: 24),

                // ── Documentation Section ──────────────────
                _SectionHeader(title: 'Documentation', subtitle: 'Shift notes & participant records'),
                const SizedBox(height: 12),
                _NavTile(
                  icon: PhosphorIconsLight.notepad,
                  title: 'Progress Notes',
                  subtitle: 'Shift completion reports with EVV',
                  color: ObsidianTheme.indigo,
                  onTap: () => context.push('/care/progress-notes'),
                ).animate().fadeIn(delay: 250.ms, duration: 300.ms).moveY(begin: 10, end: 0),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  const _SectionHeader({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary, letterSpacing: -0.3)),
        Text(subtitle, style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
      ],
    );
  }
}

class _QuickStatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;
  const _QuickStatCard({required this.icon, required this.label, required this.value, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () { HapticFeedback.lightImpact(); onTap?.call(); },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(height: 6),
            Text(value, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
            Text(label, style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
          ],
        ),
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback? onTap;
  const _NavTile({required this.icon, required this.title, required this.subtitle, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () { HapticFeedback.lightImpact(); onTap?.call(); },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 22, color: color),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                  Text(subtitle, style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
                ],
              ),
            ),
            Icon(PhosphorIconsLight.caretRight, size: 18, color: c.textTertiary),
          ],
        ),
      ),
    );
  }
}
