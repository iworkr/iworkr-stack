import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'package:iworkr_mobile/core/database/sync_engine.dart';
import 'package:iworkr_mobile/features/compliance/services/cerberus_validator.dart';

const _uuid = Uuid();

// ═══════════════════════════════════════════════════════════
// ── Field Job States (Technician Workflow) ────────────────
// ═══════════════════════════════════════════════════════════

enum FieldJobState {
  dispatched,
  enRoute,
  onSite,
  inProgress,
  paused,
  completed;

  String get label {
    switch (this) {
      case dispatched: return 'Dispatched';
      case enRoute: return 'En Route';
      case onSite: return 'On Site';
      case inProgress: return 'In Progress';
      case paused: return 'Paused';
      case completed: return 'Completed';
    }
  }

  String get dbValue {
    switch (this) {
      case dispatched: return 'scheduled';
      case enRoute: return 'scheduled';
      case onSite: return 'scheduled';
      case inProgress: return 'in_progress';
      case paused: return 'in_progress';
      case completed: return 'done';
    }
  }

  String get cerberusTrigger {
    switch (this) {
      case inProgress: return 'PRE_START';
      case completed: return 'POST_COMPLETION';
      default: return '';
    }
  }

  static FieldJobState fromDbStatus(String status) {
    switch (status) {
      case 'in_progress': return inProgress;
      case 'done': return completed;
      case 'scheduled': return dispatched;
      default: return dispatched;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ── Transition Graph ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

const Map<FieldJobState, List<FieldJobState>> _fieldTransitions = {
  FieldJobState.dispatched: [FieldJobState.enRoute],
  FieldJobState.enRoute: [FieldJobState.onSite],
  FieldJobState.onSite: [FieldJobState.inProgress],
  FieldJobState.inProgress: [FieldJobState.paused, FieldJobState.completed],
  FieldJobState.paused: [FieldJobState.inProgress, FieldJobState.completed],
  FieldJobState.completed: [],
};

// ═══════════════════════════════════════════════════════════
// ── Gate Results ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class GateResult {
  final bool passed;
  final String? gateType;
  final String? message;
  final ComplianceResult? complianceResult;

  const GateResult.pass()
      : passed = true,
        gateType = null,
        message = null,
        complianceResult = null;

  const GateResult.blocked({
    required this.gateType,
    required this.message,
    this.complianceResult,
  }) : passed = false;
}

// ═══════════════════════════════════════════════════════════
// ── Job State Machine (Cerberus-Gate Integrated) ─────────
// ═══════════════════════════════════════════════════════════

class JobStateMachine {
  final SyncEngine _sync;
  final CerberusValidator _cerberus;

  JobStateMachine(this._sync, this._cerberus);

  List<FieldJobState> nextStates(FieldJobState current) {
    return _fieldTransitions[current] ?? [];
  }

  bool canTransition(FieldJobState from, FieldJobState to) {
    return _fieldTransitions[from]?.contains(to) ?? false;
  }

  /// Attempt a job state transition with full Cerberus compliance evaluation.
  /// Returns [GateResult] with compliance violations if blocked.
  Future<GateResult> attemptTransition({
    required String jobId,
    required String orgId,
    required FieldJobState from,
    required FieldJobState to,
    String? shiftId,
  }) async {
    if (!canTransition(from, to)) {
      return GateResult.blocked(
        gateType: 'invalid_transition',
        message: 'Cannot move from ${from.label} to ${to.label}',
      );
    }

    // Determine the Cerberus trigger for this transition
    final trigger = to.cerberusTrigger;

    if (trigger.isNotEmpty) {
      final complianceResult = await _cerberus.evaluate(
        jobId: jobId,
        organizationId: orgId,
        triggerState: trigger,
        shiftId: shiftId,
      );

      if (!complianceResult.passed) {
        return GateResult.blocked(
          gateType: 'cerberus_compliance',
          message:
              '${complianceResult.violations.length} compliance requirement${complianceResult.violations.length > 1 ? 's' : ''} not met',
          complianceResult: complianceResult,
        );
      }
    }

    return const GateResult.pass();
  }

  /// Execute a field state transition, writing locally and queuing sync.
  /// Call [attemptTransition] first to validate compliance gates.
  Future<GateResult> executeTransition({
    required String jobId,
    required String orgId,
    required FieldJobState from,
    required FieldJobState to,
    String? userId,
    double? lat,
    double? lng,
  }) async {
    if (!canTransition(from, to)) {
      return GateResult.blocked(
        gateType: 'invalid_transition',
        message: 'Cannot move from ${from.label} to ${to.label}',
      );
    }

    if (to == FieldJobState.inProgress && userId != null) {
      await _sync.startTimer(
        jobId: jobId,
        orgId: orgId,
        userId: userId,
        lat: lat,
        lng: lng,
      );
    } else if (to == FieldJobState.completed) {
      await _sync.updateJobStatus(jobId, orgId, 'done');
    } else if (to == FieldJobState.paused) {
      await _sync.updateJobStatus(jobId, orgId, 'in_progress');
    } else {
      await _sync.updateJobStatus(jobId, orgId, to.dbValue);
    }

    return const GateResult.pass();
  }

  /// Record a compliance override in the sync outbox.
  Future<void> recordOverride({
    required String orgId,
    required String ruleId,
    required String workerId,
    required String jobId,
    required String justification,
    required String overrideType,
    String? adminId,
    String? pinId,
  }) async {
    final overrideId = _uuid.v4();
    await _sync.createComplianceOverride(
      overrideId: overrideId,
      organizationId: orgId,
      ruleId: ruleId,
      workerId: workerId,
      jobId: jobId,
      justification: justification,
      overrideType: overrideType,
      adminId: adminId,
      pinId: pinId,
    );
  }

  SliderConfig? getSliderConfig(FieldJobState current) {
    switch (current) {
      case FieldJobState.dispatched:
        return SliderConfig(
          label: 'Slide to Start Travel',
          targetState: FieldJobState.enRoute,
        );
      case FieldJobState.enRoute:
        return SliderConfig(
          label: 'Slide to Arrive on Site',
          targetState: FieldJobState.onSite,
        );
      case FieldJobState.onSite:
        return SliderConfig(
          label: 'Slide to Start Work',
          targetState: FieldJobState.inProgress,
        );
      case FieldJobState.inProgress:
        return SliderConfig(
          label: 'Slide to Complete Job',
          targetState: FieldJobState.completed,
        );
      case FieldJobState.paused:
        return SliderConfig(
          label: 'Slide to Resume Work',
          targetState: FieldJobState.inProgress,
        );
      case FieldJobState.completed:
        return null;
    }
  }
}

class SliderConfig {
  final String label;
  final FieldJobState targetState;
  const SliderConfig({required this.label, required this.targetState});
}

// ═══════════════════════════════════════════════════════════
// ── Providers ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

final jobStateMachineProvider = Provider<JobStateMachine>((ref) {
  final sync = ref.watch(syncEngineProvider);
  final cerberus = ref.watch(cerberusValidatorProvider);
  return JobStateMachine(sync, cerberus);
});
