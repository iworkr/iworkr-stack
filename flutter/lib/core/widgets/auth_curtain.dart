import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/biometric_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// The Airlock — cold start biometric lock screen & privacy curtain.
///
/// Wraps the entire app via MaterialApp.builder.
/// - Cold start: full lock screen with breathing logo + biometric prompt
/// - Resume: blur curtain with 30s grace period
/// - PIN fallback after 3 biometric failures
class AuthCurtain extends StatefulWidget {
  final Widget child;
  const AuthCurtain({super.key, required this.child});

  @override
  State<AuthCurtain> createState() => _AuthCurtainState();
}

class _AuthCurtainState extends State<AuthCurtain> with WidgetsBindingObserver {
  bool _coldStartLocked = true;
  bool _resumeLocked = false;
  bool _coldStartResolved = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initColdStart();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _initColdStart() async {
    final isLoggedIn = SupabaseService.auth.currentUser != null;
    if (!isLoggedIn) {
      if (mounted) setState(() { _coldStartLocked = false; _coldStartResolved = true; });
      return;
    }

    final appLockEnabled = await BiometricService.isAppLockEnabled;
    if (!appLockEnabled) {
      if (mounted) setState(() { _coldStartLocked = false; _coldStartResolved = true; });
      return;
    }

    if (mounted) setState(() => _coldStartResolved = true);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      _onPause();
    } else if (state == AppLifecycleState.resumed) {
      _onResume();
    }
  }

  Future<void> _onPause() async {
    await BiometricService.recordBackground();
    final appLockEnabled = await BiometricService.isAppLockEnabled;
    if (appLockEnabled && mounted) {
      setState(() => _resumeLocked = true);
    }
  }

  Future<void> _onResume() async {
    if (!_resumeLocked) return;

    final withinGrace = await BiometricService.isWithinGracePeriod();
    if (withinGrace) {
      if (mounted) setState(() => _resumeLocked = false);
      return;
    }
    // Hard lock — the AirlockOverlay will handle auth
  }

  void _onUnlocked() {
    HapticFeedback.heavyImpact();
    if (mounted) {
      setState(() {
        _coldStartLocked = false;
        _resumeLocked = false;
      });
    }
  }

  bool get _showAirlock => _coldStartLocked || _resumeLocked;

  @override
  Widget build(BuildContext context) {
    if (!_coldStartResolved) {
      return const _BootSplash();
    }

    return Stack(
      children: [
        // App content — scale in on unlock
        AnimatedScale(
          scale: _showAirlock ? 0.94 : 1.0,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          child: AnimatedOpacity(
            opacity: _showAirlock ? 0.0 : 1.0,
            duration: const Duration(milliseconds: 200),
            child: widget.child,
          ),
        ),

        // Airlock overlay
        if (_showAirlock)
          _AirlockOverlay(
            isColdStart: _coldStartLocked,
            onUnlocked: _onUnlocked,
          ),
      ],
    );
  }
}

/// Minimal boot splash shown while checking lock state.
class _BootSplash extends StatelessWidget {
  const _BootSplash();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      child: Center(
        child: Image.asset(
          'assets/logos/icon.png',
          width: 48,
          height: 48,
          opacity: const AlwaysStoppedAnimation(0.6),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE AIRLOCK OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

class _AirlockOverlay extends StatefulWidget {
  final bool isColdStart;
  final VoidCallback onUnlocked;

  const _AirlockOverlay({
    required this.isColdStart,
    required this.onUnlocked,
  });

  @override
  State<_AirlockOverlay> createState() => _AirlockOverlayState();
}

class _AirlockOverlayState extends State<_AirlockOverlay>
    with TickerProviderStateMixin {
  late AnimationController _breathe;
  late AnimationController _scanLine;
  late AnimationController _glyphPulse;
  late AnimationController _unlockCtrl;

  _GlyphState _glyphState = _GlyphState.idle;
  int _failCount = 0;
  bool _showPin = false;
  bool _unlocking = false;
  String _pinEntry = '';
  String? _pinError;

  @override
  void initState() {
    super.initState();
    _breathe = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);

    _scanLine = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );

    _glyphPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _unlockCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );

    // Auto-trigger biometric on cold start
    Future.delayed(const Duration(milliseconds: 600), _attemptBiometric);
  }

  @override
  void dispose() {
    _breathe.dispose();
    _scanLine.dispose();
    _glyphPulse.dispose();
    _unlockCtrl.dispose();
    super.dispose();
  }

  Future<void> _attemptBiometric() async {
    if (_unlocking || _showPin) return;
    setState(() {
      _glyphState = _GlyphState.scanning;
      _pinError = null;
    });
    _scanLine.repeat();

    final success = await BiometricService.authenticate(reason: 'Unlock iWorkr');

    _scanLine.stop();

    if (success) {
      _onAuthSuccess();
    } else {
      _failCount++;
      setState(() => _glyphState = _GlyphState.error);
      HapticFeedback.heavyImpact();

      if (_failCount >= 3) {
        final hasPin = await BiometricService.hasPinCode;
        if (hasPin) {
          await Future.delayed(const Duration(milliseconds: 500));
          if (mounted) setState(() => _showPin = true);
        }
      }

      await Future.delayed(const Duration(milliseconds: 1500));
      if (mounted) setState(() => _glyphState = _GlyphState.idle);
    }
  }

  void _onAuthSuccess() {
    setState(() {
      _glyphState = _GlyphState.success;
      _unlocking = true;
    });
    HapticFeedback.heavyImpact();
    _unlockCtrl.forward().then((_) {
      widget.onUnlocked();
    });
  }

  void _onPinDigit(String digit) {
    if (_pinEntry.length >= 6) return;
    HapticFeedback.lightImpact();
    setState(() {
      _pinEntry += digit;
      _pinError = null;
    });

    if (_pinEntry.length == 4 || _pinEntry.length == 6) {
      _verifyPin();
    }
  }

  void _onPinDelete() {
    if (_pinEntry.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _pinEntry = _pinEntry.substring(0, _pinEntry.length - 1));
  }

  Future<void> _verifyPin() async {
    final valid = await BiometricService.verifyPin(_pinEntry);
    if (valid) {
      _onAuthSuccess();
    } else if (_pinEntry.length >= 6) {
      HapticFeedback.heavyImpact();
      setState(() {
        _pinEntry = '';
        _pinError = 'Incorrect PIN';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return AnimatedBuilder(
      animation: _unlockCtrl,
      builder: (context, child) {
        final unlockProgress = _unlockCtrl.value;
        return Opacity(
          opacity: 1.0 - unlockProgress,
          child: Transform.scale(
            scale: 1.0 + unlockProgress * 0.5,
            child: child,
          ),
        );
      },
      child: widget.isColdStart
          ? _buildColdStartScreen(mq)
          : _buildResumeCurtain(mq),
    );
  }

  Widget _buildColdStartScreen(MediaQueryData mq) {
    return Container(
      color: Colors.black,
      child: SafeArea(
        child: Column(
          children: [
            // 40% breathing room at top
            const Spacer(flex: 35),

            // Breathing logo
            _buildBreathingLogo(),

            const Spacer(flex: 10),

            // Status text
            _buildStatusText(),

            const Spacer(flex: 15),

            // Biometric glyph or PIN pad
            _showPin ? _buildPinPad(mq) : _buildBiometricGlyph(),

            SizedBox(height: mq.padding.bottom + 40),
          ],
        ),
      ),
    );
  }

  Widget _buildResumeCurtain(MediaQueryData mq) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
        child: Container(
          color: Colors.black.withValues(alpha: 0.60),
          child: SafeArea(
            child: Column(
              children: [
                const Spacer(flex: 35),
                _buildBreathingLogo(),
                const Spacer(flex: 10),
                _buildStatusText(),
                const Spacer(flex: 15),
                _showPin ? _buildPinPad(mq) : _buildBiometricGlyph(),
                SizedBox(height: mq.padding.bottom + 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Breathing Logo ─────────────────────────────────

  Widget _buildBreathingLogo() {
    return AnimatedBuilder(
      animation: _breathe,
      builder: (_, child) {
        final scale = 1.0 + _breathe.value * 0.05;
        final glowAlpha = 0.1 + _breathe.value * 0.15;

        return Transform.scale(
          scale: scale,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: ObsidianTheme.emerald.withValues(alpha: glowAlpha),
                  blurRadius: 40 + _breathe.value * 20,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Outer ring
                CustomPaint(
                  size: const Size(80, 80),
                  painter: _LogoRingPainter(
                    progress: _glyphState == _GlyphState.scanning
                        ? _scanLine.value
                        : 1.0,
                    color: _glyphState == _GlyphState.error
                        ? ObsidianTheme.rose
                        : ObsidianTheme.emerald,
                    glowAlpha: glowAlpha,
                  ),
                ),
                // Logo
                Image.asset(
                  'assets/logos/icon.png',
                  width: 40,
                  height: 40,
                  color: _glyphState == _GlyphState.error
                      ? ObsidianTheme.rose
                      : null,
                ),
              ],
            ),
          ),
        );
      },
    ).animate().fadeIn(duration: 800.ms).scale(
          begin: const Offset(0.8, 0.8),
          duration: 800.ms,
          curve: Curves.easeOutCubic,
        );
  }

  // ── Status Text ────────────────────────────────────

  Widget _buildStatusText() {
    String title;
    String subtitle;
    Color titleColor = Colors.white;

    switch (_glyphState) {
      case _GlyphState.idle:
        title = 'iWorkr';
        subtitle = _showPin ? 'Enter your PIN' : 'Tap to authenticate';
      case _GlyphState.scanning:
        title = 'Verifying...';
        subtitle = 'Hold still';
        titleColor = ObsidianTheme.emerald;
      case _GlyphState.success:
        title = 'Welcome Back';
        subtitle = 'Unlocking...';
        titleColor = ObsidianTheme.emerald;
      case _GlyphState.error:
        title = 'Try Again';
        subtitle = _failCount >= 3 ? 'Tap "Enter PIN" below' : 'Authentication failed';
        titleColor = ObsidianTheme.rose;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            title,
            key: ValueKey(title),
            style: GoogleFonts.inter(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              color: titleColor,
              letterSpacing: -0.5,
            ),
          ),
        ),
        const SizedBox(height: 6),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            subtitle,
            key: ValueKey(subtitle),
            style: GoogleFonts.inter(
              fontSize: 13,
              color: ObsidianTheme.textTertiary,
            ),
          ),
        ),
      ],
    ).animate().fadeIn(delay: 400.ms, duration: 500.ms);
  }

  // ── Biometric Glyph ────────────────────────────────

  Widget _buildBiometricGlyph() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Scanning glyph
        GestureDetector(
          onTap: _glyphState != _GlyphState.scanning ? _attemptBiometric : null,
          child: AnimatedBuilder(
            animation: _glyphPulse,
            builder: (_, __) {
              return Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.03),
                  border: Border.all(
                    color: _glyphBorderColor,
                    width: 1.5,
                  ),
                  boxShadow: _glyphState == _GlyphState.success
                      ? [
                          BoxShadow(
                            color: ObsidianTheme.emerald.withValues(alpha: 0.3),
                            blurRadius: 20,
                          ),
                        ]
                      : null,
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Scan line
                    if (_glyphState == _GlyphState.scanning)
                      AnimatedBuilder(
                        animation: _scanLine,
                        builder: (_, __) {
                          return Positioned(
                            top: 8 + _scanLine.value * 52,
                            left: 12,
                            right: 12,
                            child: Container(
                              height: 2,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.transparent,
                                    ObsidianTheme.emerald.withValues(alpha: 0.8),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),

                    // Icon
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        _glyphIcon,
                        key: ValueKey(_glyphState),
                        size: 28,
                        color: _glyphIconColor,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        )
            .animate()
            .fadeIn(delay: 600.ms, duration: 500.ms)
            .scale(
              begin: const Offset(0.9, 0.9),
              delay: 600.ms,
              duration: 500.ms,
              curve: Curves.easeOutBack,
            ),

        // Shake on error
        if (_glyphState == _GlyphState.error)
          const SizedBox.shrink()
              .animate()
              .shake(hz: 4, duration: 400.ms),

        const SizedBox(height: 24),

        // "Enter PIN" fallback
        if (_failCount >= 2 && !_showPin)
          GestureDetector(
            onTap: () async {
              final hasPin = await BiometricService.hasPinCode;
              if (hasPin && mounted) {
                HapticFeedback.lightImpact();
                setState(() => _showPin = true);
              }
            },
            child: Text(
              'Enter PIN',
              style: GoogleFonts.inter(
                fontSize: 14,
                color: ObsidianTheme.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ).animate().fadeIn(duration: 300.ms),
      ],
    );
  }

  Color get _glyphBorderColor {
    switch (_glyphState) {
      case _GlyphState.idle:
        return Colors.white.withValues(alpha: 0.08 + _glyphPulse.value * 0.04);
      case _GlyphState.scanning:
        return ObsidianTheme.emerald.withValues(alpha: 0.3 + _glyphPulse.value * 0.2);
      case _GlyphState.success:
        return ObsidianTheme.emerald;
      case _GlyphState.error:
        return ObsidianTheme.rose.withValues(alpha: 0.5);
    }
  }

  IconData get _glyphIcon {
    switch (_glyphState) {
      case _GlyphState.idle:
      case _GlyphState.scanning:
        return PhosphorIconsLight.fingerprint;
      case _GlyphState.success:
        return PhosphorIconsBold.lockOpen;
      case _GlyphState.error:
        return PhosphorIconsBold.lockKey;
    }
  }

  Color get _glyphIconColor {
    switch (_glyphState) {
      case _GlyphState.idle:
        return ObsidianTheme.textSecondary;
      case _GlyphState.scanning:
        return ObsidianTheme.emerald;
      case _GlyphState.success:
        return ObsidianTheme.emerald;
      case _GlyphState.error:
        return ObsidianTheme.rose;
    }
  }

  // ── PIN Pad ────────────────────────────────────────

  Widget _buildPinPad(MediaQueryData mq) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // PIN dots
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (i) {
            final filled = i < _pinEntry.length;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.symmetric(horizontal: 8),
              width: filled ? 14 : 12,
              height: filled ? 14 : 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled
                    ? ObsidianTheme.emerald
                    : Colors.transparent,
                border: Border.all(
                  color: filled
                      ? ObsidianTheme.emerald
                      : Colors.white.withValues(alpha: 0.15),
                  width: 1.5,
                ),
                boxShadow: filled
                    ? [BoxShadow(color: ObsidianTheme.emeraldGlow, blurRadius: 6)]
                    : null,
              ),
            );
          }),
        ),

        if (_pinError != null) ...[
          const SizedBox(height: 12),
          Text(
            _pinError!,
            style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose),
          ).animate().shake(hz: 3, duration: 300.ms),
        ],

        const SizedBox(height: 32),

        // Number grid (3x4)
        SizedBox(
          width: 260,
          child: Column(
            children: [
              _buildPinRow(['1', '2', '3']),
              const SizedBox(height: 12),
              _buildPinRow(['4', '5', '6']),
              const SizedBox(height: 12),
              _buildPinRow(['7', '8', '9']),
              const SizedBox(height: 12),
              _buildPinRow(['bio', '0', 'del']),
            ],
          ),
        ),
      ],
    ).animate().fadeIn(duration: 300.ms).moveY(begin: 20, duration: 300.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildPinRow(List<String> keys) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: keys.map((key) {
        if (key == 'bio') {
          return _PinKey(
            onTap: () {
              HapticFeedback.mediumImpact();
              setState(() => _showPin = false);
              _attemptBiometric();
            },
            child: Icon(PhosphorIconsLight.fingerprint, size: 22, color: ObsidianTheme.emerald),
          );
        }
        if (key == 'del') {
          return _PinKey(
            onTap: _onPinDelete,
            child: Icon(PhosphorIconsLight.backspace, size: 20, color: ObsidianTheme.textSecondary),
          );
        }
        return _PinKey(
          onTap: () => _onPinDigit(key),
          child: Text(
            key,
            style: GoogleFonts.inter(
              fontSize: 24,
              fontWeight: FontWeight.w300,
              color: Colors.white,
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN KEY
// ─────────────────────────────────────────────────────────────────────────────

class _PinKey extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;

  const _PinKey({required this.child, required this.onTap});

  @override
  State<_PinKey> createState() => _PinKeyState();
}

class _PinKeyState extends State<_PinKey> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _pressed
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.03),
          border: Border.all(
            color: _pressed
                ? Colors.white.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Center(child: widget.child),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGO RING PAINTER — emerald trace ring around the logo
// ─────────────────────────────────────────────────────────────────────────────

class _LogoRingPainter extends CustomPainter {
  final double progress;
  final Color color;
  final double glowAlpha;

  _LogoRingPainter({
    required this.progress,
    required this.color,
    required this.glowAlpha,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 2;

    // Background ring
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.04)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    // Progress arc
    if (progress > 0) {
      final sweepAngle = 2 * pi * progress;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -pi / 2,
        sweepAngle,
        false,
        Paint()
          ..color = color.withValues(alpha: 0.6)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _LogoRingPainter old) =>
      old.progress != progress || old.color != color || old.glowAlpha != glowAlpha;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLYPH STATE
// ─────────────────────────────────────────────────────────────────────────────

enum _GlyphState { idle, scanning, success, error }
