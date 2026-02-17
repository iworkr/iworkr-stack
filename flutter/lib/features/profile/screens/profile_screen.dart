import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';

/// Profile screen — settings, branding, sign out.
///
/// Web spec:
/// - Same surface/border tokens
/// - Ghost-style buttons
/// - Monospace metadata
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final orgAsync = ref.watch(organizationProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          children: [
            Text(
              'Profile',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: ObsidianTheme.textPrimary,
                letterSpacing: -0.3,
              ),
            ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

            const SizedBox(height: 20),

            // Profile card
            profileAsync.when(
              data: (profile) {
                if (profile == null) return const SizedBox.shrink();
                return GlassCard(
                  padding: const EdgeInsets.all(20),
                  borderRadius: ObsidianTheme.radiusLg,
                  child: Row(
                    children: [
                      // Avatar — emerald initials
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusMd,
                          color: ObsidianTheme.emeraldDim,
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                        ),
                        child: Center(
                          child: Text(
                            profile.initials,
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: ObsidianTheme.emerald,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile.displayName,
                              style: GoogleFonts.inter(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: ObsidianTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              profile.email,
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 11,
                                color: ObsidianTheme.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                    .moveY(begin: 10, end: 0, delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
              },
              loading: () => ShimmerLoading(height: 88, borderRadius: ObsidianTheme.radiusLg),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 12),

            // Organization info
            orgAsync.when(
              data: (org) {
                if (org == null) return const SizedBox.shrink();
                final orgData = org['organizations'] as Map<String, dynamic>?;
                return GlassCard(
                  padding: const EdgeInsets.all(14),
                  borderRadius: ObsidianTheme.radiusLg,
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusMd,
                          color: ObsidianTheme.shimmerBase,
                          border: Border.all(color: ObsidianTheme.border),
                        ),
                        child: ClipRRect(
                          borderRadius: ObsidianTheme.radiusMd,
                          child: Image.asset('assets/logos/logo-dark-streamline.png', width: 22, height: 22),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              orgData?['name'] as String? ?? 'Organization',
                              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                            ),
                            Text(
                              '${org['role']} · ${org['branch'] ?? 'HQ'}',
                              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                    .moveY(begin: 10, end: 0);
              },
              loading: () => ShimmerLoading(height: 64, borderRadius: ObsidianTheme.radiusLg),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 28),

            // Settings list
            Text(
              'SETTINGS',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
            ).animate().fadeIn(delay: 300.ms, duration: 300.ms),
            const SizedBox(height: 10),

            ..._buildSettingsItems(context, ref),

            const SizedBox(height: 28),

            // Sign out — rose accent
            GestureDetector(
              onTap: () async {
                HapticFeedback.heavyImpact();
                await ref.read(authNotifierProvider.notifier).signOut();
                if (context.mounted) context.go('/login');
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
                  color: ObsidianTheme.rose.withValues(alpha: 0.05),
                ),
                child: Center(
                  child: Text(
                    'Sign Out',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.rose),
                  ),
                ),
              ),
            ).animate().fadeIn(delay: 600.ms, duration: 400.ms),

            const SizedBox(height: 24),

            // Footer branding
            Center(
              child: Column(
                children: [
                  Image.asset('assets/logos/logo-dark-full.png', width: 80, opacity: const AlwaysStoppedAnimation(0.3)),
                  const SizedBox(height: 8),
                  Text(
                    'v3.0.0',
                    style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 700.ms, duration: 400.ms),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildSettingsItems(BuildContext context, WidgetRef ref) {
    final items = [
      _SettingsItem(icon: PhosphorIconsRegular.bell, label: 'Notifications', index: 0),
      _SettingsItem(icon: PhosphorIconsRegular.moon, label: 'Appearance', index: 1),
      _SettingsItem(icon: PhosphorIconsRegular.shieldCheck, label: 'Security', index: 2, route: '/profile/security'),
      _SettingsItem(icon: PhosphorIconsRegular.arrowsClockwise, label: 'Sync Status', index: 3),
      _SettingsItem(icon: PhosphorIconsRegular.question, label: 'Help & Support', index: 4),
    ];
    return items;
  }
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final int index;
  final String? route;

  const _SettingsItem({required this.icon, required this.label, required this.index, this.route});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        if (route != null) context.push(route!);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ObsidianTheme.border)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: ObsidianTheme.textSecondary),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary),
              ),
            ),
            const Icon(PhosphorIconsRegular.caretRight, size: 14, color: ObsidianTheme.textTertiary),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 350 + index * 30), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveX(begin: -8, end: 0, delay: Duration(milliseconds: 350 + index * 30), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}
