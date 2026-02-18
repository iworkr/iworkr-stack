import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Non-blocking toast notification — the "Stealth Toast."
///
/// A slim, black capsule that floats above the keyboard rail / bottom dock.
/// - Success: Emerald icon + text
/// - Error: Rose icon + text
/// - Info: Blue icon + text
/// - Warning: Amber icon + text
///
/// Slides up from the bottom, pauses for 3s, slides back down.
/// Does NOT block user interaction.
///
/// Usage:
/// ```dart
/// StealthToast.show(context, message: 'Job created', type: ToastType.success);
/// StealthToast.show(context, message: 'Connection failed', type: ToastType.error);
/// ```
enum ToastType { success, error, info, warning }

class StealthToast {
  StealthToast._();

  static OverlayEntry? _currentEntry;

  /// Show a non-blocking toast notification.
  static void show(
    BuildContext context, {
    required String message,
    ToastType type = ToastType.success,
    Duration duration = const Duration(seconds: 3),
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    // Remove any existing toast
    dismiss();

    final overlay = Overlay.of(context);

    _currentEntry = OverlayEntry(
      builder: (context) => _ToastWidget(
        message: message,
        type: type,
        duration: duration,
        actionLabel: actionLabel,
        onAction: onAction,
        onDismiss: dismiss,
      ),
    );

    overlay.insert(_currentEntry!);
  }

  /// Dismiss the current toast immediately.
  static void dismiss() {
    _currentEntry?.remove();
    _currentEntry = null;
  }

  /// Convenience methods
  static void success(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.success);

  static void error(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.error);

  static void info(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.info);

  static void warning(BuildContext context, String message) =>
      show(context, message: message, type: ToastType.warning);
}

class _ToastWidget extends StatefulWidget {
  final String message;
  final ToastType type;
  final Duration duration;
  final String? actionLabel;
  final VoidCallback? onAction;
  final VoidCallback onDismiss;

  const _ToastWidget({
    required this.message,
    required this.type,
    required this.duration,
    this.actionLabel,
    this.onAction,
    required this.onDismiss,
  });

  @override
  State<_ToastWidget> createState() => _ToastWidgetState();
}

class _ToastWidgetState extends State<_ToastWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  late final Animation<Offset> _slide;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _slide = Tween(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _anim, curve: Curves.easeOutQuart));

    _opacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _anim, curve: Curves.easeOut),
    );

    // Haptic feedback based on type
    switch (widget.type) {
      case ToastType.success:
        HapticFeedback.lightImpact();
        break;
      case ToastType.error:
        HapticFeedback.heavyImpact();
        Future.delayed(const Duration(milliseconds: 100), () {
          HapticFeedback.heavyImpact();
        });
        break;
      case ToastType.warning:
        HapticFeedback.mediumImpact();
        break;
      case ToastType.info:
        HapticFeedback.selectionClick();
        break;
    }

    // Animate in
    _anim.forward();

    // Auto-dismiss after duration
    Future.delayed(widget.duration, () {
      if (mounted) {
        _animateOut();
      }
    });
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  Future<void> _animateOut() async {
    await _anim.reverse();
    widget.onDismiss();
  }

  Color get _accentColor {
    switch (widget.type) {
      case ToastType.success:
        return ObsidianTheme.emerald;
      case ToastType.error:
        return ObsidianTheme.rose;
      case ToastType.warning:
        return ObsidianTheme.amber;
      case ToastType.info:
        return ObsidianTheme.blue;
    }
  }

  IconData get _icon {
    switch (widget.type) {
      case ToastType.success:
        return PhosphorIconsFill.checkCircle;
      case ToastType.error:
        return PhosphorIconsFill.warningCircle;
      case ToastType.warning:
        return PhosphorIconsFill.warning;
      case ToastType.info:
        return PhosphorIconsFill.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;

    // Float above keyboard rail (48px) or bottom dock
    final bottom = keyboardHeight > 0
        ? keyboardHeight + 56 // Above command rail
        : bottomPad + 80; // Above bottom dock

    return Positioned(
      left: 20,
      right: 20,
      bottom: bottom,
      child: SlideTransition(
        position: _slide,
        child: FadeTransition(
          opacity: _opacity,
          child: GestureDetector(
            onVerticalDragEnd: (details) {
              if (details.primaryVelocity != null &&
                  details.primaryVelocity! > 100) {
                _animateOut();
              }
            },
            child: ClipRRect(
              borderRadius: ObsidianTheme.radiusFull,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusFull,
                    color: const Color(0xE6000000), // black/90
                    border: Border.all(
                      color: _accentColor.withValues(alpha: 0.2),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _accentColor.withValues(alpha: 0.1),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Icon
                      Icon(_icon, size: 16, color: _accentColor),

                      const SizedBox(width: 10),

                      // Message
                      Expanded(
                        child: Text(
                          widget.message,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),

                      // Action button
                      if (widget.actionLabel != null) ...[
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            widget.onAction?.call();
                            _animateOut();
                          },
                          child: Text(
                            widget.actionLabel!,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _accentColor,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
