import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/permission_service.dart';
import 'package:iworkr_mobile/core/services/rbac_provider.dart';
import 'package:iworkr_mobile/core/services/settings_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/theme_provider.dart';

/// Settings — "The Control Panel"
///
/// Fully reactive. Every toggle/input syncs to Supabase or local device storage
/// via SettingsNotifier. Obsidian Vantablack/Zinc aesthetic throughout.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late TextEditingController _nameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _companyCtrl;
  late TextEditingController _supportEmailCtrl;
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    final s = ref.read(settingsProvider);
    _nameCtrl = TextEditingController(text: s.displayName);
    _phoneCtrl = TextEditingController(text: s.phone ?? '');
    _companyCtrl = TextEditingController(text: s.companyName ?? '');
    _supportEmailCtrl = TextEditingController(text: s.supportEmail ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _companyCtrl.dispose();
    _supportEmailCtrl.dispose();
    super.dispose();
  }

  void _syncControllers(SettingsState s) {
    if (_nameCtrl.text != s.displayName && !_nameCtrl.text.contains(s.displayName)) {
      _nameCtrl.text = s.displayName;
    }
    if (_phoneCtrl.text != (s.phone ?? '') && _phoneCtrl.text.isEmpty) {
      _phoneCtrl.text = s.phone ?? '';
    }
    if (_companyCtrl.text != (s.companyName ?? '') && _companyCtrl.text.isEmpty) {
      _companyCtrl.text = s.companyName ?? '';
    }
    if (_supportEmailCtrl.text != (s.supportEmail ?? '') && _supportEmailCtrl.text.isEmpty) {
      _supportEmailCtrl.text = s.supportEmail ?? '';
    }
  }

  Future<void> _pickAvatar() async {
    HapticFeedback.lightImpact();
    final source = await showCupertinoModalPopup<ImageSource>(
      context: context,
      builder: (_) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () => Navigator.pop(context, ImageSource.camera),
            child: const Text('Take Photo'),
          ),
          CupertinoActionSheetAction(
            onPressed: () => Navigator.pop(context, ImageSource.gallery),
            child: const Text('Choose from Library'),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDestructiveAction: true,
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
      ),
    );
    if (source == null) return;

    // JIT permission gate based on chosen source
    if (!mounted) return;
    final hasPermission = source == ImageSource.camera
        ? await PermissionService.instance.requestCamera(context)
        : await PermissionService.instance.requestPhotos(context);
    if (!hasPermission || !mounted) return;

    final image = await _picker.pickImage(source: source, maxWidth: 512, maxHeight: 512, imageQuality: 80);
    if (image == null) return;

    await ref.read(settingsProvider.notifier).uploadAvatar(image);
  }

  Future<void> _toggleNotif(String key, bool value) async {
    HapticFeedback.lightImpact();
    final success = await ref.read(settingsProvider.notifier).setNotificationPref(key, value);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: ObsidianTheme.rose,
          content: Text('Sync failed. Check connection.', style: GoogleFonts.inter(color: Colors.white, fontSize: 13)),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(settingsProvider);
    _syncControllers(s);
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(onClose: () => context.pop()),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                children: [
                  // ── Profile ─────────────────────────────
                  _SectionLabel('ACCOUNT'),
                  const SizedBox(height: 8),
                  _Card(
                    children: [
                      const SizedBox(height: 4),
                      Center(
                        child: GestureDetector(
                          onTap: _pickAvatar,
                          child: Stack(
                            children: [
                              s.avatarUrl != null && s.avatarUrl!.isNotEmpty
                                  ? CircleAvatar(
                                      radius: 36,
                                      backgroundImage: NetworkImage(s.avatarUrl!),
                                      backgroundColor: ObsidianTheme.emeraldDim,
                                    )
                                  : Container(
                                      width: 72,
                                      height: 72,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: ObsidianTheme.emeraldDim,
                                        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                                      ),
                                      child: Center(
                                        child: Text(
                                          s.displayName.isNotEmpty
                                              ? s.displayName.split(' ').map((p) => p.isNotEmpty ? p[0] : '').take(2).join().toUpperCase()
                                              : 'U',
                                          style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
                                        ),
                                      ),
                                    ),
                              Positioned(
                                bottom: 0,
                                right: 0,
                                child: Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: c.surfaceSecondary,
                                    border: Border.all(color: c.borderMedium),
                                  ),
                                  child: Icon(PhosphorIconsLight.camera, size: 12, color: c.textSecondary),
                                ),
                              ),
                              if (s.saving)
                                Positioned.fill(
                                  child: Container(
                                    decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.black54),
                                    child: const Center(child: CupertinoActivityIndicator()),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      _StealthInput(
                        label: 'Display Name',
                        controller: _nameCtrl,
                        icon: PhosphorIconsLight.user,
                        onSubmitted: (v) => ref.read(settingsProvider.notifier).updateDisplayName(v),
                      ),
                      _Divider(),
                      _StealthInput(
                        label: 'Phone',
                        controller: _phoneCtrl,
                        icon: PhosphorIconsLight.phone,
                        keyboard: TextInputType.phone,
                        onSubmitted: (v) => ref.read(settingsProvider.notifier).updatePhone(v),
                      ),
                      _Divider(),
                      _StaticField(
                        label: 'Email',
                        value: s.email,
                        icon: PhosphorIconsLight.envelope,
                        locked: true,
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // ── Security ────────────────────────────
                  _SectionLabel('SECURITY'),
                  const SizedBox(height: 8),
                  _Card(
                    children: [
                      _ToggleRow(
                        icon: PhosphorIconsLight.fingerprint,
                        label: 'Require Face ID / Touch ID',
                        value: s.biometricsEnabled,
                        enabled: s.biometricsAvailable,
                        onChanged: (_) async {
                          HapticFeedback.mediumImpact();
                          await ref.read(settingsProvider.notifier).toggleBiometrics();
                        },
                      ),
                      _Divider(),
                      _NavRow(
                        icon: PhosphorIconsLight.shieldCheck,
                        label: 'Password & Sessions',
                        onTap: () {
                          HapticFeedback.lightImpact();
                          context.push('/profile/security');
                        },
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // ── Appearance ──────────────────────────
                  _SectionLabel('APPEARANCE'),
                  const SizedBox(height: 8),
                  const _ThemeSelector(),

                  const SizedBox(height: 24),

                  // ── Notifications ───────────────────────
                  _SectionLabel('NOTIFICATIONS'),
                  const SizedBox(height: 8),
                  _Card(
                    children: [
                      _ToggleRow(
                        icon: PhosphorIconsLight.bellSimple,
                        label: 'Push Notifications',
                        value: s.pushEnabled,
                        onChanged: (v) => _toggleNotif('push_enabled', v),
                      ),
                      _Divider(),
                      _ToggleRow(
                        icon: PhosphorIconsLight.envelope,
                        label: 'Email Alerts',
                        value: s.emailEnabled,
                        onChanged: (v) => _toggleNotif('email_enabled', v),
                      ),
                      _Divider(),
                      _ToggleRow(
                        icon: PhosphorIconsLight.chatText,
                        label: 'SMS (Urgent Only)',
                        value: s.smsEnabled,
                        onChanged: (v) => _toggleNotif('sms_enabled', v),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _Card(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text('TRIGGERS', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: c.textTertiary, letterSpacing: 1.5)),
                      ),
                      _ToggleRow(
                        icon: PhosphorIconsLight.briefcase,
                        label: 'New Job Assigned',
                        value: s.jobAssigned,
                        onChanged: (v) => _toggleNotif('job_assigned', v),
                      ),
                      _Divider(),
                      _ToggleRow(
                        icon: PhosphorIconsLight.arrowsClockwise,
                        label: 'Job Status Change',
                        value: s.jobStatusChange,
                        onChanged: (v) => _toggleNotif('job_status_change', v),
                      ),
                      _Divider(),
                      _ToggleRow(
                        icon: PhosphorIconsLight.at,
                        label: 'Mentioned in Chat',
                        value: s.mentionedInChat,
                        onChanged: (v) => _toggleNotif('mentioned_in_chat', v),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // ── Workspace (Admin Only) ──────────────
                  PermissionGuard(
                    claim: Claims.adminView,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SectionLabel('WORKSPACE'),
                        const SizedBox(height: 8),
                        _Card(
                          children: [
                            _StealthInput(
                              label: 'Company Name',
                              controller: _companyCtrl,
                              icon: PhosphorIconsLight.buildings,
                              onSubmitted: (v) => ref.read(settingsProvider.notifier).updateCompanyName(v),
                            ),
                            _Divider(),
                            _StealthInput(
                              label: 'Support Email',
                              controller: _supportEmailCtrl,
                              icon: PhosphorIconsLight.envelopeSimple,
                              keyboard: TextInputType.emailAddress,
                              onSubmitted: (v) => ref.read(settingsProvider.notifier).updateSupportEmail(v),
                            ),
                            _Divider(),
                            _NavRow(
                              icon: PhosphorIconsLight.usersThree,
                              label: 'Team Members',
                              subtitle: 'Manage roles & access',
                              onTap: () {
                                HapticFeedback.lightImpact();
                                context.push('/admin/users');
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),

                  // ── Destructive ─────────────────────────
                  _GhostDangerButton(
                    label: 'Sign Out',
                    color: c.textSecondary,
                    onTap: () async {
                      HapticFeedback.heavyImpact();
                      await ref.read(authNotifierProvider.notifier).signOut();
                      if (context.mounted) context.go('/login');
                    },
                  ),
                  const SizedBox(height: 12),
                  _GhostDangerButton(
                    label: 'Delete Account',
                    color: ObsidianTheme.rose,
                    onTap: () => _showDeleteModal(context),
                  ),

                  const SizedBox(height: 32),
                  Center(
                    child: Text('v3.0.0', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteModal(BuildContext context) {
    final c = context.iColors;
    final deleteCtrl = TextEditingController();
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final enabled = deleteCtrl.text.trim().toUpperCase() == 'DELETE';
            return Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                  child: Container(
                    width: 340,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: c.surface,
                      border: Border.all(color: c.border),
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: ObsidianTheme.rose.withValues(alpha: 0.1),
                            ),
                            child: const Icon(PhosphorIconsLight.warning, size: 24, color: ObsidianTheme.rose),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Delete Account',
                            style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'This action is permanent and cannot be undone. Type DELETE to confirm.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary, height: 1.5),
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: deleteCtrl,
                            onChanged: (_) => setModalState(() {}),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.jetBrainsMono(fontSize: 16, color: ObsidianTheme.rose, fontWeight: FontWeight.w600, letterSpacing: 4),
                            decoration: InputDecoration(
                              hintText: 'DELETE',
                              hintStyle: GoogleFonts.jetBrainsMono(fontSize: 16, color: c.textDisabled, letterSpacing: 4),
                              enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: c.borderMedium)),
                              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: ObsidianTheme.rose.withValues(alpha: 0.5))),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Row(
                            children: [
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => Navigator.pop(ctx),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: c.borderMedium),
                                    ),
                                    child: Center(
                                      child: Text('Cancel', style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary)),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: GestureDetector(
                                  onTap: enabled
                                      ? () async {
                                          Navigator.pop(ctx);
                                          await ref.read(settingsProvider.notifier).deleteAccount();
                                          if (context.mounted) context.go('/login');
                                        }
                                      : null,
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 150),
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      color: enabled ? ObsidianTheme.rose : ObsidianTheme.rose.withValues(alpha: 0.15),
                                    ),
                                    child: Center(
                                      child: Text(
                                        'Delete Forever',
                                        style: GoogleFonts.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: enabled ? Colors.white : ObsidianTheme.rose.withValues(alpha: 0.5),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Shared Components ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _Header extends StatelessWidget {
  final VoidCallback onClose;
  const _Header({required this.onClose});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              onClose();
            },
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                border: Border.all(color: c.border),
                color: c.surface,
              ),
              child: Center(child: Icon(PhosphorIconsLight.x, size: 16, color: c.textSecondary)),
            ),
          ),
          const SizedBox(width: 14),
          Text(
            'Settings',
            style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}

// ══════════════════════════════════════════════════════
// ── Theme Selector ──────────────────────────────────
// ══════════════════════════════════════════════════════

class _ThemeSelector extends ConsumerWidget {
  const _ThemeSelector();

  static const _options = [
    (mode: ThemeMode.system, icon: CupertinoIcons.circle_lefthalf_fill, label: 'Automatic', sub: 'Matches device'),
    (mode: ThemeMode.light, icon: CupertinoIcons.sun_max_fill, label: 'Alabaster', sub: 'Light mode'),
    (mode: ThemeMode.dark, icon: CupertinoIcons.moon_fill, label: 'Obsidian', sub: 'Dark mode'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(themeProvider);
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: _options.map((opt) {
          final active = opt.mode == current;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                HapticFeedback.heavyImpact();
                ref.read(themeProvider.notifier).setThemeMode(opt.mode);
              },
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: ObsidianTheme.standard,
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: active ? c.activeBg : Colors.transparent,
                  border: Border.all(
                    color: active ? c.borderActive : Colors.transparent,
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      opt.icon,
                      size: 22,
                      color: active
                          ? Theme.of(context).primaryColor
                          : c.textTertiary,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      opt.label,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                        color: active ? c.textPrimary : c.textMuted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      opt.sub,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        color: c.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Text(text, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5));
  }
}

class _Card extends StatelessWidget {
  final List<Widget> children;
  const _Card({required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(left: 32),
      child: Container(height: 1, color: c.shimmerBase, margin: const EdgeInsets.symmetric(vertical: 2)),
    );
  }
}

class _StealthInput extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final IconData icon;
  final TextInputType keyboard;
  final ValueChanged<String> onSubmitted;

  const _StealthInput({
    required this.label,
    required this.controller,
    required this.icon,
    this.keyboard = TextInputType.text,
    required this.onSubmitted,
  });

  @override
  State<_StealthInput> createState() => _StealthInputState();
}

class _StealthInputState extends State<_StealthInput> {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(widget.icon, size: 16, color: c.textTertiary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.label, style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary)),
                const SizedBox(height: 2),
                TextField(
                  controller: widget.controller,
                  keyboardType: widget.keyboard,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: c.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.only(bottom: 4),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: c.borderHover),
                    ),
                  ),
                  onSubmitted: widget.onSubmitted,
                  onEditingComplete: () {
                    widget.onSubmitted(widget.controller.text);
                    FocusScope.of(context).unfocus();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StaticField extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool locked;

  const _StaticField({required this.label, required this.value, required this.icon, this.locked = false});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 16, color: c.textTertiary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary)),
                const SizedBox(height: 2),
                Text(value, style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          if (locked) Icon(PhosphorIconsLight.lockSimple, size: 14, color: c.textTertiary),
        ],
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  const _ToggleRow({
    required this.icon,
    required this.label,
    required this.value,
    this.enabled = true,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: value ? ObsidianTheme.emerald : c.textTertiary),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: enabled ? c.textPrimary : c.textDisabled,
              ),
            ),
          ),
          IgnorePointer(
            ignoring: !enabled,
            child: Opacity(
              opacity: enabled ? 1 : 0.4,
              child: CupertinoSwitch(
                value: value,
                activeTrackColor: ObsidianTheme.emerald,
                inactiveTrackColor: c.shimmerHighlight,
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  const _NavRow({required this.icon, required this.label, this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Icon(icon, size: 16, color: c.textTertiary),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary)),
                  if (subtitle != null)
                    Text(subtitle!, style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary)),
                ],
              ),
            ),
            Icon(CupertinoIcons.chevron_right, size: 14, color: c.textTertiary),
          ],
        ),
      ),
    );
  }
}

class _GhostDangerButton extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _GhostDangerButton({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: Colors.transparent,
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: color),
          ),
        ),
      ),
    );
  }
}
