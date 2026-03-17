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
