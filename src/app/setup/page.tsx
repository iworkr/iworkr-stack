"use client";

import { useOnboardingStore } from "@/lib/onboarding-store";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { StepIdentity } from "@/components/onboarding/step-identity";
import { StepTrade } from "@/components/onboarding/step-trade";
import { StepTeam } from "@/components/onboarding/step-team";
import { StepTraining } from "@/components/onboarding/step-training";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepComplete } from "@/components/onboarding/step-complete";

const stepComponents: Record<string, React.ComponentType> = {
  identity: StepIdentity,
  trade: StepTrade,
  team: StepTeam,
  training: StepTraining,
  integrations: StepIntegrations,
  complete: StepComplete,
};

// INCOMPLETE:PARTIAL — no auth guard; unauthenticated users can access the setup page directly without being redirected to login.
export default function SetupPage() {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const StepComponent = stepComponents[currentStep] || StepIdentity;

  return (
    <OnboardingLayout stepKey={currentStep}>
      <StepComponent />
    </OnboardingLayout>
  );
}
