import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { PersonnelValidationKey } from '@/lib/innings-setup';

type Slot = 'striker' | 'nonStriker' | 'bowler';

export function InningsSetupPanel({
  battingTeamName,
  strikerName,
  nonStrikerName,
  bowlerName,
  validationKey,
  onSelect,
  onStart,
}: {
  battingTeamName?: string;
  strikerName?: string | null;
  nonStrikerName?: string | null;
  bowlerName?: string | null;
  validationKey: PersonnelValidationKey | null;
  onSelect: (slot: Slot) => void;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const ready = !validationKey;

  return (
    <section
      className="mx-[var(--gutter)] my-3 rounded-card-lg border border-border bg-surface px-4 py-4"
      aria-labelledby="innings-setup-heading"
    >
      <h2 id="innings-setup-heading" className="text-center text-lg font-bold">
        {ready ? t('match.readyToStartScoring') : t('match.selectPlayersToContinue')}
      </h2>
      {battingTeamName ? (
        <p className="mt-1 text-center text-sm text-text-secondary">{battingTeamName}</p>
      ) : null}
      <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {t('match.startInnings')}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <SetupSlot label={t('scoring.striker')} name={strikerName} onClick={() => onSelect('striker')} />
        <SetupSlot label={t('match.nonStriker')} name={nonStrikerName} onClick={() => onSelect('nonStriker')} />
        <SetupSlot label={t('scoring.bowler')} name={bowlerName} onClick={() => onSelect('bowler')} />
      </div>
      {validationKey ? (
        <p className="mt-3 text-center text-sm font-semibold text-danger" role="alert">
          {t(`match.${validationKey}`)}
        </p>
      ) : null}
      <Button className="mt-4 w-full" disabled={!ready} onClick={onStart}>
        {t('match.startScoring')}
      </Button>
    </section>
  );
}

export function WicketReplacementPanel({
  dismissedName,
  onSelect,
}: {
  dismissedName?: string | null;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="mx-[var(--gutter)] my-3 rounded-card-lg border border-scoring bg-surface px-4 py-4">
      <h2 className="text-center text-lg font-bold text-scoring">{t('match.wicketSelectReplacement')}</h2>
      {dismissedName ? (
        <p className="mt-1 text-center text-sm text-text-secondary">{dismissedName}</p>
      ) : null}
      <p className="mt-2 text-center text-sm font-semibold">{t('match.selectNewBatsman')}</p>
      <Button className="mt-4 w-full" variant="scoring" onClick={onSelect}>
        {t('match.chooseNewBatsman')}
      </Button>
    </section>
  );
}

function SetupSlot({
  label,
  name,
  onClick,
}: {
  label: string;
  name?: string | null;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
        <p className="truncate text-base font-semibold">{name || t('playingXI.select')}</p>
      </div>
      <button
        type="button"
        className="min-h-touch shrink-0 rounded-lg bg-primary px-3 text-sm font-bold uppercase text-on-dark"
        onClick={onClick}
      >
        {name ? t('match.changePlayer') : t('playingXI.select')}
      </button>
    </div>
  );
}
