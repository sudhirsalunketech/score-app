import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { cn } from '@/lib/cn';

const TILE =
  'min-h-12 rounded-lg border border-black/25 bg-white/25 px-2 text-center text-sm font-bold text-black active:bg-black/10 disabled:opacity-40';

export function MoreActionsSheet({
  open,
  onClose,
  canScore,
  canResult,
  canEdit,
  isTest,
  onAbandon,
  onEndInnings,
  onPenalty,
  onRetiredHurt,
  onDl,
  onChangeTarget,
  onOversFormat,
  onHattrickBonus,
  onHattrickPenalty,
  onSettings,
  onDeclare,
  onDraw,
}: {
  open: boolean;
  onClose: () => void;
  canScore?: boolean;
  canResult?: boolean;
  canEdit?: boolean;
  isTest?: boolean;
  onAbandon: () => void;
  onEndInnings: () => void;
  onPenalty: () => void;
  onRetiredHurt: () => void;
  onDl: () => void;
  onChangeTarget: () => void;
  onOversFormat: () => void;
  onHattrickBonus: () => void;
  onHattrickPenalty: () => void;
  onSettings: () => void;
  onDeclare?: () => void;
  onDraw?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} title={t('scoring.more')} closeSide="start" onClose={onClose} titleClassName="text-black">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={TILE} disabled={!canResult} onClick={onAbandon}>
          {t('scoring.moreMenu.abandon')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onEndInnings}>
          {t('scoring.moreMenu.endInnings')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onPenalty}>
          {t('scoring.moreMenu.penalty')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onRetiredHurt}>
          {t('scoring.moreMenu.retiredHurt')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onDl}>
          {t('scoring.moreMenu.dl')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onChangeTarget}>
          {t('scoring.moreMenu.changeTarget')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onHattrickBonus}>
          {t('scoring.moreMenu.hattrickBonus')}
        </button>
        <button type="button" className={TILE} disabled={!canScore} onClick={onHattrickPenalty}>
          {t('scoring.moreMenu.hattrickPenalty')}
        </button>
        {isTest ? (
          <button type="button" className={TILE} disabled={!canScore} onClick={onDeclare}>
            {t('scoring.moreMenu.declare')}
          </button>
        ) : null}
        {isTest ? (
          <button type="button" className={TILE} disabled={!canResult} onClick={onDraw}>
            {t('scoring.moreMenu.draw')}
          </button>
        ) : null}
        <button type="button" className={TILE} disabled={!canScore && !canEdit} onClick={onSettings}>
          {t('scoring.moreMenu.settings')}
        </button>
        <button type="button" className={cn(TILE, 'col-span-3')} disabled={!canEdit} onClick={onOversFormat}>
          {t('scoring.moreMenu.oversFormat')}
        </button>
      </div>
    </BottomSheet>
  );
}
