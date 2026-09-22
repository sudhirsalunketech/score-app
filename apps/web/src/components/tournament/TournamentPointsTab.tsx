import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Feedback';
import { IconChevron, IconTrash } from '@/components/ui/Icons';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/cn';
import { formatNrr } from '@/lib/format';
import type { PointsGroup, PointsRow } from '@/types/api';

export function TournamentPointsTab({
  groups,
  loading,
  canEdit,
  onRefresh,
  onAddTeam,
  onRemoveTeam,
  onRemoveGroup,
  onCreateGroup,
  creatingGroup,
}: {
  groups: PointsGroup[];
  loading: boolean;
  canEdit: boolean;
  onRefresh: () => Promise<unknown>;
  onAddTeam: (groupId: string) => void;
  onRemoveTeam: (groupId: string, teamId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onCreateGroup: () => void;
  creatingGroup: boolean;
}) {
  const { t } = useTranslation();
  const startY = useRef(0);
  const pulling = useRef(false);
  const [dy, setDy] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [removeModeIds, setRemoveModeIds] = useState<Set<string>>(new Set());

  const toggleRemoveMode = (groupId: string) => {
    setRemoveModeIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const shareGroup = async (g: PointsGroup) => {
    const lines = g.rows.map((r) => `${r.teamName.toUpperCase()}  P ${r.points}  NRR ${formatNrr(r.nrr)}`);
    const text = [g.name, ...lines, window.location.href].join('\n');
    if (navigator.share) {
      await navigator.share({ title: g.name, text, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex-1 overflow-y-auto px-[var(--gutter)] pb-4"
        onTouchStart={(e) => {
          if (e.currentTarget.scrollTop > 0) return;
          const y = e.touches[0]?.clientY;
          if (y == null) return;
          startY.current = y;
          pulling.current = true;
        }}
        onTouchMove={(e) => {
          if (!pulling.current) return;
          const y = e.touches[0]?.clientY;
          if (y == null) return;
          const next = Math.max(0, Math.min(88, y - startY.current));
          setDy(next);
        }}
        onTouchEnd={() => {
          const should = dy > 56 && !refreshing;
          pulling.current = false;
          setDy(0);
          if (!should) return;
          setRefreshing(true);
          void onRefresh().finally(() => setRefreshing(false));
        }}
      >
        <p className="flex items-center justify-center gap-1 py-3 text-xs text-text-secondary">
          <IconChevron size={14} className="rotate-90" />
          {refreshing || loading ? t('common.loading') : t('tournaments.pullRefresh')}
        </p>
        <div style={{ transform: dy ? `translateY(${dy * 0.35}px)` : undefined }}>
          {loading && !groups.length ? <Spinner /> : null}
          {groups.map((g) => (
            <section key={g.id ?? g.name} className="mb-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-text">{g.name}</h3>
                {canEdit ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PillButton onClick={() => g.id && onAddTeam(g.id)}>{t('tournaments.addTeamShort')}</PillButton>
                    {g.rows.length === 0 ? (
                      <button
                        type="button"
                        className="touch-target inline-flex items-center justify-center text-text-secondary"
                        aria-label={t('tournaments.remove')}
                        onClick={() => g.id && onRemoveGroup(g.id)}
                      >
                        <IconTrash size={18} />
                      </button>
                    ) : (
                      <>
                        <PillButton onClick={() => g.id && toggleRemoveMode(g.id)}>
                          {g.id && removeModeIds.has(g.id) ? t('common.done') : t('tournaments.remove')}
                        </PillButton>
                        <PillButton onClick={() => void shareGroup(g)}>{t('common.share')}</PillButton>
                      </>
                    )}
                  </div>
                ) : (
                  <PillButton onClick={() => void shareGroup(g)}>{t('common.share')}</PillButton>
                )}
              </div>
              {g.rows.length === 0 ? (
                <p className="inline-flex items-start gap-1 text-sm text-text-secondary">
                  {t('tournaments.groupEmpty')}
                  <InfoTooltip topic={t('tournaments.points')} compact>
                    {t('info.points.empty')}
                  </InfoTooltip>
                </p>
              ) : (
                <PointsTable
                  rows={g.rows}
                  removeMode={Boolean(g.id && removeModeIds.has(g.id))}
                  onRemoveTeam={(teamId) => g.id && onRemoveTeam(g.id, teamId)}
                />
              )}
            </section>
          ))}
          {canEdit ? (
            <button
              type="button"
              className="mb-4 flex min-h-touch w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border text-sm font-bold uppercase tracking-wide text-primary disabled:opacity-60"
              disabled={creatingGroup}
              onClick={onCreateGroup}
            >
              + {t('tournaments.createGroup')}
            </button>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <button
          type="button"
          className="min-h-[52px] w-full bg-primary text-sm font-bold uppercase tracking-wide text-on-dark disabled:opacity-60"
          disabled={creatingGroup}
          onClick={onCreateGroup}
        >
          {t('tournaments.createGroup')}
        </button>
      ) : null}
    </div>
  );
}

function PillButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary-dark"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PointsTable({
  rows,
  removeMode,
  onRemoveTeam,
}: {
  rows: PointsRow[];
  removeMode?: boolean;
  onRemoveTeam?: (teamId: string) => void;
}) {
  const { t } = useTranslation();
  const cols = [
    { key: 'played' as const, label: t('tournaments.played'), info: t('info.points.played') },
    { key: 'won' as const, label: t('tournaments.won') },
    { key: 'lost' as const, label: t('tournaments.lost') },
    { key: 'points' as const, label: t('tournaments.pts'), info: t('info.points.points') },
    { key: 'nrr' as const, label: t('tournaments.nrr'), info: t('info.points.nrr') },
  ];

  return (
    <div className="table-scroll">
      <table className="w-full min-w-[24rem] text-sm">
        <thead>
          <tr className="text-[11px] font-bold uppercase text-text">
            <th className="py-2 text-start">{t('common.teams')}</th>
            {cols.map((c) => (
              <th key={c.key} className="px-1 py-2 text-center">
                <span className="inline-flex items-center justify-center gap-0.5">
                  {c.label}
                  {'info' in c && c.info ? (
                    <InfoTooltip topic={c.label} compact>
                      {c.info}
                    </InfoTooltip>
                  ) : null}
                </span>
              </th>
            ))}
            {removeMode ? <th className="w-8 py-2" aria-hidden /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className="border-t border-border">
              <td className="py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={r.teamName} src={r.logoUrl} kind="team" size={36} />
                  <span className="truncate text-[13px] font-bold uppercase leading-tight">{r.teamName}</span>
                </div>
              </td>
              <td className="px-1 text-center"><Stat>{r.played}</Stat></td>
              <td className="px-1 text-center"><Stat>{r.won}</Stat></td>
              <td className="px-1 text-center"><Stat>{r.lost}</Stat></td>
              <td className="px-1 text-center"><Stat bold>{r.points}</Stat></td>
              <td className="px-1 text-center"><Stat>{formatNrr(r.nrr)}</Stat></td>
              {removeMode ? (
                <td className="py-2.5 text-center">
                  <button
                    type="button"
                    className="touch-target inline-flex items-center justify-center text-danger"
                    aria-label={t('tournaments.removeTeam')}
                    onClick={() => onRemoveTeam?.(r.teamId)}
                  >
                    <IconTrash size={16} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ children, bold }: { children: number | string; bold?: boolean }) {
  return (
    <span className={cn('text-center text-[13px] tabular-nums', bold ? 'font-bold text-text' : 'text-text')}>
      {children}
    </span>
  );
}
