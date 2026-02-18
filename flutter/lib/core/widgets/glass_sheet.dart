import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Shows a Glass Sheet — our replacement for system AlertDialogs.
///
/// Physics-based modal bottom sheet with:
/// - Rounded top corners (24px radius)
/// - Glassmorphism surface (black base + zinc-900/20 + blur 20px)
/// - Drag handle pill
/// - Sticky header with title + close
/// - Scrollable body
/// - Pinned footer with safe zone
Future<T?> showGlassSheet<T>({
  required BuildContext context,
  required String title,
  required Widget body,
  Widget? footer,
  bool isDismissible = true,
  bool enableDrag = true,
  double initialChildSize = 0.55,
  double maxChildSize = 0.92,
  double minChildSize = 0.25,
}) {
  HapticFeedback.mediumImpact();
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (context) => _GlassSheetBody(
      title: title,
      body: body,
      footer: footer,
      initialChildSize: initialChildSize,
      maxChildSize: maxChildSize,
      minChildSize: minChildSize,
    ),
  );
}

class _GlassSheetBody extends StatelessWidget {
  final String title;
  final Widget body;
  final Widget? footer;
  final double initialChildSize;
  final double maxChildSize;
  final double minChildSize;

  const _GlassSheetBody({
    required this.title,
    required this.body,
    this.footer,
    required this.initialChildSize,
    required this.maxChildSize,
    required this.minChildSize,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;

    return DraggableScrollableSheet(
      initialChildSize: keyboardHeight > 0 ? maxChildSize : initialChildSize,
      maxChildSize: maxChildSize,
      minChildSize: minChildSize,
      snap: true,
      snapSizes: [minChildSize, initialChildSize, maxChildSize],
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                border: const Border(
                  top: BorderSide(
                    color: Color(0x1AFFFFFF), // white/10
                  ),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Drag handle
                  _buildDragHandle(),

                  // Header
                  _buildHeader(context),

                  // Divider
                  Container(
                    height: 1,
                    color: ObsidianTheme.border,
                  ),

                  // Body (scrollable)
                  Expanded(
                    child: ListView(
                      controller: scrollController,
                      padding: EdgeInsets.only(
                        left: 20,
                        right: 20,
                        top: 16,
                        bottom: footer != null
                            ? 16
                            : bottomPad + 20,
                      ),
                      children: [body],
                    ),
                  ),

                  // Footer (pinned)
                  if (footer != null)
                    _buildFooter(context, bottomPad),
                ],
              ),
            ),
          ),
        ).animate().moveY(begin: 20, end: 0, duration: 300.ms, curve: Curves.easeOutQuart);
      },
    );
  }

  Widget _buildDragHandle() {
    return Center(
      child: Container(
        margin: const EdgeInsets.only(top: 10, bottom: 6),
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(2),
          color: ObsidianTheme.textDisabled,
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 12, 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
                letterSpacing: -0.3,
              ),
            ),
          ),
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).pop();
            },
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.hoverBg,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: const Center(
                child: Icon(
                  PhosphorIconsLight.x,
                  size: 14,
                  color: ObsidianTheme.textTertiary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context, double bottomPad) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPad + 16),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: Color(0x0DFFFFFF)),
        ),
        // Subtle surface for safe zone
        color: Color(0xFF0A0A0A),
      ),
      child: footer!,
    );
  }
}

// ══════════════════════════════════════════════════════════
// GLASS SHEET BUTTON — Full-width primary action
// ══════════════════════════════════════════════════════════

/// Primary action button for use inside GlassSheet footers.
class GlassSheetButton extends StatefulWidget {
  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final Color? color;

  const GlassSheetButton({
    super.key,
    required this.label,
    this.onTap,
    this.loading = false,
    this.color,
  });

  @override
  State<GlassSheetButton> createState() => _GlassSheetButtonState();
}

class _GlassSheetButtonState extends State<GlassSheetButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null && !widget.loading;
    final color = widget.color ?? Colors.white;

    return GestureDetector(
      onTap: enabled
          ? () {
              HapticFeedback.mediumImpact();
              widget.onTap!();
            }
          : null,
      onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        height: 48,
        transform: _pressed
            ? Matrix4.diagonal3Values(0.98, 0.98, 1)
            : Matrix4.identity(),
        transformAlignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: enabled ? color : ObsidianTheme.shimmerBase,
        ),
        child: Center(
          child: widget.loading
              ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: color == Colors.white
                        ? Colors.black
                        : Colors.white,
                  ),
                )
              : Text(
                  widget.label,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: enabled
                        ? (color == Colors.white
                            ? Colors.black
                            : Colors.white)
                        : ObsidianTheme.textTertiary,
                  ),
                ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
// CONFIRM GLASS SHEET — Quick confirmation replacement
// ══════════════════════════════════════════════════════════

/// Quick confirm dialog replacement via glass sheet.
///
/// Usage:
/// ```dart
/// final confirmed = await showConfirmGlassSheet(
///   context: context,
///   title: 'Delete Job',
///   message: 'Are you sure you want to delete this job?',
///   confirmLabel: 'Delete',
///   confirmColor: ObsidianTheme.rose,
/// );
/// ```
Future<bool> showConfirmGlassSheet({
  required BuildContext context,
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  Color? confirmColor,
}) async {
  final result = await showGlassSheet<bool>(
    context: context,
    title: title,
    initialChildSize: 0.3,
    maxChildSize: 0.4,
    minChildSize: 0.2,
    body: Text(
      message,
      style: GoogleFonts.inter(
        fontSize: 14,
        color: ObsidianTheme.textSecondary,
        height: 1.5,
      ),
    ),
    footer: Row(
      children: [
        Expanded(
          child: GlassSheetButton(
            label: cancelLabel,
            color: ObsidianTheme.shimmerBase,
            onTap: () => Navigator.of(context).pop(false),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: GlassSheetButton(
            label: confirmLabel,
            color: confirmColor ?? ObsidianTheme.emerald,
            onTap: () => Navigator.of(context).pop(true),
          ),
        ),
      ],
    ),
  );
  return result ?? false;
}
