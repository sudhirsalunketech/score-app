import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PillTabs } from '@/components/ui/Pills';
import type { PlayerProfileStats } from '@/lib/player-profile';

const COLORS: Record<string, string> = {
  '0': '#a8d5c4',
  '1': '#0d7377',
  '2': '#2ecc71',
  '3': '#ed5565',
  '4': '#fc8d62',
  '6': '#d4f5e9',
};

export function InsightsPanel({ insights }: { insights: NonNullable<PlayerProfileStats['insights']> }) {
  const { t } = useTranslation();
  const [side, setSide] = useState('batting');
  const data = side === 'batting' ? insights.batting : insights.bowling;
  const total = data.totalBalls;
  const keys = ['0', '1', '2', '3', '4', '6'] as const;
  const gradient = useMemo(() => {
    if (!total) return '#ececec';
    let start = 0;
    const parts = keys.map((k) => {
      const pct = ((data.buckets[k] ?? 0) / total) * 100;
      const end = start + pct;
      const slice = `${COLORS[k]} ${start}% ${end}%`;
      start = end;
      return slice;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }, [data.buckets, total]);

  return (
    <div className="mt-4">
      <PillTabs
        tone="ink"
        value={side}
        onChange={setSide}
        items={[
          { id: 'batting', label: t('profile.batting') },
          { id: 'bowling', label: t('profile.bowling') },
        ]}
      />
      <section className="mt-4 rounded-card-lg border border-border bg-bg p-4">
        <h2 className="text-center text-sm font-bold">
          {side === 'batting' ? t('profile.facedBalls') : t('profile.bowledBalls')}
        </h2>
        <div className="mx-auto mt-4 h-48 w-48 rounded-full" style={{ background: gradient }} aria-hidden />
        <p className="mt-3 text-center text-sm font-semibold">
          {side === 'batting'
            ? `${t('profile.totalBallsFaced')} : ${total}`
            : `${t('profile.totalBallsBowled')} : ${total}`}
        </p>
        {side === 'batting' ? (
          <p className="mt-1 text-center text-xs text-text-secondary">
            {t('profile.totalBatsmanRuns')} : {insights.batting.totalRuns}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-6 gap-1 rounded-xl bg-dark-chrome p-3 text-center text-on-dark">
          {keys.map((k) => (
            <div key={k}>
              <span
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-dark-chrome"
                style={{ background: COLORS[k] }}
              >
                {k}s
              </span>
              <p className="mt-1 text-xs font-bold">{data.buckets[k] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>
      {side === 'batting' && insights.positions.length ? (
        <section className="mt-4 rounded-card-lg border border-border bg-bg p-4">
          <h2 className="text-center text-sm font-bold">{t('profile.batPositionStats')}</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {insights.positions.map((row) => (
              <li key={row.position} className="flex justify-between py-2">
                <span className="font-semibold">{row.position}</span>
                <span>
                  {row.runs} {t('profile.runs').toLowerCase()} · {row.innings} {t('profile.innings').toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
