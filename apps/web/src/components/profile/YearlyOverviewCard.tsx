import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PillTabs } from '@/components/ui/Pills';
import { dash, type SliceView } from '@/lib/player-profile';

export function YearlyOverviewCard({ thisYear, lastYear }: { thisYear: SliceView; lastYear: SliceView }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'batting' | 'bowling'>('batting');
  if (!thisYear.innings && !lastYear.innings && !thisYear.bowlInnings && !lastYear.bowlInnings) return null;

  const rows =
    tab === 'batting'
      ? [
          { label: t('profile.thisYearSoFar'), a: thisYear.runs, b: dash(thisYear.average), c: thisYear.highest },
          { label: t('profile.lastYear'), a: lastYear.runs, b: dash(lastYear.average), c: lastYear.highest },
        ]
      : [
          { label: t('profile.thisYearSoFar'), a: thisYear.wickets, b: dash(thisYear.bowlAverage), c: thisYear.best },
          { label: t('profile.lastYear'), a: lastYear.wickets, b: dash(lastYear.bowlAverage), c: lastYear.best },
        ];
  const cols =
    tab === 'batting'
      ? [t('profile.runs'), t('profile.average'), t('profile.highScore')]
      : [t('profile.wickets'), t('profile.average'), t('profile.bestBowling')];

  return (
    <section className="mt-6 w-full">
      <h2 className="text-sm font-bold">{t('profile.yearlyOverview')}</h2>
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-text-secondary">
                <th className="font-semibold" />
                {cols.map((c) => (
                  <th key={c} className="px-2 py-1 text-right font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border/60">
                  <td className="py-2 font-semibold">{row.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.a}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.b}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
