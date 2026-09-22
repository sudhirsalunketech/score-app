import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { hasMatchPerm } from '@/lib/access';
import type { Match, OverRuleResultRow, OverRulesResponse } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { ruleSummary } from '@/pages/OverRulesPage';

export function MatchRulesTab({ match }: { match: Match }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const overRules = useQuery({
    queryKey: keys.overRules(match.id),
    queryFn: () => api<OverRulesResponse>(`/api/v1/matches/${match.id}/over-rules`),
  });

  if (overRules.isLoading) return <Spinner />;
  if (overRules.isError || !overRules.data) return <ErrorRetry onRetry={() => void overRules.refetch()} />;

  const data = overRules.data;
  const resultsByKey = new Map<string, OverRuleResultRow[]>();
  for (const r of data.results) {
    const key = `${r.overNumber}:${r.ruleType}`;
    resultsByKey.set(key, [...(resultsByKey.get(key) ?? []), r]);
  }
  const canEdit = hasMatchPerm(match, 'MATCH_EDIT');

  return (
    <div className="px-[var(--gutter)] pb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{t('overRules.title')}</p>
        {canEdit ? (
          <Button type="button" variant="outline" className="text-xs" onClick={() => nav(`/matches/${match.id}/over-rules`)}>
            {t('overRules.title')}
          </Button>
        ) : null}
      </div>

      {!data.enabled || !data.rules.length ? (
        <p className="py-8 text-center text-text-secondary">{t('common.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.rules.map((rule) => {
            const results = resultsByKey.get(`${rule.overNumber}:${rule.ruleType}`) ?? [];
            return (
              <div key={`${rule.overNumber}-${rule.ruleType}`} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">{ruleSummary(rule, t)}</p>
                {results.length ? (
                  <div className="mt-2 rounded-lg bg-muted p-2 text-xs text-text-secondary">
                    {results.map((r) => (
                      <p key={r.inningsId}>
                        {t('overRules.actual')}: {r.actualRuns} · +{r.bonusRuns} / -{r.penaltyRuns}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
