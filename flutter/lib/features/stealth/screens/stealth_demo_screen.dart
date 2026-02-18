import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/stealth_text_field.dart';
import 'package:iworkr_mobile/core/widgets/keyboard_command_rail.dart';
import 'package:iworkr_mobile/core/widgets/glass_sheet.dart';
import 'package:iworkr_mobile/core/widgets/stealth_toast.dart';

/// Demonstrates the full Stealth Input System:
/// - Ghost Inputs with Laser Spine
/// - Floating Labels
/// - Keyboard Command Rail (▲ ▼ Done)
/// - Glass Sheets
/// - Stealth Toasts
class StealthDemoScreen extends StatefulWidget {
  const StealthDemoScreen({super.key});

  @override
  State<StealthDemoScreen> createState() => _StealthDemoScreenState();
}

class _StealthDemoScreenState extends State<StealthDemoScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _serialController = TextEditingController();
  final _notesController = TextEditingController();
  String? _nameError;
  String? _emailError;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _serialController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _validate() {
    setState(() {
      _nameError = _nameController.text.trim().isEmpty ? 'Name is required' : null;
      _emailError = _emailController.text.trim().isNotEmpty &&
              !_emailController.text.contains('@')
          ? 'Enter a valid email'
          : null;
    });

    if (_nameError != null || _emailError != null) {
      HapticFeedback.heavyImpact();
      Future.delayed(const Duration(milliseconds: 100), () {
        HapticFeedback.heavyImpact();
      });
    } else {
      StealthToast.success(context, 'Validation passed — all fields valid');
    }
  }

  void _showDemoSheet() {
    showGlassSheet(
      context: context,
      title: 'Glass Sheet Demo',
      initialChildSize: 0.5,
      body: StealthFieldScope(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This is a Glass Sheet with ghost inputs inside. The keyboard command rail appears when you focus a field.',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: ObsidianTheme.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            StealthTextField(
              label: 'Project Name',
              prefixIcon: PhosphorIconsLight.folder,
            ),
            const StealthDivider(),
            StealthTextField(
              label: 'Serial Number',
              hintText: 'e.g. SN-2024-XXXX',
              isMonospace: true,
              prefixIcon: PhosphorIconsLight.barcode,
            ),
            const StealthDivider(),
            StealthTextField(
              label: 'Notes',
              maxLines: 3,
              prefixIcon: PhosphorIconsLight.noteBlank,
            ),
          ],
        ),
      ),
      footer: GlassSheetButton(
        label: 'Save Changes',
        onTap: () {
          Navigator.pop(context);
          StealthToast.success(context, 'Changes saved successfully');
        },
      ),
    );
  }

  void _showConfirmSheet() async {
    final confirmed = await showConfirmGlassSheet(
      context: context,
      title: 'Confirm Action',
      message:
          'This will delete the selected item permanently. This action cannot be undone.',
      confirmLabel: 'Delete',
      confirmColor: ObsidianTheme.rose,
    );

    if (mounted) {
      if (confirmed) {
        StealthToast.error(context, 'Item deleted');
      } else {
        StealthToast.info(context, 'Action cancelled');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: StealthFieldScope(
          child: KeyboardCommandRail(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: ListView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
                    children: [
                      // Section: Ghost Inputs
                      _buildSection('GHOST INPUTS', 'Laser Spine • Floating Labels'),
                      const SizedBox(height: 12),

                      StealthTextField(
                        label: 'Full Name',
                        controller: _nameController,
                        prefixIcon: PhosphorIconsLight.user,
                        errorText: _nameError,
                        textInputAction: TextInputAction.next,
                        onChanged: (_) {
                          if (_nameError != null) setState(() => _nameError = null);
                        },
                      ),

                      const StealthDivider(),

                      StealthTextField(
                        label: 'Email Address',
                        controller: _emailController,
                        prefixIcon: PhosphorIconsLight.envelope,
                        keyboardType: TextInputType.emailAddress,
                        errorText: _emailError,
                        textInputAction: TextInputAction.next,
                        onChanged: (_) {
                          if (_emailError != null) setState(() => _emailError = null);
                        },
                      ),

                      const StealthDivider(),

                      StealthTextField(
                        label: 'Serial Number',
                        hintText: 'e.g. SN-2024-XXXX',
                        controller: _serialController,
                        isMonospace: true,
                        prefixIcon: PhosphorIconsLight.barcode,
                        textInputAction: TextInputAction.next,
                      ),

                      const StealthDivider(),

                      StealthTextField(
                        label: 'Notes',
                        hintText: 'Additional comments...',
                        controller: _notesController,
                        prefixIcon: PhosphorIconsLight.noteBlank,
                        maxLines: 3,
                        textInputAction: TextInputAction.done,
                      ),

                      const SizedBox(height: 16),

                      // Validate button
                      GestureDetector(
                        onTap: _validate,
                        child: Container(
                          height: 48,
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            color: Colors.white,
                          ),
                          child: Center(
                            child: Text(
                              'Validate Fields',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.black,
                              ),
                            ),
                          ),
                        ),
                      ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

                      const SizedBox(height: 32),

                      // Section: Glass Sheets
                      _buildSection('GLASS SHEETS', 'Physics-Based Bottom Modals'),
                      const SizedBox(height: 12),

                      _buildActionCard(
                        icon: PhosphorIconsLight.slidersHorizontal,
                        label: 'Standard Glass Sheet',
                        subtitle: 'Header, scrollable body, sticky footer',
                        onTap: _showDemoSheet,
                      ),

                      const SizedBox(height: 8),

                      _buildActionCard(
                        icon: PhosphorIconsLight.warningCircle,
                        label: 'Confirm Glass Sheet',
                        subtitle: 'Replaces AlertDialog for confirmations',
                        color: ObsidianTheme.rose,
                        onTap: _showConfirmSheet,
                      ),

                      const SizedBox(height: 32),

                      // Section: Stealth Toasts
                      _buildSection('STEALTH TOASTS', 'Non-Blocking Capsule Alerts'),
                      const SizedBox(height: 12),

                      Row(
                        children: [
                          Expanded(
                            child: _buildToastButton(
                              'Success',
                              ObsidianTheme.emerald,
                              () => StealthToast.success(context, 'Operation completed'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildToastButton(
                              'Error',
                              ObsidianTheme.rose,
                              () => StealthToast.error(context, 'Something went wrong'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _buildToastButton(
                              'Warning',
                              ObsidianTheme.amber,
                              () => StealthToast.warning(context, 'Low stock warning'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildToastButton(
                              'Info',
                              ObsidianTheme.blue,
                              () => StealthToast.info(context, 'Route updated'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _buildToastButton(
                        'Toast with Action',
                        ObsidianTheme.emerald,
                        () => StealthToast.show(
                          context,
                          message: 'JOB-42 Created',
                          type: ToastType.success,
                          actionLabel: 'View',
                          onAction: () => StealthToast.info(context, 'Navigating...'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Header ─────────────────────────────────────────

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).pop();
            },
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.hoverBg,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: const Center(
                child: Icon(PhosphorIconsLight.arrowLeft,
                    size: 16, color: ObsidianTheme.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Stealth Inputs',
                  style: GoogleFonts.inter(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  'The Ghost & The Rail',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: ObsidianTheme.textMuted,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusFull,
              color: ObsidianTheme.emeraldDim,
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.25)),
            ),
            child: Text(
              'v11.0',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                color: ObsidianTheme.emerald,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  // ── Section Header ─────────────────────────────────

  Widget _buildSection(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 10,
            color: ObsidianTheme.textTertiary,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: GoogleFonts.inter(
            fontSize: 11,
            color: ObsidianTheme.textMuted,
          ),
        ),
      ],
    );
  }

  // ── Action Card ────────────────────────────────────

  Widget _buildActionCard({
    required IconData icon,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
    Color? color,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: ObsidianTheme.surface1,
          border: Border.all(color: ObsidianTheme.border),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusSm,
                color: (color ?? ObsidianTheme.emerald).withValues(alpha: 0.1),
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 16,
                  color: color ?? ObsidianTheme.emerald,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: ObsidianTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              PhosphorIconsLight.caretRight,
              size: 14,
              color: ObsidianTheme.textTertiary,
            ),
          ],
        ),
      ),
    );
  }

  // ── Toast Button ───────────────────────────────────

  Widget _buildToastButton(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        height: 40,
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ),
      ),
    );
  }
}
