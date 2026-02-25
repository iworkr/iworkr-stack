import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Organization Settings — The Core Config ──────────────
// ═══════════════════════════════════════════════════════════

class OrgSettingsScreen extends ConsumerStatefulWidget {
  const OrgSettingsScreen({super.key});

  @override
  ConsumerState<OrgSettingsScreen> createState() => _OrgSettingsScreenState();
}

class _OrgSettingsScreenState extends ConsumerState<OrgSettingsScreen> {
  final _nameCtrl = TextEditingController();
  final _taxIdCtrl = TextEditingController();
  final _supportEmailCtrl = TextEditingController();
  final _supportPhoneCtrl = TextEditingController();
  final _taxRateCtrl = TextEditingController();
  String _currency = 'USD';
  String _brandColor = '#10B981';
  bool _loaded = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _taxIdCtrl.dispose();
    _supportEmailCtrl.dispose();
    _supportPhoneCtrl.dispose();
    _taxRateCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadOrgData() async {
    if (_loaded) return;
    final orgId = ref.read(activeWorkspaceIdProvider);
    if (orgId == null) return;

    try {
      final data = await SupabaseService.client
          .from('organizations')
          .select('name, tax_id, support_email, support_phone, default_currency, default_tax_rate, brand_color_hex')
          .eq('id', orgId)
          .single();

      if (mounted) {
        setState(() {
          _nameCtrl.text = data['name'] as String? ?? '';
          _taxIdCtrl.text = data['tax_id'] as String? ?? '';
          _supportEmailCtrl.text = data['support_email'] as String? ?? '';
          _supportPhoneCtrl.text = data['support_phone'] as String? ?? '';
          _taxRateCtrl.text = (data['default_tax_rate'] as num?)?.toStringAsFixed(2) ?? '0.00';
          _currency = data['default_currency'] as String? ?? 'USD';
          _brandColor = data['brand_color_hex'] as String? ?? '#10B981';
          _loaded = true;
        });
      }
    } catch (_) {}
  }

  Future<void> _patchField(String column, dynamic value) async {
    final orgId = ref.read(activeWorkspaceIdProvider);
    if (orgId == null) return;

    try {
      await SupabaseService.client
          .from('organizations')
          .update({column: value})
          .eq('id', orgId);

      ref.invalidate(allWorkspacesProvider);
      ref.invalidate(activeWorkspaceProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Saved', style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 11)),
            backgroundColor: ObsidianTheme.emerald.withValues(alpha: 0.9),
            duration: const Duration(seconds: 1),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          ),
        );
      }
    } catch (_) {}
  }

  void _selectBrandColor(String hex) {
    setState(() => _brandColor = hex);
    _patchField('brand_color_hex', hex);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    // Trigger data load
    _loadOrgData();

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
        ),
        title: Text('Organization', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Business Identity ──────────────────────
            _SectionLabel(text: 'BUSINESS IDENTITY').animate().fadeIn(duration: 300.ms),
            const SizedBox(height: 12),
            _Card(
              child: Column(
                children: [
                  _AutoSaveField(controller: _nameCtrl, label: 'Legal Company Name', icon: PhosphorIconsLight.buildings, onSave: (v) => _patchField('name', v)),
                  _divider(),
                  _AutoSaveField(controller: _taxIdCtrl, label: 'Tax / VAT ID', icon: PhosphorIconsLight.identificationCard, onSave: (v) => _patchField('tax_id', v)),
                  _divider(),
                  _AutoSaveField(controller: _supportEmailCtrl, label: 'Support Email', icon: PhosphorIconsLight.envelope, keyboardType: TextInputType.emailAddress, onSave: (v) => _patchField('support_email', v)),
                  _divider(),
                  _AutoSaveField(controller: _supportPhoneCtrl, label: 'Support Phone', icon: PhosphorIconsLight.phone, keyboardType: TextInputType.phone, onSave: (v) => _patchField('support_phone', v)),
                ],
              ),
            ).animate().fadeIn(delay: 50.ms, duration: 400.ms),

            const SizedBox(height: 28),

            // ── Financial Defaults ────────────────────
            _SectionLabel(text: 'FINANCIAL DEFAULTS').animate().fadeIn(delay: 100.ms, duration: 300.ms),
            const SizedBox(height: 12),
            _Card(
              child: Column(
                children: [
                  _CurrencySelector(
                    value: _currency,
                    onChanged: (v) {
                      setState(() => _currency = v);
                      _patchField('default_currency', v);
                    },
                  ),
                  _divider(),
                  _AutoSaveField(
                    controller: _taxRateCtrl,
                    label: 'Default Tax Rate (%)',
                    icon: PhosphorIconsLight.percent,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    mono: true,
                    onSave: (v) {
                      final rate = double.tryParse(v);
                      if (rate != null) _patchField('default_tax_rate', rate);
                    },
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 150.ms, duration: 400.ms),

            const SizedBox(height: 28),

            // ── Dynamic Branding ──────────────────────
            _SectionLabel(text: 'BRAND COLOR').animate().fadeIn(delay: 200.ms, duration: 300.ms),
            const SizedBox(height: 12),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _BrandColorPicker(
                    activeHex: _brandColor,
                    onSelect: _selectBrandColor,
                  ),
                  const SizedBox(height: 14),
                  _AutoSaveField(
                    controller: TextEditingController(text: _brandColor),
                    label: 'Custom Hex (#RRGGBB)',
                    icon: PhosphorIconsLight.palette,
                    mono: true,
                    onSave: (v) {
                      if (RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(v)) {
                        _selectBrandColor(v);
                      }
                    },
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 250.ms, duration: 400.ms),
          ],
        ),
      ),
    );
  }

  Widget _divider() => Divider(height: 1, color: context.iColors.activeBg);
}

// ── Section Label ────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel({required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text,
        style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5, fontWeight: FontWeight.w500),
      ),
    );
  }
}

// ── Card Container ───────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: child,
    );
  }
}

// ── Auto-Save Stealth Input ──────────────────────────────
// Fires save on focus loss if text changed.

class _AutoSaveField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType keyboardType;
  final bool mono;
  final ValueChanged<String> onSave;

  const _AutoSaveField({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType = TextInputType.text,
    this.mono = false,
    required this.onSave,
  });

  @override
  State<_AutoSaveField> createState() => _AutoSaveFieldState();
}

class _AutoSaveFieldState extends State<_AutoSaveField> {
  final _focus = FocusNode();
  String _originalValue = '';

  @override
  void initState() {
    super.initState();
    _originalValue = widget.controller.text;
    _focus.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocusChange);
    _focus.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (!_focus.hasFocus && widget.controller.text.trim() != _originalValue) {
      _originalValue = widget.controller.text.trim();
      widget.onSave(_originalValue);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: Row(
        children: [
          Icon(widget.icon, size: 16, color: c.textTertiary),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              keyboardType: widget.keyboardType,
              style: widget.mono
                  ? GoogleFonts.jetBrainsMono(color: c.textPrimary, fontSize: 14)
                  : GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
              cursorColor: ObsidianTheme.emerald,
              decoration: InputDecoration(
                hintText: widget.label,
                hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Currency Selector ────────────────────────────────────

class _CurrencySelector extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  const _CurrencySelector({required this.value, required this.onChanged});

  static const _currencies = ['USD', 'AUD', 'GBP', 'EUR', 'CAD', 'NZD', 'ZAR', 'INR'];

  @override
  Widget build(BuildContext context) {
    final ic = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Icon(PhosphorIconsLight.currencyCircleDollar, size: 16, color: ic.textTertiary),
          const SizedBox(width: 12),
          Text('Currency', style: GoogleFonts.inter(fontSize: 14, color: ic.textSecondary)),
          const Spacer(),
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              showModalBottomSheet(
                context: context,
                backgroundColor: Colors.transparent,
                builder: (_) => Container(
                  decoration: BoxDecoration(
                    color: ic.surface,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(height: 12),
                        Container(width: 36, height: 4, decoration: BoxDecoration(color: ic.borderHover, borderRadius: BorderRadius.circular(2))),
                        const SizedBox(height: 16),
                        ..._currencies.map((c) => ListTile(
                          title: Text(c, style: GoogleFonts.jetBrainsMono(color: c == value ? ObsidianTheme.emerald : ic.textPrimary, fontSize: 15)),
                          trailing: c == value ? const Icon(PhosphorIconsBold.check, color: ObsidianTheme.emerald, size: 18) : null,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            onChanged(c);
                            Navigator.pop(context);
                          },
                        )),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                color: ic.border,
                border: Border.all(color: ic.border),
              ),
              child: Text(value, style: GoogleFonts.jetBrainsMono(fontSize: 13, fontWeight: FontWeight.w600, color: ic.textPrimary)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Brand Color Picker ───────────────────────────────────

class _BrandColorPicker extends StatelessWidget {
  final String activeHex;
  final ValueChanged<String> onSelect;

  const _BrandColorPicker({required this.activeHex, required this.onSelect});

  static const _presets = [
    '#10B981', // Emerald
    '#8B5CF6', // Violet
    '#F59E0B', // Amber
    '#F43F5E', // Rose
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#EAB308', // Gold
    '#EC4899', // Pink
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        itemCount: _presets.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final hex = _presets[i];
          final color = Color(int.parse('FF${hex.substring(1)}', radix: 16));
          final active = hex.toUpperCase() == activeHex.toUpperCase();

          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onSelect(hex);
            },
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color,
                border: Border.all(
                  color: active ? Colors.white : Colors.transparent,
                  width: active ? 2.5 : 0,
                ),
                boxShadow: active
                    ? [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 12)]
                    : null,
              ),
              child: active
                  ? const Icon(PhosphorIconsBold.check, size: 16, color: Colors.white)
                  : null,
            ),
          );
        },
      ),
    );
  }
}
