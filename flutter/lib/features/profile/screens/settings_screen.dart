import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/stealth_icon.dart';

/// Settings Modal — "The Control Panel"
///
/// Full-screen modal covering 95% of viewport.
/// Sections: Profile, Security, Preferences, Notifications, Workspace.
/// Glass-grouped lists on matte black.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  // Preferences state
  String _appearance = 'obsidian';
  String _hapticLevel = 'medium';
  String _startScreen = 'dashboard';

  // Notification toggles
  bool _pushEnabled = true;
  bool _emailEnabled = true;
  bool _smsEnabled = false;
  bool _jobAssigned = true;
  bool _jobStatusChange = true;
  bool _mentionedInChat = true;

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);

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
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.pop();
                    },
                    child: Container(
                      width: 32, height: 32,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.border),
                        color: ObsidianTheme.surface1,
                      ),
                      child: const Center(
                        child: Icon(PhosphorIconsLight.x, size: 16, color: ObsidianTheme.textSecondary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Text(
                    'Settings',
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

            const SizedBox(height: 16),

            // Scrollable content
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                children: [
                  // ── Profile ───────────────────────────────
                  _SectionLabel('PROFILE'),
                  const SizedBox(height: 8),
                  profileAsync.when(
                    data: (profile) {
                      if (profile == null) return const SizedBox.shrink();
                      return GlassCard(
                        padding: const EdgeInsets.all(20),
                        borderRadius: ObsidianTheme.radiusLg,
                        child: Column(
                          children: [
                            // Avatar
                            profile.avatarUrl != null && profile.avatarUrl!.isNotEmpty
                              ? CircleAvatar(
                                  radius: 36,
                                  backgroundImage: NetworkImage(profile.avatarUrl!),
                                  backgroundColor: ObsidianTheme.emeraldDim,
                                )
                              : Container(
                                  width: 72, height: 72,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: ObsidianTheme.emeraldDim,
                                    border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                                  ),
                                  child: Center(
                                    child: Text(
                                      profile.initials,
                                      style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
                                    ),
                                  ),
                                ),
                            const SizedBox(height: 16),
                            // Name (editable look)
                            _SettingsField(
                              label: 'Display Name',
                              value: profile.displayName,
                              icon: PhosphorIconsLight.user,
                            ),
                            const SizedBox(height: 12),
                            _SettingsField(
                              label: 'Email',
                              value: profile.email,
                              icon: PhosphorIconsLight.envelope,
                              locked: true,
                            ),
                          ],
                        ),
                      );
                    },
                    loading: () => _shimmer(100),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 24),

                  // ── Security ──────────────────────────────
                  _SectionLabel('SECURITY'),
                  const SizedBox(height: 8),
                  GlassCard(
                    padding: EdgeInsets.zero,
                    borderRadius: ObsidianTheme.radiusLg,
                    child: Column(
                      children: [
                        _SettingsNavItem(
                          icon: PhosphorIconsLight.shieldCheck,
                          label: 'Security & Billing',
                          subtitle: 'Password, biometrics, sessions, plan',
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/profile/security');
                          },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── Preferences ────────────────────────────
                  _SectionLabel('PREFERENCES'),
                  const SizedBox(height: 8),
                  GlassCard(
                    padding: EdgeInsets.zero,
                    borderRadius: ObsidianTheme.radiusLg,
                    child: Column(
                      children: [
                        _SettingsSelector(
                          icon: PhosphorIconsLight.moon,
                          label: 'Appearance',
                          value: _appearance == 'obsidian' ? 'Obsidian' : _appearance == 'dark' ? 'Dark' : 'System',
                          options: const ['System', 'Dark', 'Obsidian'],
                          onChanged: (v) {
                            HapticFeedback.selectionClick();
                            setState(() => _appearance = v.toLowerCase());
                          },
                        ),
                        const Divider(height: 1, color: ObsidianTheme.border),
                        _SettingsSelector(
                          icon: PhosphorIconsLight.vibrate,
                          label: 'Haptics',
                          value: _hapticLevel[0].toUpperCase() + _hapticLevel.substring(1),
                          options: const ['Off', 'Light', 'Medium', 'Heavy'],
                          onChanged: (v) {
                            HapticFeedback.selectionClick();
                            setState(() => _hapticLevel = v.toLowerCase());
                          },
                        ),
                        const Divider(height: 1, color: ObsidianTheme.border),
                        _SettingsSelector(
                          icon: PhosphorIconsLight.rocket,
                          label: 'Start Screen',
                          value: _startScreen == 'dashboard' ? 'Dashboard' : 'Schedule',
                          options: const ['Dashboard', 'Schedule'],
                          onChanged: (v) {
                            HapticFeedback.selectionClick();
                            setState(() => _startScreen = v.toLowerCase());
                          },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── Notifications ──────────────────────────
                  _SectionLabel('NOTIFICATIONS'),
                  const SizedBox(height: 8),
                  GlassCard(
                    padding: EdgeInsets.zero,
                    borderRadius: ObsidianTheme.radiusLg,
                    child: Column(
                      children: [
                        _SettingsToggle(
                          icon: PhosphorIconsLight.bellSimple,
                          label: 'Push Notifications',
                          value: _pushEnabled,
                          onChanged: (v) { HapticFeedback.mediumImpact(); setState(() => _pushEnabled = v); },
                        ),
                        const Divider(height: 1, color: ObsidianTheme.border),
                        _SettingsToggle(
                          icon: PhosphorIconsLight.envelope,
                          label: 'Email Alerts',
                          value: _emailEnabled,
                          onChanged: (v) { HapticFeedback.mediumImpact(); setState(() => _emailEnabled = v); },
                        ),
                        const Divider(height: 1, color: ObsidianTheme.border),
                        _SettingsToggle(
                          icon: PhosphorIconsLight.chatText,
                          label: 'SMS (Urgent Only)',
                          value: _smsEnabled,
                          onChanged: (v) { HapticFeedback.mediumImpact(); setState(() => _smsEnabled = v); },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Triggers
                  GlassCard(
                    padding: EdgeInsets.zero,
                    borderRadius: ObsidianTheme.radiusLg,
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'TRIGGERS',
                              style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
                            ),
                          ),
                        ),
                        _SettingsToggle(
                          icon: PhosphorIconsLight.briefcase,
                          label: 'New Job Assigned',
                          value: _jobAssigned,
                          onChanged: (v) { HapticFeedback.mediumImpact(); setState(() => _jobAssigned = v); },
                        ),
                        const Divider(height: 1, color: ObsidianTheme.border),
                        _SettingsToggle(
                          icon: PhosphorIconsLight.arrowsClockwise,
                          label: 'Job Status Change',
                          value: _jobStatusChange,
                          onChanged: (v) { HapticFeedback.mediumImpact(); setState(() => _jobStatusChange = v); },
                        ),
                        const Divider(height: 1, color: ObsidianTheme.border),
                        _SettingsToggle(
                          icon: PhosphorIconsLight.at,
                          label: 'Mentioned in Chat',
                          value: _mentionedInChat,
                          onChanged: (v) { HapticFeedback.mediumImpact(); setState(() => _mentionedInChat = v); },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── Workspace (Admin Only — requires adminView claim) ──
                  PermissionGuard(
                    claim: Claims.adminView,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SectionLabel('WORKSPACE'),
                        const SizedBox(height: 8),
                        GlassCard(
                          padding: EdgeInsets.zero,
                          borderRadius: ObsidianTheme.radiusLg,
                          child: Column(
                            children: [
                              PermissionGuard(
                                claim: Claims.adminUsers,
                                child: _SettingsNavItem(
                                  icon: PhosphorIconsLight.usersThree,
                                  label: 'Team Members',
                                  subtitle: 'Manage roles & access',
                                  onTap: () {
                                    HapticFeedback.lightImpact();
                                    context.push('/admin/users');
                                  },
                                ),
                              ),
                              const Divider(height: 1, color: ObsidianTheme.border),
                              PermissionGuard(
                                claim: Claims.adminBilling,
                                child: _SettingsNavItem(
                                  icon: PhosphorIconsLight.creditCard,
                                  label: 'Billing',
                                  subtitle: 'Pro Plan · Active',
                                  trailing: Container(
                                    width: 6, height: 6,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: ObsidianTheme.emerald,
                                      boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.4), blurRadius: 4)],
                                    ),
                                  ),
                                  onTap: () => HapticFeedback.lightImpact(),
                                ),
                              ),
                              const Divider(height: 1, color: ObsidianTheme.border),
                              PermissionGuard(
                                claim: Claims.adminIntegrations,
                                child: _SettingsNavItem(
                                  icon: PhosphorIconsLight.plugs,
                                  label: 'Integrations',
                                  subtitle: 'Stripe, Xero, Slack',
                                  onTap: () => HapticFeedback.lightImpact(),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),

                  // ── Sign Out ───────────────────────────────
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
                  ),

                  const SizedBox(height: 24),

                  // Footer
                  Center(
                    child: Column(
                      children: [
                        Image.asset('assets/logos/logo-dark-full.png', width: 80, opacity: const AlwaysStoppedAnimation(0.3)),
                        const SizedBox(height: 8),
                        Text('v3.0.0', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shimmer(double height) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: ObsidianTheme.shimmerBase,
      ),
    );
  }

}

// ── Section Label ────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
    );
  }
}

// ── Settings Field (Readonly / Editable) ─────────────

class _SettingsField extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool locked;

  const _SettingsField({required this.label, required this.value, required this.icon, this.locked = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        StealthIcon(icon, size: 16),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary)),
              const SizedBox(height: 2),
              Text(
                value,
                style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
        if (locked) Icon(PhosphorIconsLight.lockSimple, size: 14, color: ObsidianTheme.textTertiary),
      ],
    );
  }
}

// ── Settings Nav Item (Pushes to screen) ─────────────

class _SettingsNavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  const _SettingsNavItem({required this.icon, required this.label, this.subtitle, this.trailing, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            StealthIcon(icon, size: 18),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary)),
                  if (subtitle != null)
                    Text(subtitle!, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                ],
              ),
            ),
            if (trailing != null) trailing!
            else Icon(PhosphorIconsLight.caretRight, size: 14, color: ObsidianTheme.textTertiary),
          ],
        ),
      ),
    );
  }
}

// ── Settings Toggle ──────────────────────────────────

class _SettingsToggle extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingsToggle({required this.icon, required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          StealthIcon(icon, size: 18, isActive: value),
          const SizedBox(width: 14),
          Expanded(
            child: Text(label, style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary)),
          ),
          _ObsidianSwitch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

// ── Obsidian Switch (Custom Toggle) ──────────────────

class _ObsidianSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ObsidianSwitch({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: ObsidianTheme.standard,
        width: 40,
        height: 22,
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(11),
          color: value ? ObsidianTheme.emerald : const Color(0xFF27272A),
          border: Border.all(
            color: value ? ObsidianTheme.emerald.withValues(alpha: 0.5) : ObsidianTheme.borderMedium,
          ),
        ),
        child: AnimatedAlign(
          duration: ObsidianTheme.standard,
          curve: Curves.easeOutBack,
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: value
                  ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.3), blurRadius: 4)]
                  : null,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Settings Selector ────────────────────────────────

class _SettingsSelector extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  const _SettingsSelector({
    required this.icon,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          StealthIcon(icon, size: 18),
          const SizedBox(width: 14),
          Expanded(
            child: Text(label, style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary)),
          ),
          GestureDetector(
            onTap: () {
              final currentIndex = options.indexWhere((o) => o == value);
              final nextIndex = (currentIndex + 1) % options.length;
              onChanged(options[nextIndex]);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: ObsidianTheme.shimmerBase,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(value, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textSecondary)),
                  const SizedBox(width: 4),
                  Icon(PhosphorIconsLight.caretDown, size: 10, color: ObsidianTheme.textTertiary),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
