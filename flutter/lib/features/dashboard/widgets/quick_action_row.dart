import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Quick action buttons — ghost/outline style matching web "New Item" button.
///
/// Web spec:
/// - border: border-white/[0.08]
/// - bg: bg-white/[0.02]
/// - hover border: border-emerald-500/30
/// - rounded-lg (8px)
class QuickActionRow extends StatelessWidget {
  const QuickActionRow({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = [
      _QuickAction(
        icon: PhosphorIconsRegular.plus,
        label: 'New Job',
        onTap: () => context.go('/jobs'),
      ),
      _QuickAction(
        icon: PhosphorIconsRegular.calendarPlus,
        label: 'Schedule',
        onTap: () => context.go('/schedule'),
      ),
      _QuickAction(
        icon: PhosphorIconsRegular.magnifyingGlass,
        label: 'Search',
        onTap: () {},
      ),
      _QuickAction(
        icon: PhosphorIconsRegular.barcode,
        label: 'Scan',
        onTap: () {},
      ),
    ];

    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final action = actions[i];
          return _QuickActionButton(action: action, index: i);
        },
      ),
    );
  }
}

class _QuickAction {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});
}

class _QuickActionButton extends StatefulWidget {
  final _QuickAction action;
  final int index;
  const _QuickActionButton({required this.action, required this.index});

  @override
  State<_QuickActionButton> createState() => _QuickActionButtonState();
}

class _QuickActionButtonState extends State<_QuickActionButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.action.onTap();
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        width: 76,
        transform: _pressed ? Matrix4.diagonal3Values(0.95, 0.95, 1) : Matrix4.identity(),
        transformAlignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          border: Border.all(color: ObsidianTheme.borderMedium),
          color: ObsidianTheme.hoverBg,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(widget.action.icon, size: 20, color: ObsidianTheme.textSecondary),
            const SizedBox(height: 8),
            Text(
              widget.action.label,
              style: GoogleFonts.inter(
                fontSize: 10,
                color: ObsidianTheme.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 400 + widget.index * 60), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 400 + widget.index * 60), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }
}
