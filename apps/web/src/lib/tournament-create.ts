import { z } from 'zod';

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const coverImageUrl = z
  .string()
  .trim()
  .optional()
  .refine(
    (v) => !v || /^https?:\/\//i.test(v) || /^\/uploads\/[A-Za-z0-9._-]+$/.test(v),
    'Logo upload failed. Please try again.',
  );

export const tournamentCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Tournament name is required.')
      .min(2, 'Tournament name must contain at least 2 characters.')
      .max(80, "Tournament name can't be greater than 80 characters."),
    clubId: z.string().optional(),
    season: z
      .string()
      .trim()
      .min(1, 'Season is required.')
      .max(40, "Season can't be greater than 40 characters."),
    coverImageUrl,
    startDate: z.string().trim().min(1, 'Tournament start date is required.'),
    endDate: z.string().trim().min(1, 'Tournament end date is required.'),
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']),
    defaultOvers: z.coerce
      .number({ invalid_type_error: 'Overs is required.' })
      .int({ message: 'Overs must be a whole number.' })
      .min(1, 'Overs must be at least 1.')
      .max(90, "Overs can't be greater than 90."),
    defaultMaxWickets: z.coerce
      .number({ invalid_type_error: 'Maximum wickets is required.' })
      .int({ message: 'Maximum wickets must be a whole number.' })
      .min(1, 'Maximum wickets must be at least 1.')
      .max(10, "Maximum wickets can't be greater than 10."),
    stageType: z.enum(['GROUP_STAGE', 'KNOCKOUT', 'GROUP_AND_KNOCKOUT']),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'End date cannot be before the start date.',
    path: ['endDate'],
  })
  .refine((v) => !v.startDate || v.startDate >= todayIsoDate(), {
    message: 'Start date cannot be in the past. Choose today or a future date.',
    path: ['startDate'],
  });

export type TournamentCreateValues = z.infer<typeof tournamentCreateSchema>;

export const tournamentCreateDefaults = (): TournamentCreateValues => ({
  name: '',
  clubId: '',
  season: `Year ${new Date().getFullYear()}`,
  coverImageUrl: '',
  startDate: todayIsoDate(),
  endDate: todayIsoDate(),
  visibility: 'PUBLIC',
  defaultOvers: 5,
  defaultMaxWickets: 7,
  stageType: 'GROUP_STAGE',
});

export function quizzesStepError(
  enabled: boolean,
  quizzes: Array<{ name: string; startAt: string; endAt: string }>,
): { index: number; message: string } | null {
  if (!enabled) return null;
  for (let index = 0; index < quizzes.length; index += 1) {
    const quiz = quizzes[index]!;
    if (!quiz.name.trim()) return { index, message: 'Quiz name is required.' };
    if (quiz.startAt && quiz.endAt && quiz.startAt > quiz.endAt) {
      return { index, message: 'Quiz end cannot be before the start.' };
    }
  }
  return null;
}
