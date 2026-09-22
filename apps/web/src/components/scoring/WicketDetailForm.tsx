import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconClose, IconPlus } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { WicketByeKind, WicketIllegal } from '@/lib/wicket-followup';
import type { Player } from '@/types/api';

const CARD =
  'flex min-h-[7.5rem] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-black/15 px-3 py-3';
const CHIP = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-md border border-black/20 text-sm font-bold';
const PAIR = 'inline-flex min-h-12 flex-1 items-center justify-center rounded-md border border-black/20 text-sm font-bold';

export function WicketDetailForm({
  open,
  title,
  batsmen,
  showFielders,
  fielder1,
  fielder2,
  onClose,
  onPickFielder,
  onDone,
}: {
  open: boolean;
  title: string;
  batsmen: Player[];
  showFielders?: boolean;
  fielder1?: Player | null;
  fielder2?: Player | null;
  onClose: () => void;
  onPickFielder?: (slot: 1 | 2) => void;
  onDone: (input: {
    batsmanId: string;
    completedRuns: number | null;
    byeKind: WicketByeKind | null;
    illegal: WicketIllegal | null;
  }) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [batsmanId, setBatsmanId] = useState<string | null>(null);
  const [runs, setRuns] = useState<number | null>(null);
  const [byeKind, setByeKind] = useState<WicketByeKind | null>(null);
  const [illegal, setIllegal] = useState<WicketIllegal | null>(null);

  useEffect(() => {
    if (!open) {
      setBatsmanId(null);
      setRuns(null);
      setByeKind(null);
      setIllegal(null);
    }
  }, [open]);

  if (!open) return null;

  const canDone = Boolean(batsmanId) && (!showFielders || Boolean(fielder1));

  return (
    <div className="fixed inset-0 z-sheet flex flex-col bg-white">
      <header className="shrink-0 bg-scoring px-2 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <div className="grid grid-cols-[3rem_1fr_3rem] items-center">
          <button
            type="button"
            className="inline-flex min-h-touch min-w-touch items-center justify-center text-white"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <IconClose />
          </button>
          <h2 id={titleId} className="text-center text-lg font-bold text-white">
            {title}
          </h2>
          <span />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <p className="mb-3 text-sm font-bold text-black">{t('scoring.selectTheBatsman')}</p>
        <div className="mb-6 flex gap-3">
          {batsmen.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(CARD, batsmanId === p.id ? 'bg-[#E8E8E8]' : 'bg-white')}
              onClick={() => setBatsmanId(p.id)}
            >
              <Avatar name={p.name} src={p.photoUrl} size={56} />
              <span className="text-sm font-bold text-black">{p.name}</span>
            </button>
          ))}
        </div>

        {showFielders ? (
          <>
            <p className="mb-3 text-sm font-bold text-black">{t('scoring.selectFielder')}</p>
            <div className="mb-6 flex justify-center gap-10">
              <FielderSlot
                label={t('scoring.fielder01')}
                player={fielder1}
                onClick={() => onPickFielder?.(1)}
              />
              <FielderSlot
                label={t('scoring.fielder02')}
                player={fielder2}
                onClick={() => onPickFielder?.(2)}
              />
            </div>
          </>
        ) : null}

        <p className="mb-3 text-sm font-bold text-black">{t('scoring.completedRuns')}</p>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={cn(CHIP, runs === n ? 'bg-[#E8E8E8]' : 'bg-white')}
              onClick={() => setRuns((cur) => (cur === n ? null : n))}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mb-6 flex justify-center gap-2">
          {[5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              className={cn(CHIP, 'w-12', runs === n ? 'bg-[#E8E8E8]' : 'bg-white')}
              onClick={() => setRuns((cur) => (cur === n ? null : n))}
            >
              {n}
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm font-bold text-black">{t('scoring.byesOrLegBye')}</p>
        <div className="mb-6 flex gap-3">
          <button
            type="button"
            className={cn(PAIR, byeKind === 'BYE' ? 'bg-[#E8E8E8]' : 'bg-white')}
            onClick={() => setByeKind((cur) => (cur === 'BYE' ? null : 'BYE'))}
          >
            {t('scoring.byesTitle')}
          </button>
          <button
            type="button"
            className={cn(PAIR, byeKind === 'LEG_BYE' ? 'bg-[#E8E8E8]' : 'bg-white')}
            onClick={() => setByeKind((cur) => (cur === 'LEG_BYE' ? null : 'LEG_BYE'))}
          >
            {t('scoring.legByesTitle')}
          </button>
        </div>

        <p className="mb-3 text-sm font-bold text-black">{t('scoring.noBallOrWide')}</p>
        <div className="mb-8 flex gap-3">
          <button
            type="button"
            className={cn(PAIR, illegal === 'NO_BALL' ? 'bg-scoring text-scoring-on' : 'bg-white')}
            onClick={() => setIllegal((cur) => (cur === 'NO_BALL' ? null : 'NO_BALL'))}
          >
            {t('scoring.noBallTitle')}
          </button>
          <button
            type="button"
            className={cn(PAIR, illegal === 'WIDE' ? 'bg-scoring text-scoring-on' : 'bg-white')}
            onClick={() => setIllegal((cur) => (cur === 'WIDE' ? null : 'WIDE'))}
          >
            {t('scoring.wideTitle')}
          </button>
        </div>
      </div>

      <div className="shrink-0 px-8 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          disabled={!canDone}
          className="flex min-h-12 w-full items-center justify-center rounded-pill bg-scoring text-sm font-bold uppercase tracking-wide text-white disabled:opacity-45"
          onClick={() => {
            if (!batsmanId || !canDone) return;
            onDone({ batsmanId, completedRuns: runs, byeKind, illegal });
          }}
        >
          {t('common.done')}
        </button>
      </div>
    </div>
  );
}

function FielderSlot({
  label,
  player,
  onClick,
}: {
  label: string;
  player?: Player | null;
  onClick: () => void;
}) {
  return (
    <button type="button" className="flex flex-col items-center gap-2" onClick={onClick}>
      {player ? (
        <Avatar name={player.name} src={player.photoUrl} size={64} className="shadow-md" />
      ) : (
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#E8E8E8] text-[#9E9E9E] shadow-md">
          <IconPlus size={28} />
        </span>
      )}
      <span className="text-xs font-semibold text-text-secondary">{player?.name ?? label}</span>
    </button>
  );
}
