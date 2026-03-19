import { z } from "zod";

export const UuidSchema = z.string().uuid();

export const TimestampSchema = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/));

export const NullableString = z.string().nullable().optional();
export const NullableNumber = z.number().nullable().optional();
export const NullableUuid = UuidSchema.nullable().optional();

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(200).default(25),
  total: z.number().int().min(0).optional(),
});

export const JsonSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown());

export type Pagination = z.infer<typeof PaginationSchema>;
