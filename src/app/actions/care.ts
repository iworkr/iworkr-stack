/**
 * @module Care Server Actions (Barrel)
 * @status COMPLETE
 * @description Barrel re-export aggregating care-clinical, care-compliance, and care-governance sub-modules
 * @exports createObservationAction, createRestrictivePracticeAction, createIncidentAction, fetchObservationsAction, fetchIncidentsAction
 * @lastAudit 2026-03-22
 */

/**
 * Barrel re-export — original monolith decomposed into domain modules.
 * All existing imports from "@/app/actions/care" continue to work unchanged.
 *
 * Note: "use server" is intentionally omitted here — the directive lives in
 * each sub-module (care-clinical, care-compliance, care-governance) which is
 * where the actual server action functions are defined. Next.js only allows
 * async function exports in "use server" files, not re-exports.
 */

// ── Clinical Safety & Health ──
export {
  createObservationAction,
  fetchObservationsAction,
  createMedicationAction,
  updateMedicationAction,
  fetchMedicationsAction,
  recordMARAction,
  createCarePlanAction,
  updateCarePlanAction,
  fetchCarePlansAction,
  createCareGoalAction,
  updateCareGoalAction,
  createBSPAction,
  updateBSPAction,
  fetchBSPsAction,
  createBehaviourEventAction,
  fetchBehaviourEventsAction,
  createProgressNoteAction,
  fetchProgressNotesAction,
} from "./care-clinical";

// ── Worker Compliance & Restrictive Practices ──
export {
  createRestrictivePracticeAction,
  fetchRestrictivePracticesAction,
  createOnboardingChecklistAction,
  updateOnboardingChecklistAction,
  authoriseWorkerAction,
  fetchOnboardingChecklistAction,
  fetchSentinelAlertsAction,
  acknowledgeSentinelAlertAction,
} from "./care-compliance";

// ── Governance, Quality, Incidents & Finance ──
export {
  createIncidentAction,
  updateIncidentAction,
  fetchIncidentsAction,
  createAuditSessionAction,
  fetchAuditSessionsAction,
  createCIActionAction,
  updateCIActionAction,
  fetchCIActionsAction,
  createPolicyAction,
  fetchPoliciesAction,
  acknowledgePolicyAction,
  createGovernanceMeetingAction,
  fetchGovernanceMeetingsAction,
  createSCCaseAction,
  updateSCCaseAction,
  fetchSCCasesAction,
  fetchNDISCatalogueAction,
  fetchBudgetAllocationsAction,
  fetchClaimBatchesAction,
  fetchClaimLineItemsAction,
  createClaimBatchAction,
  applyClaimResolutionsAction,
  fetchPlanManagerInvoicesAction,
  approvePlanManagerInvoiceAction,
  rejectPlanManagerInvoiceAction,
} from "./care-governance";

// ── Rosetta: Dynamic Shift Notes ──
export {
  listShiftNoteTemplatesAction,
  createShiftNoteTemplateAction,
  listTemplateAssignmentRulesAction,
  createTemplateAssignmentRuleAction,
  listShiftNoteSubmissionsAction,
  acknowledgeShiftNoteSubmissionAction,
} from "./care-shift-notes";

// ── Ironclad: Audit & Compliance Fortress ──
export {
  listIroncladScopeOptionsAction,
  createAuditorPortalAction,
  listAuditorPortalsAction,
  revokeAuditorPortalAction,
  getComplianceReadinessAction,
  triggerCredentialRemediationAction,
  verifyDocumentHashAction,
} from "./care-ironclad";
