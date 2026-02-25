import 'dart:async';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/permission_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Invite Onboarding — Token-Based Account Creation ─────
// ═══════════════════════════════════════════════════════════

class InviteOnboardingScreen extends ConsumerStatefulWidget {
  final String token;
  const InviteOnboardingScreen({super.key, required this.token});

  @override
  ConsumerState<InviteOnboardingScreen> createState() => _InviteOnboardingScreenState();
}

class _InviteOnboardingScreenState extends ConsumerState<InviteOnboardingScreen> {
  int _step = 0; // 0=loading, 1=auth, 2=profile, 3=permissions, 4=success, -1=error
  String _error = '';

  // Invite data
  String _email = '';
  String _role = '';
  String _orgName = '';
  String _inviterName = '';

  // Auth fields
  final _passCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscure = true;

  // Profile fields
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _validateToken();
  }

  @override
  void dispose() {
    _passCtrl.dispose();
    _confirmCtrl.dispose();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  // ── Password validation ────────────────────────────────
  bool get _hasLength => _passCtrl.text.length >= 8;
  bool get _hasNumber => RegExp(r'\d').hasMatch(_passCtrl.text);
  bool get _hasSymbol => RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(_passCtrl.text);
  bool get _passwordsMatch => _passCtrl.text == _confirmCtrl.text && _passCtrl.text.isNotEmpty;
  bool get _passwordValid => _hasLength && _hasNumber && _hasSymbol && _passwordsMatch;

  Future<void> _validateToken() async {
    try {
      final result = await SupabaseService.client.rpc('validate_invite_token', params: {
        'p_token': widget.token,
      });

      final data = result as Map<String, dynamic>;

      if (data['valid'] != true) {
        setState(() { _error = data['error'] as String? ?? 'Invalid invitation'; _step = -1; });
        return;
      }

      setState(() {
        _email = data['email'] as String? ?? '';
        _role = data['role'] as String? ?? 'technician';
        _orgName = data['organization_name'] as String? ?? 'your team';
        _inviterName = data['inviter_name'] as String? ?? 'Your team';
      });

      // Check if user is already logged in
      final user = SupabaseService.auth.currentUser;
      if (user != null) {
        await _acceptInvite();
      } else {
        setState(() => _step = 1);
      }
    } catch (e) {
      setState(() { _error = 'Failed to validate invitation.'; _step = -1; });
    }
  }

  Future<void> _createAccount() async {
    if (!_passwordValid) return;
    setState(() => _submitting = true);

    try {
      final res = await SupabaseService.auth.signUp(
        email: _email,
        password: _passCtrl.text,
      );

      if (res.user == null && res.session == null) {
        // User might already exist — try sign in
        await SupabaseService.auth.signInWithPassword(
          email: _email,
          password: _passCtrl.text,
        );
      }

      setState(() { _step = 2; _submitting = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _submitting = false; });
    }
  }

  Future<void> _completeProfile() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);

    try {
      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      await SupabaseService.client.from('profiles').upsert({
        'id': userId,
        'full_name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      });

      await _acceptInvite();
    } catch (e) {
      setState(() { _error = e.toString(); _submitting = false; });
    }
  }

  Future<void> _acceptInvite() async {
    setState(() => _submitting = true);

    try {
      final session = SupabaseService.auth.currentSession;
      if (session == null) throw Exception('No active session');

      final res = await SupabaseService.client.functions.invoke(
        'accept-invite',
        body: {'token': widget.token},
      );

      if (res.status != 200) {
        final data = res.data as Map<String, dynamic>?;
        throw Exception(data?['error'] ?? 'Failed to accept invite');
      }

      // If technician on mobile, run permission prompts
      final isTech = _role == 'technician' || _role == 'apprentice' || _role == 'subcontractor';
      if (isTech) {
        setState(() { _step = 3; _submitting = false; });
      } else {
        setState(() { _step = 4; _submitting = false; });
        _navigateToDashboard();
      }
    } catch (e) {
      setState(() { _error = e.toString(); _step = -1; _submitting = false; });
    }
  }

  Future<void> _runPermissions() async {
    if (!mounted) return;

    await PermissionService.instance.requestLocationWhenInUse(context);
    if (!mounted) return;

    // Background location is critical for GPS telemetry during en_route/on_site
    await PermissionService.instance.requestLocationAlways(context);
    if (!mounted) return;

    await PermissionService.instance.requestCamera(context);
    if (!mounted) return;

    await PermissionService.instance.requestNotifications(context);
    if (!mounted) return;

    setState(() => _step = 4);
    _navigateToDashboard();
  }

  void _navigateToDashboard() {
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) context.go('/');
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: AnimatedSwitcher(
              duration: ObsidianTheme.medium,
              child: _buildStep(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep() {
    return switch (_step) {
      0 => _buildLoading(),
      1 => _buildAuth(),
      2 => _buildProfile(),
      3 => _buildPermissions(),
      4 => _buildSuccess(),
      _ => _buildError(),
    };
  }

  // ── Loading ────────────────────────────────────────────

  Widget _buildLoading() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('loading'),
      mainAxisSize: MainAxisSize.min,
      children: [
        const CupertinoActivityIndicator(color: ObsidianTheme.emerald, radius: 14),
        const SizedBox(height: 16),
        Text('Verifying invitation...', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
      ],
    );
  }

  // ── Error ──────────────────────────────────────────────

  Widget _buildError() {
    final c = context.iColors;
    return _GlassCard(
      key: const ValueKey('error'),
      child: Column(
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: ObsidianTheme.roseDim,
              border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
            ),
            child: const Icon(PhosphorIconsBold.lockSimple, size: 24, color: ObsidianTheme.rose),
          ),
          const SizedBox(height: 20),
          Text('Invitation Invalid', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 8),
          Text(
            _error.isNotEmpty ? _error : 'This invitation has expired or has already been used. Please ask your administrator to send a new one.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 13, color: c.textMuted, height: 1.6),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => context.go('/'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: c.border),
              ),
              child: Text('Return Home', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.95, 0.95), duration: 400.ms);
  }

  // ── Step 1: Auth ───────────────────────────────────────

  Widget _buildAuth() {
    final c = context.iColors;
    return _GlassCard(
      key: const ValueKey('auth'),
      child: Column(
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: ObsidianTheme.emeraldDim,
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
            ),
            child: const Icon(PhosphorIconsBold.checkCircle, size: 24, color: ObsidianTheme.emerald),
          ),
          const SizedBox(height: 16),
          Text('Welcome to $_orgName', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 6),
          Text(
            '$_inviterName invited you as ${_role.replaceAll('_', ' ')}',
            style: GoogleFonts.inter(fontSize: 13, color: c.textMuted),
          ),
          const SizedBox(height: 24),

          // Email (read-only)
          _label('EMAIL'),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: c.surfaceSecondary,
              border: Border.all(color: c.border),
            ),
            child: Text(_email, style: GoogleFonts.inter(fontSize: 14, color: c.textMuted)),
          ),
          const SizedBox(height: 14),

          // Password
          _label('PASSWORD'),
          _stealthInput(_passCtrl, 'Create a secure password', obscure: _obscure, suffixIcon: GestureDetector(
            onTap: () => setState(() => _obscure = !_obscure),
            child: Icon(_obscure ? PhosphorIconsLight.eye : PhosphorIconsLight.eyeSlash, size: 18, color: c.textTertiary),
          )),
          const SizedBox(height: 10),

          _label('CONFIRM PASSWORD'),
          _stealthInput(_confirmCtrl, 'Confirm password', obscure: true),
          const SizedBox(height: 12),

          // Requirements
          _req(_hasLength, '8+ characters'),
          _req(_hasNumber, 'Contains a number'),
          _req(_hasSymbol, 'Contains a symbol'),
          _req(_passwordsMatch, 'Passwords match'),

          if (_error.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_error, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose)),
          ],

          const SizedBox(height: 24),
          _cta('Create Account', _passwordValid ? _createAccount : null),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.05, duration: 400.ms, curve: Curves.easeOutQuart);
  }

  // ── Step 2: Profile ────────────────────────────────────

  Widget _buildProfile() {
    final c = context.iColors;
    return _GlassCard(
      key: const ValueKey('profile'),
      child: Column(
        children: [
          Text('Complete Your Profile', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 6),
          Text('Just a few details so your team can find you.', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
          const SizedBox(height: 24),

          _label('FULL NAME'),
          _stealthInput(_nameCtrl, 'Your full name'),
          const SizedBox(height: 14),

          _label('PHONE NUMBER'),
          _stealthInput(_phoneCtrl, '+1 234 567 890 (optional)', keyboardType: TextInputType.phone),

          const SizedBox(height: 24),
          _cta('Continue', _nameCtrl.text.trim().isNotEmpty ? _completeProfile : null),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideX(begin: 0.05, duration: 400.ms, curve: Curves.easeOutQuart);
  }

  // ── Step 3: Permissions ────────────────────────────────

  Widget _buildPermissions() {
    final c = context.iColors;
    return _GlassCard(
      key: const ValueKey('permissions'),
      child: Column(
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: ObsidianTheme.emeraldDim,
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
            ),
            child: const Icon(PhosphorIconsBold.shieldCheck, size: 24, color: ObsidianTheme.emerald),
          ),
          const SizedBox(height: 16),
          Text('Device Setup', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 6),
          Text(
            'To dispatch you efficiently, we need a few permissions.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 13, color: c.textMuted, height: 1.5),
          ),
          const SizedBox(height: 16),
          _permRow(PhosphorIconsLight.mapPin, 'Location', 'Track travel time for payroll accuracy'),
          _permRow(PhosphorIconsLight.camera, 'Camera', 'Capture job evidence and scan barcodes'),
          _permRow(PhosphorIconsLight.bell, 'Notifications', 'Receive job assignments and reminders'),
          const SizedBox(height: 20),
          _cta('Set Up Permissions', _runPermissions),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () {
              setState(() => _step = 4);
              _navigateToDashboard();
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('Skip for now', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  // ── Step 4: Success ────────────────────────────────────

  Widget _buildSuccess() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('success'),
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emeraldDim,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
          ),
          child: const Icon(PhosphorIconsBold.checkCircle, size: 32, color: ObsidianTheme.emerald),
        ).animate().scale(begin: const Offset(0.5, 0.5), duration: 500.ms, curve: Curves.elasticOut),
        const SizedBox(height: 20),
        Text("You're In", style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
        const SizedBox(height: 8),
        Text('Redirecting to your dashboard...', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
        const SizedBox(height: 20),
        CupertinoActivityIndicator(color: c.textTertiary, radius: 10),
      ],
    ).animate().fadeIn(duration: 400.ms);
  }

  // ── Shared Widgets ─────────────────────────────────────

  Widget _label(String text) {
    final c = context.iColors;
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 6, left: 2),
        child: Text(text, style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
      ),
    );
  }

  Widget _stealthInput(
    TextEditingController ctrl,
    String hint, {
    bool obscure = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
  }) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: c.surfaceSecondary,
        border: Border.all(color: c.border),
      ),
      child: TextField(
        controller: ctrl,
        obscureText: obscure,
        keyboardType: keyboardType,
        onChanged: (_) => setState(() {}),
        style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
        cursorColor: ObsidianTheme.emerald,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          suffixIcon: suffixIcon != null ? Padding(padding: const EdgeInsets.only(right: 10), child: suffixIcon) : null,
          suffixIconConstraints: const BoxConstraints(maxHeight: 24),
        ),
      ),
    );
  }

  Widget _req(bool met, String text) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        children: [
          Container(
            width: 4, height: 4,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: met ? ObsidianTheme.emerald : c.textTertiary,
            ),
          ),
          const SizedBox(width: 8),
          Text(text, style: GoogleFonts.inter(fontSize: 11, color: met ? ObsidianTheme.emerald : c.textTertiary)),
        ],
      ),
    );
  }

  Widget _permRow(IconData icon, String title, String desc) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: ObsidianTheme.emerald.withValues(alpha: 0.08),
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
            ),
            child: Icon(icon, size: 16, color: ObsidianTheme.emerald),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: c.textPrimary)),
                Text(desc, style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _cta(String label, VoidCallback? onTap) {
    return GestureDetector(
      onTap: _submitting ? null : () {
        HapticFeedback.mediumImpact();
        onTap?.call();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: onTap != null && !_submitting ? Colors.white : Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: _submitting
              ? const CupertinoActivityIndicator(color: Colors.black)
              : Text(label, style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: onTap != null ? Colors.black : Colors.white.withValues(alpha: 0.3),
                )),
        ),
      ),
    );
  }
}

// ── Glass Card Container ─────────────────────────────────

class _GlassCard extends StatelessWidget {
  final Widget child;
  const _GlassCard({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: child,
    );
  }
}
