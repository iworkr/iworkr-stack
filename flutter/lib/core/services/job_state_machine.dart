import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:iworkr_mobile/core/database/sync_engine.dart';

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

  const GateResult.pass() : passed = true, gateType = null, message = null;
  const GateResult.blocked({required this.gateType, required this.message}) : passed = false;
}

// ═══════════════════════════════════════════════════════════
// ── Job State Machine (Offline-Aware) ────────────────────
// ═══════════════════════════════════════════════════════════

class JobStateMachine {
  final AppDatabase _db;
  final SyncEngine _sync;

  JobStateMachine(this._db, this._sync);

  List<FieldJobState> nextStates(FieldJobState current) {
    return _fieldTransitions[current] ?? [];
  }

  bool canTransition(FieldJobState from, FieldJobState to) {
    return _fieldTransitions[from]?.contains(to) ?? false;
  }

  /// Check compliance gates before allowing transition.
  /// Returns [GateResult.pass()] if clear, or a blocked result with details.
  Future<GateResult> checkGates({
    required String jobId,
    required FieldJobState from,
    required FieldJobState to,
  }) async {
    // Gate 1: SWMS / Pre-Start check before starting work
    if (to == FieldJobState.inProgress && from == FieldJobState.onSite) {
      final criticalTasks = await _db.getCriticalIncompleteTasks(jobId);
      if (criticalTasks.isNotEmpty) {
        return GateResult.blocked(
          gateType: 'swms',
          message: '${criticalTasks.length} mandatory safety item${criticalTasks.length > 1 ? 's' : ''} not completed',
        );
      }
    }

    // Gate 2: Mandatory evidence before completion
    if (to == FieldJobState.completed) {
      // Check for incomplete critical tasks
      final criticalTasks = await _db.getCriticalIncompleteTasks(jobId);
      if (criticalTasks.isNotEmpty) {
        return GateResult.blocked(
          gateType: 'critical_tasks',
          message: '${criticalTasks.length} critical task${criticalTasks.length > 1 ? 's' : ''} incomplete',
        );
      }
    }

    return const GateResult.pass();
  }

  /// Execute a field state transition, writing locally and queuing sync.
  Future<GateResult> transition({
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

    final gate = await checkGates(jobId: jobId, from: from, to: to);
    if (!gate.passed) return gate;

    // Handle timer lifecycle
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

  /// Get the slider configuration for the current state.
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
