import { z } from 'zod';

export const CURRENT_YEAR = new Date().getFullYear();
export const ESTABLISHED_YEARS = Array.from({ length: CURRENT_YEAR - 1799 }, (_, i) => CURRENT_YEAR - i);

export const clubRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Club name must contain at least 2 characters.').max(80, 'Club name is too long.'),
  city: z.string().trim().min(1, 'City is required.').max(80),
  establishedYear: z.coerce
    .number()
    .int()
    .min(1800, 'Enter a valid year.')
    .max(CURRENT_YEAR, 'Year cannot be in the future.'),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v) || /^\/uploads\/[A-Za-z0-9._-]+$/.test(v),
      'Logo upload failed. Please try again.',
    ),
  ballTypes: z.array(z.enum(['TENNIS', 'LEATHER', 'RUBBER'])).length(1, 'Select a ball type.'),
});

export type ClubRegisterValues = z.infer<typeof clubRegisterSchema>;
