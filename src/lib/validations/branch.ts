import { z } from "zod";

export const BranchSchema = z.object({
  name: z.string().min(2, "Branch name is required").max(100, "Branch name is too long"),
  city: z.string().min(2, "City is required").max(100, "City is too long"),
  timezone: z.string().min(1, "Timezone is required").default("Australia/Sydney"),
  tax_rate: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), "Tax rate must be a number")
    .min(0, "Tax rate must be between 0 and 100")
    .max(100, "Tax rate must be between 0 and 100"),
  address: z.string().max(500, "Address is too long").optional().or(z.literal("")),
  state: z.string().max(100, "State is too long").optional().or(z.literal("")),
  country: z.string().max(100, "Country is too long").optional().or(z.literal("")),
  postal_code: z.string().max(20, "Postal code is too long").optional().or(z.literal("")),
  phone: z
    .string()
    .max(30, "Phone is too long")
    .regex(/^[+\d\s()-]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
});

export const BranchCreateSchema = BranchSchema.extend({
  organization_id: z.string().uuid("Invalid workspace ID"),
});

export const BranchUpdateSchema = BranchSchema.partial().extend({
  is_headquarters: z.boolean().optional(),
  ai_agent_phone: z.string().max(30).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type BranchInput = z.infer<typeof BranchSchema>;
export type BranchCreateInput = z.infer<typeof BranchCreateSchema>;
export type BranchUpdateInput = z.infer<typeof BranchUpdateSchema>;
