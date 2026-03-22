/**
 * @module NewWorkspaceContext
 * @status COMPLETE
 * @description React context for new workspace onboarding modal — isModal flag, onComplete, onClose callbacks
 * @lastAudit 2026-03-22
 */

import { createContext, useContext } from "react";

export interface NewWorkspaceContextValue {
  /** True when onboarding is running inside the modal (not the /setup page) */
  isModal: boolean;
  /** Called when onboarding completes inside the modal — switches org + closes */
  onComplete: (newOrgId: string) => void;
  /** Called when the user closes/cancels the modal */
  onClose: () => void;
}

export const NewWorkspaceContext = createContext<NewWorkspaceContextValue>({
  isModal: false,
  onComplete: () => {},
  onClose: () => {},
});

export function useNewWorkspaceContext() {
  return useContext(NewWorkspaceContext);
}
