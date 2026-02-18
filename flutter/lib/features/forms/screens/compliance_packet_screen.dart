import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/forms_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/form_template.dart';
import 'package:iworkr_mobile/features/forms/screens/form_runner_screen.dart';

/// Opens the Pre-Start compliance packet as a blocking modal.
/// Returns `true` only when ALL mandatory pre-job forms are completed.
Future<bool> showCompliancePacket(
  BuildContext context, {
  required String jobId,
  FormStage stage = FormStage.preJob,
}) {
  HapticFeedback.mediumImpact();
  return Navigator.of(context, rootNavigator: true).push<bool>(
    PageRouteBuilder<bool>(
      opaque: true,
      pageBuilder: (_, __, ___) => _CompliancePacketScreen(
        jobId: jobId,
        stage: stage,
      ),
      transitionsBuilder: (_, a, __, child) {
        return SlideTransition(
          position: Tween(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
          child: FadeTransition(opacity: a, child: child),
        );
      },
      transitionDuration: const Duration(milliseconds: 400),
    ),
  ).then((v) => v ?? false);
}

class _CompliancePacketScreen extends ConsumerStatefulWidget {
  final String jobId;
  final FormStage stage;

  const _CompliancePacketScreen({
    required this.jobId,
    this.stage = FormStage.preJob,
  });

  @override
  ConsumerState<_CompliancePacketScreen> createState() =>
      _CompliancePacketScreenState();
}

class _CompliancePacketScreenState
    extends ConsumerState<_CompliancePacketScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _borderPulse;

  @override
  void initState() {
    super.initState();
    _borderPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _borderPulse.dispose();
    super.dispose();
  }

  String get _stageTitle {
    switch (widget.stage) {
      case FormStage.preJob:
        return 'PRE-START PACKET';
      case FormStage.midJob:
        return 'PROCESS FORMS';
      case FormStage.postJob:
        return 'CLOSEOUT CHECKLIST';
    }
  }

  String get _stageSubtitle {
    switch (widget.stage) {
      case FormStage.preJob:
        return 'Complete all forms before starting the job';
      case FormStage.midJob:
        return 'Required process documentation';
      case FormStage.postJob:
        return 'Complete all forms before closing the job';
    }
  }

  IconData get _stageIcon {
    switch (widget.stage) {
      case FormStage.preJob:
        return PhosphorIconsBold.shieldCheck;
      case FormStage.midJob:
        return PhosphorIconsBold.clipboardText;
      case FormStage.postJob:
        return PhosphorIconsBold.checkSquare;
    }
  }

  Color get _accentColor {
    switch (widget.stage) {
      case FormStage.preJob:
        return ObsidianTheme.amber;
      case FormStage.midJob:
        return ObsidianTheme.blue;
      case FormStage.postJob:
        return ObsidianTheme.emerald;
    }
  }

  @override
  Widget build(BuildContext context) {
    final templatesAsync = ref.watch(stageFormsProvider(widget.stage.value));
    final responsesAsync = ref.watch(jobFormResponsesProvider(widget.jobId));
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: AnimatedBuilder(
        animation: _borderPulse,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: _accentColor.withValues(
                  alpha: 0.2 + _borderPulse.value * 0.3,
                ),
                width: 2,
              ),
            ),
            child: child,
          );
        },
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: templatesAsync.when(
                  loading: () => _buildLoading(),
                  error: (e, _) => _buildError(e),
                  data: (templates) {
                    return responsesAsync.when(
                      loading: () => _buildLoading(),
                      error: (e, _) => _buildError(e),
                      data: (responses) {
                        final submittedIds = responses
                            .where((r) => r.isSubmitted)
                            .map((r) => r.formTemplateId)
                            .toSet();

                        final allComplete =
                            templates.every((t) => submittedIds.contains(t.id));

                        return Column(
                          children: [
                            Expanded(
                              child: templates.isEmpty
                                  ? _buildEmpty()
                                  : _buildFormList(templates, submittedIds),
                            ),
                            _buildFooter(
                              mq,
                              allComplete: allComplete,
                              isEmpty: templates.isEmpty,
                            ),
                          ],
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: BoxDecoration(
        color: ObsidianTheme.void_,
        border: Border(
          bottom: BorderSide(color: _accentColor.withValues(alpha: 0.15)),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.pop(context, false);
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    PhosphorIconsLight.arrowLeft,
                    color: Colors.white70,
                    size: 20,
                  ),
                ),
              ),
              const Spacer(),
              Icon(_stageIcon, color: _accentColor, size: 28),
              const Spacer(),
              const SizedBox(width: 36),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _stageTitle,
            style: GoogleFonts.jetBrainsMono(
              color: _accentColor,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _stageSubtitle,
            style: GoogleFonts.inter(
              color: ObsidianTheme.textTertiary,
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

  Widget _buildLoading() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: _accentColor,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Loading forms...',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: ObsidianTheme.textMuted,
            ),
          ),
        ],
      ).animate().fadeIn(duration: 400.ms),
    );
  }

  Widget _buildError(Object e) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(PhosphorIconsLight.warning, size: 40, color: ObsidianTheme.rose),
          const SizedBox(height: 12),
          Text(
            'Failed to load forms',
            style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(PhosphorIconsLight.checks, size: 52, color: _accentColor.withValues(alpha: 0.4)),
          const SizedBox(height: 14),
          Text(
            'No forms required',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: ObsidianTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'You\'re good to proceed',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: ObsidianTheme.textTertiary,
            ),
          ),
        ],
      ).animate().fadeIn(duration: 500.ms).scale(
            begin: const Offset(0.95, 0.95),
            duration: 500.ms,
            curve: Curves.easeOutCubic,
          ),
    );
  }

  Widget _buildFormList(List<FormTemplate> templates, Set<String> submittedIds) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      itemCount: templates.length,
      itemBuilder: (context, index) {
        final template = templates[index];
        final isComplete = submittedIds.contains(template.id);

        return _FormCard(
          template: template,
          isComplete: isComplete,
          accentColor: _accentColor,
          onTap: () async {
            if (isComplete) return;
            HapticFeedback.mediumImpact();
            final submitted = await showFormRunner(
              context,
              template: template,
              jobId: widget.jobId,
            );
            if (submitted == true) {
              ref.invalidate(jobFormResponsesProvider(widget.jobId));
              ref.invalidate(preJobFormsCompleteProvider(widget.jobId));
              ref.invalidate(postJobFormsCompleteProvider(widget.jobId));
            }
          },
        )
            .animate()
            .fadeIn(
              delay: Duration(milliseconds: 80 * index),
              duration: 400.ms,
            )
            .moveY(
              begin: 12,
              delay: Duration(milliseconds: 80 * index),
              duration: 400.ms,
              curve: Curves.easeOutCubic,
            );
      },
    );
  }

  Widget _buildFooter(MediaQueryData mq, {required bool allComplete, required bool isEmpty}) {
    final canProceed = allComplete || isEmpty;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, mq.padding.bottom + 12),
      decoration: BoxDecoration(
        color: ObsidianTheme.void_,
        border: Border(
          top: BorderSide(color: ObsidianTheme.border),
        ),
      ),
      child: GestureDetector(
        onTap: canProceed
            ? () {
                HapticFeedback.heavyImpact();
                Navigator.pop(context, true);
              }
            : () {
                HapticFeedback.heavyImpact();
                // Shake to indicate can't proceed
              },
        child: AnimatedContainer(
          duration: ObsidianTheme.standard,
          width: double.infinity,
          height: 52,
          decoration: BoxDecoration(
            borderRadius: ObsidianTheme.radiusMd,
            color: canProceed
                ? ObsidianTheme.emerald
                : ObsidianTheme.shimmerBase,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                canProceed
                    ? PhosphorIconsBold.checkCircle
                    : PhosphorIconsBold.lockKey,
                size: 18,
                color: canProceed ? Colors.white : ObsidianTheme.textTertiary,
              ),
              const SizedBox(width: 8),
              Text(
                canProceed
                    ? (widget.stage == FormStage.postJob ? 'CONFIRM CLOSEOUT' : 'PROCEED')
                    : 'COMPLETE ALL FORMS',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: canProceed ? Colors.white : ObsidianTheme.textTertiary,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: 200.ms, duration: 400.ms);
  }
}

/// Individual form card in the packet list.
class _FormCard extends StatelessWidget {
  final FormTemplate template;
  final bool isComplete;
  final Color accentColor;
  final VoidCallback onTap;

  const _FormCard({
    required this.template,
    required this.isComplete,
    required this.accentColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isComplete
              ? ObsidianTheme.emeraldDim
              : Colors.white.withValues(alpha: 0.02),
          borderRadius: ObsidianTheme.radiusLg,
          border: Border.all(
            color: isComplete
                ? ObsidianTheme.emerald.withValues(alpha: 0.25)
                : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Row(
          children: [
            // Status icon
            AnimatedContainer(
              duration: ObsidianTheme.standard,
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: isComplete
                    ? ObsidianTheme.emerald.withValues(alpha: 0.15)
                    : accentColor.withValues(alpha: 0.08),
              ),
              child: Center(
                child: Icon(
                  isComplete
                      ? PhosphorIconsBold.checkCircle
                      : template.requiresSignature
                          ? PhosphorIconsLight.pen
                          : PhosphorIconsLight.clipboardText,
                  color: isComplete ? ObsidianTheme.emerald : accentColor,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(width: 14),

            // Title + meta
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    template.title,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isComplete
                          ? ObsidianTheme.textMuted
                          : Colors.white,
                      decoration: isComplete ? TextDecoration.lineThrough : null,
                      decorationColor: ObsidianTheme.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        '${template.totalFields} fields',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: ObsidianTheme.textTertiary,
                        ),
                      ),
                      if (template.requiresSignature) ...[
                        const SizedBox(width: 8),
                        Icon(
                          PhosphorIconsLight.pen,
                          size: 10,
                          color: ObsidianTheme.textTertiary,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          'Signature',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: ObsidianTheme.textTertiary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Arrow or check
            Icon(
              isComplete
                  ? PhosphorIconsBold.check
                  : PhosphorIconsLight.caretRight,
              color: isComplete
                  ? ObsidianTheme.emerald
                  : ObsidianTheme.textTertiary,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}
