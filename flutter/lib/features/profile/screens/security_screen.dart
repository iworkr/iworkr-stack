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

/// Security settings — Create/Update password, biometrics toggle.
///
/// Obsidian aesthetic: matte black, minimal borders, emerald accents.
class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _loading = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSetPassword() async {
    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (newPassword.length < 8) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Password must be at least 8 characters');
      return;
    }
    if (newPassword != confirmPassword) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Passwords do not match');
      return;
    }

    setState(() { _loading = true; _error = null; _success = null; });
    HapticFeedback.mediumImpact();

    try {
      await ref.read(authNotifierProvider.notifier).updatePassword(newPassword);
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() {
          _loading = false;
          _success = 'Password updated successfully';
          _newPasswordController.clear();
          _confirmPasswordController.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _loading = false; _error = e.toString(); });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          children: [
            // Header with back
            Row(
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
                    ),
                    child: const Center(child: Icon(PhosphorIconsRegular.arrowLeft, size: 16, color: ObsidianTheme.textSecondary)),
                  ),
                ),
                const SizedBox(width: 14),
                Text(
                  'Security',
                  style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: ObsidianTheme.textPrimary, letterSpacing: -0.3),
                ),
              ],
            ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

            const SizedBox(height: 28),

            // Password section header
            Text(
              'APP PASSWORD',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
            ).animate().fadeIn(delay: 100.ms, duration: 300.ms),

            const SizedBox(height: 6),

            Text(
              'Create or update your app password for quick login without magic links.',
              style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textMuted),
            ).animate().fadeIn(delay: 150.ms, duration: 300.ms),

            const SizedBox(height: 20),

            // Password form
            GlassCard(
              padding: const EdgeInsets.all(20),
              borderRadius: ObsidianTheme.radiusLg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // New password
                  Text(
                    'New Password',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  _buildPasswordField(
                    controller: _newPasswordController,
                    hint: 'Minimum 8 characters',
                    obscured: _obscureNew,
                    onToggle: () => setState(() => _obscureNew = !_obscureNew),
                  ),

                  const SizedBox(height: 20),

                  // Confirm password
                  Text(
                    'Confirm Password',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  _buildPasswordField(
                    controller: _confirmPasswordController,
                    hint: 'Re-enter password',
                    obscured: _obscureConfirm,
                    onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    onSubmitted: (_) => _handleSetPassword(),
                  ),

                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: ObsidianTheme.roseDim,
                        border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(PhosphorIconsRegular.warning, size: 14, color: ObsidianTheme.rose),
                          const SizedBox(width: 8),
                          Expanded(child: Text(_error!, style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12))),
                        ],
                      ),
                    ),
                  ],

                  if (_success != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: ObsidianTheme.emeraldDim,
                        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(PhosphorIconsBold.check, size: 14, color: ObsidianTheme.emerald),
                          const SizedBox(width: 8),
                          Expanded(child: Text(_success!, style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 12))),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Save button
                  GestureDetector(
                    onTap: _loading ? null : _handleSetPassword,
                    child: AnimatedContainer(
                      duration: ObsidianTheme.fast,
                      width: double.infinity,
                      height: 44,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: _loading ? ObsidianTheme.surface2 : Colors.white,
                      ),
                      child: Center(
                        child: _loading
                            ? SizedBox(
                                width: 20, height: 20,
                                child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald),
                              )
                            : Text(
                                'Update Password',
                                style: GoogleFonts.inter(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 14),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                .moveY(begin: 10, end: 0),

            const SizedBox(height: 28),

            // Biometrics section
            Text(
              'BIOMETRICS',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
            ).animate().fadeIn(delay: 350.ms, duration: 300.ms),

            const SizedBox(height: 12),

            GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              borderRadius: ObsidianTheme.radiusLg,
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: ObsidianTheme.emeraldDim,
                    ),
                    child: const Center(child: Icon(PhosphorIconsRegular.fingerprint, size: 18, color: ObsidianTheme.emerald)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Face ID / Touch ID', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary)),
                        const SizedBox(height: 2),
                        Text('Quick access using biometrics', style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textMuted)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusFull,
                      color: ObsidianTheme.shimmerBase,
                      border: Border.all(color: ObsidianTheme.border),
                    ),
                    child: Text('Soon', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(delay: 400.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
                .moveY(begin: 10, end: 0),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String hint,
    required bool obscured,
    required VoidCallback onToggle,
    ValueChanged<String>? onSubmitted,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscured,
      style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textPrimary, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textDisabled, fontSize: 14),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Icon(PhosphorIconsRegular.lock, size: 16, color: ObsidianTheme.textTertiary),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
        suffixIcon: GestureDetector(
          onTap: onToggle,
          child: Icon(
            obscured ? PhosphorIconsRegular.eye : PhosphorIconsRegular.eyeSlash,
            size: 16, color: ObsidianTheme.textTertiary,
          ),
        ),
        suffixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
      ),
      onSubmitted: onSubmitted,
    );
  }
}
