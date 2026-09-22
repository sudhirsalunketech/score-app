import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { FanQuizForm, FanQuizStatus } from '@/lib/fan-quiz';

export function QuizCard({
  index,
  value,
  onChange,
  onRemove,
  error,
  dark,
}: {
  index: number;
  value: FanQuizForm;
  onChange: (next: FanQuizForm) => void;
  onRemove: () => void;
  error?: string;
  dark?: boolean;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<FanQuizForm>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gold/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gold">
          {t('fans.quizNumbered', { number: index + 1 })}
        </h3>
        <Button type="button" variant="danger" onClick={onRemove}>
          {t('fans.quizRemove')}
        </Button>
      </div>
      <Input
        dark={dark}
        underline
        requiredMark
        label={t('fans.quizName')}
        value={value.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder={t('fans.quizNamePlaceholder')}
        error={error}
      />
      <Input
        dark={dark}
        underline
        label={t('fans.quizDescription')}
        value={value.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <Select
        dark={dark}
        underline
        label={t('fans.quizStatus')}
        info={t('info.fanQuiz.publish')}
        value={value.status}
        onChange={(e) => set({ status: e.target.value as FanQuizStatus })}
      >
        <option value="DRAFT">{t('fans.quizStatuses.DRAFT')}</option>
        <option value="SCHEDULED">{t('fans.quizStatuses.SCHEDULED')}</option>
        <option value="ACTIVE">{t('fans.quizStatuses.ACTIVE')}</option>
        <option value="COMPLETED">{t('fans.quizStatuses.COMPLETED')}</option>
      </Select>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          dark={dark}
          underline
          type="datetime-local"
          label={t('fans.quizStart')}
          value={value.startAt}
          onChange={(e) => set({ startAt: e.target.value })}
        />
        <Input
          dark={dark}
          underline
          type="datetime-local"
          label={t('fans.quizEnd')}
          value={value.endAt}
          onChange={(e) => set({ endAt: e.target.value })}
        />
      </div>
    </div>
  );
}
