import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { TournamentNamedStat } from '@/types/api';

export function DashSection({ title, info, children }: { title: string; info?: string; children: ReactNode }) {
  return (
    <section className="px-[var(--gutter)] py-4">
      <h2 className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-text-secondary">
        {title}
        {info ? <InfoTooltip topic={title}>{info}</InfoTooltip> : null}
      </h2>
      {children}
    </section>
  );
}

export function EmptyStats({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

export function SummaryGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border px-3 py-3">
          <p className="text-[11px] font-semibold uppercase text-text-secondary">{item.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function BigNumberCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string | number;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border px-4 py-4 text-center">
      <p className="text-xs font-semibold uppercase text-text-secondary">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {children}
    </div>
  );
}

export function PlayerLink({
  tournamentId,
  player,
  children,
}: {
  tournamentId: string;
  player: Pick<TournamentNamedStat, 'playerId'>;
  children: ReactNode;
}) {
  return (
    <Link to={`/tournaments/${tournamentId}/players/${player.playerId}`} className="min-w-0 text-start">
      {children}
    </Link>
  );
}

export function PerformerCard({
  tournamentId,
  title,
  info,
  player,
  lines,
  empty,
}: {
  tournamentId: string;
  title: string;
  info?: string;
  player: (TournamentNamedStat & { photoUrl?: string | null }) | null;
  lines: string[];
  empty: string;
}) {
  const matchHref = player?.matchId ? `/matches/${player.matchId}/centre` : null;
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="inline-flex items-center gap-1 text-xs font-bold uppercase text-text-secondary">
        {title}
        {info ? <InfoTooltip topic={title}>{info}</InfoTooltip> : null}
      </p>
      {player ? (
        <div>
          <PlayerLink tournamentId={tournamentId} player={player}>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={player.playerName} src={player.photoUrl} size={48} />
              <div className="min-w-0">
                <p className="truncate font-bold">{player.playerName}</p>
                <p className="text-xs uppercase text-text-secondary">{player.teamName}</p>
              </div>
            </div>
          </PlayerLink>
          <ul className="mt-3 space-y-0.5 text-sm text-text-secondary">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {matchHref && player.matchTitle ? (
            <Link to={matchHref} className="mt-2 inline-block text-sm font-semibold text-primary">
              {player.matchTitle}
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">{empty}</p>
      )}
    </div>
  );
}

export function ResponsiveStatTable<T extends { playerId: string }>({
  rows,
  columns,
  tournamentId,
  empty,
  matchHref,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; numeric?: boolean; render: (row: T) => ReactNode }>;
  tournamentId: string;
  empty: string;
  matchHref?: (row: T) => string | null;
}) {
  const { t } = useTranslation();
  if (!rows.length) return <EmptyStats title={empty} />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-text-secondary">
              {columns.map((c) => (
                <th key={c.key} className={`px-2 py-2 font-semibold ${c.numeric ? 'text-end' : 'text-start'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = matchHref?.(row);
              return (
                <tr key={row.playerId + String(columns[0]?.render(row))} className="border-b border-border">
                  {columns.map((c, i) => (
                    <td key={c.key} className={`px-2 py-2 ${c.numeric ? 'text-end tabular-nums' : ''}`}>
                      {i === 0 && 'playerId' in row ? (
                        <Link to={`/tournaments/${tournamentId}/players/${row.playerId}`} className="font-semibold">
                          {c.render(row)}
                        </Link>
                      ) : href && c.key === 'match' ? (
                        <Link to={href} className="font-semibold text-primary">
                          {c.render(row)}
                        </Link>
                      ) : (
                        c.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => {
          const href = matchHref?.(row);
          return (
            <article key={row.playerId + String(columns[0]?.render(row))} className="rounded-xl border border-border p-3">
              {columns.map((c, i) => (
                <div key={c.key} className={`flex justify-between gap-3 ${i === 0 ? 'mb-1' : 'text-sm'}`}>
                  <span className="text-xs uppercase text-text-secondary">{c.label}</span>
                  <span className={c.numeric ? 'tabular-nums' : 'text-end font-semibold'}>
                    {i === 0 ? (
                      <Link to={`/tournaments/${tournamentId}/players/${row.playerId}`}>{c.render(row)}</Link>
                    ) : href && c.key === 'match' ? (
                      <Link to={href} className="text-primary">
                        {c.render(row)}
                      </Link>
                    ) : (
                      c.render(row)
                    )}
                  </span>
                </div>
              ))}
            </article>
          );
        })}
      </div>
      <p className="sr-only">{t('tournaments.scopeNote')}</p>
    </>
  );
}

export function fmtAvg(n: number | null | undefined) {
  return n == null ? '—' : n.toFixed(2);
}
