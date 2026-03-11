import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── The Genesis — Immersive Onboarding Flow ──────────────
// ═══════════════════════════════════════════════════════════
//
// A borderless, full-bleed onboarding experience that forks
// between Trades and Care pathways. Each step fills the
// entire screen with a single, focused question. The progress
// bar is a thin luminous strip at the very top.
//
// Project Nightingale: Dual-sector onboarding.

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen>
    with TickerProviderStateMixin {
  final _pageCtrl = PageController();
  int _step = 0;
  static const _totalSteps = 5;

  // Step 0: Sector
  String? _sector; // 'trades' | 'care'

  // Step 1: Role
  String? _role;

  // Step 2: Company
  final _companyCtrl = TextEditingController();

  // Step 3: Industry
  String? _industry;

  // Step 4: Team Size
  String? _teamSize;

  bool _submitting = false;
  late AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    _companyCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  bool get _canProceed {
    switch (_step) {
      case 0:
        return _sector != null;
      case 1:
        return _role != null;
      case 2:
        return _companyCtrl.text.trim().isNotEmpty;
      case 3:
        return _industry != null;
      case 4:
        return _teamSize != null;
      default:
        return false;
    }
  }

  void _next() {
    if (!_canProceed) return;
    HapticFeedback.mediumImpact();

    if (_step < _totalSteps - 1) {
      setState(() => _step++);
      _pageCtrl.animateToPage(
        _step,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _complete();
    }
  }

  void _back() {
    if (_step > 0) {
      HapticFeedback.lightImpact();
      setState(() => _step--);
      _pageCtrl.animateToPage(
        _step,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  Future<void> _complete() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    final userId = SupabaseService.auth.currentUser?.id;
    if (userId == null) return;

    try {
      final companyName = _companyCtrl.text.trim();
      final slug =
          '${companyName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-|-$'), '')}-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';

      // Atomic provisioning via RPC
      final orgData = await SupabaseService.client.rpc(
        'create_organization_with_owner',
        params: {
          'org_name': companyName,
          'org_slug': slug,
          'org_trade': _industry,
        },
      );

      // Set industry_type and team_size
      if (orgData != null) {
        final orgId = orgData['id'] as String;
        final existingSettings =
            (orgData['settings'] as Map<String, dynamic>?) ?? {};
        existingSettings['team_size'] = _teamSize;
        existingSettings['onboarding_role'] = _role;
        await SupabaseService.client.from('organizations').update({
          'settings': existingSettings,
          'industry_type': _sector ?? 'trades',
        }).eq('id', orgId);
      }

      ref.invalidate(profileProvider);
      ref.invalidate(organizationProvider);

      if (!mounted) return;
      context.go('/paywall');
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Setup failed: $e',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.rose,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
  }

  bool get _isCare => _sector == 'care';

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      body: Stack(
        children: [
          // ── Background ambient glow ─────────────────────
          Positioned(
            top: -120,
            left: -60,
            child: AnimatedBuilder(
              animation: _pulseCtrl,
              builder: (_, __) {
                final opacity = 0.03 + (_pulseCtrl.value * 0.04);
                return Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        (_isCare ? ObsidianTheme.blue : ObsidianTheme.emerald)
                            .withValues(alpha: opacity),
                        Colors.transparent,
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // ── Main content ────────────────────────────────
          Column(
            children: [
              SizedBox(height: MediaQuery.of(context).padding.top + 8),

              // ── Top bar: progress + back ────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    // Progress strip
                    _GlowProgress(step: _step, total: _totalSteps, isCare: _isCare),
                    const SizedBox(height: 16),
                    // Back + step label
                    Row(
                      children: [
                        if (_step > 0)
                          GestureDetector(
                            onTap: _back,
                            behavior: HitTestBehavior.opaque,
                            child: Row(
                              children: [
                                Icon(PhosphorIconsLight.arrowLeft,
                                    size: 16, color: c.textTertiary),
                                const SizedBox(width: 6),
                                Text('Back',
                                    style: GoogleFonts.inter(
                                        fontSize: 13, color: c.textTertiary)),
                              ],
                            ),
                          ).animate().fadeIn(duration: 200.ms)
                        else
                          // Logo
                          Image.asset('assets/logos/logo-dark-streamline.png',
                                  width: 24, height: 24)
                              .animate()
                              .fadeIn(duration: 600.ms)
                              .scaleXY(
                                  begin: 0.7,
                                  end: 1,
                                  duration: 600.ms,
                                  curve: Curves.easeOutBack),
                        const Spacer(),
                        Text(
                          '${_step + 1}/$_totalSteps',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: c.textDisabled,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // ── Steps ───────────────────────────────────
              Expanded(
                child: PageView(
                  controller: _pageCtrl,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _StepSector(
                      selected: _sector,
                      onSelect: (v) => setState(() {
                        _sector = v;
                        // Reset downstream selections on sector change
                        _role = null;
                        _industry = null;
                      }),
                    ),
                    _StepRole(
                      isCare: _isCare,
                      selected: _role,
                      onSelect: (v) => setState(() => _role = v),
                    ),
                    _StepCompany(
                      controller: _companyCtrl,
                      isCare: _isCare,
                      onChanged: () => setState(() {}),
                    ),
                    _StepIndustry(
                      isCare: _isCare,
                      selected: _industry,
                      onSelect: (v) => setState(() => _industry = v),
                    ),
                    _StepTeamSize(
                      isCare: _isCare,
                      selected: _teamSize,
                      onSelect: (v) => setState(() => _teamSize = v),
                    ),
                  ],
                ),
              ),

              // ── Bottom CTA ─────────────────────────────
              _BottomCTA(
                canProceed: _canProceed,
                isLastStep: _step == _totalSteps - 1,
                submitting: _submitting,
                isCare: _isCare,
                onTap: _next,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Glow Progress Strip ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _GlowProgress extends StatelessWidget {
  final int step;
  final int total;
  final bool isCare;
  const _GlowProgress({required this.step, required this.total, required this.isCare});

  @override
  Widget build(BuildContext context) {
    final accent = isCare ? ObsidianTheme.blue : ObsidianTheme.emerald;
    final c = context.iColors;
    final progress = (step + 1) / total;

    return Container(
      height: 3,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(2),
        color: c.surfaceSecondary,
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: AnimatedFractionallySizedBox(
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOutCubic,
          widthFactor: progress,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              color: accent,
              boxShadow: [
                BoxShadow(color: accent.withValues(alpha: 0.5), blurRadius: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Bottom CTA ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _BottomCTA extends StatelessWidget {
  final bool canProceed;
  final bool isLastStep;
  final bool submitting;
  final bool isCare;
  final VoidCallback onTap;

  const _BottomCTA({
    required this.canProceed,
    required this.isLastStep,
    required this.submitting,
    required this.isCare,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isCare ? ObsidianTheme.blue : ObsidianTheme.emerald;

    return Padding(
      padding: EdgeInsets.fromLTRB(24, 8, 24, MediaQuery.of(context).padding.bottom + 16),
      child: GestureDetector(
        onTap: canProceed ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          height: 54,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: canProceed ? accent : accent.withValues(alpha: 0.12),
            boxShadow: canProceed
                ? [BoxShadow(color: accent.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))]
                : null,
          ),
          child: Center(
            child: submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        isLastStep ? 'Launch Workspace' : 'Continue',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: canProceed ? Colors.black : accent.withValues(alpha: 0.4),
                          letterSpacing: -0.2,
                        ),
                      ),
                      if (!isLastStep) ...[
                        const SizedBox(width: 8),
                        Icon(
                          PhosphorIconsLight.arrowRight,
                          size: 16,
                          color: canProceed ? Colors.black : accent.withValues(alpha: 0.3),
                        ),
                      ],
                      if (isLastStep) ...[
                        const SizedBox(width: 8),
                        Icon(
                          PhosphorIconsLight.rocketLaunch,
                          size: 18,
                          color: canProceed ? Colors.black : accent.withValues(alpha: 0.3),
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Step 0: Sector Selection (The Fork) ──────────────────
// ═══════════════════════════════════════════════════════════

class _StepSector extends StatelessWidget {
  final String? selected;
  final ValueChanged<String> onSelect;
  const _StepSector({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Welcome to iWorkr',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: c.textTertiary,
              letterSpacing: 0.5,
            ),
          ).animate().fadeIn(duration: 400.ms),
          const SizedBox(height: 8),
          Text(
            'What best describes\nyour business?',
            style: GoogleFonts.inter(
              fontSize: 32,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -1,
              height: 1.15,
            ),
          ).animate().fadeIn(delay: 100.ms, duration: 500.ms).moveY(begin: 16, end: 0),
          const SizedBox(height: 8),
          Text(
            'This shapes your entire experience — from labels to features.',
            style: GoogleFonts.inter(fontSize: 15, color: c.textMuted, height: 1.5),
          ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

          const SizedBox(height: 36),

          // ── Trades Card ─────────────────────────────────
          _SectorCard(
            title: 'Trades & Field Service',
            subtitle: 'Plumbing, HVAC, Electrical, Cleaning, Landscaping, Security, Fire',
            icon: PhosphorIconsLight.wrench,
            accent: ObsidianTheme.emerald,
            isSelected: selected == 'trades',
            onTap: () => onSelect('trades'),
            features: const ['Jobs & quoting', 'Dispatch & fleet', 'Invoicing & payments'],
            delay: 300,
          ),

          const SizedBox(height: 12),

          // ── Care Card ───────────────────────────────────
          _SectorCard(
            title: 'NDIS & Aged Care',
            subtitle: 'Disability support, home care, community access, allied health',
            icon: PhosphorIconsLight.heartbeat,
            accent: ObsidianTheme.blue,
            isSelected: selected == 'care',
            onTap: () => onSelect('care'),
            features: const ['Shift rostering', 'Credential compliance', 'Clinical records & eMAR'],
            delay: 400,
          ),
        ],
      ),
    );
  }
}

class _SectorCard extends StatefulWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final bool isSelected;
  final VoidCallback onTap;
  final List<String> features;
  final int delay;

  const _SectorCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.isSelected,
    required this.onTap,
    required this.features,
    required this.delay,
  });

  @override
  State<_SectorCard> createState() => _SectorCardState();
}

class _SectorCardState extends State<_SectorCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap();
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        transform: _pressed ? Matrix4.diagonal3Values(0.97, 0.97, 1) : Matrix4.identity(),
        transformAlignment: Alignment.center,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: widget.isSelected
              ? widget.accent.withValues(alpha: 0.06)
              : c.surface,
          border: Border.all(
            color: widget.isSelected
                ? widget.accent.withValues(alpha: 0.35)
                : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: widget.isSelected
                        ? widget.accent.withValues(alpha: 0.12)
                        : c.surfaceSecondary,
                  ),
                  child: Center(
                    child: Icon(widget.icon, size: 24,
                        color: widget.isSelected ? widget.accent : c.textMuted),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.title,
                          style: GoogleFonts.inter(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: c.textPrimary,
                            letterSpacing: -0.3,
                          )),
                      const SizedBox(height: 3),
                      Text(widget.subtitle,
                          style: GoogleFonts.inter(fontSize: 12, color: c.textMuted, height: 1.3),
                          maxLines: 2),
                    ],
                  ),
                ),
                if (widget.isSelected)
                  Icon(PhosphorIconsFill.checkCircle, size: 22, color: widget.accent),
              ],
            ),
            // Feature pills
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              child: widget.isSelected
                  ? Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: widget.features.map((f) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: widget.accent.withValues(alpha: 0.08),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(PhosphorIconsLight.check, size: 12, color: widget.accent),
                              const SizedBox(width: 6),
                              Text(f, style: GoogleFonts.inter(
                                  fontSize: 12, color: widget.accent, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        )).toList(),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: widget.delay), duration: 500.ms, curve: Curves.easeOutCubic)
        .moveY(begin: 16, delay: Duration(milliseconds: widget.delay), duration: 500.ms, curve: Curves.easeOutCubic);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Step 1: Role ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StepRole extends StatelessWidget {
  final bool isCare;
  final String? selected;
  final ValueChanged<String> onSelect;
  const _StepRole({required this.isCare, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final roles = isCare ? _careRoles : _tradesRoles;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isCare ? 'Your role in care' : 'Your role in the field',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -0.8,
            ),
          ).animate().fadeIn(duration: 400.ms).moveY(begin: 12, end: 0),
          const SizedBox(height: 6),
          Text(
            'This configures your permissions and experience.',
            style: GoogleFonts.inter(fontSize: 15, color: c.textMuted),
          ).animate().fadeIn(delay: 100.ms, duration: 400.ms),
          const SizedBox(height: 28),
          ...roles.asMap().entries.map((e) {
            final i = e.key;
            final r = e.value;
            return Padding(
              padding: EdgeInsets.only(bottom: i < roles.length - 1 ? 10 : 0),
              child: _ChoiceCard(
                icon: r.icon,
                title: r.title,
                subtitle: r.subtitle,
                tag: r.tag,
                tagColor: r.tagColor,
                isSelected: selected == r.value,
                onTap: () => onSelect(r.value),
                delay: 200 + i * 80,
              ),
            );
          }),
        ],
      ),
    );
  }

  static final _tradesRoles = [
    _RoleData('owner', 'Owner', 'I run the business', PhosphorIconsLight.crown, 'FULL ACCESS', const Color(0xFFA78BFA)),
    _RoleData('dispatcher', 'Dispatcher', 'I manage the team and schedule', PhosphorIconsLight.headset, 'DISPATCH', ObsidianTheme.amber),
    _RoleData('technician', 'Technician', 'I work in the field', PhosphorIconsLight.wrench, 'OPERATOR', ObsidianTheme.emerald),
  ];

  static final _careRoles = [
    _RoleData('owner', 'Provider Owner', 'I run the care organisation', PhosphorIconsLight.crown, 'FULL ACCESS', const Color(0xFFA78BFA)),
    _RoleData('coordinator', 'Care Coordinator', 'I manage rosters and participants', PhosphorIconsLight.headset, 'COORDINATION', ObsidianTheme.blue),
    _RoleData('support_worker', 'Support Worker', 'I deliver direct support', PhosphorIconsLight.heartbeat, 'FIELD', ObsidianTheme.emerald),
  ];
}

class _RoleData {
  final String value;
  final String title;
  final String subtitle;
  final IconData icon;
  final String tag;
  final Color tagColor;
  const _RoleData(this.value, this.title, this.subtitle, this.icon, this.tag, this.tagColor);
}

// ═══════════════════════════════════════════════════════════
// ── Step 2: Company Name ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StepCompany extends StatelessWidget {
  final TextEditingController controller;
  final bool isCare;
  final VoidCallback onChanged;
  const _StepCompany({required this.controller, required this.isCare, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final accent = isCare ? ObsidianTheme.blue : ObsidianTheme.emerald;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isCare ? 'Name your organisation' : 'Name your workspace',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -0.8,
            ),
          ).animate().fadeIn(duration: 400.ms).moveY(begin: 12, end: 0),
          const SizedBox(height: 6),
          Text(
            isCare
                ? 'Your participants and team will see this name.'
                : 'This is how your company appears to your team.',
            style: GoogleFonts.inter(fontSize: 15, color: c.textMuted),
          ).animate().fadeIn(delay: 100.ms, duration: 400.ms),
          const SizedBox(height: 36),

          // Minimalist text field
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: c.surface,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: TextField(
              controller: controller,
              autofocus: true,
              onChanged: (_) => onChanged(),
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: c.textPrimary,
                letterSpacing: -0.3,
              ),
              decoration: InputDecoration(
                hintText: isCare ? 'e.g. Sunrise Care Services' : 'e.g. Acme Electrical',
                hintStyle: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: c.textDisabled,
                  letterSpacing: -0.3,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
              ),
              cursorColor: accent,
            ),
          ).animate().fadeIn(delay: 250.ms, duration: 400.ms).moveY(begin: 8, end: 0),

          const SizedBox(height: 16),
          Text(
            'You can change this later in settings.',
            style: GoogleFonts.inter(fontSize: 13, color: c.textDisabled),
          ).animate().fadeIn(delay: 400.ms, duration: 300.ms),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Step 3: Industry / Specialty ─────────────────────────
// ═══════════════════════════════════════════════════════════

class _StepIndustry extends StatelessWidget {
  final bool isCare;
  final String? selected;
  final ValueChanged<String> onSelect;
  const _StepIndustry({required this.isCare, required this.selected, required this.onSelect});

  static const _tradesIndustries = [
    ('HVAC', PhosphorIconsLight.thermometerSimple),
    ('Electrical', PhosphorIconsLight.lightning),
    ('Plumbing', PhosphorIconsLight.drop),
    ('Fire', PhosphorIconsLight.fireTruck),
    ('Security', PhosphorIconsLight.shieldCheck),
    ('Cleaning', PhosphorIconsLight.broom),
    ('Landscaping', PhosphorIconsLight.tree),
    ('General', PhosphorIconsLight.toolbox),
  ];

  static const _careSpecialties = [
    ('Disability Support', PhosphorIconsLight.wheelchair),
    ('Aged Care', PhosphorIconsLight.heart),
    ('Home Care', PhosphorIconsLight.house),
    ('Community Access', PhosphorIconsLight.mapTrifold),
    ('Allied Health', PhosphorIconsLight.stethoscope),
    ('Supported Living', PhosphorIconsLight.bed),
    ('Mental Health', PhosphorIconsLight.brain),
    ('General Care', PhosphorIconsLight.firstAidKit),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final accent = isCare ? ObsidianTheme.blue : ObsidianTheme.emerald;
    final items = isCare ? _careSpecialties : _tradesIndustries;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isCare ? 'What type of care?' : 'Pick your trade',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -0.8,
            ),
          ).animate().fadeIn(duration: 400.ms).moveY(begin: 12, end: 0),
          const SizedBox(height: 6),
          Text(
            isCare
                ? 'We\'ll configure compliance rules and forms for you.'
                : 'We\'ll customize your workflow for this trade.',
            style: GoogleFonts.inter(fontSize: 15, color: c.textMuted),
          ).animate().fadeIn(delay: 100.ms, duration: 400.ms),
          const SizedBox(height: 28),

          // 2-column grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 2.2,
            children: items.asMap().entries.map((entry) {
              final i = entry.key;
              final (label, icon) = entry.value;
              final isSelected = selected == label;

              return GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onSelect(label);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: isSelected ? accent.withValues(alpha: 0.08) : c.surface,
                    border: Border.all(
                      color: isSelected ? accent.withValues(alpha: 0.35) : Colors.transparent,
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(icon, size: 20, color: isSelected ? accent : c.textMuted),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          label,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? c.textPrimary : c.textSecondary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              )
                  .animate()
                  .fadeIn(delay: Duration(milliseconds: 200 + i * 40), duration: 350.ms)
                  .scaleXY(begin: 0.92, delay: Duration(milliseconds: 200 + i * 40), duration: 350.ms, curve: Curves.easeOutCubic);
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Step 4: Team Size ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _StepTeamSize extends StatelessWidget {
  final bool isCare;
  final String? selected;
  final ValueChanged<String> onSelect;
  const _StepTeamSize({required this.isCare, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final accent = isCare ? ObsidianTheme.blue : ObsidianTheme.emerald;

    final sizes = [
      ('Just Me', '1', PhosphorIconsLight.user, 'Solo operator'),
      ('2–5', '2-5', PhosphorIconsLight.usersThree, isCare ? 'Small care team' : 'Small crew'),
      ('6–20', '6-20', PhosphorIconsLight.users, isCare ? 'Growing provider' : 'Growing business'),
      ('20+', '20+', PhosphorIconsLight.buildings, 'Enterprise'),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isCare ? 'How many support workers?' : 'How many in your fleet?',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: c.textPrimary,
              letterSpacing: -0.8,
            ),
          ).animate().fadeIn(duration: 400.ms).moveY(begin: 12, end: 0),
          const SizedBox(height: 6),
          Text(
            'We\'ll tailor your experience to match.',
            style: GoogleFonts.inter(fontSize: 15, color: c.textMuted),
          ).animate().fadeIn(delay: 100.ms, duration: 400.ms),
          const SizedBox(height: 28),

          ...sizes.asMap().entries.map((e) {
            final i = e.key;
            final (label, value, icon, hint) = e.value;
            final isSelected = selected == value;

            return Padding(
              padding: EdgeInsets.only(bottom: i < sizes.length - 1 ? 10 : 0),
              child: _ChoiceCard(
                icon: icon,
                title: label,
                subtitle: hint,
                tag: (value == '6-20' || value == '20+') ? 'PRO' : null,
                tagColor: accent,
                isSelected: isSelected,
                onTap: () => onSelect(value),
                delay: 200 + i * 80,
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Shared: Choice Card ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _ChoiceCard extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? tag;
  final Color tagColor;
  final bool isSelected;
  final VoidCallback onTap;
  final int delay;

  const _ChoiceCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.tag,
    required this.tagColor,
    required this.isSelected,
    required this.onTap,
    required this.delay,
  });

  @override
  State<_ChoiceCard> createState() => _ChoiceCardState();
}

class _ChoiceCardState extends State<_ChoiceCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap();
      },
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        transform: _pressed ? Matrix4.diagonal3Values(0.97, 0.97, 1) : Matrix4.identity(),
        transformAlignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: widget.isSelected
              ? widget.tagColor.withValues(alpha: 0.06)
              : c.surface,
          border: Border.all(
            color: widget.isSelected
                ? widget.tagColor.withValues(alpha: 0.35)
                : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: widget.isSelected
                    ? widget.tagColor.withValues(alpha: 0.12)
                    : c.surfaceSecondary,
              ),
              child: Center(
                child: Icon(widget.icon, size: 20,
                    color: widget.isSelected ? widget.tagColor : c.textMuted),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.title,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: c.textPrimary,
                      )),
                  const SizedBox(height: 2),
                  Text(widget.subtitle,
                      style: GoogleFonts.inter(fontSize: 12, color: c.textMuted)),
                ],
              ),
            ),
            if (widget.tag != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: widget.tagColor.withValues(alpha: 0.1),
                ),
                child: Text(
                  widget.tag!,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 8,
                    fontWeight: FontWeight.w700,
                    color: widget.tagColor,
                    letterSpacing: 1,
                  ),
                ),
              ),
            if (widget.isSelected)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Icon(PhosphorIconsFill.checkCircle, size: 20, color: widget.tagColor),
              ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: widget.delay), duration: 400.ms, curve: Curves.easeOutCubic)
        .moveY(begin: 12, delay: Duration(milliseconds: widget.delay), duration: 400.ms, curve: Curves.easeOutCubic);
  }
}
