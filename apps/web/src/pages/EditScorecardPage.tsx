import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { playerName, teamById, teamRosterPlayers } from '@/lib/format';
import { ballFeedBadge, ballFeedDescriptionKey, ballFeedOver, dismissalI18nKey, type BallFeedEvent } from '@/lib/ball-feed';
import { diffCorrectionFields, PLAYER_ID_FIELDS, type CorrectionFieldChange } from '@/lib/correction-diff';
import { cn } from '@/lib/cn';
import { IconBack, IconChevron } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Input, NumericInput, Select, TextArea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import type { BallEvent, CorrectionLogEntry, Match } from '@/types/api';
import type { TFunction } from 'i18next';

type ExtraType = BallEvent['extraType'];
const EXTRA_TYPES: ExtraType[] = ['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY'];
const DISMISSALS = [
  'BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'MANKAD', 'OVER_THE_FENCE',
  'ONE_HAND_ONE_BOUNCE', 'OBSTRUCTING', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED_HURT', 'RETIRED_OUT',
] as const;

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
}

type BallFormValues = {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraType: ExtraType;
  extraRuns: number;
  isWicket: boolean;
  dismissalType: string;
  dismissedPlayerId: string;
  fielderId: string;
  reason: string;
};

function ballToForm(ev: BallEvent): BallFormValues {
  return {
    strikerId: ev.strikerId,
    nonStrikerId: ev.nonStrikerId,
    bowlerId: ev.bowlerId,
    batsmanRuns: ev.batsmanRuns,
    extraType: ev.extraType,
    extraRuns: ev.extraRuns,
    isWicket: ev.isWicket,
    dismissalType: ev.dismissalType ?? '',
    dismissedPlayerId: ev.dismissedPlayerId ?? '',
    fielderId: ev.fielderId ?? '',
    reason: '',
  };
}

export function EditScorecardPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [inningsIdx, setInningsIdx] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterOver, setFilterOver] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [editingBall, setEditingBall] = useState<BallEvent | null>(null);
  const [deletingBall, setDeletingBall] = useState<BallEvent | null>(null);
  const [insertAfter, setInsertAfter] = useState<{ id: string | null } | null>(null);

  const match = useQuery({ queryKey: keys.match(id), queryFn: () => api<Match>(`/api/v1/matches/${id}`) });
  const innings = useMemo(
    () => (match.data?.innings ?? []).filter((i) => !i.isSuperOver).slice().sort((a, b) => a.inningsNumber - b.inningsNumber),
    [match.data],
  );
  const selectedInnings = innings[inningsIdx] ?? null;

  const events = useQuery({
    queryKey: keys.inningsEvents(selectedInnings?.id ?? ''),
    queryFn: () => api<BallEvent[]>(`/api/v1/innings/${selectedInnings!.id}/events`),
    enabled: Boolean(selectedInnings),
  });

  const history = useQuery({
    queryKey: keys.corrections(id),
    queryFn: () => api<CorrectionLogEntry[]>(`/api/v1/matches/${id}/corrections`),
    enabled: showHistory,
  });

  const invalidateAfterChange = () => {
    void qc.invalidateQueries({ queryKey: keys.inningsEvents(selectedInnings?.id ?? '') });
    void qc.invalidateQueries({ queryKey: keys.match(id) });
    void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
    void qc.invalidateQueries({ queryKey: keys.live(id) });
    void qc.invalidateQueries({ queryKey: keys.corrections(id) });
  };

  const unlock = useMutation({
    mutationFn: () => api(`/api/v1/matches/${id}/correction/unlock`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.match(id) }),
  });
  const lock = useMutation({
    mutationFn: () => api(`/api/v1/matches/${id}/correction/lock`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.match(id) }),
  });
  const correct = useMutation({
    mutationFn: (vars: { eventId: string; body: Record<string, unknown> }) =>
      api(`/api/v1/innings/${selectedInnings!.id}/events/${vars.eventId}`, { method: 'PATCH', body: vars.body }),
    onSuccess: () => {
      invalidateAfterChange();
      setEditingBall(null);
    },
  });
  const remove = useMutation({
    mutationFn: (vars: { eventId: string; reason: string }) =>
      api(`/api/v1/innings/${selectedInnings!.id}/events/${vars.eventId}`, { method: 'DELETE', body: { reason: vars.reason } }),
    onSuccess: () => {
      invalidateAfterChange();
      setDeletingBall(null);
    },
  });
  const insert = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/v1/innings/${selectedInnings!.id}/events/insert`, { method: 'POST', body }),
    onSuccess: () => {
      invalidateAfterChange();
      setInsertAfter(null);
    },
  });

  if (match.isLoading) return <Spinner />;
  if (match.isError || !match.data) return <ErrorRetry onRetry={() => void match.refetch()} />;
  const m = match.data;
  const locked = m.status === 'COMPLETED' || m.status === 'ABANDONED' || m.status === 'CANCELLED';
  const canEdit = !locked || Boolean(m.correctionUnlocked);

  const battingRoster = selectedInnings ? teamRosterPlayers(m, selectedInnings.battingTeamId) : [];
  const bowlingRoster = selectedInnings ? teamRosterPlayers(m, selectedInnings.bowlingTeamId) : [];

  const filtered = (events.data ?? []).filter((ev) => {
    if (filterOver && String(ev.overNumber) !== filterOver) return false;
    if (filterEvent) {
      if (filterEvent === 'WICKET' && !ev.isWicket) return false;
      if (filterEvent === 'FOUR' && !(ev.extraType === 'NONE' && ev.batsmanRuns === 4)) return false;
      if (filterEvent === 'SIX' && !(ev.extraType === 'NONE' && ev.batsmanRuns === 6)) return false;
      if (['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY'].includes(filterEvent) && ev.extraType !== filterEvent) return false;
      if (filterEvent === 'RUNS' && ev.extraType !== 'NONE') return false;
    }
    if (filterText) {
      const needle = filterText.trim().toLowerCase();
      const names = [ev.strikerId, ev.nonStrikerId, ev.bowlerId, ev.dismissedPlayerId]
        .map((pid) => playerName(m, pid).toLowerCase());
      if (!names.some((n) => n.includes(needle))) return false;
    }
    return true;
  });

  const overs = new Map<number, BallEvent[]>();
  for (const ev of filtered) {
    if (!overs.has(ev.overNumber)) overs.set(ev.overNumber, []);
    overs.get(ev.overNumber)!.push(ev);
  }
  const overGroups = [...overs.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="px-[var(--gutter)] py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="flex-1 text-lg font-bold">{t('correction.title')}</h1>
      </header>

      {locked ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted p-3">
          <p className="text-sm text-text-secondary">
            {m.correctionUnlocked ? t('correction.unlockedNotice') : t('correction.lockedNotice')}
          </p>
          {m.correctionUnlocked ? (
            <Button variant="outline" disabled={lock.isPending} onClick={() => lock.mutate()}>
              {t('correction.lockScorecard')}
            </Button>
          ) : (
            <Button variant="primaryDark" disabled={unlock.isPending} onClick={() => unlock.mutate()}>
              {t('correction.unlockScorecard')}
            </Button>
          )}
        </div>
      ) : null}

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {innings.map((inn, i) => {
          const team = teamById(m, inn.battingTeamId);
          return (
            <button
              key={inn.id}
              type="button"
              className={`min-h-touch shrink-0 rounded-pill px-3 text-sm font-bold uppercase ${inningsIdx === i ? 'bg-primary text-on-dark' : 'bg-muted text-text-secondary'}`}
              onClick={() => setInningsIdx(i)}
            >
              {team?.shortName || team?.name} · #{inn.inningsNumber}
            </button>
          );
        })}
        <button
          type="button"
          className={`min-h-touch shrink-0 rounded-pill px-3 text-sm font-bold uppercase ${showHistory ? 'bg-primary text-on-dark' : 'bg-muted text-text-secondary'}`}
          onClick={() => setShowHistory((v) => !v)}
        >
          {t('correction.viewHistory')}
        </button>
      </div>

      {showHistory ? (
        <CorrectionHistory entries={history.data ?? []} loading={history.isLoading} match={m} />
      ) : !selectedInnings ? (
        <p className="py-8 text-center text-text-secondary">{t('common.empty')}</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input placeholder={t('correction.searchPlayer')} value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            <Select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
              <option value="">{t('correction.filterAllEvents')}</option>
              <option value="RUNS">{t('correction.filterRuns')}</option>
              <option value="FOUR">{t('scoring.fours')}</option>
              <option value="SIX">{t('scoring.sixes')}</option>
              <option value="WIDE">{t('scoring.wideTitle')}</option>
              <option value="NO_BALL">{t('scoring.noBallTitle')}</option>
              <option value="BYE">{t('scoring.byesTitle')}</option>
              <option value="LEG_BYE">{t('scoring.legByesTitle')}</option>
              <option value="PENALTY">{t('correction.filterPenaltyBonus')}</option>
              <option value="WICKET">{t('scoring.wicket')}</option>
            </Select>
            <NumericInput placeholder={t('correction.filterOver')} value={filterOver} onChange={(e) => setFilterOver(e.target.value)} />
            <Button
              variant="outline"
              disabled={!canEdit}
              onClick={() => setInsertAfter({ id: null })}
            >
              {t('correction.insertBall')}
            </Button>
          </div>

          {events.isLoading ? (
            <Spinner />
          ) : overGroups.length === 0 ? (
            <p className="py-8 text-center text-text-secondary">{t('common.empty')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {overGroups.map(([overNumber, balls]) => (
                <div key={overNumber}>
                  <p className="mb-1 text-xs font-bold uppercase text-text-secondary">
                    {t('match.overNum', { n: overNumber + 1 })}
                  </p>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {balls.map((ev) => (
                      <BallRow
                        key={ev.id}
                        match={m}
                        event={ev}
                        canEdit={canEdit}
                        onEdit={() => setEditingBall(ev)}
                        onDelete={() => setDeletingBall(ev)}
                        onInsertAfter={() => setInsertAfter({ id: ev.id })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingBall ? (
        <BallFormModal
          title={t('correction.editBall')}
          match={m}
          battingRoster={battingRoster}
          bowlingRoster={bowlingRoster}
          initial={ballToForm(editingBall)}
          showDiff
          submitLabel={t('common.save')}
          busy={correct.isPending}
          error={correct.error ? errMsg(correct.error, t('common.error')) : null}
          onClose={() => setEditingBall(null)}
          onSubmit={(values) =>
            correct.mutate({
              eventId: editingBall.id,
              body: {
                strikerId: values.strikerId,
                nonStrikerId: values.nonStrikerId,
                bowlerId: values.bowlerId,
                batsmanRuns: values.batsmanRuns,
                extraType: values.extraType,
                extraRuns: values.extraRuns,
                isWicket: values.isWicket,
                dismissalType: values.isWicket ? values.dismissalType || null : null,
                dismissedPlayerId: values.isWicket ? values.dismissedPlayerId || null : null,
                fielderId: values.fielderId || null,
                reason: values.reason,
              },
            })
          }
        />
      ) : null}

      {insertAfter ? (
        <BallFormModal
          title={t('correction.insertBall')}
          match={m}
          battingRoster={battingRoster}
          bowlingRoster={bowlingRoster}
          initial={{
            strikerId: '', nonStrikerId: '', bowlerId: '', batsmanRuns: 0, extraType: 'NONE', extraRuns: 0,
            isWicket: false, dismissalType: '', dismissedPlayerId: '', fielderId: '', reason: '',
          }}
          submitLabel={t('correction.insertBall')}
          busy={insert.isPending}
          error={insert.error ? errMsg(insert.error, t('common.error')) : null}
          onClose={() => setInsertAfter(null)}
          onSubmit={(values) =>
            insert.mutate({
              afterEventId: insertAfter.id,
              strikerId: values.strikerId,
              nonStrikerId: values.nonStrikerId,
              bowlerId: values.bowlerId,
              batsmanRuns: values.batsmanRuns,
              extraType: values.extraType,
              extraRuns: values.extraRuns,
              isWicket: values.isWicket,
              dismissalType: values.isWicket ? values.dismissalType || undefined : undefined,
              dismissedPlayerId: values.isWicket ? values.dismissedPlayerId || undefined : undefined,
              fielderId: values.fielderId || undefined,
              reason: values.reason,
            })
          }
        />
      ) : null}

      {deletingBall ? (
        <DeleteBallModal
          match={m}
          event={deletingBall}
          busy={remove.isPending}
          error={remove.error ? errMsg(remove.error, t('common.error')) : null}
          onClose={() => setDeletingBall(null)}
          onConfirm={(reason) => remove.mutate({ eventId: deletingBall.id, reason })}
        />
      ) : null}
    </div>
  );
}

function BallRow({
  match,
  event,
  canEdit,
  onEdit,
  onDelete,
  onInsertAfter,
}: {
  match: Match;
  event: BallEvent;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onInsertAfter: () => void;
}) {
  const { t } = useTranslation();
  const feedEvent: BallFeedEvent = {
    sequence: event.sequence,
    overNumber: event.overNumber,
    ballInOver: event.ballInOver,
    batsmanRuns: event.batsmanRuns,
    extraRuns: event.extraRuns,
    extraType: event.extraType,
    isWicket: event.isWicket,
    dismissalType: event.dismissalType,
    commentary: event.commentary,
    bowlerName: playerName(match, event.bowlerId),
    strikerName: playerName(match, event.strikerId),
    dismissedName: playerName(match, event.dismissedPlayerId),
  };
  const desc = ballFeedDescriptionKey(feedEvent);
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="w-10 shrink-0 text-xs font-bold tabular-nums text-text-secondary">{ballFeedOver(feedEvent)}</span>
      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold">
        {ballFeedBadge(feedEvent)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {t(desc.key, { count: desc.count })} · {playerName(match, event.strikerId)}
        </p>
        <p className="truncate text-xs text-text-secondary">{t('scoring.bowler')}: {playerName(match, event.bowlerId)}</p>
      </div>
      {canEdit ? (
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" className="px-2 text-xs" onClick={onInsertAfter}>
            {t('correction.insertAfter')}
          </Button>
          <Button variant="outline" className="px-2 text-xs" onClick={onEdit}>
            {t('correction.edit')}
          </Button>
          <Button variant="outline" className="px-2 text-xs text-danger" onClick={onDelete}>
            {t('correction.delete')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BallFormModal({
  title,
  match,
  battingRoster,
  bowlingRoster,
  initial,
  showDiff,
  submitLabel,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  match: Match;
  battingRoster: { id: string; name: string }[];
  bowlingRoster: { id: string; name: string }[];
  initial: BallFormValues;
  showDiff?: boolean;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: BallFormValues) => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<BallFormValues>(initial);
  const set = <K extends keyof BallFormValues>(key: K, value: BallFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const diffRows: { label: string; before: string; after: string }[] = showDiff
    ? [
        { label: t('scoring.striker'), before: playerName(match, initial.strikerId), after: playerName(match, values.strikerId) },
        { label: t('scoring.bowler'), before: playerName(match, initial.bowlerId), after: playerName(match, values.bowlerId) },
        { label: t('scoring.runs'), before: String(initial.batsmanRuns), after: String(values.batsmanRuns) },
        { label: t('match.extras'), before: `${initial.extraType} (${initial.extraRuns})`, after: `${values.extraType} (${values.extraRuns})` },
        {
          label: t('scoring.wicket'),
          before: initial.isWicket ? initial.dismissalType || t('scoring.wicket') : '—',
          after: values.isWicket ? values.dismissalType || t('scoring.wicket') : '—',
        },
      ].filter((row) => row.before !== row.after)
    : [];

  return (
    <Modal open title={title} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('scoring.striker')} value={values.strikerId} onChange={(e) => set('strikerId', e.target.value)}>
            <option value="">—</option>
            {battingRoster.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select label={t('scoring.batsman') + ' 2'} value={values.nonStrikerId} onChange={(e) => set('nonStrikerId', e.target.value)}>
            <option value="">—</option>
            {battingRoster.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select label={t('scoring.bowler')} value={values.bowlerId} onChange={(e) => set('bowlerId', e.target.value)}>
            <option value="">—</option>
            {bowlingRoster.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <NumericInput
            label={t('scoring.runs')}
            min={0}
            max={6}
            value={values.batsmanRuns}
            onChange={(e) => set('batsmanRuns', Number(e.target.value) || 0)}
          />
          <Select
            label={t('match.extras')}
            value={values.extraType}
            onChange={(e) => {
              const extraType = e.target.value as ExtraType;
              set('extraType', extraType);
              set('extraRuns', extraType === 'WIDE' || extraType === 'NO_BALL' ? 1 : extraType === 'NONE' ? 0 : values.extraRuns);
            }}
          >
            {EXTRA_TYPES.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </Select>
          {values.extraType !== 'NONE' ? (
            <NumericInput
              label={t('correction.extraRuns')}
              min={0}
              value={values.extraRuns}
              onChange={(e) => set('extraRuns', Number(e.target.value) || 0)}
            />
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={values.isWicket} onChange={(e) => set('isWicket', e.target.checked)} />
          {t('scoring.wicket')}
        </label>
        {values.isWicket ? (
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('scoring.wicket')} value={values.dismissalType} onChange={(e) => set('dismissalType', e.target.value)}>
              <option value="">—</option>
              {DISMISSALS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <Select
              label={t('scoring.wicket') + ' (' + t('scoring.batsman') + ')'}
              value={values.dismissedPlayerId}
              onChange={(e) => set('dismissedPlayerId', e.target.value)}
            >
              <option value="">{playerName(match, values.strikerId)}</option>
              {battingRoster.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select label={t('scoring.fielder01')} value={values.fielderId} onChange={(e) => set('fielderId', e.target.value)}>
              <option value="">—</option>
              {bowlingRoster.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        ) : null}

        {diffRows.length ? (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="mb-2 font-bold">{t('correction.beforeAfter')}</p>
            {diffRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-2 py-0.5">
                <span className="text-text-secondary">{row.label}</span>
                <span>
                  <span className="text-text-secondary line-through">{row.before}</span> → <strong>{row.after}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <TextArea
          label={`${t('correction.reason')} *`}
          value={values.reason}
          onChange={(e) => set('reason', e.target.value)}
          rows={2}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            disabled={busy || values.reason.trim().length < 3 || !values.strikerId || !values.nonStrikerId || !values.bowlerId}
            onClick={() => onSubmit(values)}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteBallModal({
  match,
  event,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  match: Match;
  event: BallEvent;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <Modal open title={t('correction.deleteBall')} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm">
          {ballFeedOver(event)} · {playerName(match, event.strikerId)} · {playerName(match, event.bowlerId)}
        </p>
        <TextArea label={`${t('correction.reason')} *`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={busy || reason.trim().length < 3} onClick={() => onConfirm(reason)}>
            {t('correction.deleteBall')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  batsmanRuns: 'correction.field.batsmanRuns',
  extraType: 'correction.field.extraType',
  extraRuns: 'correction.field.extraRuns',
  isWicket: 'correction.field.isWicket',
  dismissalType: 'correction.field.dismissalType',
  strikerId: 'correction.field.strikerId',
  nonStrikerId: 'correction.field.nonStrikerId',
  bowlerId: 'correction.field.bowlerId',
  fielderId: 'correction.field.fielderId',
  dismissedPlayerId: 'correction.field.dismissedPlayerId',
  penaltyReason: 'correction.field.penaltyReason',
};

const EXTRA_TYPE_LABEL_KEYS: Record<string, string> = {
  NONE: 'correction.extraNone',
  WIDE: 'scoring.wideTitle',
  NO_BALL: 'scoring.noBallTitle',
  BYE: 'scoring.byesTitle',
  LEG_BYE: 'scoring.legByesTitle',
  PENALTY: 'correction.filterPenaltyBonus',
};

function formatCorrectionValue(field: string, value: unknown, match: Match, t: TFunction): string {
  if (PLAYER_ID_FIELDS.has(field)) {
    if (typeof value !== 'string' || !value) return t('correction.noneValue');
    const name = playerName(match, value);
    return name === '—' ? t('correction.unknownPlayer') : name;
  }
  if (field === 'extraType') {
    const key = typeof value === 'string' ? EXTRA_TYPE_LABEL_KEYS[value] : undefined;
    return key ? t(key) : t('correction.noneValue');
  }
  if (field === 'isWicket') return value ? t('common.yes') : t('common.no');
  if (field === 'dismissalType') return typeof value === 'string' && value ? t(dismissalI18nKey(value)) : t('correction.noneValue');
  if (value === null || value === undefined || value === '') return t('correction.noneValue');
  return String(value);
}

function ChangeRow({ change, match, t }: { change: CorrectionFieldChange; match: Match; t: TFunction }) {
  const label = t(FIELD_LABEL_KEYS[change.field] ?? change.field, change.field);
  const beforeText = formatCorrectionValue(change.field, change.before, match, t);
  const afterText = formatCorrectionValue(change.field, change.after, match, t);
  const afterTone = change.tone === 'added' ? 'text-success' : change.tone === 'removed' ? 'text-danger' : 'text-primary';
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
      <span className="shrink-0 text-xs font-semibold text-text-secondary">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-text-secondary">{beforeText}</span>
        <span aria-hidden="true" className="text-text-secondary">→</span>
        <span className={cn('font-bold', afterTone)}>{afterText}</span>
      </span>
    </div>
  );
}

function CorrectionCard({ row, match }: { row: CorrectionLogEntry; match: Match }) {
  const { t } = useTranslation();
  const [showTech, setShowTech] = useState(false);
  const changes = useMemo(() => diffCorrectionFields(row.meta?.before, row.meta?.after), [row.meta?.before, row.meta?.after]);
  const playerFields = changes.filter((c) => PLAYER_ID_FIELDS.has(c.field));
  const otherFields = changes.filter((c) => !PLAYER_ID_FIELDS.has(c.field));
  const hasBallRef = typeof row.meta?.overNumber === 'number';
  const hasTechnical = Boolean(row.meta?.before || row.meta?.after);
  const showReason = Boolean(row.meta?.reason) || ['BALL_CORRECTED', 'BALL_DELETED', 'BALL_INSERTED'].includes(row.action);

  return (
    <div className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{t(`correction.action.${row.action}`, row.action)}</p>
          <p className="text-xs text-text-secondary">{row.user?.name ?? t('common.empty')}</p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-xs text-text-secondary">{new Date(row.createdAt).toLocaleString()}</p>
          {hasBallRef ? (
            <p className="mt-0.5 text-xs font-semibold text-primary">
              {t('correction.ballRef', { over: row.meta!.overNumber, ball: (row.meta!.ballInOver ?? 0) + 1 })}
            </p>
          ) : null}
        </div>
      </div>

      {otherFields.length ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs font-bold uppercase text-text-secondary">{t('correction.changesHeading')}</p>
          <div className="flex flex-col divide-y divide-border">
            {otherFields.map((c) => (
              <ChangeRow key={c.field} change={c} match={match} t={t} />
            ))}
          </div>
        </div>
      ) : null}

      {playerFields.length ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs font-bold uppercase text-text-secondary">{t('correction.playersHeading')}</p>
          <div className="flex flex-col divide-y divide-border">
            {playerFields.map((c) => (
              <ChangeRow key={c.field} change={c} match={match} t={t} />
            ))}
          </div>
        </div>
      ) : null}

      {showReason ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs font-bold uppercase text-text-secondary">{t('correction.reasonHeading')}</p>
          <p className={row.meta?.reason ? 'font-medium' : 'text-text-secondary'}>
            {row.meta?.reason || t('correction.reasonNotProvided')}
          </p>
        </div>
      ) : null}

      {hasTechnical ? (
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            className="flex min-h-touch items-center gap-1 text-xs font-semibold text-primary"
            onClick={() => setShowTech((v) => !v)}
          >
            {showTech ? t('correction.hideTechnicalDetails') : t('correction.viewTechnicalDetails')}
            <IconChevron size={14} className={cn('transition-transform', showTech ? 'rotate-90' : '')} />
          </button>
          {showTech ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-text-secondary">{t('correction.before')}</p>
                <pre className="overflow-x-auto rounded-lg bg-dark-chrome p-2 text-[11px] leading-relaxed text-on-dark">
                  {JSON.stringify(row.meta?.before ?? null, null, 2)}
                </pre>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-text-secondary">{t('correction.after')}</p>
                <pre className="overflow-x-auto rounded-lg bg-dark-chrome p-2 text-[11px] leading-relaxed text-on-dark">
                  {JSON.stringify(row.meta?.after ?? null, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CorrectionHistory({ entries, loading, match }: { entries: CorrectionLogEntry[]; loading: boolean; match: Match }) {
  const { t } = useTranslation();
  if (loading) return <Spinner />;
  if (!entries.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold">{t('correction.emptyTitle')}</p>
        <p className="mt-1 text-sm text-text-secondary">{t('correction.emptyHint')}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase text-text-secondary">{t('correction.historyCount', { count: entries.length })}</p>
      {entries.map((row) => (
        <CorrectionCard key={row.id} row={row} match={match} />
      ))}
    </div>
  );
}
