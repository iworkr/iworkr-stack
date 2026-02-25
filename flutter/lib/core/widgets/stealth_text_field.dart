import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Ghost Input — the "Stealth" text field.
///
/// Idle: transparent background, no border, zinc placeholder.
/// Focused: emerald "Laser Spine" bar slides in from the left, subtle glow.
/// Error: laser spine turns rose, text micro-shakes.
///
/// Features:
/// - Floating label (placeholder → overline animation)
/// - Monospace mode for IDs/codes
/// - Prefix icon support
/// - Error message with slide-down animation
/// - Auto-registers with [StealthFieldScope] for keyboard command rail navigation
class StealthTextField extends StatefulWidget {
  final String label;
  final String? hintText;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final bool isMonospace;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final IconData? prefixIcon;
  final Widget? suffix;
  final String? errorText;
  final int maxLines;
  final bool autofocus;
  final bool readOnly;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final List<TextInputFormatter>? inputFormatters;

  const StealthTextField({
    super.key,
    required this.label,
    this.hintText,
    this.controller,
    this.focusNode,
    this.isMonospace = false,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.prefixIcon,
    this.suffix,
    this.errorText,
    this.maxLines = 1,
    this.autofocus = false,
    this.readOnly = false,
    this.onChanged,
    this.onSubmitted,
    this.inputFormatters,
  });

  @override
  State<StealthTextField> createState() => _StealthTextFieldState();
}

class _StealthTextFieldState extends State<StealthTextField>
    with SingleTickerProviderStateMixin {
  late final FocusNode _effectiveFocusNode;
  late final TextEditingController _effectiveController;
  late final AnimationController _laserAnim;
  bool _focused = false;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _effectiveFocusNode = widget.focusNode ?? FocusNode();
    _effectiveController = widget.controller ?? TextEditingController();
    _hasText = _effectiveController.text.isNotEmpty;

    _laserAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    _effectiveFocusNode.addListener(_onFocusChange);
    _effectiveController.addListener(_onTextChange);

    // Register with scope if available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final scope = StealthFieldScope.maybeOf(context);
      scope?.register(_effectiveFocusNode);
    });
  }

  @override
  void dispose() {
    final scope = StealthFieldScope.maybeOf(context);
    scope?.unregister(_effectiveFocusNode);

    _effectiveFocusNode.removeListener(_onFocusChange);
    _effectiveController.removeListener(_onTextChange);
    _laserAnim.dispose();
    if (widget.focusNode == null) _effectiveFocusNode.dispose();
    if (widget.controller == null) _effectiveController.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    final hasFocus = _effectiveFocusNode.hasFocus;
    if (hasFocus != _focused) {
      setState(() => _focused = hasFocus);
      if (hasFocus) {
        HapticFeedback.selectionClick();
        _laserAnim.forward();
        _ensureVisible();
      } else {
        _laserAnim.reverse();
      }
    }
  }

  void _onTextChange() {
    final has = _effectiveController.text.isNotEmpty;
    if (has != _hasText) {
      setState(() => _hasText = has);
    }
  }

  void _ensureVisible() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _effectiveFocusNode.hasFocus) {
        Scrollable.ensureVisible(
          context,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutQuart,
          alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
        );
      }
    });
  }

  bool get _hasError => widget.errorText != null && widget.errorText!.isNotEmpty;

  Color get _spineColor => _hasError ? ObsidianTheme.rose : ObsidianTheme.emerald;

  TextStyle get _inputStyle {
    if (widget.isMonospace) {
      return GoogleFonts.jetBrainsMono(
        fontSize: 16,
        color: const Color(0xFFF4F4F5), // Zinc-100
        fontWeight: FontWeight.w400,
      );
    }
    return GoogleFonts.inter(
      fontSize: 16,
      color: const Color(0xFFF4F4F5), // Zinc-100
      fontWeight: FontWeight.w400,
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final showFloatingLabel = _focused || _hasText;

    Widget field = AnimatedBuilder(
      animation: _laserAnim,
      builder: (context, child) {
        final laserProgress = Curves.easeOut.transform(_laserAnim.value);

        return Container(
          decoration: BoxDecoration(
            // Subtle emerald glow when focused (5% opacity)
            gradient: _focused
                ? LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      _spineColor.withValues(alpha: 0.05),
                      Colors.transparent,
                    ],
                  )
                : null,
          ),
          child: Row(
            crossAxisAlignment: widget.maxLines > 1
                ? CrossAxisAlignment.start
                : CrossAxisAlignment.center,
            children: [
              // Laser Spine
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                width: 3,
                height: laserProgress * (widget.maxLines > 1 ? 60 : 44),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(1.5),
                  color: _spineColor.withValues(alpha: laserProgress),
                  boxShadow: laserProgress > 0
                      ? [
                          BoxShadow(
                            color: _spineColor.withValues(alpha: 0.3 * laserProgress),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                ),
              ),

              const SizedBox(width: 12),

              // Prefix icon
              if (widget.prefixIcon != null)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Icon(
                    widget.prefixIcon,
                    size: 16,
                    color: _focused
                        ? _spineColor
                        : c.textTertiary,
                  ),
                ),

              // Field + floating label stack
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Floating label
                    AnimatedCrossFade(
                      duration: const Duration(milliseconds: 200),
                      sizeCurve: Curves.easeOut,
                      firstChild: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          widget.label,
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            color: _focused
                                ? _spineColor
                                : c.textMuted,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      secondChild: const SizedBox(height: 0),
                      crossFadeState: showFloatingLabel
                          ? CrossFadeState.showFirst
                          : CrossFadeState.showSecond,
                    ),

                    // Text field
                    TextField(
                      controller: _effectiveController,
                      focusNode: _effectiveFocusNode,
                      autofocus: widget.autofocus,
                      readOnly: widget.readOnly,
                      obscureText: widget.obscureText,
                      maxLines: widget.maxLines,
                      keyboardType: widget.keyboardType,
                      textInputAction: widget.textInputAction,
                      inputFormatters: widget.inputFormatters,
                      style: _inputStyle,
                      cursorColor: _spineColor,
                      cursorWidth: 2,
                      cursorRadius: const Radius.circular(1),
                      decoration: InputDecoration(
                        hintText: showFloatingLabel
                            ? (widget.hintText ?? '')
                            : widget.label,
                        hintStyle: GoogleFonts.inter(
                          fontSize: showFloatingLabel ? 14 : 16,
                          color: const Color(0xFF52525B), // Zinc-600
                          fontWeight: FontWeight.w400,
                        ),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.only(
                          top: showFloatingLabel ? 2 : 12,
                          bottom: 12,
                        ),
                      ),
                      onChanged: widget.onChanged,
                      onSubmitted: widget.onSubmitted,
                    ),
                  ],
                ),
              ),

              // Suffix
              if (widget.suffix != null)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: widget.suffix!,
                ),
            ],
          ),
        );
      },
    );

    // Error message
    if (_hasError) {
      field = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          field,
          Padding(
            padding: const EdgeInsets.only(left: 15, top: 4),
            child: Text(
              widget.errorText!,
              style: GoogleFonts.inter(
                fontSize: 11,
                color: ObsidianTheme.rose,
                fontWeight: FontWeight.w400,
              ),
            ),
          )
              .animate()
              .fadeIn(duration: 200.ms)
              .moveY(begin: -4, end: 0, duration: 200.ms)
              .shake(hz: 3, offset: const Offset(4, 0), duration: 300.ms),
        ],
      );
    }

    return field;
  }
}

// ══════════════════════════════════════════════════════════
// STEALTH FIELD SCOPE
// ══════════════════════════════════════════════════════════

/// Provides keyboard command rail navigation across a group of [StealthTextField]s.
///
/// Wrap a form or scrollable body with this to enable ▲/▼ field navigation
/// and the "Done" button on the command rail.
class StealthFieldScope extends StatefulWidget {
  final Widget child;

  const StealthFieldScope({super.key, required this.child});

  static StealthFieldScopeState? maybeOf(BuildContext context) {
    return context.findAncestorStateOfType<StealthFieldScopeState>();
  }

  @override
  State<StealthFieldScope> createState() => StealthFieldScopeState();
}

class StealthFieldScopeState extends State<StealthFieldScope> {
  final List<FocusNode> _fields = [];

  void register(FocusNode node) {
    if (!_fields.contains(node)) {
      _fields.add(node);
    }
  }

  void unregister(FocusNode node) {
    _fields.remove(node);
  }

  int get _currentIndex => _fields.indexWhere((f) => f.hasFocus);

  void focusPrevious() {
    final idx = _currentIndex;
    if (idx > 0) {
      HapticFeedback.selectionClick();
      _fields[idx - 1].requestFocus();
    }
  }

  void focusNext() {
    final idx = _currentIndex;
    if (idx >= 0 && idx < _fields.length - 1) {
      HapticFeedback.selectionClick();
      _fields[idx + 1].requestFocus();
    }
  }

  void dismissKeyboard() {
    HapticFeedback.lightImpact();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  bool get hasPrevious => _currentIndex > 0;
  bool get hasNext => _currentIndex >= 0 && _currentIndex < _fields.length - 1;

  @override
  Widget build(BuildContext context) => widget.child;
}

// ══════════════════════════════════════════════════════════
// STEALTH DIVIDER
// ══════════════════════════════════════════════════════════

/// Hairline divider for separating ghost inputs in a list.
/// Matches the PRD: white/5 bottom separator.
class StealthDivider extends StatelessWidget {
  const StealthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      height: 1,
      margin: const EdgeInsets.only(left: 15),
      color: c.border,
    );
  }
}
