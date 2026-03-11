"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { StepSector } from "@/components/onboarding/step-sector";
import { StepIdentity } from "@/components/onboarding/step-identity";
import { StepTrade } from "@/components/onboarding/step-trade";
import { StepTeam } from "@/components/onboarding/step-team";
import { StepTraining } from "@/components/onboarding/step-training";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepComplete } from "@/components/onboarding/step-complete";
import { createClient } from "@/lib/supabase/client";

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
  const reset = useOnboardingStore((s) => s.reset);
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  // Check if the user already has an active org membership.
  // If so, they've already onboarded — clear store and go to dashboard.
  useEffect(() => {
    async function checkExistingMembership() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setChecked(true);
          return;
        }

        const { data: membership } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { eq: (col: string, val: string) => { limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> } } } } } })
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (membership) {
          // User already has an active org — reset onboarding store and redirect
          reset();
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Supabase may not be configured — continue to onboarding
      }
      setChecked(true);
    }
    checkExistingMembership();
  }, [reset, router]);

  // If industry is already set (e.g. from /ndis CTA), skip the sector step
  useEffect(() => {
    if (checked && currentStep === "sector" && industryType) {
      goToStep("identity");
    }
  }, [checked, currentStep, industryType, goToStep]);

  // Don't render until we've checked membership
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="stealth-noise fixed" />
      </div>
    );
  }

  const StepComponent = stepComponents[currentStep] || StepSector;

  return (
    <OnboardingLayout stepKey={currentStep}>
      <StepComponent />
    </OnboardingLayout>
  );
}
