import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:iworkr_mobile/core/database/app_database.dart';

/// A single compliance requirement that was not met.
class ComplianceViolation {
  final String ruleId;
  final String ruleName;
  final String ruleType;
  final String triggerState;
  final bool isHardBlock;
  final Map<String, dynamic> config;
  final String message;
  final String? actionRoute;

  const ComplianceViolation({
    required this.ruleId,
    required this.ruleName,
    required this.ruleType,
    required this.triggerState,
    required this.isHardBlock,
    required this.config,
    required this.message,
    this.actionRoute,
  });
}

/// Aggregate result of evaluating all compliance rules.
class ComplianceResult {
  final bool passed;
  final List<ComplianceViolation> violations;

  const ComplianceResult.pass()
      : passed = true,
        violations = const [];

  const ComplianceResult.blocked(this.violations) : passed = false;

  bool get hasHardBlocks => violations.any((v) => v.isHardBlock);
  bool get hasSoftStopsOnly => violations.isNotEmpty && !hasHardBlocks;
  List<ComplianceViolation> get hardBlocks =>
      violations.where((v) => v.isHardBlock).toList();
  List<ComplianceViolation> get softStops =>
      violations.where((v) => !v.isHardBlock).toList();
}

/// Evaluates all compliance rules for a job/shift transition offline
/// against the local SQLite replica.
class CerberusValidator {
  final AppDatabase _db;

  CerberusValidator(this._db);

  /// Evaluate all applicable compliance rules for a job transition.
  Future<ComplianceResult> evaluate({
    required String jobId,
    required String organizationId,
    required String triggerState,
    String? shiftId,
  }) async {
    final rules = await _db.getComplianceRulesForTrigger(
      organizationId,
      triggerState,
    );

    if (rules.isEmpty) return const ComplianceResult.pass();

    final job = await _db.getJob(jobId);
    final jobLabels = job?.labels ?? '[]';
    List<String> parsedLabels;
    try {
      parsedLabels = (jsonDecode(jobLabels) as List).cast<String>();
    } catch (_) {
      parsedLabels = [];
    }

    final applicableRules = _filterApplicableRules(
      rules,
      jobId: jobId,
      jobLabels: parsedLabels,
      clientId: job?.clientId,
    );

    if (applicableRules.isEmpty) return const ComplianceResult.pass();

    final violations = <ComplianceViolation>[];

    for (final rule in applicableRules) {
      final config = _parseConfig(rule.configJsonb);
      final violation = await _evaluateRule(
        rule: rule,
        config: config,
        jobId: jobId,
        shiftId: shiftId,
        organizationId: organizationId,
      );
      if (violation != null) violations.add(violation);
    }

    if (violations.isEmpty) return const ComplianceResult.pass();
    return ComplianceResult.blocked(violations);
  }

  List<LocalComplianceRule> _filterApplicableRules(
    List<LocalComplianceRule> rules, {
    required String jobId,
    required List<String> jobLabels,
    String? clientId,
  }) {
    return rules.where((r) {
      switch (r.targetEntityType) {
        case 'GLOBAL':
          return true;
        case 'SPECIFIC_JOB':
          return r.targetEntityId == jobId;
        case 'JOB_LABEL':
          return r.targetLabel != null && jobLabels.contains(r.targetLabel);
        case 'CLIENT_TAG':
          return r.targetEntityId != null && r.targetEntityId == clientId;
        case 'CARE_PLAN_TYPE':
          return true;
        default:
          return false;
      }
    }).toList();
  }

  Map<String, dynamic> _parseConfig(String configStr) {
    try {
      return jsonDecode(configStr) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  Future<ComplianceViolation?> _evaluateRule({
    required LocalComplianceRule rule,
    required Map<String, dynamic> config,
    required String jobId,
    String? shiftId,
    required String organizationId,
  }) async {
    switch (rule.ruleType) {
      case 'FORM_SUBMISSION':
        return _evaluateFormSubmission(rule, config, jobId);
      case 'MEDIA_CAPTURE':
        return _evaluateMediaCapture(rule, config, jobId);
      case 'PROGRESS_NOTE':
        return _evaluateProgressNote(rule, config, shiftId);
      case 'EMAR_SIGN_OFF':
        return _evaluateEmarSignOff(rule, config, shiftId);
      case 'CLIENT_SIGNATURE':
        return _evaluateClientSignature(rule, config, jobId);
      case 'SWMS_REQUIRED':
        return _evaluateSwmsRequired(rule, config, jobId);
      case 'SUBTASK_COMPLETION':
        return _evaluateSubtaskCompletion(rule, config, jobId);
      default:
        return null;
    }
  }

  // ── FORM_SUBMISSION Evaluator ────────────────────────────

  Future<ComplianceViolation?> _evaluateFormSubmission(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String jobId,
  ) async {
    final formTemplateId = config['form_template_id'] as String?;
    if (formTemplateId == null) return null;

    final hasSubmission = await _db.hasFormResponseForJob(jobId, formTemplateId);
    if (hasSubmission) return null;

    final formName = config['form_name'] as String? ?? 'Required Form';
    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: 'Complete "$formName" before proceeding',
      actionRoute: '/forms/$formTemplateId',
    );
  }

  // ── MEDIA_CAPTURE Evaluator ──────────────────────────────

  Future<ComplianceViolation?> _evaluateMediaCapture(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String jobId,
  ) async {
    final minPhotos = (config['min_photos'] as num?)?.toInt() ?? 1;
    final mediaType = config['media_type'] as String?;

    final currentCount = await _db.getJobMediaCount(jobId, mediaType: mediaType);
    if (currentCount >= minPhotos) return null;

    final remaining = minPhotos - currentCount;
    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: '$remaining photo${remaining > 1 ? 's' : ''} required '
          '($currentCount/$minPhotos captured)',
      actionRoute: '/camera',
    );
  }

  // ── PROGRESS_NOTE Evaluator ──────────────────────────────

  Future<ComplianceViolation?> _evaluateProgressNote(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String? shiftId,
  ) async {
    if (shiftId == null) return null;

    final minChars = (config['min_chars'] as num?)?.toInt() ?? 150;
    final noteContent = await _db.getShiftNoteContent(shiftId);

    if (noteContent != null && noteContent.length >= minChars) return null;

    final currentLength = noteContent?.length ?? 0;
    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: 'Progress note too short ($currentLength/$minChars characters)',
      actionRoute: '/notes',
    );
  }

  // ── EMAR_SIGN_OFF Evaluator ──────────────────────────────

  Future<ComplianceViolation?> _evaluateEmarSignOff(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String? shiftId,
  ) async {
    if (shiftId == null) return null;

    final pendingMeds = await _db.getPendingMedicationsForShift(shiftId);
    if (pendingMeds.isEmpty) return null;

    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: '${pendingMeds.length} medication${pendingMeds.length > 1 ? 's' : ''} '
          'require administration or sign-off',
      actionRoute: '/emar',
    );
  }

  // ── CLIENT_SIGNATURE Evaluator ───────────────────────────

  Future<ComplianceViolation?> _evaluateClientSignature(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String jobId,
  ) async {
    final hasSignature = await _db.hasClientSignatureForJob(jobId);
    if (hasSignature) return null;

    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: 'Client signature required to complete this job',
      actionRoute: '/signature',
    );
  }

  // ── SWMS_REQUIRED Evaluator ──────────────────────────────

  Future<ComplianceViolation?> _evaluateSwmsRequired(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String jobId,
  ) async {
    final hasSwms = await _db.hasSwmsForJob(jobId);
    if (hasSwms) return null;

    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: 'SWMS assessment must be completed before starting work',
      actionRoute: '/swms',
    );
  }

  // ── SUBTASK_COMPLETION Evaluator ─────────────────────────

  Future<ComplianceViolation?> _evaluateSubtaskCompletion(
    LocalComplianceRule rule,
    Map<String, dynamic> config,
    String jobId,
  ) async {
    final criticalOnly = config['critical_only'] as bool? ?? true;
    final tasks = criticalOnly
        ? await _db.getCriticalIncompleteTasks(jobId)
        : await _db.getIncompleteTasks(jobId);

    if (tasks.isEmpty) return null;

    return ComplianceViolation(
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggerState: rule.triggerState,
      isHardBlock: rule.isHardBlock,
      config: config,
      message: '${tasks.length} mandatory task${tasks.length > 1 ? 's' : ''} incomplete',
      actionRoute: '/tasks',
    );
  }
}

/// Provider for the CerberusValidator.
final cerberusValidatorProvider = Provider<CerberusValidator>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return CerberusValidator(db);
});
