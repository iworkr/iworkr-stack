import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/features/auth/widgets/otp_input.dart';

// ── Auth Modes ────────────────────────────────────────
enum _AuthTab { email, phone }

enum _AuthMode {
  choice,         // Landing: Google + method switcher
  emailPassword,  // Email + Password
  magicLinkSent,  // Awaiting magic link
  phoneEntry,     // Phone number input
  phoneOtp,       // OTP verification
  authenticating, // OAuth in progress
  success,        // Auth succeeded — zoom transition
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();

  _AuthTab _tab = _AuthTab.email;
  _AuthMode _mode = _AuthMode.choice;
  String? _error;
  bool _loading = false;
  bool _obscurePassword = true;
  bool _showSuccess = false;

  @override
  void initState() {
    super.initState();
    SupabaseService.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.signedIn && mounted) {
        _handleAuthSuccess();
      }
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _handleAuthSuccess() {
    HapticFeedback.mediumImpact();
    setState(() {
      _showSuccess = true;
      _mode = _AuthMode.success;
    });

    Future.delayed(const Duration(milliseconds: 800), () async {
      if (!mounted) return;
      // Check if user needs onboarding
      final profile = await ref.read(profileProvider.future);
      if (!mounted) return;
      if (profile != null && !profile.onboardingCompleted) {
        final orgData = await ref.read(organizationProvider.future);
        if (!mounted) return;
        if (orgData == null) {
          context.go('/onboarding');
          return;
        }
      }
      context.go('/');
    });
  }

  // ── Auth Handlers ─────────────────────────────────────

  Future<void> _handleGoogleAuth() async {
    setState(() { _loading = true; _error = null; _mode = _AuthMode.authenticating; });
    HapticFeedback.mediumImpact();
    try {
      await ref.read(authNotifierProvider.notifier).signInWithGoogle();
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _error = _parseError(e); _mode = _AuthMode.choice; _loading = false; });
      }
    }
  }

  Future<void> _handlePasswordLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || !email.contains('@')) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    if (password.isEmpty) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Enter your password');
      return;
    }

    setState(() { _loading = true; _error = null; });
    HapticFeedback.mediumImpact();

    try {
      await ref.read(authNotifierProvider.notifier).signInWithPassword(
        email: email,
        password: password,
      );
      // Auth state listener will handle navigation
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _error = _parseError(e); _loading = false; });
      }
    }
  }

  Future<void> _handleMagicLink() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Enter a valid email address');
      return;
    }

    setState(() { _loading = true; _error = null; });
    HapticFeedback.mediumImpact();

    try {
      await ref.read(authNotifierProvider.notifier).sendMagicLink(email);
      if (mounted) {
        setState(() { _mode = _AuthMode.magicLinkSent; _loading = false; });
        HapticFeedback.heavyImpact();
      }
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _error = _parseError(e); _loading = false; });
      }
    }
  }

  Future<void> _handleSendPhoneOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 8) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Enter a valid phone number');
      return;
    }

    setState(() { _loading = true; _error = null; });
    HapticFeedback.mediumImpact();

    try {
      await ref.read(authNotifierProvider.notifier).sendPhoneOtp(phone);
      if (mounted) {
        setState(() { _mode = _AuthMode.phoneOtp; _loading = false; });
        HapticFeedback.heavyImpact();
      }
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _error = _parseError(e); _loading = false; });
      }
    }
  }

  Future<void> _handleVerifyPhoneOtp(String code) async {
    setState(() { _loading = true; _error = null; });
    HapticFeedback.mediumImpact();

    try {
      await ref.read(authNotifierProvider.notifier).verifyPhoneOtp(
        phone: _phoneController.text.trim(),
        token: code,
      );
      // Auth state listener will handle navigation
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _error = _parseError(e); _loading = false; });
      }
    }
  }

  String _parseError(dynamic e) {
    if (e is AuthException) return e.message;
    final msg = e.toString();
    if (msg.contains('Invalid login credentials')) return 'Invalid email or password';
    if (msg.contains('User not found')) return 'No account found with this email';
    if (msg.contains('rate limit')) return 'Too many attempts. Please wait.';
    return 'Authentication failed. Please try again.';
  }

  // ── Build ─────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: AnimatedScale(
        scale: _showSuccess ? 1.15 : 1.0,
        duration: const Duration(milliseconds: 600),
        curve: const Cubic(0.16, 1, 0.3, 1),
        child: AnimatedOpacity(
          opacity: _showSuccess ? 0.0 : 1.0,
          duration: const Duration(milliseconds: 500),
          child: Stack(
            children: [
              // Noise grain
              Positioned.fill(child: CustomPaint(painter: _NoisePainter())),

              // Vignette
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 0.9,
                      colors: [Colors.transparent, Colors.black.withValues(alpha: 0.7)],
                      stops: const [0.3, 1.0],
                    ),
                  ),
                ),
              ),

              // Grid lines
              Positioned.fill(child: CustomPaint(painter: _GridPainter())),

              // Aurora gradient at bottom (PRD: Emerald/Zinc at bottom 10%, opacity 10%)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: MediaQuery.of(context).size.height * 0.15,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        ObsidianTheme.emerald.withValues(alpha: 0.06),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),

              // Main content
              SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 384),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 400),
                        switchInCurve: const Cubic(0.16, 1, 0.3, 1),
                        switchOutCurve: Curves.easeIn,
                        transitionBuilder: (child, animation) {
                          return FadeTransition(
                            opacity: animation,
                            child: SlideTransition(
                              position: Tween(
                                begin: const Offset(0, 0.02),
                                end: Offset.zero,
                              ).animate(animation),
                              child: child,
                            ),
                          );
                        },
                        child: _buildCurrentMode(),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentMode() {
    switch (_mode) {
      case _AuthMode.choice:
        return _buildChoiceMode();
      case _AuthMode.emailPassword:
        return _buildEmailPasswordMode();
      case _AuthMode.magicLinkSent:
        return _buildMagicLinkSentMode();
      case _AuthMode.phoneEntry:
        return _buildPhoneEntryMode();
      case _AuthMode.phoneOtp:
        return _buildPhoneOtpMode();
      case _AuthMode.authenticating:
        return _buildAuthenticatingMode();
      case _AuthMode.success:
        return _buildSuccessMode();
    }
  }

  // ── Choice Mode (Landing) ─────────────────────────────

  Widget _buildChoiceMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('choice'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildLogo(),
        const SizedBox(height: 14),

        Text(
          'Sign in to iWorkr',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w500,
            color: c.textPrimary,
            letterSpacing: -0.3,
          ),
        ).animate().fadeIn(delay: 350.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        const SizedBox(height: 6),

        Text(
          'Your field operating system',
          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
        ).animate().fadeIn(delay: 400.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        const SizedBox(height: 36),

        // Google
        _AuthButton(
          key: const Key('btn_auth_google'),
          onTap: _handleGoogleAuth,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 18, height: 18,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(3), color: Colors.white),
                child: Center(child: Text('G', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black))),
              ),
              const SizedBox(width: 12),
              Text('Continue with Google', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary)),
            ],
          ),
        ).animate().fadeIn(delay: 500.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)).moveY(begin: 8, end: 0),

        const SizedBox(height: 14),

        // Divider
        Row(
          children: [
            Expanded(child: Container(height: 1, color: c.border)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('or', style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
            ),
            Expanded(child: Container(height: 1, color: c.border)),
          ],
        ).animate().fadeIn(delay: 580.ms, duration: 300.ms),

        const SizedBox(height: 14),

        // Method Switcher: [ Email ] [ Phone ]
        _buildMethodSwitcher()
            .animate().fadeIn(delay: 620.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        const SizedBox(height: 14),

        // Continue button (Email vs Phone)
        _AuthButton(
          key: Key(_tab == _AuthTab.email ? 'btn_auth_email' : 'btn_auth_phone'),
          filled: false,
          onTap: () {
            HapticFeedback.lightImpact();
            setState(() {
              _error = null;
              if (_tab == _AuthTab.email) {
                _mode = _AuthMode.emailPassword;
              } else {
                _mode = _AuthMode.phoneEntry;
              }
            });
          },
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _tab == _AuthTab.email ? PhosphorIconsLight.envelope : PhosphorIconsLight.phone,
                size: 16, color: c.textSecondary,
              ),
              const SizedBox(width: 12),
              Text(
                _tab == _AuthTab.email ? 'Continue with Email' : 'Continue with Phone',
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary),
              ),
            ],
          ),
        ).animate().fadeIn(delay: 700.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)).moveY(begin: 8, end: 0),

        if (_error != null) _buildError(),

        const SizedBox(height: 48),
        _buildVersionLabel(),
      ],
    );
  }

  // ── Method Switcher (Glass Toggle) ───────────────────

  Widget _buildMethodSwitcher() {
    final c = context.iColors;
    return Container(
      height: 36,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.shimmerBase,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          _buildTabPill('Email', _AuthTab.email, const Key('tab_auth_email')),
          _buildTabPill('Phone', _AuthTab.phone, const Key('tab_auth_phone')),
        ],
      ),
    );
  }

  Widget _buildTabPill(String label, _AuthTab tab, Key key) {
    final c = context.iColors;
    final isActive = _tab == tab;
    return Expanded(
      key: key,
      child: GestureDetector(
        onTap: () {
          if (_tab != tab) {
            HapticFeedback.lightImpact();
            setState(() { _tab = tab; _error = null; });
          }
        },
        child: AnimatedContainer(
          duration: ObsidianTheme.fast,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(5),
            color: isActive ? c.surfaceSecondary : Colors.transparent,
            border: Border.all(
              color: isActive ? c.borderMedium : Colors.transparent,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w500 : FontWeight.w400,
                color: isActive ? c.textPrimary : c.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Email + Password Mode ─────────────────────────────

  Widget _buildEmailPasswordMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('email-password'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildLogoSmall(),
        const SizedBox(height: 24),

        Text(
          'Sign in with Email',
          style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w500, color: c.textPrimary, letterSpacing: -0.3),
        ).animate().fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        const SizedBox(height: 6),

        Text(
          'Enter your credentials to authenticate.',
          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 80.ms, duration: 400.ms),

        const SizedBox(height: 28),

        // Email input
        TextField(
          key: const Key('input_email'),
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          autofocus: true,
          style: GoogleFonts.jetBrainsMono(color: c.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'you@company.com',
            hintStyle: GoogleFonts.jetBrainsMono(color: c.textDisabled, fontSize: 14),
            prefixIcon: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Icon(PhosphorIconsLight.envelope, size: 16, color: c.textTertiary),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
          ),
          onSubmitted: (_) => FocusScope.of(context).nextFocus(),
        ).animate().fadeIn(delay: 150.ms, duration: 400.ms),

        const SizedBox(height: 16),

        // Password input
        TextField(
          key: const Key('input_password'),
          controller: _passwordController,
          obscureText: _obscurePassword,
          style: GoogleFonts.jetBrainsMono(color: c.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Password',
            hintStyle: GoogleFonts.jetBrainsMono(color: c.textDisabled, fontSize: 14),
            prefixIcon: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Icon(PhosphorIconsLight.lock, size: 16, color: c.textTertiary),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
            suffixIcon: GestureDetector(
              onTap: () => setState(() => _obscurePassword = !_obscurePassword),
              child: Icon(
                _obscurePassword ? PhosphorIconsLight.eye : PhosphorIconsLight.eyeSlash,
                size: 16,
                color: c.textTertiary,
              ),
            ),
            suffixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
          ),
          onSubmitted: (_) => _handlePasswordLogin(),
        ).animate().fadeIn(delay: 220.ms, duration: 400.ms),

        if (_error != null) _buildError(),

        const SizedBox(height: 24),

        // Authenticate button
        SizedBox(
          width: double.infinity,
          height: 44,
          child: _AuthButton(
            key: const Key('btn_submit_login'),
            onTap: _loading ? () {} : _handlePasswordLogin,
            filled: true,
            solidFill: true,
            child: _loading
                ? _buildPulseLoader()
                : Text(
                    'Authenticate',
                    style: GoogleFonts.inter(
                      color: Colors.black,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
          ),
        ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

        const SizedBox(height: 16),

        // Forgot Password
        GestureDetector(
          key: const Key('link_forgot_password'),
          onTap: () async {
            final email = _emailController.text.trim();
            if (email.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Enter your email address first')),
              );
              return;
            }
            try {
              await Supabase.instance.client.auth.resetPasswordForEmail(email);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Password reset email sent. Check your inbox.')),
                );
              }
            } catch (e) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to send reset email: $e')),
                );
              }
            }
          },
          child: Text(
            'Forgot password?',
            style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary, fontWeight: FontWeight.w500),
          ),
        ).animate().fadeIn(delay: 340.ms, duration: 300.ms),

        const SizedBox(height: 8),

        // Use Magic Link instead
        GestureDetector(
          onTap: _loading ? null : _handleMagicLink,
          child: Text(
            'Use Magic Link instead',
            style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500),
          ),
        ).animate().fadeIn(delay: 380.ms, duration: 300.ms),

        const SizedBox(height: 20),

        _buildBackButton(),

        const SizedBox(height: 48),
        _buildVersionLabel(),
      ],
    );
  }

  // ── Phone Entry Mode ──────────────────────────────────

  Widget _buildPhoneEntryMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('phone-entry'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildLogoSmall(),
        const SizedBox(height: 24),

        Text(
          'Sign in with Phone',
          style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w500, color: c.textPrimary, letterSpacing: -0.3),
        ).animate().fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        const SizedBox(height: 6),

        Text(
          "We'll send a one-time code to verify.",
          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 80.ms, duration: 400.ms),

        const SizedBox(height: 28),

        // Phone input
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          autocorrect: false,
          autofocus: true,
          style: GoogleFonts.jetBrainsMono(color: c.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: '+61 4XX XXX XXX',
            hintStyle: GoogleFonts.jetBrainsMono(color: c.textDisabled, fontSize: 14),
            prefixIcon: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Icon(PhosphorIconsLight.phone, size: 16, color: c.textTertiary),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
          ),
          onSubmitted: (_) => _handleSendPhoneOtp(),
        ).animate().fadeIn(delay: 150.ms, duration: 400.ms),

        if (_error != null) _buildError(),

        const SizedBox(height: 24),

        // Send Code button
        SizedBox(
          width: double.infinity,
          height: 44,
          child: _AuthButton(
            onTap: _loading ? () {} : _handleSendPhoneOtp,
            filled: true,
            solidFill: true,
            child: _loading
                ? _buildPulseLoader()
                : Text(
                    'Send Code',
                    style: GoogleFonts.inter(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
          ),
        ).animate().fadeIn(delay: 250.ms, duration: 400.ms),

        const SizedBox(height: 20),

        _buildBackButton(),

        const SizedBox(height: 48),
        _buildVersionLabel(),
      ],
    );
  }

  // ── Phone OTP Mode ────────────────────────────────────

  Widget _buildPhoneOtpMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('phone-otp'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildLogoSmall(),
        const SizedBox(height: 24),

        Text(
          'Enter verification code',
          style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w500, color: c.textPrimary, letterSpacing: -0.3),
        ).animate().fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        const SizedBox(height: 6),

        Text(
          'We sent a 6-digit code to',
          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 80.ms, duration: 400.ms),

        const SizedBox(height: 8),

        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusMd,
            color: c.surface,
            border: Border.all(color: c.border),
          ),
          child: Text(
            _phoneController.text.trim(),
            style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500),
          ),
        ).animate().fadeIn(delay: 150.ms, duration: 400.ms),

        const SizedBox(height: 28),

        // OTP Input
        OtpInput(
          length: 6,
          onCompleted: _handleVerifyPhoneOtp,
          hasError: _error != null,
        ).animate().fadeIn(delay: 250.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

        if (_error != null) _buildError(),

        if (_loading)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: _buildPulseLoader(),
          ),

        const SizedBox(height: 28),

        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); _handleSendPhoneOtp(); },
              child: Text('Resend', style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500)),
            ),
            const SizedBox(width: 24),
            Container(width: 1, height: 14, color: c.border),
            const SizedBox(width: 24),
            GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); setState(() { _mode = _AuthMode.phoneEntry; _error = null; }); },
              child: Text('Change number', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
            ),
          ],
        ).animate().fadeIn(delay: 350.ms, duration: 400.ms),

        const SizedBox(height: 48),
        _buildVersionLabel(),
      ],
    );
  }

  // ── Magic Link Sent Mode ──────────────────────────────

  Widget _buildMagicLinkSentMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('magic-sent'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 88, height: 88,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.15)),
                ),
              )
                  .animate(onPlay: (ctrl) => ctrl.repeat())
                  .scaleXY(begin: 0.9, end: 1.6, duration: 2000.ms, curve: Curves.easeOut)
                  .fadeOut(duration: 2000.ms),

              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emeraldDim,
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                ),
                child: const Icon(PhosphorIconsLight.paperPlaneTilt, size: 26, color: ObsidianTheme.emerald),
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
            .scaleXY(begin: 0.7, end: 1, duration: 600.ms, curve: Curves.easeOutBack),

        const SizedBox(height: 28),

        Text(
          'Check your email',
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
        ).animate().fadeIn(delay: 200.ms, duration: 500.ms),

        const SizedBox(height: 10),

        Text('We sent a magic link to', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary), textAlign: TextAlign.center)
            .animate().fadeIn(delay: 280.ms, duration: 400.ms),

        const SizedBox(height: 8),

        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusMd,
            color: c.surface,
            border: Border.all(color: c.border),
          ),
          child: Text(
            _emailController.text.trim(),
            style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textPrimary, fontWeight: FontWeight.w500),
          ),
        ).animate().fadeIn(delay: 350.ms, duration: 400.ms),

        const SizedBox(height: 8),

        Text(
          'Tap the link in the email to sign in.',
          style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 420.ms, duration: 400.ms),

        const SizedBox(height: 36),

        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); _handleMagicLink(); },
              child: Text('Resend', style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500)),
            ),
            const SizedBox(width: 24),
            Container(width: 1, height: 14, color: c.border),
            const SizedBox(width: 24),
            GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); setState(() { _mode = _AuthMode.choice; _error = null; }); },
              child: Text('Try another method', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
            ),
          ],
        ).animate().fadeIn(delay: 500.ms, duration: 400.ms),

        const SizedBox(height: 48),
        _buildVersionLabel(),
      ],
    );
  }

  // ── Authenticating Mode (OAuth) ───────────────────────

  Widget _buildAuthenticatingMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('authenticating'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 64, height: 64,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: c.border, width: 1),
                ),
              )
                  .animate(onPlay: (ctrl) => ctrl.repeat())
                  .scaleXY(begin: 0.8, end: 2, duration: 2000.ms, curve: Curves.easeOut)
                  .fadeOut(duration: 2000.ms),

              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3), width: 1.5),
                ),
              )
                  .animate(onPlay: (ctrl) => ctrl.repeat())
                  .rotate(duration: 1800.ms),

              Image.asset('assets/logos/logo-dark-streamline.png', width: 20, height: 20),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text('Authenticating...', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w500, color: c.textSecondary))
            .animate().fadeIn(delay: 200.ms, duration: 400.ms),
        const SizedBox(height: 6),
        Text('Complete sign-in in your browser', style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary))
            .animate().fadeIn(delay: 300.ms, duration: 400.ms),
        const SizedBox(height: 32),
        GestureDetector(
          onTap: () { HapticFeedback.lightImpact(); setState(() { _mode = _AuthMode.choice; _loading = false; _error = null; }); },
          child: Text('Cancel', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
        ).animate().fadeIn(delay: 500.ms, duration: 400.ms),
      ],
    );
  }

  // ── Success Mode ──────────────────────────────────────

  Widget _buildSuccessMode() {
    final c = context.iColors;
    return Column(
      key: const ValueKey('success'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emeraldDim,
            border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
          ),
          child: const Icon(PhosphorIconsBold.check, size: 28, color: ObsidianTheme.emerald),
        )
            .animate()
            .scaleXY(begin: 0.5, end: 1, duration: 400.ms, curve: Curves.easeOutBack)
            .fadeIn(duration: 300.ms),
        const SizedBox(height: 20),
        Text('Welcome back', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary))
            .animate().fadeIn(delay: 200.ms, duration: 400.ms),
      ],
    );
  }

  // ── Shared Widgets ────────────────────────────────────

  Widget _buildLogo() {
    return Column(
      children: [
        Image.asset('assets/logos/logo-dark-streamline.png', width: 56, height: 56)
            .animate()
            .fadeIn(duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
            .scaleXY(begin: 0.8, end: 1, duration: 600.ms, curve: Curves.easeOutBack),
        const SizedBox(height: 20),
        Image.asset('assets/logos/logo-dark-full.png', width: 120, fit: BoxFit.contain)
            .animate().fadeIn(delay: 200.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)),
      ],
    );
  }

  Widget _buildLogoSmall() {
    return Image.asset('assets/logos/logo-dark-streamline.png', width: 40, height: 40)
        .animate().fadeIn(duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }

  Widget _buildPulseLoader() {
    return SizedBox(
      width: 20, height: 20,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 18, height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3), width: 1.5),
            ),
          )
              .animate(onPlay: (c) => c.repeat())
              .scaleXY(begin: 0.8, end: 1.5, duration: 1200.ms, curve: Curves.easeOut)
              .fadeOut(duration: 1200.ms),
          Container(
            width: 8, height: 8,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: ObsidianTheme.emerald),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: ObsidianTheme.roseDim,
          border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Icon(PhosphorIconsLight.warning, size: 14, color: ObsidianTheme.rose),
            const SizedBox(width: 8),
            Expanded(child: Text(_error!, style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12))),
          ],
        ),
      ),
    ).animate().fadeIn().shake(hz: 3, offset: const Offset(4, 0));
  }

  Widget _buildBackButton() {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() { _mode = _AuthMode.choice; _error = null; });
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(PhosphorIconsLight.arrowLeft, size: 14, color: c.textTertiary),
          const SizedBox(width: 6),
          Text('All sign in options', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
        ],
      ),
    ).animate().fadeIn(delay: 350.ms, duration: 300.ms);
  }

  Widget _buildVersionLabel() {
    final c = context.iColors;
    return Text(
      'v3.0.0',
      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
    ).animate().fadeIn(delay: 700.ms, duration: 400.ms);
  }
}

// ── Auth Button ───────────────────────────────────────

class _AuthButton extends StatefulWidget {
  final VoidCallback onTap;
  final Widget child;
  final bool filled;
  final bool solidFill;
  const _AuthButton({super.key, required this.onTap, required this.child, this.filled = true, this.solidFill = false});

  @override
  State<_AuthButton> createState() => _AuthButtonState();
}

class _AuthButtonState extends State<_AuthButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        width: double.infinity,
        height: 44,
        transform: _pressed ? Matrix4.diagonal3Values(0.98, 0.98, 1) : Matrix4.identity(),
        transformAlignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          border: Border.all(
            color: _pressed ? c.borderHover : c.borderMedium,
          ),
          color: widget.solidFill
              ? (_pressed ? const Color(0xFFE0E0E0) : Colors.white)
              : widget.filled
                  ? c.activeBg
                  : Colors.transparent,
        ),
        child: Center(child: widget.child),
      ),
    );
  }
}

// ── Background Painters ─────────────────────────────────

class _NoisePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.015);
    final random = Random(42);
    for (int i = 0; i < 2000; i++) {
      final x = random.nextDouble() * size.width;
      final y = random.nextDouble() * size.height;
      canvas.drawCircle(Offset(x, y), 0.5, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.02)
      ..strokeWidth = 0.5;
    const spacing = 80.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
