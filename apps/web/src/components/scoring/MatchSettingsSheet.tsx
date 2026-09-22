import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/cn';
import type { MatchScoringSettings } from '@/lib/match-scoring-settings';

const ROW = 'flex min-h-12 items-center justify-between gap-3 border-b border-black/15 py-2';

export function MatchSettingsSheet({
  open,
  onClose,
  value,
  ballsPerOver,
  ballsPerOverLocked,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: MatchScoringSettings;
  ballsPerOver: number;
  ballsPerOverLocked?: boolean;
  onChange: (patch: Partial<MatchScoringSettings> & { ballsPerOver?: number }) => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      title={t('scoring.matchSettings')}
      closeSide="start"
      onClose={onClose}
      titleClassName="text-black"
    >
      <ToggleRow label={t('scoring.settings.wagonWheel')} on={value.wagonWheel} onToggle={() => onChange({ wagonWheel: !value.wagonWheel })} />
      <ToggleRow label={t('scoring.settings.addExtrasToWide')} on={value.addExtrasToWide} onToggle={() => onChange({ addExtrasToWide: !value.addExtrasToWide })} />
      <ToggleRow label={t('scoring.settings.addExtrasToNoBall')} on={value.addExtrasToNoBall} onToggle={() => onChange({ addExtrasToNoBall: !value.addExtrasToNoBall })} />

      <div className="border-b border-black/15 py-3">
        <p className="mb-2 text-sm font-semibold text-black">{t('match.ballsPerOver')}</p>
        <ChipRow
          options={[4, 5, 6, 7, 8]}
          value={ballsPerOver}
          disabled={ballsPerOverLocked}
          onPick={(n) => onChange({ ballsPerOver: n })}
        />
      </div>

      <div className="border-b border-black/15 py-3">
        <p className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-black">
          {t('scoring.settings.maxBallsWithExtras')}
          <InfoTooltip topic={t('scoring.settings.maxBallsWithExtras')} compact>
            {t('scoring.settings.maxBallsWithExtrasHint')}
          </InfoTooltip>
        </p>
        <div className="flex items-center justify-between gap-2">
          <ChipRow
            options={[6, 7, 8]}
            value={value.maxBallsPerOverWithExtras}
            onPick={(n) => onChange({ maxBallsPerOverWithExtras: n })}
          />
          <Switch
            label={t('scoring.settings.maxBallsWithExtras')}
            on={value.limitMaxBallsWithExtras}
            onToggle={() => onChange({ limitMaxBallsWithExtras: !value.limitMaxBallsWithExtras })}
          />
        </div>
      </div>

      <ToggleRow label={t('scoring.settings.addWideBallsToBatsman')} on={value.addWideBallsToBatsman} onToggle={() => onChange({ addWideBallsToBatsman: !value.addWideBallsToBatsman })} />
      <ToggleRow label={t('scoring.settings.addWideRunsToBatsman')} on={value.addWideToBatsman} onToggle={() => onChange({ addWideToBatsman: !value.addWideToBatsman })} />
      <ToggleRow label={t('scoring.settings.addNoBallExtrasToBatsman')} on={value.addNoBallToBatsman} onToggle={() => onChange({ addNoBallToBatsman: !value.addNoBallToBatsman })} />

      <ToggleRow label={t('scoring.settings.hattrickBattingBonus')} on={value.hattrickBattingBonus} onToggle={() => onChange({ hattrickBattingBonus: !value.hattrickBattingBonus })} />
      {value.hattrickBattingBonus ? (
        <div className="border-b border-black/15 py-3">
          <p className="mb-2 text-sm font-semibold text-black">{t('scoring.settings.hattrickBonusRuns')}</p>
          <ChipRow options={[1, 2, 3, 4, 5, 6]} value={value.hattrickBattingBonusRuns} onPick={(n) => onChange({ hattrickBattingBonusRuns: n })} />
        </div>
      ) : null}

      <ToggleRow label={t('scoring.settings.hattrickWicketPenalty')} on={value.hattrickWicketPenalty} onToggle={() => onChange({ hattrickWicketPenalty: !value.hattrickWicketPenalty })} />
      {value.hattrickWicketPenalty ? (
        <div className="py-3">
          <p className="mb-2 text-sm font-semibold text-black">{t('scoring.settings.hattrickPenaltyRuns')}</p>
          <ChipRow options={[1, 2, 3, 4, 5, 6]} value={value.hattrickWicketPenaltyRuns} onPick={(n) => onChange({ hattrickWicketPenaltyRuns: n })} />
        </div>
      ) : null}
    </BottomSheet>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className={ROW}>
      <span className="text-sm font-semibold text-black">{label}</span>
      <Switch label={label} on={on} onToggle={onToggle} />
    </div>
  );
}

function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="shrink-0" onClick={onToggle} aria-pressed={on} aria-label={label}>
      <span className={cn('block h-6 w-11 rounded-pill p-0.5', on ? 'bg-success' : 'bg-white/50')}>
        <span className={cn('block h-5 w-5 rounded-full bg-white transition-transform', on && 'translate-x-5')} />
      </span>
    </button>
  );
}

function ChipRow({
  options,
  value,
  disabled,
  onPick,
}: {
  options: number[];
  value: number;
  disabled?: boolean;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className={cn(
            'min-h-10 min-w-10 rounded-md border border-black/30 px-2 text-sm font-bold text-black disabled:opacity-40',
            value === n ? 'bg-black text-white' : 'bg-white/20',
          )}
          onClick={() => onPick(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
