import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconMinus, IconPlus } from '@/components/ui/Icons';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/cn';
import { parseRunDigits } from '@/lib/run-input';
import type { ExtraType, PenaltyReason } from '@/types/api';

type NbView = 'main' | 'BYE' | 'LEG_BYE' | 'MORE';

const PENALTY_REASONS: PenaltyReason[] = [
  'TOURNAMENT_PENALTY',
  'SLOW_OVER_RATE',
  'MISCONDUCT',
  'ILLEGAL_EQUIPMENT',
  'OTHER',
];

const KEY =
  'min-h-12 min-w-0 rounded-lg border border-black/30 bg-transparent px-1 text-sm font-bold text-scoring-on active:bg-black/10 disabled:opacity-40';

export function ExtrasSheet({
  open,
  extraType,
  pendingWicket = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  extraType: ExtraType | null;
  pendingWicket?: boolean;
  onClose: () => void;
  onConfirm: (extraRuns: number, batsmanRuns: number, penaltyReason?: PenaltyReason) => void;
}) {
  const { t } = useTranslation();
  const [nbView, setNbView] = useState<NbView>('main');
  const [sign, setSign] = useState<'plus' | 'minus'>('plus');
  const [pendingPenaltyRuns, setPendingPenaltyRuns] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setNbView('main');
      setSign('plus');
      setPendingPenaltyRuns(null);
    }
  }, [open, extraType]);

  const title = pendingPenaltyRuns != null ? t('scoring.penaltyReasonTitle') : sheetTitle(t, extraType, pendingWicket, nbView);
  const bonusOpen = extraType === 'PENALTY' && !pendingWicket && pendingPenaltyRuns == null;
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-touch min-w-touch items-center justify-center rounded-full',
      active ? 'bg-black text-white' : 'border border-black text-black',
    );

  const closeOrBack = () => {
    if (pendingPenaltyRuns != null) {
      setPendingPenaltyRuns(null);
      return;
    }
    if (extraType === 'NO_BALL' && nbView !== 'main') {
      setNbView('main');
      return;
    }
    onClose();
  };

  const pick = (extraRuns: number, batsmanRuns: number) => {
    onConfirm(extraRuns, batsmanRuns);
    setNbView('main');
  };

  return (
    <BottomSheet
      open={open}
      title={title}
      closeSide="start"
      onClose={closeOrBack}
      titleClassName={bonusOpen ? 'text-black' : undefined}
      headerEnd={
        bonusOpen ? (
          <div className="flex items-center gap-1">
            <InfoTooltip topic={title}>{t('info.scoring.extra')}</InfoTooltip>
            <button
              type="button"
              className={chip(sign === 'plus')}
              aria-label={t('scoring.addBonus')}
              aria-pressed={sign === 'plus'}
              onClick={() => setSign('plus')}
            >
              <IconPlus />
            </button>
            <button
              type="button"
              className={chip(sign === 'minus')}
              aria-label={t('scoring.minusScore')}
              aria-pressed={sign === 'minus'}
              onClick={() => setSign('minus')}
            >
              <IconMinus />
            </button>
          </div>
        ) : extraType && extraType !== 'NONE' ? (
          <InfoTooltip topic={title}>{t('info.scoring.extra')}</InfoTooltip>
        ) : null
      }
    >
      {pendingWicket || extraType === 'NONE' ? (
        <Grid>
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className={KEY} onClick={() => pick(0, n)}>
              {n}
            </button>
          ))}
        </Grid>
      ) : extraType === 'BYE' || nbView === 'BYE' ? (
        <Grid>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              className={KEY}
              onClick={() => pick(extraType === 'NO_BALL' ? 1 + n : n, 0)}
            >
              {t('scoring.byeN', { n })}
            </button>
          ))}
        </Grid>
      ) : extraType === 'LEG_BYE' || nbView === 'LEG_BYE' ? (
        <Grid>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              className={KEY}
              onClick={() => pick(extraType === 'NO_BALL' ? 1 + n : n, 0)}
            >
              {t('scoring.legByeN', { n })}
            </button>
          ))}
        </Grid>
      ) : extraType === 'WIDE' ? (
        <div className="grid grid-cols-4 gap-2">
          <button type="button" className={KEY} onClick={() => pick(1, 0)}>
            {t('scoring.widePlain')}
          </button>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className={KEY} onClick={() => pick(n + 1, 0)}>
              {t('scoring.widePlus', { n })}
            </button>
          ))}
        </div>
      ) : extraType === 'NO_BALL' && nbView === 'MORE' ? (
        <Grid>
          {[4, 5, 6, 7].map((n) => (
            <button key={n} type="button" className={KEY} onClick={() => pick(1, n)}>
              {t('scoring.noBallPlus', { n })}
            </button>
          ))}
        </Grid>
      ) : extraType === 'NO_BALL' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={KEY} onClick={() => pick(1, 0)}>
              {t('scoring.noBallPlain')}
            </button>
            {[1, 2, 3, 4, 6].map((n) => (
              <button key={n} type="button" className={KEY} onClick={() => pick(1, n)}>
                {t('scoring.noBallPlus', { n })}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button type="button" className={KEY} onClick={() => setNbView('LEG_BYE')}>
              {t('scoring.legByesTitle')}
            </button>
            <button type="button" className={KEY} onClick={() => setNbView('BYE')}>
              {t('scoring.byesTitle')}
            </button>
            <button type="button" className={KEY} onClick={() => setNbView('MORE')}>
              {t('scoring.moreRuns')}
            </button>
          </div>
        </>
      ) : pendingPenaltyRuns != null ? (
        <PenaltyReasonPad
          onPick={(reason) => {
            onConfirm(pendingPenaltyRuns, 0, reason);
            setPendingPenaltyRuns(null);
            setNbView('main');
          }}
        />
      ) : (
        <PenaltyPad sign={sign} onConfirm={setPendingPenaltyRuns} />
      )}
    </BottomSheet>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-2">{children}</div>;
}

function sheetTitle(
  t: (key: string) => string,
  extraType: ExtraType | null,
  pendingWicket: boolean,
  nbView: NbView,
): string {
  if (pendingWicket) return t('match.wicket');
  if (extraType === 'NO_BALL' && nbView === 'BYE') return t('scoring.byesTitle');
  if (extraType === 'NO_BALL' && nbView === 'LEG_BYE') return t('scoring.legByesTitle');
  if (extraType === 'BYE') return t('scoring.byesTitle');
  if (extraType === 'LEG_BYE') return t('scoring.legByesTitle');
  if (extraType === 'WIDE') return t('scoring.wideTitle');
  if (extraType === 'NO_BALL') return t('scoring.noBallTitle');
  if (extraType === 'PENALTY') return t('scoring.bonusRuns');
  return t('scoring.extraRuns');
}

function PenaltyPad({
  sign,
  onConfirm,
}: {
  sign: 'plus' | 'minus';
  onConfirm: (runs: number) => void;
}) {
  const { t } = useTranslation();
  const [customText, setCustomText] = useState('');
  const parsed = parseRunDigits(customText);
  const prefix = sign === 'minus' ? '-' : '+';
  return (
    <>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 8].map((n) => (
          <button
            key={n}
            type="button"
            className="min-h-12 min-w-0 rounded-lg border border-black/30 bg-transparent px-1 text-sm font-bold text-black active:bg-black/10"
            onClick={() => onConfirm(sign === 'minus' ? -n : n)}
          >
            {prefix} {n}
          </button>
        ))}
        <CustomValueBox
          value={customText}
          onChange={setCustomText}
          onSubmit={() => {
            if (parsed.value == null) return;
            onConfirm(sign === 'minus' ? -parsed.value : parsed.value);
          }}
        />
      </div>
      <Button
        className="mt-1 min-h-12 w-full bg-black text-white"
        disabled={parsed.value == null}
        onClick={() => {
          if (parsed.value == null) return;
          onConfirm(sign === 'minus' ? -parsed.value : parsed.value);
        }}
      >
        {t('scoring.confirm')}
      </Button>
    </>
  );
}

function PenaltyReasonPad({ onPick }: { onPick: (reason: PenaltyReason) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-2">
      {PENALTY_REASONS.map((reason) => (
        <button
          key={reason}
          type="button"
          className="min-h-12 rounded-lg border border-black/30 bg-transparent px-3 text-start text-sm font-bold text-black active:bg-black/10"
          onClick={() => onPick(reason)}
        >
          {t(`scoring.penaltyReasons.${reason}`)}
        </button>
      ))}
    </div>
  );
}

export function MoreRunsSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (runs: number) => void;
}) {
  const { t } = useTranslation();
  const [customText, setCustomText] = useState('');
  const parsed = parseRunDigits(customText);

  useEffect(() => {
    if (!open) setCustomText('');
  }, [open]);

  return (
    <BottomSheet open={open} title={t('scoring.moreRuns')} closeSide="start" onClose={onClose}>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[4, 5, 6, 7].map((n) => (
          <button key={n} type="button" className={KEY} onClick={() => onPick(n)}>
            {n}
          </button>
        ))}
        <CustomValueBox
          value={customText}
          onChange={setCustomText}
          onSubmit={() => {
            if (parsed.value == null) return;
            onPick(parsed.value);
          }}
        />
      </div>
      <Button
        className="min-h-12 w-full bg-black text-white"
        disabled={parsed.value == null}
        onClick={() => {
          if (parsed.value == null) return;
          onPick(parsed.value);
        }}
      >
        {t('scoring.confirm')}
      </Button>
    </BottomSheet>
  );
}

function CustomValueBox({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const filled = value.length > 0;
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        aria-label={t('scoring.customValue')}
        aria-invalid={false}
        placeholder=""
        value={value}
        className={cn(
          'min-h-12 w-full min-w-0 rounded-lg border px-1 text-center text-sm font-bold text-black caret-black focus:outline-none',
          filled ? 'border-black bg-[#FFCC80]' : 'border-black/35 bg-[#FFD8A8]',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
        }}
        onChange={(e) => onChange(parseRunDigits(e.target.value).text)}
      />
      <span
        className={cn(
          'pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-black/40',
          filled ? 'bg-black' : 'bg-white/70',
        )}
        aria-hidden
      />
      <span className="sr-only">{filled ? t('scoring.customValueAdded') : t('scoring.customValue')}</span>
    </div>
  );
}
