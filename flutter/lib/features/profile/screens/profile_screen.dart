import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/services/timeclock_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/core/widgets/stealth_icon.dart';

/// Profile screen — identity card, quick actions, and gateway to Settings.
///
/// Uses Phosphor Light icons for 1.5px stroke precision.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final orgAsync = ref.watch(organizationProvider);
    final c = context.iColors;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          children: [
            // Header with settings gear
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Profile',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: c.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    context.push('/profile/settings');
                  },
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      border: Border.all(color: c.border),
                      color: c.surface,
                    ),
                    child: Center(
                      child: Icon(PhosphorIconsLight.gearSix, size: 18, color: c.textSecondary),
                    ),
                  ),
                ),
              ],
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
                      profile.avatarUrl != null && profile.avatarUrl!.isNotEmpty
                        ? CircleAvatar(
                            radius: 26,
                            backgroundImage: NetworkImage(profile.avatarUrl!),
                            backgroundColor: ObsidianTheme.emeraldDim,
                          )
                        : Container(
                            width: 52, height: 52,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: ObsidianTheme.emeraldDim,
                              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                            ),
                            child: Center(
                              child: Text(
                                profile.initials,
                                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
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
                              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              profile.email,
                              style: GoogleFonts.jetBrainsMono(fontSize: 11, color: c.textTertiary),
                            ),
                          ],
                        ),
                      ),
                      Icon(PhosphorIconsLight.caretRight, size: 16, color: c.textTertiary),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                    .moveY(begin: 10, end: 0, delay: 100.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
              },
              loading: () => ShimmerLoading(height: 92, borderRadius: ObsidianTheme.radiusLg),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 12),

            // Organization info with clearance badge
            orgAsync.when(
              data: (org) {
                if (org == null) return const SizedBox.shrink();
                final orgData = org['organizations'] as Map<String, dynamic>?;
                final roleStr = org['role'] as String? ?? 'technician';
                final role = UserRole.fromString(roleStr);
                final Color badgeColor;
                final String badgeLabel;
                final IconData badgeIcon;

                if (role.isGodMode) {
                  badgeColor = const Color(0xFFA78BFA);
                  badgeLabel = 'GOD MODE';
                  badgeIcon = PhosphorIconsBold.crown;
                } else if (role.isManager) {
                  badgeColor = ObsidianTheme.amber;
                  badgeLabel = 'DISPATCH';
                  badgeIcon = PhosphorIconsBold.shieldStar;
                } else {
                  badgeColor = ObsidianTheme.emerald;
                  badgeLabel = 'OPERATOR';
                  badgeIcon = PhosphorIconsBold.wrench;
                }

                return GlassCard(
                  padding: const EdgeInsets.all(14),
                  borderRadius: ObsidianTheme.radiusLg,
                  child: Row(
                    children: [
                      Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusMd,
                          color: c.shimmerBase,
                          border: Border.all(color: c.border),
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
                              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary),
                            ),
                            Text(
                              '${role.label} · ${org['branch'] ?? 'HQ'}',
                              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                            ),
                          ],
                        ),
                      ),
                      // Clearance badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: badgeColor.withValues(alpha: 0.1),
                          border: Border.all(color: badgeColor.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(badgeIcon, size: 11, color: badgeColor),
                            const SizedBox(width: 4),
                            Text(
                              badgeLabel,
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 8,
                                fontWeight: FontWeight.w600,
                                color: badgeColor,
                                letterSpacing: 1,
                              ),
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

            const SizedBox(height: 24),

            // MY TIME section
            Text(
              'MY TIME',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5),
            ).animate().fadeIn(delay: 250.ms, duration: 300.ms),
            const SizedBox(height: 10),

            GlassCard(
              padding: EdgeInsets.zero,
              borderRadius: ObsidianTheme.radiusLg,
              child: Column(
                children: [
                  // Time Clock
                  _QuickAction(
                    icon: PhosphorIconsLight.clock,
                    label: 'Time Clock',
                    subtitle: 'Clock in/out, track shifts',
                    trailing: Consumer(
                      builder: (_, ref, __) {
                        final activeAsync = ref.watch(activeTimeEntryProvider);
                        final isActive = activeAsync.valueOrNull != null;
                        if (!isActive) return const SizedBox.shrink();
                        return Container(
                          width: 8, height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ObsidianTheme.emerald,
                            boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 6)],
                          ),
                        );
                      },
                    ),
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push('/profile/timeclock');
                    },
                    index: 0,
                  ),
                  Divider(height: 1, color: c.border),
                  // Weekly Hours
                  Consumer(
                    builder: (_, ref, __) {
                      final weeklyAsync = ref.watch(weeklyHoursProvider);
                      final hours = weeklyAsync.valueOrNull ?? 0;
                      return _QuickAction(
                        icon: PhosphorIconsLight.chartBar,
                        label: 'Weekly Hours',
                        subtitle: '${hours.toStringAsFixed(1)}h this week',
                        onTap: () {
                          HapticFeedback.lightImpact();
                          context.push('/profile/timeclock');
                        },
                        index: 1,
                      );
                    },
                  ),
                  Divider(height: 1, color: c.border),
                  // Leave
                  _QuickAction(
                    icon: PhosphorIconsLight.sunHorizon,
                    label: 'Leave Requests',
                    subtitle: 'Annual, sick, RDO',
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push('/profile/leave');
                    },
                    index: 2,
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(delay: 280.ms, duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
                .moveY(begin: 10, end: 0, delay: 280.ms, duration: 500.ms),

            const SizedBox(height: 24),

            // Quick Actions
            Text(
              'QUICK ACTIONS',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5),
            ).animate().fadeIn(delay: 350.ms, duration: 300.ms),
            const SizedBox(height: 10),

            GlassCard(
              padding: EdgeInsets.zero,
              borderRadius: ObsidianTheme.radiusLg,
              child: Column(
                children: [
                  _QuickAction(
                    icon: PhosphorIconsLight.key,
                    label: 'Security & Password',
                    subtitle: 'Change password, biometrics',
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push('/profile/security');
                    },
                    index: 3,
                  ),
                  Divider(height: 1, color: c.border),
                  _QuickAction(
                    icon: PhosphorIconsLight.bellSimple,
                    label: 'Notifications',
                    subtitle: 'Push, email, and SMS preferences',
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push('/profile/settings');
                    },
                    index: 4,
                  ),
                  Divider(height: 1, color: c.border),
                  _QuickAction(
                    icon: PhosphorIconsLight.sliders,
                    label: 'Preferences',
                    subtitle: 'Appearance, haptics, start screen',
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push('/profile/settings');
                    },
                    index: 5,
                  ),
                  Divider(height: 1, color: c.border),
                  _QuickAction(
                    icon: PhosphorIconsLight.arrowsClockwise,
                    label: 'Sync Status',
                    subtitle: 'Last synced just now',
                    trailing: Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.emerald,
                        boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 4)],
                      ),
                    ),
                    onTap: () => HapticFeedback.lightImpact(),
                    index: 6,
                  ),
                  Divider(height: 1, color: c.border),
                  _QuickAction(
                    icon: PhosphorIconsLight.question,
                    label: 'Help & Support',
                    subtitle: 'Documentation, contact us',
                    onTap: () => HapticFeedback.lightImpact(),
                    index: 7,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            // Sign out
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
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.signOut, size: 16, color: ObsidianTheme.rose),
                      const SizedBox(width: 8),
                      Text('Sign Out', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.rose)),
                    ],
                  ),
                ),
              ),
            ).animate().fadeIn(delay: 600.ms, duration: 400.ms),

            const SizedBox(height: 24),

            // Footer
            Center(
              child: Column(
                children: [
                  Image.asset('assets/logos/logo-dark-full.png', width: 80, opacity: const AlwaysStoppedAnimation(0.3)),
                  const SizedBox(height: 8),
                  Text('v3.0.0', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary)),
                ],
              ),
            ).animate().fadeIn(delay: 700.ms, duration: 400.ms),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback onTap;
  final int index;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.subtitle,
    this.trailing,
    required this.onTap,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            StealthIcon(icon, size: 18),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary)),
                  Text(subtitle, style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary)),
                ],
              ),
            ),
            if (trailing != null) trailing!
            else Icon(PhosphorIconsLight.caretRight, size: 14, color: c.textTertiary),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 350 + index * 30), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveX(begin: -8, end: 0, delay: Duration(milliseconds: 350 + index * 30), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}
