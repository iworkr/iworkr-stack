import { z } from "zod";

export const companyNameSchema = z
  .string()
  .min(2, "Company name must be at least 2 characters")
  .max(50, "Company name must be under 50 characters")
  .regex(
    /^[a-zA-Z0-9\s&'.,-]+$/,
    "Only letters, numbers, spaces, and basic punctuation allowed"
  );

export const emailSchema = z.string().email("Invalid email address");

export const inviteEmailSchema = z
  .string()
  .email("Enter a valid email address")
  .refine(
    (email) => !email.endsWith("@example.com"),
    "Please use a real email address"
  );

export type CompanyNameInput = z.infer<typeof companyNameSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
