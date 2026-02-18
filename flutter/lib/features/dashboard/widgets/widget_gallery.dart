import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/dashboard_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Shows the Widget Gallery filtered by the user's clearance.
Future<DashboardWidgetConfig?> showWidgetGallery(BuildContext context, WidgetRef ref) {
  final catalog = ref.read(filteredWidgetCatalogProvider).valueOrNull ?? widgetCatalog;
  return showModalBottomSheet<DashboardWidgetConfig>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _WidgetGallerySheet(catalog: catalog),
  );
}

class _WidgetGallerySheet extends StatefulWidget {
  final List<WidgetTypeInfo> catalog;
  const _WidgetGallerySheet({required this.catalog});
  @override
  State<_WidgetGallerySheet> createState() => _WidgetGallerySheetState();
}

class _WidgetGallerySheetState extends State<_WidgetGallerySheet> {
  String? _selectedType;
  WidgetSize _selectedSize = WidgetSize.medium;

  IconData _iconForType(String type) {
    switch (type) {
      case 'revenue': return PhosphorIconsLight.chartLineUp;
      case 'next_job': return PhosphorIconsLight.briefcase;
      case 'quick_actions': return PhosphorIconsLight.lightning;
      case 'team_pulse': return PhosphorIconsLight.users;
      case 'schedule': return PhosphorIconsLight.calendarDots;
      case 'route': return PhosphorIconsLight.path;
      case 'stats': return PhosphorIconsLight.chartBar;
      default: return PhosphorIconsLight.squaresFour;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'revenue': return ObsidianTheme.emerald;
      case 'next_job': return ObsidianTheme.blue;
      case 'quick_actions': return ObsidianTheme.amber;
      case 'team_pulse': return const Color(0xFF8B5CF6);
      case 'schedule': return ObsidianTheme.blue;
      case 'route': return ObsidianTheme.emerald;
      case 'stats': return ObsidianTheme.indigo;
      default: return ObsidianTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          height: mq.size.height * 0.7,
          decoration: BoxDecoration(
            color: ObsidianTheme.surface1.withValues(alpha: 0.95),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ObsidianTheme.border),
          ),
          child: Column(
            children: [
              // Handle bar
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 36, height: 4,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.borderMedium),
                ),
              ),
              // Title
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Row(
                  children: [
                    Text(
                      'WIDGET GALLERY',
                      style: GoogleFonts.jetBrainsMono(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Icon(PhosphorIconsLight.x, color: ObsidianTheme.textTertiary, size: 20),
                    ),
                  ],
                ),
              ),
              Container(height: 1, color: ObsidianTheme.border),

              // Widget list
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                  itemCount: widget.catalog.length,
                  itemBuilder: (context, i) {
                    final info = widget.catalog[i];
                    final isSelected = _selectedType == info.type;
                    final color = _colorForType(info.type);

                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() {
                          _selectedType = info.type;
                          _selectedSize = info.supportedSizes.contains(WidgetSize.medium) ? WidgetSize.medium : info.supportedSizes.first;
                        });
                      },
                      child: AnimatedContainer(
                        duration: ObsidianTheme.standard,
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          color: isSelected ? color.withValues(alpha: 0.06) : ObsidianTheme.hoverBg,
                          border: Border.all(color: isSelected ? color.withValues(alpha: 0.2) : ObsidianTheme.border),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 36, height: 36,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(10),
                                    color: color.withValues(alpha: 0.1),
                                  ),
                                  child: Icon(_iconForType(info.type), size: 16, color: color),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(info.label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                                      Text(info.description, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                                    ],
                                  ),
                                ),
                                if (isSelected) Icon(PhosphorIconsBold.checkCircle, size: 18, color: color),
                              ],
                            ),

                            // Size selector (expanded)
                            if (isSelected) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: info.supportedSizes.map((s) {
                                  final active = s == _selectedSize;
                                  return Expanded(
                                    child: GestureDetector(
                                      onTap: () {
                                        HapticFeedback.selectionClick();
                                        setState(() => _selectedSize = s);
                                      },
                                      child: Container(
                                        margin: const EdgeInsets.symmetric(horizontal: 3),
                                        padding: const EdgeInsets.symmetric(vertical: 8),
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(8),
                                          color: active ? color.withValues(alpha: 0.15) : ObsidianTheme.surface2,
                                          border: Border.all(color: active ? color.withValues(alpha: 0.3) : ObsidianTheme.border),
                                        ),
                                        child: Center(
                                          child: Text(
                                            s.name.toUpperCase(),
                                            style: GoogleFonts.jetBrainsMono(
                                              fontSize: 10,
                                              color: active ? color : ObsidianTheme.textTertiary,
                                              fontWeight: FontWeight.w600,
                                              letterSpacing: 1,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ],
                        ),
                      ),
                    )
                        .animate()
                        .fadeIn(delay: Duration(milliseconds: 50 * i), duration: 300.ms)
                        .moveY(begin: 8, delay: Duration(milliseconds: 50 * i), duration: 300.ms, curve: Curves.easeOutCubic);
                  },
                ),
              ),

              // Add button
              if (_selectedType != null)
                Padding(
                  padding: EdgeInsets.fromLTRB(16, 0, 16, mq.padding.bottom + 16),
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      Navigator.pop(
                        context,
                        DashboardWidgetConfig(
                          id: 'w${DateTime.now().millisecondsSinceEpoch}',
                          type: _selectedType!,
                          size: _selectedSize,
                        ),
                      );
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: LinearGradient(
                          colors: [
                            _colorForType(_selectedType!),
                            _colorForType(_selectedType!).withValues(alpha: 0.85),
                          ],
                        ),
                      ),
                      child: Center(
                        child: Text(
                          'Add Widget',
                          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                        ),
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 200.ms)
                      .moveY(begin: 8, duration: 200.ms),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
