import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/stealth_text_field.dart';

/// Keyboard Command Rail — glass bar that attaches above the software keyboard.
///
/// Provides:
/// - ▲ Previous field navigation
/// - ▼ Next field navigation
/// - "Done" button to dismiss keyboard
///
/// Automatically appears when any field in a [StealthFieldScope] is focused.
/// Uses a custom [OverlayEntry] positioned just above `viewInsets.bottom`.
class KeyboardCommandRail extends StatefulWidget {
  final Widget child;

  const KeyboardCommandRail({super.key, required this.child});

  @override
  State<KeyboardCommandRail> createState() => _KeyboardCommandRailState();
}

class _KeyboardCommandRailState extends State<KeyboardCommandRail>
    with WidgetsBindingObserver {
  OverlayEntry? _overlayEntry;
  double _keyboardHeight = 0;
  bool _isKeyboardVisible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _removeOverlay();
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    final bottom = WidgetsBinding
        .instance.platformDispatcher.views.first.viewInsets.bottom;
    final devicePixelRatio = WidgetsBinding
        .instance.platformDispatcher.views.first.devicePixelRatio;
    final kbHeight = bottom / devicePixelRatio;

    final wasVisible = _isKeyboardVisible;
    _isKeyboardVisible = kbHeight > 100;

    if (_isKeyboardVisible && !wasVisible) {
      _keyboardHeight = kbHeight;
      _showOverlay();
    } else if (!_isKeyboardVisible && wasVisible) {
      _removeOverlay();
    } else if (_isKeyboardVisible) {
      _keyboardHeight = kbHeight;
      _overlayEntry?.markNeedsBuild();
    }
  }

  void _showOverlay() {
    _removeOverlay();
    _overlayEntry = OverlayEntry(builder: (context) {
      return Positioned(
        left: 0,
        right: 0,
        bottom: _keyboardHeight,
        child: _CommandRailBar(
          onPrevious: _handlePrevious,
          onNext: _handleNext,
          onDone: _handleDone,
          hasPrevious: _scope?.hasPrevious ?? false,
          hasNext: _scope?.hasNext ?? false,
        ),
      );
    });
    Overlay.of(context).insert(_overlayEntry!);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  StealthFieldScopeState? get _scope =>
      StealthFieldScope.maybeOf(context);

  void _handlePrevious() => _scope?.focusPrevious();
  void _handleNext() => _scope?.focusNext();
  void _handleDone() {
    _scope?.dismissKeyboard();
    _removeOverlay();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

// ── The Rail Bar Widget ────────────────────────────────

class _CommandRailBar extends StatelessWidget {
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onDone;
  final bool hasPrevious;
  final bool hasNext;

  const _CommandRailBar({
    required this.onPrevious,
    required this.onNext,
    required this.onDone,
    required this.hasPrevious,
    required this.hasNext,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            // bg-zinc-900/90
            color: const Color(0xFF18181B).withValues(alpha: 0.9),
            border: const Border(
              top: BorderSide(
                color: Color(0x1AFFFFFF), // white/10
              ),
            ),
          ),
          child: Row(
            children: [
              const SizedBox(width: 8),

              // Previous button
              _RailButton(
                icon: PhosphorIconsLight.caretUp,
                onTap: hasPrevious ? onPrevious : null,
                enabled: hasPrevious,
              ),

              const SizedBox(width: 4),

              // Next button
              _RailButton(
                icon: PhosphorIconsLight.caretDown,
                onTap: hasNext ? onNext : null,
                enabled: hasNext,
              ),

              const Spacer(),

              // Done button
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onDone();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  child: Text(
                    'Done',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.emerald,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 8),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Rail Navigation Button ─────────────────────────────

class _RailButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final bool enabled;

  const _RailButton({
    required this.icon,
    required this.onTap,
    required this.enabled,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 34,
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusSm,
          color: enabled
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.transparent,
          border: Border.all(
            color: enabled
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.white.withValues(alpha: 0.03),
          ),
        ),
        child: Center(
          child: Icon(
            icon,
            size: 16,
            color: enabled
                ? ObsidianTheme.textSecondary
                : ObsidianTheme.textDisabled,
          ),
        ),
      ),
    );
  }
}
