import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/safety_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/safety_assessment.dart';

/// Opens the Safety Shield as a full-screen blocking modal.
Future<bool> showSafetyShield(BuildContext context, {required String jobId}) {
  return Navigator.of(context, rootNavigator: true).push<bool>(
    PageRouteBuilder<bool>(
      opaque: true,
      pageBuilder: (_, __, ___) => SafetyShieldScreen(jobId: jobId),
      transitionsBuilder: (_, a, __, child) =>
          FadeTransition(opacity: a, child: child),
      transitionDuration: const Duration(milliseconds: 400),
    ),
  ).then((v) => v ?? false);
}

class SafetyShieldScreen extends ConsumerStatefulWidget {
  final String jobId;
  const SafetyShieldScreen({super.key, required this.jobId});

  @override
  ConsumerState<SafetyShieldScreen> createState() => _SafetyShieldScreenState();
}

class _SafetyShieldScreenState extends ConsumerState<SafetyShieldScreen>
    with TickerProviderStateMixin {
  final Map<String, bool> _selectedHazards = {};
  final Map<String, String> _selectedControls = {};
  bool _loneWorkerEnabled = false;
  bool _saving = false;
  bool _siteSafeLongPressing = false;
  late AnimationController _borderPulse;
  late AnimationController _shieldPulse;

  @override
  void initState() {
    super.initState();
    _borderPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _shieldPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    for (final h in HazardCatalog.standard) {
      _selectedHazards[h.key] = false;
    }

    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
  }

  @override
  void dispose() {
    _borderPulse.dispose();
    _shieldPulse.dispose();
    super.dispose();
  }

  bool get _anyHazardSelected => _selectedHazards.values.any((v) => v);

  bool get _allControlsFilled {
    for (final entry in _selectedHazards.entries) {
      if (entry.value && (_selectedControls[entry.key]?.isEmpty ?? true)) {
        return false;
      }
    }
    return true;
  }

  bool get _canClear => !_anyHazardSelected || _allControlsFilled;

  Future<void> _submitAssessment({required bool siteSafe}) async {
    setState(() => _saving = true);
    HapticFeedback.heavyImpact();

    final hazards = HazardCatalog.standard.map((h) {
      return HazardEntry(
        key: h.key,
        label: h.label,
        icon: h.icon,
        selected: _selectedHazards[h.key] ?? false,
      );
    }).toList();

    final controls = _selectedControls.entries
        .where((e) => e.value.isNotEmpty)
        .map((e) => ControlMeasure(hazardKey: e.key, measure: e.value))
        .toList();

    final result = await createSafetyAssessment(
      jobId: widget.jobId,
      hazards: hazards,
      controlMeasures: controls,
      siteSafe: siteSafe,
      loneWorkerEnabled: _loneWorkerEnabled,
    );

    if (!mounted) return;
    setState(() => _saving = false);

    if (result != null) {
      ref.invalidate(jobSafetyProvider(widget.jobId));
      ref.invalidate(isJobSafetyClearedProvider(widget.jobId));
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: c.canvas,
      body: AnimatedBuilder(
        animation: _borderPulse,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: ObsidianTheme.amber.withValues(alpha: 0.3 + _borderPulse.value * 0.4),
                width: 3,
              ),
            ),
            child: child,
          );
        },
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(mq),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    const SizedBox(height: 16),
                    _buildHazardMatrix(),
                    const SizedBox(height: 24),
                    _buildLoneWorkerToggle(),
                    const SizedBox(height: 32),
                    _buildActions(),
                    SizedBox(height: mq.padding.bottom + 24),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(MediaQueryData mq) {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: BoxDecoration(
        color: c.canvas,
        border: Border(
          bottom: BorderSide(color: ObsidianTheme.amber.withValues(alpha: 0.15)),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.of(context).pop(false),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: c.border,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(PhosphorIconsLight.x, color: c.textSecondary, size: 20),
                ),
              ),
              const Spacer(),
              AnimatedBuilder(
                animation: _shieldPulse,
                builder: (_, child) => Opacity(
                  opacity: 0.6 + _shieldPulse.value * 0.4,
                  child: child,
                ),
                child: Icon(PhosphorIconsBold.shieldWarning, color: ObsidianTheme.amber, size: 28),
              ),
              const Spacer(),
              const SizedBox(width: 36),
            ],
          ),
          const SizedBox(height: 16),
          // Hazard stripe
          _HazardStripe(),
          const SizedBox(height: 16),
          Text(
            'RISK ASSESSMENT REQUIRED',
            style: GoogleFonts.jetBrainsMono(
              color: ObsidianTheme.amber,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Timer cannot start until safety shield is cleared',
            style: GoogleFonts.inter(
              color: c.textTertiary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms)
        .moveY(begin: -10, duration: 500.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildHazardMatrix() {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'HAZARD MATRIX',
          style: GoogleFonts.jetBrainsMono(
            color: c.textTertiary,
            fontSize: 11,
            fontWeight: FontWeight.w500,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1.15,
          ),
          itemCount: HazardCatalog.standard.length,
          itemBuilder: (context, index) {
            final hazard = HazardCatalog.standard[index];
            final isSelected = _selectedHazards[hazard.key] ?? false;
            return _HazardCard(
              hazard: hazard,
              isSelected: isSelected,
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() {
                  _selectedHazards[hazard.key] = !isSelected;
                  if (!isSelected == false) {
                    _selectedControls.remove(hazard.key);
                  }
                });
              },
            )
                .animate()
                .fadeIn(
                  delay: Duration(milliseconds: 50 * index),
                  duration: 400.ms,
                )
                .scale(
                  begin: const Offset(0.9, 0.9),
                  delay: Duration(milliseconds: 50 * index),
                  duration: 400.ms,
                  curve: Curves.easeOutCubic,
                );
          },
        ),
        // Control measure dropdowns for selected hazards
        ..._buildControlDropdowns(),
      ],
    );
  }

  List<Widget> _buildControlDropdowns() {
    final c = context.iColors;
    final selected = _selectedHazards.entries.where((e) => e.value).toList();
    if (selected.isEmpty) return [];

    return [
      const SizedBox(height: 20),
      Text(
        'CONTROL MEASURES',
        style: GoogleFonts.jetBrainsMono(
          color: c.textTertiary,
          fontSize: 11,
          fontWeight: FontWeight.w500,
          letterSpacing: 1.5,
        ),
      ),
      const SizedBox(height: 10),
      ...selected.map((entry) {
        final hazard = HazardCatalog.standard.firstWhere((h) => h.key == entry.key);
        final controls = HazardCatalog.controls[entry.key] ?? [];
        final currentValue = _selectedControls[entry.key];

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: ObsidianTheme.amber.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.15)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                hazard.label,
                style: GoogleFonts.inter(
                  color: ObsidianTheme.amber,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: currentValue,
                hint: Text(
                  'Select control measure...',
                  style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                ),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.transparent,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 10),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                ),
                dropdownColor: c.surfaceSecondary,
                style: GoogleFonts.inter(color: c.textPrimary, fontSize: 13),
                items: controls.map((c) {
                  return DropdownMenuItem(value: c, child: Text(c));
                }).toList(),
                onChanged: (value) {
                  if (value != null) {
                    HapticFeedback.selectionClick();
                    setState(() => _selectedControls[entry.key] = value);
                  }
                },
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(duration: 300.ms)
            .moveY(begin: 8, duration: 300.ms, curve: Curves.easeOutCubic);
      }),
    ];
  }

  Widget _buildLoneWorkerToggle() {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.hoverBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _loneWorkerEnabled
              ? ObsidianTheme.amber.withValues(alpha: 0.3)
              : c.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _loneWorkerEnabled
                  ? ObsidianTheme.amber.withValues(alpha: 0.15)
                  : c.border,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              PhosphorIconsLight.userFocus,
              color: _loneWorkerEnabled ? ObsidianTheme.amber : c.textTertiary,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LONE WORKER MODE',
                  style: GoogleFonts.jetBrainsMono(
                    color: c.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Check-in every 30 min. Alerts admin if no response.',
                  style: GoogleFonts.inter(
                    color: c.textTertiary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: _loneWorkerEnabled,
            activeTrackColor: ObsidianTheme.amber.withValues(alpha: 0.5),
            thumbColor: WidgetStateProperty.resolveWith((states) =>
              states.contains(WidgetState.selected) ? ObsidianTheme.amber : c.textTertiary),
            onChanged: (v) {
              HapticFeedback.selectionClick();
              setState(() => _loneWorkerEnabled = v);
            },
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 400.ms, duration: 500.ms)
        .moveY(begin: 8, delay: 400.ms, duration: 500.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildActions() {
    final c = context.iColors;
    return Column(
      children: [
        // Site Safe (long press)
        if (!_anyHazardSelected)
          GestureDetector(
            onLongPressStart: (_) {
              HapticFeedback.mediumImpact();
              setState(() => _siteSafeLongPressing = true);
            },
            onLongPressEnd: (_) {
              setState(() => _siteSafeLongPressing = false);
            },
            onLongPress: () => _submitAssessment(siteSafe: true),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18),
              decoration: BoxDecoration(
                color: _siteSafeLongPressing
                    ? ObsidianTheme.emerald.withValues(alpha: 0.25)
                    : ObsidianTheme.emerald.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _siteSafeLongPressing
                      ? ObsidianTheme.emerald
                      : ObsidianTheme.emerald.withValues(alpha: 0.3),
                  width: _siteSafeLongPressing ? 2 : 1,
                ),
              ),
              child: Column(
                children: [
                  Icon(
                    PhosphorIconsBold.shieldCheck,
                    color: ObsidianTheme.emerald,
                    size: 28,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'SITE SAFE',
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.emerald,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Long press to confirm no hazards present',
                    style: GoogleFonts.inter(
                      color: c.textTertiary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(delay: 500.ms, duration: 500.ms)
              .scale(
                begin: const Offset(0.95, 0.95),
                delay: 500.ms,
                duration: 500.ms,
                curve: Curves.easeOutCubic,
              ),

        // Clear with controls
        if (_anyHazardSelected) ...[
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_canClear && !_saving) ? () => _submitAssessment(siteSafe: false) : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _canClear ? ObsidianTheme.emerald : c.textTertiary.withValues(alpha: 0.2),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(PhosphorIconsBold.shieldCheck, size: 20),
                        const SizedBox(width: 10),
                        Text(
                          'CLEAR SHIELD',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms)
              .moveY(begin: 10, duration: 400.ms, curve: Curves.easeOutCubic),
          if (!_canClear)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Select control measures for all identified hazards',
                style: GoogleFonts.inter(
                  color: ObsidianTheme.rose,
                  fontSize: 12,
                ),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ],
    );
  }
}

// ── Hazard Card ─────────────────────────────────────
class _HazardCard extends StatelessWidget {
  final HazardEntry hazard;
  final bool isSelected;
  final VoidCallback onTap;

  const _HazardCard({required this.hazard, required this.isSelected, required this.onTap});

  IconData _iconForKey(String key) {
    switch (key) {
      case 'heights':
        return PhosphorIconsLight.ladder;
      case 'electrical':
        return PhosphorIconsLight.lightning;
      case 'confined':
        return PhosphorIconsLight.cube;
      case 'chemical':
        return PhosphorIconsLight.flask;
      case 'heat':
        return PhosphorIconsLight.fire;
      case 'noise':
        return PhosphorIconsLight.speakerHigh;
      case 'manual':
        return PhosphorIconsLight.person;
      case 'traffic':
        return PhosphorIconsLight.car;
      case 'asbestos':
        return PhosphorIconsLight.warning;
      case 'fall':
        return PhosphorIconsLight.warning;
      case 'weather':
        return PhosphorIconsLight.cloudRain;
      default:
        return PhosphorIconsLight.dotsThree;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        decoration: BoxDecoration(
          color: isSelected
              ? ObsidianTheme.amber.withValues(alpha: 0.12)
              : c.hoverBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? ObsidianTheme.amber.withValues(alpha: 0.5)
                : c.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _iconForKey(hazard.key),
              color: isSelected ? ObsidianTheme.amber : c.textTertiary,
              size: 26,
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(
                hazard.label,
                style: GoogleFonts.inter(
                  color: isSelected ? c.textPrimary : c.textTertiary,
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Hazard Stripe (Industrial Warning) ──────────────
class _HazardStripe extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 6,
      child: CustomPaint(
        painter: _HazardStripePainter(),
        size: const Size(double.infinity, 6),
      ),
    );
  }
}

class _HazardStripePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const stripeWidth = 12.0;
    final paint = Paint()..style = PaintingStyle.fill;

    for (double x = -stripeWidth; x < size.width + stripeWidth; x += stripeWidth * 2) {
      final path = Path()
        ..moveTo(x, 0)
        ..lineTo(x + stripeWidth, 0)
        ..lineTo(x + stripeWidth * 2, size.height)
        ..lineTo(x + stripeWidth, size.height)
        ..close();

      paint.color = const Color(0xFFF59E0B).withValues(alpha: 0.6);
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
