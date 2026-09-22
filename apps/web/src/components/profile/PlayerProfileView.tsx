import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconShare } from '@/components/ui/Icons';
import { battingAverage, bestBowling, bowlingAverage, formatAvg, type CareerStats } from '@/lib/career-stats';
import { playerRoleLabel } from '@/lib/match-result';
import { copyText, playerShareText } from '@/lib/share-text';

export function PlayerProfileView({
  name,
  photoUrl,
  role,
  battingStyle,
  bowlingStyle,
  profileCode,
  city,
  stats,
  photoSlot,
}: {
  name: string;
  photoUrl?: string | null;
  role?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  profileCode?: string | null;
  city?: string | null;
  stats?: CareerStats | null;
  photoSlot?: ReactNode;
}) {
  const { t } = useTranslation();
  const roleLabel = role ? t(`playingXI.${playerRoleLabel(role)}`) : null;
  const batAvg = formatAvg(battingAverage(stats));
  const bowlAvg = formatAvg(bowlingAverage(stats));
  const [idCopied, setIdCopied] = useState(false);

  const copyProfileId = async () => {
    if (!profileCode) return;
    const ok = await copyText(profileCode);
    if (ok) {
      setIdCopied(true);
      window.setTimeout(() => setIdCopied(false), 1800);
    }
  };

  const share = async () => {
    const url = window.location.href;
    const text = playerShareText({
      name,
      teamName: t('playerHome.crickscorePlayer'),
      url,
      matches: stats?.matches,
      runs: stats?.runs,
      wickets: stats?.wickets,
      best: stats?.highestScore,
      strikeRate: stats?.balls ? Number((((stats.runs ?? 0) / stats.balls) * 100).toFixed(1)) : undefined,
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copyText(text);
  };

  return (
    <div className="flex flex-col items-center">
      {photoSlot ?? <Avatar name={name} src={photoUrl} kind="person" size={96} />}
      <h1 className="mt-3 text-center text-2xl font-bold">{name}</h1>
      {roleLabel || battingStyle || bowlingStyle || city ? (
        <p className="mt-1 max-w-full px-4 text-center text-sm text-text-secondary">
          {[roleLabel, battingStyle, bowlingStyle, city].filter(Boolean).join(' | ')}
        </p>
      ) : null}
      <div className="mt-3 flex max-w-full items-center gap-2">
        <button
          type="button"
          disabled={!profileCode}
          onClick={() => void copyProfileId()}
          className="max-w-[min(100%,18rem)] truncate rounded-pill bg-muted px-3 py-1.5 text-sm font-semibold disabled:cursor-default"
          aria-label={t('profile.profileId')}
        >
          {idCopied ? t('common.copied') : `${t('profile.profileId')} : ${profileCode || '—'}`}
        </button>
        <button type="button" className="inline-flex min-h-touch min-w-touch items-center justify-center text-text-secondary" aria-label={t('common.share')} onClick={() => void share()}>
          <IconShare size={18} />
        </button>
      </div>

      <div className="mt-5 grid w-full grid-cols-3 gap-1.5 min-[400px]:gap-2 sm:gap-3">
        <StatCard
          title={t('profile.batting')}
          header="var(--color-batting-header)"
          body="var(--color-batting-body)"
          rows={[
            { value: stats?.runs ?? 0, label: t('profile.runs') },
            { value: batAvg, label: t('profile.average') },
            { value: stats?.highestScore ?? 0, label: t('profile.highScore') },
          ]}
        />
        <StatCard
          title={t('profile.bowling')}
          header="var(--color-bowling-header)"
          body="var(--color-bowling-body)"
          rows={[
            { value: stats?.wickets ?? 0, label: t('profile.wickets') },
            { value: bowlAvg, label: t('profile.average') },
            { value: bestBowling(stats), label: t('profile.bestBowling') },
          ]}
        />
        <StatCard
          title={t('profile.fielding')}
          header="var(--color-fielding-header)"
          body="var(--color-fielding-body)"
          rows={[
            { value: stats?.catches ?? 0, label: t('profile.catches') },
            { value: stats?.stumpings ?? 0, label: t('profile.stumpings') },
            { value: stats?.runOuts ?? 0, label: t('profile.runouts') },
          ]}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  header,
  body,
  rows,
}: {
  title: string;
  header: string;
  body: string;
  rows: Array<{ value: string | number; label: string }>;
}) {
  return (
    <article className="overflow-hidden rounded-xl text-center">
      <div className="py-1.5 text-[10px] font-bold uppercase tracking-wide text-on-dark min-[400px]:py-2 min-[400px]:text-xs" style={{ background: header }}>
        {title}
      </div>
      <div className="flex flex-col gap-2 px-0.5 py-2.5 min-[400px]:gap-3 min-[400px]:px-1 min-[400px]:py-3" style={{ background: body }}>
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-base font-bold leading-none min-[400px]:text-lg">{row.value}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase leading-tight tracking-wide text-text-secondary min-[400px]:text-[10px]">{row.label}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
