import { BurstCard, Glass, useOverlayBurst, type Translate } from '@/components/overlay/BroadcastOverlay';
import { chaseFromLive, displayName, type OverlayConfig } from '@/lib/overlay-model';
import type { PublicLiveScoreDto } from '@/types/api';

/**
 * Full-screen scenes for OBS/vMix "browser source" use, selected via `?scene=`.
 * Each is deliberately minimal — a single graphic, no chrome — since the operator
 * places it as its own source/layer and switches which one is visible.
 */

export function IntroScene({ data, config, t }: { data: PublicLiveScoreDto; config: OverlayConfig; t: Translate }) {
  const home = displayName(data.homeTeam.name);
  const away = displayName(data.awayTeam.name);
  const tossTeam =
    data.toss?.winnerTeamId === data.homeTeam.id ? home : data.toss?.winnerTeamId === data.awayTeam.id ? away : null;
  return (
    <div
      className={`cs-broadcast cs-ov-safe cs-ov-theme-${config.theme} cs-ov-scene-enter flex min-h-dvh flex-col items-center justify-center overflow-hidden text-center`}
      data-overlay-mode="intro"
    >
      {config.tournamentLogo && data.tournamentName ? (
        <p className="cs-ov-brand mb-6 text-sm font-bold uppercase tracking-[0.2em]">{data.tournamentName}</p>
      ) : null}
      <div className="flex items-center gap-10">
        <TeamBadge name={home} logoUrl={data.homeTeam.logoUrl} />
        <p className="cs-ov-muted text-2xl font-black tracking-[0.3em]">VS</p>
        <TeamBadge name={away} logoUrl={data.awayTeam.logoUrl} />
      </div>
      <p className="cs-ov-muted mt-8 text-sm font-bold uppercase tracking-[0.2em]">
        {[data.format, data.oversLimit ? `${data.oversLimit} ${t('overlay.overs')}` : null].filter(Boolean).join(' · ')}
      </p>
      {data.venueText ? <p className="cs-ov-muted mt-1 text-xs">{data.venueText}</p> : null}
      {tossTeam ? (
        <p className="mt-4 text-sm font-semibold text-[var(--color-primary-light)]">
          {tossTeam} {t(data.toss?.decision === 'BOWL' ? 'overlay.optedToBowl' : 'overlay.optedToBat')}
        </p>
      ) : null}
    </div>
  );
}

function TeamBadge({ name, logoUrl }: { name: string | null; logoUrl?: string | null }) {
  if (!name) return null;
  return (
    <div className="flex flex-col items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-24 w-24 rounded-full object-contain" />
      ) : (
        <div className="cs-ov-glass flex h-24 w-24 items-center justify-center rounded-full text-2xl font-black">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <p className="max-w-[16rem] truncate text-lg font-bold uppercase tracking-wide">{name}</p>
    </div>
  );
}

export function LineupScene({ data, t }: { data: PublicLiveScoreDto; t: Translate }) {
  const home = data.playingXi?.home ?? [];
  const away = data.playingXi?.away ?? [];
  return (
    <div className="cs-broadcast cs-ov-safe cs-ov-scene-enter flex min-h-dvh flex-col overflow-hidden">
      <div className="grid flex-1 grid-cols-2 gap-6">
        <LineupColumn name={data.homeTeam.name} logoUrl={data.homeTeam.logoUrl} rows={home} t={t} />
        <LineupColumn name={data.awayTeam.name} logoUrl={data.awayTeam.logoUrl} rows={away} t={t} />
      </div>
    </div>
  );
}

function LineupColumn({
  name,
  logoUrl,
  rows,
  t,
}: {
  name: string;
  logoUrl?: string | null;
  rows: Array<{ id: string; name: string; isCaptain: boolean; isWicketKeeper: boolean; photoUrl?: string | null }>;
  t: Translate;
}) {
  const label = displayName(name);
  return (
    <Glass className="flex flex-col gap-2">
      <div className="mb-2 flex items-center gap-2">
        {logoUrl ? <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" /> : null}
        <p className="truncate text-sm font-bold uppercase tracking-wide">{label}</p>
      </div>
      {rows.length ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="cs-ov-glass flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="truncate text-sm font-semibold">
                {p.name}
                {p.isCaptain ? ' (C)' : ''}
                {p.isWicketKeeper ? ' (WK)' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cs-ov-muted text-xs">{t('overlay.lineupPending')}</p>
      )}
    </Glass>
  );
}

export function LowerThirdScene({ data, config, t }: { data: PublicLiveScoreDto; config: OverlayConfig; t: Translate }) {
  const role = config.lowerThirdRole;
  return (
    <div
      className={`cs-broadcast cs-ov-theme-${config.theme} cs-ov-scene-enter flex min-h-dvh flex-col justify-end overflow-hidden p-[4vw] pb-[6vh]`}
      data-overlay-mode="lower-third"
    >
      {role === 'bowler' ? (
        data.bowler && displayName(data.bowler.name) ? (
          <Glass className="w-full max-w-2xl">
            <p className="truncate text-xl font-black uppercase">{data.bowler.name}</p>
            <p className="cs-ov-muted mt-1 text-sm font-semibold">
              {data.bowler.overs} {t('overlay.ov')} · {data.bowler.runs} {t('overlay.runs')} · {data.bowler.wickets}{' '}
              {t('overlay.wickets')}
            </p>
          </Glass>
        ) : null
      ) : (() => {
          const batter = role === 'nonStriker' ? data.nonStriker : data.striker;
          if (!batter || !displayName(batter.name)) return null;
          return (
            <Glass className="w-full max-w-2xl">
              <p className="truncate text-xl font-black uppercase">{batter.name}</p>
              <p className="cs-ov-muted mt-1 text-sm font-semibold">
                {batter.runs} {t('overlay.runs')} · {batter.balls} {t('overlay.balls')} · {batter.fours} {t('overlay.fours')} ·{' '}
                {batter.sixes} {t('overlay.sixes')}
              </p>
            </Glass>
          );
        })()}
    </div>
  );
}

export function TargetScene({ data, config, t }: { data: PublicLiveScoreDto; config: OverlayConfig; t: Translate }) {
  const chase = chaseFromLive(data);
  return (
    <div
      className={`cs-broadcast cs-ov-safe cs-ov-theme-${config.theme} cs-ov-scene-enter flex min-h-dvh flex-col items-center justify-center overflow-hidden text-center`}
      data-overlay-mode="target"
    >
      {chase ? (
        <>
          <p className="cs-ov-kicker text-lg">{t('overlay.target')}</p>
          <p className="text-6xl font-black">{chase.target}</p>
          <p className="mt-6 text-2xl font-bold text-[var(--color-scoring)]">
            {t('overlay.needed')} {chase.needed} {t('match.runs')}
          </p>
          <p className="cs-ov-muted text-lg font-semibold">
            {t('overlay.from')} {chase.ballsLeft} {t('overlay.balls')}
          </p>
          <p className="mt-8 text-3xl font-black tabular-nums">
            {data.score.runs}/{data.score.wickets}
          </p>
          <p className="cs-ov-muted text-sm font-bold">
            {data.score.overs} {t('overlay.overs')} · {t('overlay.rrr')} {chase.rrr.toFixed(2)}
          </p>
        </>
      ) : (
        <p className="cs-ov-muted text-sm font-bold uppercase tracking-wide">{t('overlay.noTargetYet')}</p>
      )}
    </div>
  );
}

export function BallResultScene({ data, config, t }: { data: PublicLiveScoreDto; config: OverlayConfig; t: Translate }) {
  const burst = useOverlayBurst(data, config);
  return (
    <div
      className={`cs-broadcast cs-ov-theme-${config.theme} flex min-h-dvh items-center justify-center overflow-hidden`}
      data-overlay-mode="ball-result"
    >
      {burst ? (
        <div className="cs-ov-burst-scale">
          <BurstCard burst={burst} t={t} />
        </div>
      ) : null}
    </div>
  );
}
