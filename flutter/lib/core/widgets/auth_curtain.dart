import 'dart:math';
import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/services/biometric_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── The Vault Lock — Biometric Auth Curtain ──────────────
// ═══════════════════════════════════════════════════════════
//
// Wraps the entire app via MaterialApp.builder.
// - Cold start: full lock screen with breathing logo + biometric prompt
// - Resume: blur curtain with 30s grace period
// - PIN fallback after 3 biometric failures
// - Log out escape hatch for broken sensors

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
    }
  }

  void _onUnlocked() {
    HapticFeedback.lightImpact();
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
        if (_showAirlock)
          Positioned.fill(
            child: _VaultLockOverlay(
              isColdStart: _coldStartLocked,
              onUnlocked: _onUnlocked,
            ),
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
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: Center(
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

// ═══════════════════════════════════════════════════════════
// ── The Vault Lock Overlay ───────────────────────────────
// ═══════════════════════════════════════════════════════════

enum _VaultState { idle, prompting, error, success }

class _VaultLockOverlay extends StatefulWidget {
  final bool isColdStart;
  final VoidCallback onUnlocked;

  const _VaultLockOverlay({
    required this.isColdStart,
    required this.onUnlocked,
  });

  @override
  State<_VaultLockOverlay> createState() => _VaultLockOverlayState();
}

class _VaultLockOverlayState extends State<_VaultLockOverlay>
    with TickerProviderStateMixin {
  late AnimationController _breathe;
  late AnimationController _unlockCtrl;
  late AnimationController _shakeCtrl;

  _VaultState _state = _VaultState.idle;
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
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);

    _unlockCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    Future.delayed(const Duration(milliseconds: 600), _attemptBiometric);
  }

  @override
  void dispose() {
    _breathe.dispose();
    _unlockCtrl.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  Future<void> _attemptBiometric() async {
    if (_unlocking || _showPin) return;
    setState(() => _state = _VaultState.prompting);

    final success = await BiometricService.authenticate(reason: 'Unlock iWorkr');

    if (!mounted) return;

    if (success) {
      _onAuthSuccess();
    } else {
      _failCount++;
      setState(() => _state = _VaultState.error);
      HapticFeedback.heavyImpact();
      _shakeCtrl.forward(from: 0);

      if (_failCount >= 3) {
        final hasPin = await BiometricService.hasPinCode;
        if (hasPin && mounted) {
          await Future.delayed(const Duration(milliseconds: 500));
          if (mounted) setState(() => _showPin = true);
        }
      }
    }
  }

  void _onAuthSuccess() {
    setState(() {
      _state = _VaultState.success;
      _unlocking = true;
    });
    HapticFeedback.lightImpact();
    _unlockCtrl.forward().then((_) => widget.onUnlocked());
  }

  void _onPinDigit(String digit) {
    if (_pinEntry.length >= 6) return;
    HapticFeedback.lightImpact();
    setState(() { _pinEntry += digit; _pinError = null; });
    if (_pinEntry.length == 4 || _pinEntry.length == 6) _verifyPin();
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
      _shakeCtrl.forward(from: 0);
      setState(() { _pinEntry = ''; _pinError = 'Incorrect PIN'; });
    }
  }

  Future<void> _logout() async {
    HapticFeedback.heavyImpact();
    await SupabaseService.auth.signOut();
    if (mounted) {
      // Force a full restart by popping everything
      Navigator.of(context, rootNavigator: true).popUntil((r) => r.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _unlockCtrl,
      builder: (context, child) {
        final p = Curves.easeOutCubic.transform(_unlockCtrl.value);
        return Opacity(
          opacity: (1.0 - p).clamp(0.0, 1.0),
          child: Transform.scale(scale: 1.0 + p * 0.08, child: child),
        );
      },
      child: widget.isColdStart
          ? _buildColdStart(context)
          : _buildResumeCurtain(context),
    );
  }

  // ── Cold Start (Full screen) ───────────────────────────

  Widget _buildColdStart(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        bottom: false,
        child: SizedBox.expand(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(flex: 30),
              _buildBreathingLogo(),
              const SizedBox(height: 28),
              _buildStatusText(),
              const Spacer(flex: 15),
              _showPin ? _buildPinPad() : _buildLockGlyph(),
              const SizedBox(height: 24),
              if (_state == _VaultState.error && !_showPin) _buildRetryButton(),
              const Spacer(flex: 8),
              _buildLogoutEscape(),
              SizedBox(height: bottomPad + 16),
            ],
          ),
        ),
      ),
    );
  }

  // ── Resume Curtain (Blur overlay) ──────────────────────

  Widget _buildResumeCurtain(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
          child: Container(
            color: Colors.black.withValues(alpha: 0.65),
            child: SafeArea(
              bottom: false,
              child: SizedBox.expand(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const Spacer(flex: 30),
                    _buildBreathingLogo(),
                    const SizedBox(height: 28),
                    _buildStatusText(),
                    const Spacer(flex: 15),
                    _showPin ? _buildPinPad() : _buildLockGlyph(),
                    const SizedBox(height: 24),
                    if (_state == _VaultState.error && !_showPin) _buildRetryButton(),
                    const Spacer(flex: 8),
                    _buildLogoutEscape(),
                    SizedBox(height: bottomPad + 16),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Breathing Logo ─────────────────────────────────────

  Widget _buildBreathingLogo() {
    return AnimatedBuilder(
      animation: _breathe,
      builder: (_, __) {
        final opacity = 0.6 + _breathe.value * 0.4;
        final glowAlpha = _breathe.value * 0.12;

        return Opacity(
          opacity: _state == _VaultState.success ? 1.0 : opacity,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: _state == _VaultState.success
                  ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.35), blurRadius: 40)]
                  : [BoxShadow(color: Colors.white.withValues(alpha: glowAlpha), blurRadius: 30)],
            ),
            child: Image.asset(
              'assets/logos/icon.png',
              width: 80,
              height: 80,
              color: _state == _VaultState.success ? ObsidianTheme.emerald : Colors.white,
            ),
          ),
        );
      },
    )
        .animate()
        .fadeIn(duration: 800.ms)
        .scale(begin: const Offset(0.85, 0.85), duration: 800.ms, curve: Curves.easeOutCubic);
  }

  // ── Status Text ────────────────────────────────────────

  Widget _buildStatusText() {
    String title;
    String subtitle;
    Color titleColor = Colors.white;

    switch (_state) {
      case _VaultState.idle:
        title = 'iWorkr';
        subtitle = _showPin ? 'Enter your PIN to unlock' : 'Tap to authenticate';
      case _VaultState.prompting:
        title = 'Verifying Identity';
        subtitle = 'Look at the screen to unlock';
      case _VaultState.success:
        title = 'Welcome Back';
        subtitle = 'Unlocking...';
        titleColor = ObsidianTheme.emerald;
      case _VaultState.error:
        title = 'Recognition Failed';
        subtitle = _failCount >= 3 ? 'Enter PIN or try again' : 'Face or fingerprint not recognized';
        titleColor = ObsidianTheme.rose;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            title,
            key: ValueKey('t_$title'),
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: titleColor,
              letterSpacing: -0.3,
            ),
          ),
        ),
        const SizedBox(height: 6),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            subtitle,
            key: ValueKey('s_$subtitle'),
            style: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF71717A)),
          ),
        ),
      ],
    ).animate().fadeIn(delay: 400.ms, duration: 500.ms);
  }

  // ── Lock Glyph ─────────────────────────────────────────

  Widget _buildLockGlyph() {
    final IconData icon;
    final Color iconColor;

    switch (_state) {
      case _VaultState.idle:
        icon = CupertinoIcons.lock_fill;
        iconColor = const Color(0xFF71717A);
      case _VaultState.prompting:
        icon = CupertinoIcons.lock_fill;
        iconColor = Colors.white;
      case _VaultState.success:
        icon = CupertinoIcons.lock_open_fill;
        iconColor = ObsidianTheme.emerald;
      case _VaultState.error:
        icon = CupertinoIcons.lock_fill;
        iconColor = ObsidianTheme.rose;
    }

    Widget lockWidget = GestureDetector(
      onTap: _state != _VaultState.prompting ? _attemptBiometric : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 64,
        height: 64,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _state == _VaultState.prompting
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.white.withValues(alpha: 0.03),
          border: Border.all(
            color: _state == _VaultState.success
                ? ObsidianTheme.emerald.withValues(alpha: 0.5)
                : _state == _VaultState.error
                    ? ObsidianTheme.rose.withValues(alpha: 0.3)
                    : Colors.white.withValues(alpha: 0.06),
            width: 1,
          ),
          boxShadow: _state == _VaultState.success
              ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.25), blurRadius: 20)]
              : _state == _VaultState.prompting
                  ? [BoxShadow(color: Colors.white.withValues(alpha: 0.05), blurRadius: 16)]
                  : null,
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Icon(icon, key: ValueKey(icon), size: 24, color: iconColor),
        ),
      ),
    );

    if (_state == _VaultState.error) {
      lockWidget = AnimatedBuilder(
        animation: _shakeCtrl,
        builder: (_, child) {
          final shake = sin(_shakeCtrl.value * pi * 6) * 8 * (1 - _shakeCtrl.value);
          return Transform.translate(offset: Offset(shake, 0), child: child);
        },
        child: lockWidget,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        lockWidget
            .animate()
            .fadeIn(delay: 600.ms, duration: 500.ms)
            .scale(begin: const Offset(0.9, 0.9), delay: 600.ms, duration: 500.ms, curve: Curves.easeOutBack),
        if (_failCount >= 2 && !_showPin) ...[
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () async {
              final hasPin = await BiometricService.hasPinCode;
              if (hasPin && mounted) {
                HapticFeedback.lightImpact();
                setState(() => _showPin = true);
              }
            },
            child: Text(
              'Enter PIN Instead',
              style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textMuted, fontWeight: FontWeight.w500),
            ),
          ).animate().fadeIn(duration: 300.ms),
        ],
      ],
    );
  }

  // ── Try Again Button ───────────────────────────────────

  Widget _buildRetryButton() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _state = _VaultState.idle);
        _attemptBiometric();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          color: Colors.white.withValues(alpha: 0.03),
        ),
        child: Text(
          'Try Again',
          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white),
        ),
      ),
    ).animate().fadeIn(delay: 200.ms, duration: 300.ms).moveY(begin: 8, delay: 200.ms, duration: 300.ms);
  }

  // ── Logout Escape Hatch ────────────────────────────────

  Widget _buildLogoutEscape() {
    return GestureDetector(
      onTap: _logout,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 24),
        child: Text(
          'Log out instead',
          style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textMuted),
        ),
      ),
    );
  }

  // ── PIN Pad ────────────────────────────────────────────

  Widget _buildPinPad() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // PIN dots
        AnimatedBuilder(
          animation: _shakeCtrl,
          builder: (_, child) {
            final shake = _pinError != null
                ? sin(_shakeCtrl.value * pi * 6) * 6 * (1 - _shakeCtrl.value)
                : 0.0;
            return Transform.translate(offset: Offset(shake, 0), child: child);
          },
          child: Row(
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
                  color: filled ? ObsidianTheme.emerald : Colors.transparent,
                  border: Border.all(
                    color: filled ? ObsidianTheme.emerald : Colors.white.withValues(alpha: 0.15),
                    width: 1.5,
                  ),
                  boxShadow: filled
                      ? [BoxShadow(color: ObsidianTheme.emeraldGlow, blurRadius: 6)]
                      : null,
                ),
              );
            }),
          ),
        ),

        if (_pinError != null) ...[
          const SizedBox(height: 12),
          Text(
            _pinError!,
            style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose),
          ),
        ],

        const SizedBox(height: 32),

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
              setState(() { _showPin = false; _state = _VaultState.idle; });
              _attemptBiometric();
            },
            child: Icon(CupertinoIcons.lock_fill, size: 20, color: ObsidianTheme.emerald),
          );
        }
        if (key == 'del') {
          return _PinKey(
            onTap: _onPinDelete,
            child: const Icon(CupertinoIcons.delete_left, size: 20, color: ObsidianTheme.textSecondary),
          );
        }
        return _PinKey(
          onTap: () => _onPinDigit(key),
          child: Text(
            key,
            style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w300, color: Colors.white),
          ),
        );
      }).toList(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── PIN Key ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

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
          color: _pressed ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.03),
          border: Border.all(
            color: _pressed ? Colors.white.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Center(child: widget.child),
      ),
    );
  }
}
