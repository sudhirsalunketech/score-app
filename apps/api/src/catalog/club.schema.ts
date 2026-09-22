import { BallType } from '@prisma/client';
import { z } from 'zod';
import { isAllowedImageUrl } from '../uploads/image-upload';

export const createClubSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(80),
  establishedYear: z.coerce.number().int().min(1800).max(2100),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || isAllowedImageUrl(v), 'Enter a valid image URL'),
  description: z.string().trim().max(400).optional().transform((v) => (v ? v : undefined)),
  ballTypes: z.array(z.nativeEnum(BallType)).min(1).max(1).optional(),
});

export function clubBallTypes(input: z.infer<typeof createClubSchema>): BallType[] {
  const unique = [...new Set(input.ballTypes ?? [BallType.TENNIS])];
  return unique.slice(0, 1).length ? unique.slice(0, 1) : [BallType.TENNIS];
}
