import { useTranslation } from 'react-i18next';
import { LabelWithInfo } from '@/components/ui/InfoTooltip';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/components/fans/QuizCard';
import { emptyQuizForm, type FanQuizForm } from '@/lib/fan-quiz';

export function QuizList({
  enabled,
  onEnabledChange,
  quizzes,
  onQuizzesChange,
  errors,
  dark,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  quizzes: FanQuizForm[];
  onQuizzesChange: (next: FanQuizForm[]) => void;
  errors?: Record<number, string>;
  dark?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-touch items-center justify-between gap-3">
        <LabelWithInfo label={t('fans.quizEnable')} info={t('info.fanQuiz.enable')} dark={dark} />
        <input
          type="checkbox"
          className={dark ? 'h-5 w-5 accent-[var(--color-gold)]' : 'h-5 w-5 accent-primary'}
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
      </div>
      {enabled ? (
        <>
          {quizzes.map((quiz, index) => (
            <QuizCard
              key={index}
              index={index}
              value={quiz}
              dark={dark}
              error={errors?.[index]}
              onChange={(next) => onQuizzesChange(quizzes.map((q, i) => (i === index ? next : q)))}
              onRemove={() => onQuizzesChange(quizzes.filter((_, i) => i !== index))}
            />
          ))}
          <Button type="button" variant="outline" onClick={() => onQuizzesChange([...quizzes, emptyQuizForm()])}>
            + {t('fans.quizAddAnother')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
