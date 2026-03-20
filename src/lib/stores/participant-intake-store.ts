"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";

export const lineItemSchema = z.object({
  ndis_code: z.string().min(1, "Select an NDIS item"),
  ndis_name: z.string(),
  unit_rate: z.number().min(0),
  support_purpose: z.string(),
  allocated_budget: z.number().min(0, "Budget must be positive"),
});

export const rosterEntrySchema = z.object({
  days: z.array(z.string()).min(1, "Select at least one day"),
  start_time: z.string().min(1, "Set start time"),
  end_time: z.string().min(1, "Set end time"),
  linked_item_index: z.number().optional(),
  linked_item_number: z.string().optional(),
});

export const participantIntakeSchema = z.object({
  // Step 1: Identity
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  preferred_name: z.string().optional(),
  ndis_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  funding_type: z.string().min(1, "Select a funding type"),

  // Step 2: Medical
  primary_diagnosis: z.string().optional(),
  critical_alerts: z.string().optional(),
  mobility_status: z.string().optional(),
  communication_type: z.string().optional(),

  // Step 3: Service Agreement
  sa_start_date: z.string().optional(),
  sa_end_date: z.string().optional(),
  plan_manager_email: z.string().email("Invalid email").optional().or(z.literal("")),
  sa_line_items: z.array(lineItemSchema),

  // Step 4: Schedule
  roster_entries: z.array(rosterEntrySchema),
});

export type IntakeFormData = z.infer<typeof participantIntakeSchema>;

export const INTAKE_DEFAULTS: IntakeFormData = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  ndis_number: "",
  funding_type: "",
  date_of_birth: "",
  email: "",
  phone: "",
  primary_diagnosis: "",
  critical_alerts: "",
  mobility_status: "",
  communication_type: "",
  sa_start_date: new Date().toISOString().split("T")[0],
  sa_end_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
  plan_manager_email: "",
  sa_line_items: [],
  roster_entries: [],
};

interface IntakeState {
  currentStep: number;
  formData: Partial<IntakeFormData>;
  hasDraft: boolean;
  setFormData: (data: Partial<IntakeFormData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

export const useIntakeStore = create<IntakeState>()(
  persist(
    (set) => ({
      currentStep: 0,
      formData: {},
      hasDraft: false,
      setFormData: (data) =>
        set((state) => ({
          formData: { ...state.formData, ...data },
          hasDraft: true,
        })),
      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
      reset: () => set({ currentStep: 0, formData: {}, hasDraft: false }),
    }),
    { name: "iworkr-intake-draft" }
  )
);
