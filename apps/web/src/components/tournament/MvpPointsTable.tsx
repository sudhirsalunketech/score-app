import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MvpConfig } from '@/types/api';
import { NumericInput } from '@/components/ui/Input';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/cn';

export const DEFAULT_MVP_CONFIG: MvpConfig = {
  batting: {
    pointsPerTenRuns: 1,
    minRuns: 10,
    fiftyBonus: 1,
    hundredBonus: 1,
    strikeRateBonus: 1,
    strikeRateThreshold: 130,
    strikeRateMinRuns: 10,
  },
  bowling: { pointsPerWicket: 2, threeWicketBonus: 1, fiveWicketBonus: 1, maidenOverBonus: 1 },
  fielding: { catch: 1, stumping: 1, runOut: 1 },
};

export function MvpPointsTable({
  config,
  onChange,
  readOnly = false,
  dark,
}: {
  config: MvpConfig;
  onChange?: (next: MvpConfig) => void;
  readOnly?: boolean;
  dark?: boolean;
}) {
  const { t } = useTranslation();
  const set = (path: (c: MvpConfig) => void) => {
    if (readOnly || !onChange) return;
    const next = structuredClone(config);
    path(next);
    onChange(next);
  };
  const num = (value: number, write: (n: number) => void) =>
    readOnly ? (
      <span className="font-bold tabular-nums">{value}</span>
    ) : (
      <NumericInput dark={dark} decimal min={0} value={String(value)} onChange={(e) => write(Number(e.target.value))} />
    );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className={cn('mb-2 font-bold', dark && 'text-gold')}>{t('mvp.batting')}</h3>
        <Row dark={dark} label={t('mvp.runsPer10')} info={t('info.mvp.runsPer10')} value={num(config.batting.pointsPerTenRuns, (n) => set((c) => { c.batting.pointsPerTenRuns = n; }))} />
        <Row dark={dark} label={t('mvp.minRuns')} info={t('info.mvp.minRuns')} value={num(config.batting.minRuns, (n) => set((c) => { c.batting.minRuns = n; }))} />
        <Row dark={dark} label={t('mvp.fifty')} info={t('info.mvp.fifty')} value={num(config.batting.fiftyBonus, (n) => set((c) => { c.batting.fiftyBonus = n; }))} />
        <Row dark={dark} label={t('mvp.hundred')} info={t('info.mvp.hundred')} value={num(config.batting.hundredBonus, (n) => set((c) => { c.batting.hundredBonus = n; }))} />
        <Row dark={dark} label={t('mvp.strikeRate')} info={t('info.mvp.strikeRate')} value={num(config.batting.strikeRateThreshold, (n) => set((c) => { c.batting.strikeRateThreshold = n; }))} />
        <Row dark={dark} label={t('mvp.srMinRuns')} info={t('info.mvp.srMinRuns')} value={num(config.batting.strikeRateMinRuns, (n) => set((c) => { c.batting.strikeRateMinRuns = n; }))} />
        <Row dark={dark} label={t('mvp.srBonus')} info={t('info.mvp.srBonus')} value={num(config.batting.strikeRateBonus, (n) => set((c) => { c.batting.strikeRateBonus = n; }))} />
      </section>
      <section>
        <h3 className={cn('mb-2 font-bold', dark && 'text-gold')}>{t('mvp.bowling')}</h3>
        <Row dark={dark} label={t('mvp.wicket')} info={t('info.mvp.wicket')} value={num(config.bowling.pointsPerWicket, (n) => set((c) => { c.bowling.pointsPerWicket = n; }))} />
        <Row dark={dark} label={t('mvp.threeWickets')} info={t('info.mvp.threeWickets')} value={num(config.bowling.threeWicketBonus, (n) => set((c) => { c.bowling.threeWicketBonus = n; }))} />
        <Row dark={dark} label={t('mvp.fiveWickets')} info={t('info.mvp.fiveWickets')} value={num(config.bowling.fiveWicketBonus, (n) => set((c) => { c.bowling.fiveWicketBonus = n; }))} />
        <Row dark={dark} label={t('mvp.maidenOver')} info={t('info.mvp.maidenOver')} value={num(config.bowling.maidenOverBonus, (n) => set((c) => { c.bowling.maidenOverBonus = n; }))} />
      </section>
      <section>
        <h3 className={cn('mb-2 font-bold', dark && 'text-gold')}>{t('mvp.fielding')}</h3>
        <Row dark={dark} label={t('mvp.catch')} info={t('info.mvp.catch')} value={num(config.fielding.catch, (n) => set((c) => { c.fielding.catch = n; }))} />
        <Row dark={dark} label={t('mvp.stumping')} info={t('info.mvp.stumping')} value={num(config.fielding.stumping, (n) => set((c) => { c.fielding.stumping = n; }))} />
        <Row dark={dark} label={t('mvp.runOut')} info={t('info.mvp.runOut')} value={num(config.fielding.runOut, (n) => set((c) => { c.fielding.runOut = n; }))} />
      </section>
    </div>
  );
}

function Row({ label, info, value, dark }: { label: string; info?: string; value: ReactNode; dark?: boolean }) {
  return (
    <div className={cn('flex min-h-touch items-center justify-between gap-3 border-b py-2', dark ? 'border-gold/15' : 'border-border')}>
      <span className={cn('inline-flex items-center gap-1', dark ? 'text-on-dark/70' : 'text-text-secondary')}>
        {label}
        {info ? (
          <InfoTooltip topic={label} dark={dark} compact>
            {info}
          </InfoTooltip>
        ) : null}
      </span>
      <span className="w-24 text-end">{value}</span>
    </div>
  );
}
