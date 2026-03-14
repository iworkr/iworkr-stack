import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import 'package:iworkr_mobile/core/services/incidents_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/incident.dart';

// ═══════════════════════════════════════════════════════════
// ── Create Incident — Rapid Field Reporting ──────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// 5-step rapid incident form: Category → Severity → Description
// → Immediate Actions → Photo Evidence. With restrictive practice
// extra fields when applicable.

class CreateIncidentScreen extends ConsumerStatefulWidget {
  const CreateIncidentScreen({super.key});

  @override
  ConsumerState<CreateIncidentScreen> createState() => _CreateIncidentScreenState();
}

class _CreateIncidentScreenState extends ConsumerState<CreateIncidentScreen> {
  IncidentCategory _category = IncidentCategory.other;
  IncidentSeverity _severity = IncidentSeverity.medium;
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _actionsCtrl = TextEditingController();
  final _restraintTypeCtrl = TextEditingController();
  final _restraintDurationCtrl = TextEditingController();
  bool _restraintAuthorized = false;
  final List<XFile> _photos = [];
  bool _submitting = false;
  final _stt = stt.SpeechToText();
  bool _isListening = false;
  final _picker = ImagePicker();

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _actionsCtrl.dispose();
    _restraintTypeCtrl.dispose();
    _restraintDurationCtrl.dispose();
    super.dispose();
  }

  Future<void> _toggleVoice() async {
    if (_isListening) {
      _stt.stop();
      setState(() => _isListening = false);
      return;
    }
    final available = await _stt.initialize();
    if (!available) return;
    setState(() => _isListening = true);
    _stt.listen(
      onResult: (r) {
        setState(() {
          _descCtrl.text = r.recognizedWords;
          if (r.finalResult) _isListening = false;
        });
      },
      listenFor: const Duration(minutes: 2),
    );
  }

  Future<void> _takePhoto() async {
    final photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 1200);
    if (photo != null) setState(() => _photos.add(photo));
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty || _descCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please fill in the title and description.', style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.amber,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await createIncident(
        category: _category,
        severity: _severity,
        title: _titleCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        immediateActions: _actionsCtrl.text.trim().isNotEmpty ? _actionsCtrl.text.trim() : null,
      );

      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Incident reported successfully', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.emerald,
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.canPop() ? context.pop() : context.go('/');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e', style: GoogleFonts.inter(color: Colors.white)), backgroundColor: ObsidianTheme.rose, behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isRestrictive = _category == IncidentCategory.restrictivePractice;

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); context.canPop() ? context.pop() : context.go('/'); },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text('Report Incident', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3)),
            flexibleSpace: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24), child: Container(color: c.canvas.withValues(alpha: 0.85)))),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Step 1: Category ──────────────────────
                Text('CATEGORY', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: IncidentCategory.values.map((cat) {
                    final isSelected = _category == cat;
                    return GestureDetector(
                      onTap: () { HapticFeedback.selectionClick(); setState(() => _category = cat); },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? ObsidianTheme.amber.withValues(alpha: 0.15) : c.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: isSelected ? ObsidianTheme.amber.withValues(alpha: 0.4) : c.border),
                        ),
                        child: Text(cat.label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: isSelected ? ObsidianTheme.amber : c.textSecondary)),
                      ),
                    );
                  }).toList(),
                ).animate().fadeIn(duration: 300.ms),
                const SizedBox(height: 20),

                // ── Step 2: Severity ──────────────────────
                Text('SEVERITY', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Row(
                  children: IncidentSeverity.values.map((sev) {
                    final isSelected = _severity == sev;
                    final color = switch (sev) {
                      IncidentSeverity.low => ObsidianTheme.emerald,
                      IncidentSeverity.medium => ObsidianTheme.amber,
                      IncidentSeverity.high => ObsidianTheme.rose,
                      IncidentSeverity.critical => const Color(0xFFDC2626),
                    };
                    return Expanded(
                      child: GestureDetector(
                        onTap: () { HapticFeedback.selectionClick(); setState(() => _severity = sev); },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.only(right: 6),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: isSelected ? color.withValues(alpha: 0.15) : c.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: isSelected ? color.withValues(alpha: 0.4) : c.border),
                          ),
                          child: Center(
                            child: Text(sev.label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: isSelected ? color : c.textSecondary)),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
                const SizedBox(height: 20),

                // ── Title ─────────────────────────────────
                Text('TITLE', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _IncidentField(controller: _titleCtrl, hint: 'Brief incident title'),
                const SizedBox(height: 16),

                // ── Step 3: Description ───────────────────
                Text('WHAT HAPPENED?', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    children: [
                      TextField(
                        controller: _descCtrl,
                        maxLines: 4,
                        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.5),
                        decoration: InputDecoration(
                          hintText: 'Describe what happened in detail...',
                          hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.all(14),
                        ),
                      ),
                      Divider(height: 1, color: c.border),
                      GestureDetector(
                        onTap: _toggleVoice,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(_isListening ? PhosphorIconsFill.microphone : PhosphorIconsLight.microphone, size: 18, color: _isListening ? ObsidianTheme.rose : ObsidianTheme.careBlue),
                              const SizedBox(width: 6),
                              Text(_isListening ? 'Listening...' : 'Dictate', style: GoogleFonts.inter(fontSize: 13, color: _isListening ? ObsidianTheme.rose : ObsidianTheme.careBlue)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 200.ms, duration: 300.ms),
                const SizedBox(height: 16),

                // ── Step 4: Immediate Actions ─────────────
                Text('IMMEDIATE ACTIONS TAKEN', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _IncidentField(controller: _actionsCtrl, hint: 'e.g., Applied first aid, called ambulance...', maxLines: 3),
                const SizedBox(height: 16),

                // ── Restrictive Practice Extra Fields ─────
                if (isRestrictive) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: ObsidianTheme.rose.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(PhosphorIconsLight.shieldWarning, size: 16, color: ObsidianTheme.rose),
                            const SizedBox(width: 8),
                            Text('RESTRICTIVE PRACTICE DETAILS', style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w700, color: ObsidianTheme.rose, letterSpacing: 0.8)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text('TYPE OF RESTRAINT', style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                        const SizedBox(height: 4),
                        _IncidentField(controller: _restraintTypeCtrl, hint: 'e.g., Environmental, Physical, Chemical...'),
                        const SizedBox(height: 12),
                        Text('DURATION (MINUTES)', style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                        const SizedBox(height: 4),
                        _IncidentField(controller: _restraintDurationCtrl, hint: '0', keyboard: TextInputType.number),
                        const SizedBox(height: 12),
                        GestureDetector(
                          onTap: () => setState(() => _restraintAuthorized = !_restraintAuthorized),
                          child: Row(
                            children: [
                              Icon(_restraintAuthorized ? PhosphorIconsFill.checkSquare : PhosphorIconsLight.square, size: 22, color: _restraintAuthorized ? ObsidianTheme.careBlue : c.textTertiary),
                              const SizedBox(width: 8),
                              Expanded(child: Text('Authorized in Behaviour Support Plan', style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary))),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(duration: 300.ms),
                ],

                // ── Step 5: Photo Evidence ────────────────
                Text('PHOTOGRAPHIC EVIDENCE', style: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    GestureDetector(
                      onTap: _takePhoto,
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: c.border, style: BorderStyle.solid),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(PhosphorIconsLight.camera, size: 24, color: ObsidianTheme.careBlue),
                            const SizedBox(height: 4),
                            Text('Photo', style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (_photos.isNotEmpty)
                      Text('${_photos.length} photo${_photos.length > 1 ? 's' : ''} attached', style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.careBlue)),
                  ],
                ),
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).viewPadding.bottom + 12),
        decoration: BoxDecoration(color: c.canvas, border: Border(top: BorderSide(color: c.border))),
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _submitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: ObsidianTheme.amber,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: _submitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                : Text('Submit Incident Report', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}

class _IncidentField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final int maxLines;
  final TextInputType? keyboard;
  const _IncidentField({required this.controller, required this.hint, this.maxLines = 1, this.keyboard});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.border),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboard,
        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }
}
