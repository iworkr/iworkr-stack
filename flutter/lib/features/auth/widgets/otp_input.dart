import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// 6-digit OTP input — matches "The Secure Gateway" spec.
///
/// Features:
/// - Individual digit boxes in JetBrains Mono
/// - Auto-advance on typing
/// - Auto-backspace on delete
/// - Native SMS autofill support
/// - Emerald focus glow / Rose error state
class OtpInput extends StatefulWidget {
  final int length;
  final ValueChanged<String> onCompleted;
  final bool hasError;

  const OtpInput({
    super.key,
    this.length = 6,
    required this.onCompleted,
    this.hasError = false,
  });

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  late List<TextEditingController> _controllers;
  late List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _focusNodes = List.generate(widget.length, (_) => FocusNode());

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNodes[0].requestFocus();
    });
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _onChanged(int index, String value) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'[^0-9]'), '');
      for (int i = 0; i < widget.length && i < digits.length; i++) {
        _controllers[i].text = digits[i];
      }
      final lastFilled = digits.length.clamp(0, widget.length) - 1;
      if (lastFilled >= 0 && lastFilled < widget.length) {
        _focusNodes[lastFilled].requestFocus();
      }
      _checkCompletion();
      return;
    }

    if (value.isNotEmpty) {
      if (index < widget.length - 1) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
      }
      HapticFeedback.selectionClick();
    }

    _checkCompletion();
  }

  void _onKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.backspace) {
      if (_controllers[index].text.isEmpty && index > 0) {
        _controllers[index - 1].clear();
        _focusNodes[index - 1].requestFocus();
        HapticFeedback.selectionClick();
      }
    }
  }

  void _checkCompletion() {
    final code = _controllers.map((c) => c.text).join();
    if (code.length == widget.length && code.contains(RegExp(r'^[0-9]+$'))) {
      widget.onCompleted(code);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(widget.length, (i) {
        final isFocused = _focusNodes[i].hasFocus;
        return Padding(
          padding: EdgeInsets.only(left: i == 0 ? 0 : 8),
          child: SizedBox(
            width: 44,
            height: 52,
            child: KeyboardListener(
              focusNode: FocusNode(),
              onKeyEvent: (event) => _onKeyEvent(i, event),
              child: AnimatedContainer(
                duration: ObsidianTheme.fast,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: c.surface,
                  border: Border.all(
                    color: widget.hasError
                        ? ObsidianTheme.rose.withValues(alpha: 0.5)
                        : isFocused
                            ? ObsidianTheme.emerald.withValues(alpha: 0.5)
                            : c.borderMedium,
                    width: isFocused ? 1.5 : 1,
                  ),
                  boxShadow: isFocused && !widget.hasError
                      ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.1), blurRadius: 8)]
                      : widget.hasError
                          ? [BoxShadow(color: ObsidianTheme.rose.withValues(alpha: 0.1), blurRadius: 8)]
                          : null,
                ),
                child: TextField(
                  controller: _controllers[i],
                  focusNode: _focusNodes[i],
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  autofillHints: i == 0 ? const [AutofillHints.oneTimeCode] : null,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                  ),
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (value) => _onChanged(i, value),
                  onTap: () => setState(() {}),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}
