export type FanQuizStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';

export type FanQuizVisibility = {
  show: boolean;
  comingSoon: boolean;
  playable: boolean;
  tournamentId: string | null;
  tournamentName: string | null;
  quizName: string | null;
  quizDescription: string | null;
  quizStatus: string;
};

export type FanQuizQuestion = {
  id: string;
  matchId?: string | null;
  tournamentId?: string | null;
  kind: string;
  type: string;
  title: string;
  question: string;
  status: string;
  options: Array<{ id: string; label: string }>;
  myAnswer?: { optionIds: string[]; numberValue?: number | null } | null;
  correctOptionIds: string[];
  answerCount?: number;
  enabled?: boolean;
};

export type FanQuizPlay = {
  visibility: FanQuizVisibility;
  questions: FanQuizQuestion[];
  result: { score: number; total: number; accuracy: number } | null;
};

export type FanQuizForm = {
  id?: string;
  name: string;
  description: string;
  status: FanQuizStatus;
  startAt: string;
  endAt: string;
};

export const emptyQuizForm = (): FanQuizForm => ({
  name: '',
  description: '',
  status: 'DRAFT',
  startAt: '',
  endAt: '',
});

export function toLocalDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toIsoDateTime(local: string) {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function quizListPayload(enabled: boolean, quizzes: FanQuizForm[]) {
  return {
    enabled,
    quizzes: quizzes.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description || undefined,
      status: q.status,
      startAt: toIsoDateTime(q.startAt),
      endAt: toIsoDateTime(q.endAt),
    })),
  };
}
