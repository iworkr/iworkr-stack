"use client";

import { useEffect } from "react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { StepSector } from "@/components/onboarding/step-sector";
import { StepIdentity } from "@/components/onboarding/step-identity";
import { StepTrade } from "@/components/onboarding/step-trade";
import { StepTeam } from "@/components/onboarding/step-team";
import { StepTraining } from "@/components/onboarding/step-training";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepComplete } from "@/components/onboarding/step-complete";

const stepComponents: Record<string, React.ComponentType> = {
  sector: StepSector,
  identity: StepIdentity,
  trade: StepTrade,
  team: StepTeam,
  training: StepTraining,
  integrations: StepIntegrations,
  complete: StepComplete,
};

export default function SetupPage() {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const industryType = useOnboardingStore((s) => s.industryType);
  const goToStep = useOnboardingStore((s) => s.goToStep);

  // If industry is already set (e.g. from /ndis CTA), skip the sector step
  useEffect(() => {
    if (currentStep === "sector" && industryType) {
      goToStep("identity");
    }
  }, [currentStep, industryType, goToStep]);

  const StepComponent = stepComponents[currentStep] || StepSector;

  return (
    <OnboardingLayout stepKey={currentStep}>
      <StepComponent />
    </OnboardingLayout>
  );
}
