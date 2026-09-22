import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PillTabs } from '@/components/ui/Pills';
import { dash, type SliceView } from '@/lib/player-profile';

export function BestAgainstTeamCard({ teams }: { teams: Array<SliceView & { team: string }> }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'batting' | 'bowling'>('batting');
  const rows = useMemo(() => {
    if (tab === 'batting') {
      return [...teams].filter((row) => row.innings > 0).sort((a, b) => b.runs - a.runs).slice(0, 3);
    }
    return [...teams].filter((row) => row.bowlInnings > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 3);
  }, [teams, tab]);

  if (!teams.length) return null;

  return (
    <section className="mt-6 w-full">
      <h2 className="text-sm font-bold">{t('profile.bestAgainstTeam')}</h2>
      <div className="mt-2 rounded-card-lg bg-muted p-3">
        <PillTabs
          tone="ink"
          value={tab}
          onChange={(v) => setTab(v as 'batting' | 'bowling')}
          items={[
            { id: 'batting', label: t('profile.batting') },
            { id: 'bowling', label: t('profile.bowling') },
          ]}
        />
        {rows.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-text-secondary">
                  <th className="font-semibold" />
                  {tab === 'batting' ? (
                    <>
                      <th className="px-2 py-1 text-right font-semibold">{t('profile.runs')}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t('profile.innings')}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t('profile.strikeRate')}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-1 text-right font-semibold">{t('profile.wickets')}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t('profile.innings')}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t('profile.economy')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.team} className="border-t border-border/60">
                    <td className="max-w-[9rem] truncate py-2 font-semibold">{row.team}</td>
                    {tab === 'batting' ? (
                      <>
                        <td className="px-2 py-2 text-right tabular-nums">{row.runs}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.innings}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{dash(row.sr)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2 text-right tabular-nums">{row.wickets}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.bowlInnings}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{dash(row.economy)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 py-2 text-center text-sm text-text-secondary">{t('common.empty')}</p>
        )}
      </div>
    </section>
  );
}
