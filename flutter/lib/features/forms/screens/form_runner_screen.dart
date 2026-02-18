import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/forms_provider.dart';
import 'package:iworkr_mobile/core/services/telemetry_provider.dart' show logTelemetryEvent;
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/form_template.dart';
import 'package:iworkr_mobile/models/telemetry_event.dart';

/// Opens the Form Runner as a full-screen modal.
/// Returns `true` if the form was submitted, `false`/`null` if dismissed.
Future<bool?> showFormRunner(
  BuildContext context, {
  required FormTemplate template,
  required String jobId,
}) {
  HapticFeedback.mediumImpact();
  return Navigator.of(context, rootNavigator: true).push<bool>(
    PageRouteBuilder<bool>(
      opaque: true,
      pageBuilder: (_, __, ___) => FormRunnerScreen(
        template: template,
        jobId: jobId,
      ),
      transitionsBuilder: (_, a, __, child) {
        return SlideTransition(
          position: Tween(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 400),
    ),
  );
}

class FormRunnerScreen extends ConsumerStatefulWidget {
  final FormTemplate template;
  final String jobId;

  const FormRunnerScreen({
    super.key,
    required this.template,
    required this.jobId,
  });

  @override
  ConsumerState<FormRunnerScreen> createState() => _FormRunnerScreenState();
}

class _FormRunnerScreenState extends ConsumerState<FormRunnerScreen>
    with TickerProviderStateMixin {
  final Map<String, dynamic> _values = {};
  final ScrollController _scroll = ScrollController();
  bool _submitting = false;
  bool _submitted = false;
  String? _signatureSvg;
  late AnimationController _stampCtrl;

  @override
  void initState() {
    super.initState();
    _stampCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void dispose() {
    _scroll.dispose();
    _stampCtrl.dispose();
    super.dispose();
  }

  int get _totalFields => widget.template.totalFields;

  int get _completedFields {
    int count = 0;
    for (final section in widget.template.sections) {
      for (final field in section.fields) {
        final val = _values[field.id];
        if (val != null && val.toString().isNotEmpty) count++;
      }
    }
    return count;
  }

  double get _progress => _totalFields == 0 ? 1.0 : _completedFields / _totalFields;

  bool get _canSubmit {
    for (final section in widget.template.sections) {
      for (final field in section.fields) {
        if (field.required) {
          final val = _values[field.id];
          if (val == null || val.toString().isEmpty) return false;
        }
      }
    }
    if (widget.template.requiresSignature && _signatureSvg == null) return false;
    return true;
  }

  Future<void> _submit() async {
    if (!_canSubmit || _submitting) return;
    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    final response = await submitFormResponse(
      formTemplateId: widget.template.id,
      jobId: widget.jobId,
      data: Map.from(_values),
      signatureSvg: _signatureSvg,
    );

    if (response != null) {
      ref.invalidate(jobFormResponsesProvider(widget.jobId));
      ref.invalidate(preJobFormsCompleteProvider(widget.jobId));
      ref.invalidate(postJobFormsCompleteProvider(widget.jobId));

      await logTelemetryEvent(
        jobId: widget.jobId,
        eventType: TelemetryEventType.formSubmitted,
        eventData: {
          'form_id': widget.template.id,
          'form_title': widget.template.title,
          'stage': widget.template.stage.value,
        },
      );

      setState(() {
        _submitted = true;
        _submitting = false;
      });
      _stampCtrl.forward();

      await Future.delayed(const Duration(milliseconds: 1500));
      if (mounted) Navigator.pop(context, true);
    } else {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit form', style: GoogleFonts.inter()),
            backgroundColor: ObsidianTheme.rose,
          ),
        );
      }
    }
  }

  void _openSignaturePad() async {
    HapticFeedback.mediumImpact();
    final svg = await Navigator.of(context, rootNavigator: true).push<String?>(
      PageRouteBuilder(
        opaque: true,
        pageBuilder: (_, __, ___) => const _WetInkSignaturePad(),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: a, child: child),
        transitionDuration: const Duration(milliseconds: 250),
      ),
    );
    if (svg != null && mounted) {
      setState(() => _signatureSvg = svg);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: Stack(
        children: [
          // Main content
          Column(
            children: [
              SizedBox(height: mq.padding.top),
              _buildHeader(),
              _buildProgressBar(),
              Expanded(child: _buildFormContent()),
              _buildFooter(mq),
            ],
          ),

          // Stamp overlay
          if (_submitted) _buildStampOverlay(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: BoxDecoration(
        color: ObsidianTheme.void_,
        border: Border(
          bottom: BorderSide(color: ObsidianTheme.border),
        ),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.pop(context, false);
            },
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.hoverBg,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: const Center(
                child: Icon(PhosphorIconsLight.x, size: 16, color: ObsidianTheme.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.template.title,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (widget.template.description != null)
                  Text(
                    widget.template.description!,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: ObsidianTheme.textTertiary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ObsidianTheme.emeraldDim,
              borderRadius: ObsidianTheme.radiusFull,
            ),
            child: Text(
              widget.template.stage.label.toUpperCase(),
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: ObsidianTheme.emerald,
                letterSpacing: 1,
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).moveY(begin: -8, duration: 300.ms);
  }

  Widget _buildProgressBar() {
    final pct = (_progress * 100).round();
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: ObsidianTheme.surface1,
      child: Row(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: ObsidianTheme.radiusFull,
              child: AnimatedContainer(
                duration: ObsidianTheme.standard,
                height: 4,
                child: Stack(
                  children: [
                    Container(color: Colors.white.withValues(alpha: 0.06)),
                    FractionallySizedBox(
                      widthFactor: _progress,
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusFull,
                          color: ObsidianTheme.emerald,
                          boxShadow: [
                            BoxShadow(
                              color: ObsidianTheme.emeraldGlow,
                              blurRadius: 8,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '$pct%',
            style: GoogleFonts.jetBrainsMono(
              fontSize: 10,
              color: ObsidianTheme.emerald,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormContent() {
    if (widget.template.sections.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsLight.fileText, size: 48, color: ObsidianTheme.textTertiary),
            const SizedBox(height: 12),
            Text(
              'No fields configured',
              style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textMuted),
            ),
          ],
        ).animate().fadeIn(duration: 400.ms),
      );
    }

    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      itemCount: widget.template.sections.length,
      itemBuilder: (context, sIdx) {
        final section = widget.template.sections[sIdx];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Sticky section header
            Container(
              margin: EdgeInsets.only(top: sIdx == 0 ? 8 : 24, bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.03),
                borderRadius: ObsidianTheme.radiusMd,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 3,
                    height: 14,
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusFull,
                      color: ObsidianTheme.emerald,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    section.title.toUpperCase(),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.textSecondary,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(delay: Duration(milliseconds: 60 * sIdx), duration: 400.ms)
                .moveX(begin: -8, duration: 400.ms),

            // Fields
            ...section.fields.asMap().entries.map((entry) {
              final fIdx = entry.key;
              final field = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildField(field),
              )
                  .animate()
                  .fadeIn(
                    delay: Duration(milliseconds: 60 * sIdx + 30 * fIdx),
                    duration: 400.ms,
                  )
                  .moveY(begin: 10, duration: 400.ms, curve: Curves.easeOutCubic);
            }),
          ],
        );
      },
    );
  }

  Widget _buildField(FormFieldDef field) {
    switch (field.type) {
      case FormFieldType.boolean:
      case FormFieldType.yesNoNa:
        return _YesNoField(
          field: field,
          value: _values[field.id] as String?,
          hasNa: field.type == FormFieldType.yesNoNa,
          onChanged: (v) => setState(() => _values[field.id] = v),
        );
      case FormFieldType.text:
        return _TextInputField(
          field: field,
          value: _values[field.id] as String?,
          onChanged: (v) => setState(() => _values[field.id] = v),
        );
      case FormFieldType.number:
        return _NumberInputField(
          field: field,
          value: _values[field.id] as String?,
          onChanged: (v) => setState(() => _values[field.id] = v),
        );
      case FormFieldType.photo:
        return _PhotoField(
          field: field,
          hasPhoto: _values[field.id] != null,
          onCapture: () => setState(() => _values[field.id] = 'captured'),
        );
      case FormFieldType.dropdown:
        return _DropdownField(
          field: field,
          value: _values[field.id] as String?,
          onChanged: (v) => setState(() => _values[field.id] = v),
        );
      case FormFieldType.signature:
        return _SignatureField(
          field: field,
          hasSigned: _values[field.id] != null,
          onSign: () async {
            _openSignaturePad();
          },
        );
      case FormFieldType.date:
        return _DateField(
          field: field,
          value: _values[field.id] as String?,
          onChanged: (v) => setState(() => _values[field.id] = v),
        );
    }
  }

  Widget _buildFooter(MediaQueryData mq) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, mq.padding.bottom + 12),
      decoration: BoxDecoration(
        color: ObsidianTheme.void_,
        border: Border(
          top: BorderSide(color: ObsidianTheme.border),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Signature section
          if (widget.template.requiresSignature) ...[
            GestureDetector(
              onTap: _openSignaturePad,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: _signatureSvg != null
                      ? ObsidianTheme.emeraldDim
                      : Colors.white.withValues(alpha: 0.03),
                  borderRadius: ObsidianTheme.radiusMd,
                  border: Border.all(
                    color: _signatureSvg != null
                        ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                        : ObsidianTheme.border,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _signatureSvg != null
                          ? PhosphorIconsBold.checkCircle
                          : PhosphorIconsLight.pen,
                      color: _signatureSvg != null
                          ? ObsidianTheme.emerald
                          : ObsidianTheme.textSecondary,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _signatureSvg != null ? 'SIGNED' : 'TAP TO SIGN',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _signatureSvg != null
                            ? ObsidianTheme.emerald
                            : ObsidianTheme.textSecondary,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          // Submit button
          GestureDetector(
            onTap: _canSubmit ? _submit : null,
            child: AnimatedContainer(
              duration: ObsidianTheme.standard,
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: _canSubmit
                    ? ObsidianTheme.emerald
                    : ObsidianTheme.shimmerBase,
              ),
              child: Center(
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            PhosphorIconsBold.paperPlaneTilt,
                            size: 18,
                            color: _canSubmit ? Colors.white : ObsidianTheme.textTertiary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'SUBMIT FORM',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _canSubmit
                                  ? Colors.white
                                  : ObsidianTheme.textTertiary,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms, duration: 400.ms).moveY(begin: 12, duration: 400.ms);
  }

  Widget _buildStampOverlay() {
    return AnimatedBuilder(
      animation: _stampCtrl,
      builder: (context, _) {
        final scale = Tween(begin: 3.0, end: 1.0)
            .animate(CurvedAnimation(parent: _stampCtrl, curve: Curves.elasticOut))
            .value;
        final opacity = _stampCtrl.value.clamp(0.0, 1.0);

        return Container(
          color: Colors.black.withValues(alpha: 0.7 * opacity),
          child: Center(
            child: Transform.scale(
              scale: scale,
              child: Opacity(
                opacity: opacity,
                child: Transform.rotate(
                  angle: -0.15,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                    decoration: BoxDecoration(
                      border: Border.all(color: ObsidianTheme.emerald, width: 4),
                      borderRadius: ObsidianTheme.radiusMd,
                    ),
                    child: Text(
                      'APPROVED',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: ObsidianTheme.emerald,
                        letterSpacing: 6,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD WIDGETS
// ─────────────────────────────────────────────────────────────────────────────

/// Yes / No / NA segmented control — large horizontal tactile targets.
class _YesNoField extends StatelessWidget {
  final FormFieldDef field;
  final String? value;
  final bool hasNa;
  final ValueChanged<String> onChanged;

  const _YesNoField({
    required this.field,
    this.value,
    this.hasNa = false,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final options = ['Yes', 'No', if (hasNa) 'N/A'];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(
          color: value != null
              ? ObsidianTheme.emerald.withValues(alpha: 0.15)
              : ObsidianTheme.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  field.label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (field.required)
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.amber,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: options.map((opt) {
              final isSelected = value == opt.toLowerCase();
              final isNo = opt == 'No';
              final activeColor = isNo ? ObsidianTheme.rose : ObsidianTheme.emerald;

              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: opt != options.last ? 8 : 0),
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onChanged(opt.toLowerCase());
                    },
                    child: AnimatedContainer(
                      duration: ObsidianTheme.fast,
                      height: 48,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: isSelected
                            ? activeColor.withValues(alpha: 0.15)
                            : Colors.white.withValues(alpha: 0.04),
                        border: Border.all(
                          color: isSelected
                              ? activeColor.withValues(alpha: 0.4)
                              : Colors.white.withValues(alpha: 0.08),
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          opt,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                            color: isSelected ? activeColor : ObsidianTheme.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

/// Floating-label "Stealth" text input.
class _TextInputField extends StatelessWidget {
  final FormFieldDef field;
  final String? value;
  final ValueChanged<String> onChanged;

  const _TextInputField({
    required this.field,
    this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(color: ObsidianTheme.border),
      ),
      child: TextFormField(
        initialValue: value,
        onChanged: onChanged,
        style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
        decoration: InputDecoration(
          labelText: field.label,
          labelStyle: GoogleFonts.inter(
            fontSize: 13,
            color: ObsidianTheme.textMuted,
          ),
          hintText: field.hint,
          hintStyle: GoogleFonts.inter(
            fontSize: 13,
            color: ObsidianTheme.textDisabled,
          ),
          border: InputBorder.none,
          suffixIcon: field.required
              ? Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 4),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.amber,
                  ),
                )
              : null,
          suffixIconConstraints: const BoxConstraints(maxWidth: 16, maxHeight: 16),
        ),
        maxLines: null,
      ),
    );
  }
}

/// Number input with stealth styling.
class _NumberInputField extends StatelessWidget {
  final FormFieldDef field;
  final String? value;
  final ValueChanged<String> onChanged;

  const _NumberInputField({
    required this.field,
    this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(color: ObsidianTheme.border),
      ),
      child: TextFormField(
        initialValue: value,
        onChanged: onChanged,
        keyboardType: TextInputType.number,
        style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
        decoration: InputDecoration(
          labelText: field.label,
          labelStyle: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textMuted),
          border: InputBorder.none,
        ),
      ),
    );
  }
}

/// Photo evidence field.
class _PhotoField extends StatelessWidget {
  final FormFieldDef field;
  final bool hasPhoto;
  final VoidCallback onCapture;

  const _PhotoField({
    required this.field,
    this.hasPhoto = false,
    required this.onCapture,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(
          color: hasPhoto
              ? ObsidianTheme.emerald.withValues(alpha: 0.2)
              : ObsidianTheme.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  field.label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (field.required)
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.amber,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onCapture();
            },
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              width: double.infinity,
              height: 56,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: hasPhoto
                    ? ObsidianTheme.emeraldDim
                    : Colors.white.withValues(alpha: 0.04),
                border: Border.all(
                  color: hasPhoto
                      ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                      : Colors.white.withValues(alpha: 0.08),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    hasPhoto
                        ? PhosphorIconsBold.checkCircle
                        : PhosphorIconsLight.camera,
                    color: hasPhoto
                        ? ObsidianTheme.emerald
                        : ObsidianTheme.textSecondary,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    hasPhoto ? 'Photo Captured' : '+ Add Photo',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: hasPhoto
                          ? ObsidianTheme.emerald
                          : ObsidianTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dropdown selector.
class _DropdownField extends StatelessWidget {
  final FormFieldDef field;
  final String? value;
  final ValueChanged<String> onChanged;

  const _DropdownField({
    required this.field,
    this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: ObsidianTheme.radiusLg,
        border: Border.all(color: ObsidianTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            field.label,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: ObsidianTheme.textMuted,
            ),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            // ignore: deprecated_member_use
            value: value,
            hint: Text(
              'Select...',
              style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textDisabled),
            ),
            decoration: const InputDecoration(
              border: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
            dropdownColor: ObsidianTheme.surface2,
            style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
            items: field.options.map((opt) {
              return DropdownMenuItem(value: opt, child: Text(opt));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                HapticFeedback.selectionClick();
                onChanged(v);
              }
            },
          ),
        ],
      ),
    );
  }
}

/// Signature trigger field.
class _SignatureField extends StatelessWidget {
  final FormFieldDef field;
  final bool hasSigned;
  final VoidCallback onSign;

  const _SignatureField({
    required this.field,
    this.hasSigned = false,
    required this.onSign,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onSign,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: hasSigned
              ? ObsidianTheme.emeraldDim
              : Colors.white.withValues(alpha: 0.02),
          borderRadius: ObsidianTheme.radiusLg,
          border: Border.all(
            color: hasSigned
                ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                : ObsidianTheme.border,
          ),
        ),
        child: Row(
          children: [
            Icon(
              hasSigned
                  ? PhosphorIconsBold.checkCircle
                  : PhosphorIconsLight.pen,
              color: hasSigned
                  ? ObsidianTheme.emerald
                  : ObsidianTheme.textSecondary,
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              hasSigned ? 'Signed' : field.label,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: hasSigned
                    ? ObsidianTheme.emerald
                    : Colors.white,
              ),
            ),
            if (field.required) ...[
              const Spacer(),
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.amber,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Date picker field.
class _DateField extends StatelessWidget {
  final FormFieldDef field;
  final String? value;
  final ValueChanged<String> onChanged;

  const _DateField({
    required this.field,
    this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime(2030),
          builder: (context, child) {
            return Theme(
              data: ThemeData.dark().copyWith(
                colorScheme: const ColorScheme.dark(
                  primary: ObsidianTheme.emerald,
                  surface: ObsidianTheme.surface2,
                ),
              ),
              child: child!,
            );
          },
        );
        if (date != null) {
          onChanged(date.toIso8601String().split('T').first);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.02),
          borderRadius: ObsidianTheme.radiusLg,
          border: Border.all(color: ObsidianTheme.border),
        ),
        child: Row(
          children: [
            Icon(
              PhosphorIconsLight.calendarBlank,
              color: value != null
                  ? ObsidianTheme.emerald
                  : ObsidianTheme.textSecondary,
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              value ?? field.label,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: value != null ? Colors.white : ObsidianTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WET INK SIGNATURE PAD — velocity-sensitive Bézier strokes
// ─────────────────────────────────────────────────────────────────────────────

class _WetInkSignaturePad extends StatefulWidget {
  const _WetInkSignaturePad();

  @override
  State<_WetInkSignaturePad> createState() => _WetInkSignaturePadState();
}

class _WetInkSignaturePadState extends State<_WetInkSignaturePad>
    with SingleTickerProviderStateMixin {
  final List<_InkPoint> _points = [];
  final List<int> _strokeBreaks = [];
  bool _isEmpty = true;
  Offset? _lastPos;
  DateTime? _lastTime;
  bool _stamping = false;
  late AnimationController _stampCtrl;

  @override
  void initState() {
    super.initState();
    _stampCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _stampCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted) Navigator.pop(context, _toSvg());
        });
      }
    });
  }

  @override
  void dispose() {
    _stampCtrl.dispose();
    super.dispose();
  }

  void _onPanStart(DragStartDetails d) {
    HapticFeedback.selectionClick();
    _lastPos = d.localPosition;
    _lastTime = DateTime.now();
    _points.add(_InkPoint(pos: d.localPosition, width: 2.0));
    setState(() => _isEmpty = false);
  }

  void _onPanUpdate(DragUpdateDetails d) {
    final now = DateTime.now();
    final pos = d.localPosition;
    double width = 2.5;

    if (_lastPos != null && _lastTime != null) {
      final dist = (pos - _lastPos!).distance;
      final elapsed = now.difference(_lastTime!).inMilliseconds.toDouble();
      if (elapsed > 0) {
        final velocity = dist / elapsed;
        width = (4.0 - velocity * 3.0).clamp(0.6, 5.0);
      }
    }

    _points.add(_InkPoint(pos: pos, width: width));
    _lastPos = pos;
    _lastTime = now;
    setState(() {});
  }

  void _onPanEnd(DragEndDetails _) {
    _strokeBreaks.add(_points.length - 1);
    _lastPos = null;
    _lastTime = null;
  }

  void _clear() {
    HapticFeedback.lightImpact();
    setState(() {
      _points.clear();
      _strokeBreaks.clear();
      _isEmpty = true;
    });
  }

  void _accept() {
    if (_isEmpty) return;
    HapticFeedback.heavyImpact();
    setState(() => _stamping = true);
    _stampCtrl.forward();
  }

  String _toSvg() {
    if (_points.isEmpty) return '';
    final buf = StringBuffer();
    int start = 0;
    for (final breakIdx in [..._strokeBreaks, _points.length - 1]) {
      if (start >= _points.length) break;
      final first = _points[start];
      buf.write('M${first.pos.dx.toStringAsFixed(1)},${first.pos.dy.toStringAsFixed(1)} ');
      for (int i = start + 1; i <= breakIdx && i < _points.length; i++) {
        final p = _points[i];
        buf.write('L${p.pos.dx.toStringAsFixed(1)},${p.pos.dy.toStringAsFixed(1)} ');
      }
      start = breakIdx + 1;
    }
    return buf.toString().trim();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ObsidianTheme.hoverBg,
                            border: Border.all(color: ObsidianTheme.border),
                          ),
                          child: const Center(
                            child: Icon(PhosphorIconsLight.x, size: 16, color: ObsidianTheme.textSecondary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Sign Below',
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: _clear,
                        child: Text(
                          'Clear',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: ObsidianTheme.textTertiary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 300.ms),

                const SizedBox(height: 16),

                // Canvas
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusLg,
                      color: ObsidianTheme.surface1,
                      border: Border.all(color: ObsidianTheme.borderMedium),
                    ),
                    child: ClipRRect(
                      borderRadius: ObsidianTheme.radiusLg,
                      child: Stack(
                        children: [
                          // Baseline
                          Positioned(
                            left: 20,
                            right: 20,
                            bottom: 60,
                            child: Container(height: 1, color: ObsidianTheme.border),
                          ),
                          Positioned(
                            left: 20,
                            bottom: 68,
                            child: Text(
                              '×',
                              style: GoogleFonts.inter(fontSize: 18, color: ObsidianTheme.textTertiary),
                            ),
                          ),
                          GestureDetector(
                            onPanStart: _onPanStart,
                            onPanUpdate: _onPanUpdate,
                            onPanEnd: _onPanEnd,
                            child: CustomPaint(
                              painter: _WetInkPainter(
                                points: _points,
                                strokeBreaks: _strokeBreaks,
                              ),
                              size: Size.infinite,
                            ),
                          ),
                          if (_isEmpty)
                            Center(
                              child: Text(
                                'Sign with your finger',
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  color: ObsidianTheme.textDisabled,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Accept
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: GestureDetector(
                    onTap: _accept,
                    child: AnimatedContainer(
                      duration: ObsidianTheme.fast,
                      height: 52,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: _isEmpty ? ObsidianTheme.shimmerBase : ObsidianTheme.emerald,
                      ),
                      child: Center(
                        child: Text(
                          'Accept',
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: _isEmpty ? ObsidianTheme.textTertiary : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                Text(
                  'By signing, you acknowledge this compliance form.',
                  style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary),
                ),
                SizedBox(height: mq.padding.bottom + 8),
              ],
            ),

            // Stamp overlay
            if (_stamping)
              AnimatedBuilder(
                animation: _stampCtrl,
                builder: (_, __) {
                  final scale = Tween(begin: 4.0, end: 1.0)
                      .animate(CurvedAnimation(parent: _stampCtrl, curve: Curves.elasticOut))
                      .value;
                  final opacity = _stampCtrl.value.clamp(0.0, 1.0);

                  return Container(
                    color: Colors.black.withValues(alpha: 0.6 * opacity),
                    child: Center(
                      child: Transform.scale(
                        scale: scale,
                        child: Opacity(
                          opacity: opacity,
                          child: Transform.rotate(
                            angle: -0.2,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: ObsidianTheme.emerald,
                                  width: 3,
                                ),
                                borderRadius: ObsidianTheme.radiusMd,
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    PhosphorIconsBold.sealCheck,
                                    color: ObsidianTheme.emerald,
                                    size: 36,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'SIGNED',
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                      color: ObsidianTheme.emerald,
                                      letterSpacing: 4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _InkPoint {
  final Offset pos;
  final double width;
  const _InkPoint({required this.pos, required this.width});
}

/// Wet-ink painter using velocity-based widths and rounded caps.
class _WetInkPainter extends CustomPainter {
  final List<_InkPoint> points;
  final List<int> strokeBreaks;

  _WetInkPainter({required this.points, required this.strokeBreaks});

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final breakSet = strokeBreaks.toSet();

    for (int i = 0; i < points.length - 1; i++) {
      if (breakSet.contains(i)) continue;

      final p1 = points[i];
      final p2 = points[i + 1];
      final avgW = (p1.width + p2.width) / 2;

      final paint = Paint()
        ..color = Colors.white.withValues(alpha: 0.92)
        ..strokeWidth = avgW
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      canvas.drawLine(p1.pos, p2.pos, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _WetInkPainter old) => true;
}
