import { useTranslation } from 'react-i18next';
import { ruleBallLabel } from '@/lib/custom-rules-display';
import type { CustomRulesOverlay } from '@/types/api';

export function CustomRulesBanner({
  overlay,
  compact = false,
}: {
  overlay?: CustomRulesOverlay | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!overlay?.active) return null;
  const last = overlay.lastBall ? ruleBallLabel(overlay.lastBall.actual, overlay.lastBall.counted) : null;
  const hint = overlay.summary[0];
  const scoresDiffer = overlay.score && overlay.score.actual !== overlay.score.counted;

  return (
    <div className="mx-[var(--gutter)] my-2 rounded-lg border border-primary/30 bg-primary-light px-3 py-2 text-start">
      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{t('tournamentRules.active')}</p>
      {hint ? <p className="text-xs font-semibold text-primary-dark">{hint}</p> : null}
      {last ? <p className="text-sm font-bold tabular-nums text-text">{last}</p> : null}
      {compact || !scoresDiffer ? null : (
        <p className="text-xs text-text-secondary">
          {t('tournamentRules.actual')}: {overlay.score!.actual} · {t('tournamentRules.counted')}: {overlay.score!.counted}
        </p>
      )}
    </div>
  );
}
