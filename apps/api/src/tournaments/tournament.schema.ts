import { ShareVisibility } from '@prisma/client';
import { z } from 'zod';
import { isAllowedImageUrl } from '../uploads/image-upload';
import { overRuleUpsertSchema } from '../matches/over-rules.service';

const defaultOverRuleSchema = z.intersection(z.object({ overNumber: z.number().int().min(0).max(89) }), overRuleUpsertSchema);

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || isAllowedImageUrl(v), 'Enter a valid image URL');

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const knockoutFields = {
  stageType: z.enum(['GROUP_STAGE', 'KNOCKOUT', 'GROUP_AND_KNOCKOUT']).optional(),
  knockoutTeamCount: z.coerce.number().int().min(2).max(16).optional(),
  includeThirdPlace: z.boolean().optional(),
  pairingMode: z.enum(['SEEDED', 'ADJACENT', 'MANUAL']).optional(),
};

export const quizInputSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z.string().trim().min(1, 'Quiz name is required.').max(80),
    description: z.string().trim().max(400).optional().transform((v) => (v ? v : undefined)),
    status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED']).optional(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .refine((v) => !v.startAt || !v.endAt || v.startAt <= v.endAt, {
    message: 'Quiz end cannot be before the start.',
    path: ['endAt'],
  });

export const fanQuizConfigSchema = z.object({
  enabled: z.boolean().optional(),
  quizzes: z.array(quizInputSchema).max(50).optional(),
});

export const createTournamentSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    clubId: z.string().trim().optional().transform((v) => (v ? v : undefined)),
    season: z.string().trim().max(40).optional().transform((v) => (v ? v : undefined)),
    coverImageUrl: optionalUrl,
    startDate: optionalDate,
    endDate: optionalDate,
    visibility: z.nativeEnum(ShareVisibility).optional(),
    defaultOvers: z.coerce.number().int().min(1).max(90).optional(),
    defaultMaxWickets: z.coerce.number().int().min(1).max(10).optional(),
    defaultBallsPerOver: z.coerce.number().int().min(4).max(8).optional(),
    defaultWidesCountAsLegal: z.boolean().optional(),
    defaultNoBallsCountAsLegal: z.boolean().optional(),
    defaultOverWiseRulesEnabled: z.boolean().optional(),
    defaultOverRules: z.array(defaultOverRuleSchema).max(90).optional(),
    winningBonusPoints: z.coerce.number().int().min(0).max(20).optional(),
    ...knockoutFields,
    fanQuiz: fanQuizConfigSchema.optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'Tournament end date cannot be before the start date',
    path: ['endDate'],
  });

export const patchTournamentSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    season: z.string().trim().max(40).optional(),
    coverImageUrl: optionalUrl,
    startDate: optionalDate,
    endDate: optionalDate,
    visibility: z.nativeEnum(ShareVisibility).optional(),
    defaultOvers: z.coerce.number().int().min(1).max(90).optional(),
    defaultMaxWickets: z.coerce.number().int().min(1).max(10).optional(),
    defaultBallsPerOver: z.coerce.number().int().min(4).max(8).optional(),
    defaultWidesCountAsLegal: z.boolean().optional(),
    defaultNoBallsCountAsLegal: z.boolean().optional(),
    defaultOverWiseRulesEnabled: z.boolean().optional(),
    defaultOverRules: z.array(defaultOverRuleSchema).max(90).optional(),
    winningBonusPoints: z.coerce.number().int().min(0).max(20).optional(),
    ...knockoutFields,
    fanQuiz: fanQuizConfigSchema.optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'Tournament end date cannot be before the start date',
    path: ['endDate'],
  });

export function toDate(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
