import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/jobs/screens/create_job_sheet.dart';
import 'package:iworkr_mobile/features/scan/screens/scanner_screen.dart';
import 'package:iworkr_mobile/features/search/screens/command_palette_screen.dart';

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
        icon: PhosphorIconsLight.plus,
        label: 'New Job',
        onTap: () => showCreateJobSheet(context),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.calendarPlus,
        label: 'Schedule',
        onTap: () => context.go('/schedule'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.magnifyingGlass,
        label: 'Search',
        onTap: () => showCommandPalette(context),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.barcode,
        label: 'Scan',
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ScannerScreen())),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.currencyDollar,
        label: 'Finance',
        onTap: () => context.push('/finance'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.books,
        label: 'Archive',
        onTap: () => context.push('/knowledge'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.path,
        label: 'Route',
        onTap: () => context.push('/route'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.package,
        label: 'Inventory',
        onTap: () => context.push('/inventory'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.van,
        label: 'Fleet',
        onTap: () => context.push('/fleet'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.pulse,
        label: 'IoT',
        onTap: () => context.push('/iot'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.ruler,
        label: 'Measure',
        onTap: () => context.push('/ar'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.eye,
        label: 'Scout',
        onTap: () => context.push('/scout'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.chartLineUp,
        label: 'Index',
        onTap: () => context.push('/market'),
      ),
      _QuickAction(
        icon: PhosphorIconsLight.gauge,
        label: 'Admin',
        onTap: () => context.push('/admin'),
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
    final c = context.iColors;
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
          border: Border.all(color: c.border),
          color: c.hoverBg,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(widget.action.icon, size: 20, color: c.textPrimary),
            const SizedBox(height: 8),
            Text(
              widget.action.label.toUpperCase(),
              style: GoogleFonts.jetBrainsMono(
                fontSize: 8,
                color: c.textMuted,
                fontWeight: FontWeight.w500,
                letterSpacing: 1.2,
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
