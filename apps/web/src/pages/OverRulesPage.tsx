import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { IconBack, IconChevron, IconTrash } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Input, NumericInput, Select } from '@/components/ui/Input';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import type { Match, OverRuleResultRow, OverRuleRow, OverRuleType, OverRulesResponse } from '@/types/api';
import { mappingToRows, rowsToMapping, type MappingKind, type MappingRow } from '@/lib/over-rule-mapping';

const ALL_RULE_TYPES: OverRuleType[] = ['TARGET', 'MAPPING', 'CUSTOM'];

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
}

export function ruleSummary(rule: OverRuleRow, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const name = rule.name?.trim() || t('overRules.defaultRuleName', { n: rule.overNumber + 1 });
  if (rule.ruleType === 'TARGET') {
    const c = rule.config as { target?: number; achievedBonus?: number; notAchievedPenalty?: number };
    return `${name} · ${t('overRules.ruleType.TARGET')} ${c.target ?? 0} · +${c.achievedBonus ?? 0} / -${c.notAchievedPenalty ?? 0}`;
  }
  if (rule.ruleType === 'CUSTOM') {
    const c = rule.config as { bonusRuns?: number; penaltyRuns?: number };
    return `${name} · ${t('overRules.ruleType.CUSTOM')} +${c.bonusRuns ?? 0} / -${c.penaltyRuns ?? 0}`;
  }
  const c = rule.config as { mapping?: Array<{ kind: MappingKind; count: number; value: number }> };
  const rows = Array.isArray(c.mapping) ? c.mapping : [];
  const preview = rows
    .slice(0, 3)
    .map((r) => (r.kind === 'OTHER' ? `${t(`overRules.mappingKind.${r.kind}`)}→+${r.value}` : `${r.count} ${t(`overRules.mappingKind.${r.kind}`)}→+${r.value}`))
    .join(', ');
  return `${name} · ${t(`overRules.ruleType.${rule.ruleType}`)}${preview ? ` · ${preview}` : ''}`;
}

export function OverRulesPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const match = useQuery({ queryKey: keys.match(id), queryFn: () => api<Match>(`/api/v1/matches/${id}`) });
  const overRules = useQuery({ queryKey: keys.overRules(id), queryFn: () => api<OverRulesResponse>(`/api/v1/matches/${id}/over-rules`) });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.overRules(id) });
    void qc.invalidateQueries({ queryKey: keys.match(id) });
  };

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) => api(`/api/v1/matches/${id}`, { method: 'PATCH', body: { overWiseRulesEnabled: enabled } }),
    onSuccess: invalidate,
  });

  if (match.isLoading || overRules.isLoading) return <Spinner />;
  if (match.isError || !match.data) return <ErrorRetry onRetry={() => void match.refetch()} />;
  if (overRules.isError || !overRules.data) return <ErrorRetry onRetry={() => void overRules.refetch()} />;

  const m = match.data;
  const data = overRules.data;
  const beforeStart = m.status === 'DRAFT' || m.status === 'SCHEDULED' || m.status === 'TOSS_PENDING' || m.status === 'TOSS_COMPLETED';
  const finished = m.status === 'COMPLETED' || m.status === 'ABANDONED' || m.status === 'CANCELLED';
  const rulesByOver = new Map<number, OverRuleRow[]>();
  for (const r of data.rules) rulesByOver.set(r.overNumber, [...(rulesByOver.get(r.overNumber) ?? []), r]);
  const resultsByKey = new Map<string, OverRuleResultRow[]>();
  for (const r of data.results) {
    const key = `${r.overNumber}:${r.ruleType}`;
    resultsByKey.set(key, [...(resultsByKey.get(key) ?? []), r]);
  }
  const lockedOvers = new Set(data.results.map((r) => r.overNumber));

  return (
    <div className="px-[var(--gutter)] py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="flex-1 text-lg font-bold">{t('overRules.title')}</h1>
      </header>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-bold">{t('overRules.toggleLabel')}</p>
          <p className="text-xs text-text-secondary">{t('overRules.toggleHint')}</p>
          {!beforeStart ? <p className="mt-1 text-xs text-danger">{finished ? t('overRules.finishedLockedNotice') : t('overRules.toggleLockedNotice')}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.enabled}
          disabled={!beforeStart || toggleEnabled.isPending}
          onClick={() => toggleEnabled.mutate(!data.enabled)}
          className={cn('block h-6 w-11 shrink-0 rounded-pill p-0.5 transition-colors', data.enabled ? 'bg-primary' : 'bg-border')}
        >
          <span className={cn('block h-5 w-5 rounded-full bg-white transition-transform', data.enabled ? 'translate-x-5' : 'translate-x-0')} />
        </button>
      </div>

      {data.enabled ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: m.overs }, (_, overNumber) => overNumber).map((overNumber) => (
            <OverRuleSection
              key={overNumber}
              matchId={id}
              overNumber={overNumber}
              overs={m.overs}
              rules={rulesByOver.get(overNumber) ?? []}
              resultsByKey={resultsByKey}
              overLocked={lockedOvers.has(overNumber)}
              canEdit={!finished}
              expanded={expanded}
              onToggleOpen={(key) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              onChanged={invalidate}
            />
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-text-secondary">{t('common.empty')}</p>
      )}
    </div>
  );
}

function OverRuleSection({
  matchId,
  overNumber,
  overs,
  rules,
  resultsByKey,
  overLocked,
  canEdit,
  expanded,
  onToggleOpen,
  onChanged,
}: {
  matchId: string;
  overNumber: number;
  overs: number;
  rules: OverRuleRow[];
  resultsByKey: Map<string, OverRuleResultRow[]>;
  overLocked: boolean;
  canEdit: boolean;
  expanded: Set<string>;
  onToggleOpen: (key: string) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [draftTypes, setDraftTypes] = useState<OverRuleType[]>([]);
  const [pendingType, setPendingType] = useState<OverRuleType | ''>('');
  const [copyTo, setCopyTo] = useState('');

  const copy = useMutation({
    mutationFn: () => api(`/api/v1/matches/${matchId}/over-rules/${overNumber}/copy`, { method: 'POST', body: { toOver: Number(copyTo) - 1 } }),
    onSuccess: () => {
      setCopyTo('');
      onChanged();
    },
  });

  const usedTypes = new Set<OverRuleType>([...rules.map((r) => r.ruleType), ...draftTypes]);
  const availableTypes = ALL_RULE_TYPES.filter((rt) => !usedTypes.has(rt));
  const canAddMore = canEdit && !overLocked && availableTypes.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">{t('overRules.overCard', { n: overNumber + 1 })}</p>
        {overLocked ? <span className="text-xs text-text-secondary">{t('overRules.locked')}</span> : null}
      </div>

      {!rules.length && !draftTypes.length ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-text-secondary">{t('overRules.summaryNoRule')}</p>
      ) : null}

      {rules.map((rule) => (
        <OverRuleCard
          key={rule.ruleType}
          matchId={matchId}
          overNumber={overNumber}
          overs={overs}
          ruleType={rule.ruleType}
          rule={rule}
          results={resultsByKey.get(`${overNumber}:${rule.ruleType}`) ?? []}
          canEdit={canEdit}
          open={expanded.has(`${overNumber}:${rule.ruleType}`)}
          onToggleOpen={() => onToggleOpen(`${overNumber}:${rule.ruleType}`)}
          onChanged={onChanged}
          onDeleted={onChanged}
        />
      ))}

      {draftTypes.map((draftType, draftIndex) => {
        const changeableTypes = ALL_RULE_TYPES.filter((rt) => rt === draftType || !usedTypes.has(rt));
        return (
          <OverRuleCard
            key={draftIndex}
            matchId={matchId}
            overNumber={overNumber}
            overs={overs}
            ruleType={draftType}
            rule={null}
            results={[]}
            canEdit={canEdit}
            open
            onToggleOpen={() => {}}
            onChanged={onChanged}
            onDeleted={() => setDraftTypes((rows) => rows.filter((_, i) => i !== draftIndex))}
            onRuleTypeChange={(next) => setDraftTypes((rows) => rows.map((rt, i) => (i === draftIndex ? next : rt)))}
            changeableTypes={changeableTypes}
          />
        );
      })}

      {canAddMore || (rules.length > 0 && canEdit && !overLocked) ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {canAddMore ? (
            <div className="flex items-center gap-2">
              <SearchSelect
                className="w-44"
                value={pendingType}
                onChange={(next) => setPendingType(next as OverRuleType | '')}
                placeholder={t('overRules.ruleTypeLabel')}
                options={availableTypes.map((rt) => ({ value: rt, label: t(`overRules.ruleType.${rt}`) }))}
              />
              <Button
                type="button"
                variant="outline"
                className="text-xs"
                disabled={!pendingType}
                onClick={() => {
                  if (!pendingType) return;
                  setDraftTypes((rows) => [...rows, pendingType]);
                  setPendingType('');
                }}
              >
                {t('overRules.addRule')}
              </Button>
            </div>
          ) : null}
          {rules.length > 0 && canEdit && !overLocked ? (
            <div className="flex items-center gap-2">
              <NumericInput className="w-20" placeholder="#" min={1} max={overs} value={copyTo} onChange={(e) => setCopyTo(e.target.value)} />
              <Button type="button" variant="outline" className="text-xs" disabled={!copyTo || copy.isPending} onClick={() => copy.mutate()}>
                {t('overRules.copy')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {copy.error ? <p className="px-1 text-sm text-danger">{errMsg(copy.error, t('common.error'))}</p> : null}
    </div>
  );
}

function OverRuleCard({
  matchId,
  overNumber,
  ruleType,
  rule,
  results,
  canEdit,
  open,
  onToggleOpen,
  onChanged,
  onDeleted,
  onRuleTypeChange,
  changeableTypes,
}: {
  matchId: string;
  overNumber: number;
  overs: number;
  ruleType: OverRuleType;
  rule: OverRuleRow | null;
  results: OverRuleResultRow[];
  canEdit: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onRuleTypeChange?: (next: OverRuleType) => void;
  changeableTypes?: OverRuleType[];
}) {
  const { t } = useTranslation();
  const locked = Boolean(rule?.locked);
  const [name, setName] = useState(rule?.name ?? '');
  const [target, setTarget] = useState(String((rule?.config as { target?: number })?.target ?? 0));
  const [achievedBonus, setAchievedBonus] = useState(String((rule?.config as { achievedBonus?: number })?.achievedBonus ?? 0));
  const [notAchievedPenalty, setNotAchievedPenalty] = useState(String((rule?.config as { notAchievedPenalty?: number })?.notAchievedPenalty ?? 0));
  const [mappingRows, setMappingRows] = useState<MappingRow[]>(mappingToRows((rule?.config as { mapping?: unknown })?.mapping));
  const [customBonusRuns, setCustomBonusRuns] = useState(String((rule?.config as { bonusRuns?: number })?.bonusRuns ?? 0));
  const [customPenaltyRuns, setCustomPenaltyRuns] = useState(String((rule?.config as { penaltyRuns?: number })?.penaltyRuns ?? 0));

  const save = useMutation({
    mutationFn: () => {
      const config =
        ruleType === 'TARGET'
          ? { target: Number(target) || 0, achievedBonus: Number(achievedBonus) || 0, notAchievedPenalty: Number(notAchievedPenalty) || 0 }
          : ruleType === 'CUSTOM'
            ? { bonusRuns: Number(customBonusRuns) || 0, penaltyRuns: Number(customPenaltyRuns) || 0 }
            : { mapping: rowsToMapping(mappingRows) };
      return api(`/api/v1/matches/${matchId}/over-rules/${overNumber}`, {
        method: 'PUT',
        body: { name: name.trim() || null, ruleType, enabled: true, config },
      });
    },
    onSuccess: onChanged,
  });
  const clear = useMutation({
    mutationFn: () => api(`/api/v1/matches/${matchId}/over-rules/${overNumber}?ruleType=${ruleType}`, { method: 'DELETE' }),
    onSuccess: onDeleted,
  });

  const heading = rule ? ruleSummary(rule, t) : `${t(`overRules.ruleType.${ruleType}`)} · ${t('overRules.summaryNoRule')}`;

  return (
    <div className="rounded-xl border border-border">
      <button type="button" className="flex w-full items-center gap-2 p-3 text-start" onClick={onToggleOpen}>
        <IconChevron size={16} className={cn('shrink-0 transition-transform', open ? 'rotate-90' : '')} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{heading}</span>
        {locked ? <span className="shrink-0 text-xs text-text-secondary">{t('overRules.locked')}</span> : null}
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <Input
            label={t('overRules.ruleNameLabel')}
            placeholder={t('overRules.ruleNamePlaceholder')}
            value={name}
            disabled={!canEdit || locked}
            onChange={(e) => setName(e.target.value)}
          />
          {onRuleTypeChange && changeableTypes ? (
            <SearchSelect
              label={t('overRules.ruleTypeLabel')}
              value={ruleType}
              disabled={!canEdit || locked}
              onChange={(next) => onRuleTypeChange(next as OverRuleType)}
              options={changeableTypes.map((rt) => ({ value: rt, label: t(`overRules.ruleType.${rt}`) }))}
            />
          ) : (
            <p className="text-xs font-semibold text-text-secondary">
              {t('overRules.ruleTypeLabel')}: {t(`overRules.ruleType.${ruleType}`)}
            </p>
          )}

          {ruleType === 'TARGET' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <NumericInput label={t('overRules.targetRuns')} min={0} value={target} disabled={!canEdit || locked} onChange={(e) => setTarget(e.target.value)} />
              <NumericInput label={t('overRules.achievedBonus')} min={0} value={achievedBonus} disabled={!canEdit || locked} onChange={(e) => setAchievedBonus(e.target.value)} />
              <NumericInput label={t('overRules.notAchievedPenalty')} min={0} value={notAchievedPenalty} disabled={!canEdit || locked} onChange={(e) => setNotAchievedPenalty(e.target.value)} />
            </div>
          ) : ruleType === 'CUSTOM' ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-text-secondary">{t('overRules.customHint')}</p>
              <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                <NumericInput label={t('overRules.customBonusRuns')} min={0} value={customBonusRuns} disabled={!canEdit || locked} onChange={(e) => setCustomBonusRuns(e.target.value)} />
                <NumericInput label={t('overRules.customPenaltyRuns')} min={0} value={customPenaltyRuns} disabled={!canEdit || locked} onChange={(e) => setCustomPenaltyRuns(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-xs font-semibold text-text-secondary">{t('overRules.mappingHint')}</p>
              <div className="flex flex-col gap-2">
                {mappingRows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <NumericInput
                      className="!w-16 shrink-0"
                      placeholder={row.kind === 'WICKET' ? t('overRules.mappingWicketsLabel') : t('overRules.mappingRunsLabel')}
                      min={0}
                      value={row.kind === 'OTHER' ? '' : row.count}
                      disabled={!canEdit || locked || row.kind === 'OTHER'}
                      onChange={(e) => setMappingRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, count: e.target.value } : r)))}
                    />
                    <Select
                      className="!w-28 shrink-0"
                      aria-label={t('overRules.mappingKindLabel')}
                      value={row.kind}
                      disabled={!canEdit || locked}
                      onChange={(e) => setMappingRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, kind: e.target.value as MappingKind } : r)))}
                    >
                      <option value="RUN">{t('overRules.mappingKind.RUN')}</option>
                      <option value="WICKET">{t('overRules.mappingKind.WICKET')}</option>
                      <option value="OTHER">{t('overRules.mappingKind.OTHER')}</option>
                    </Select>
                    <NumericInput
                      className="!w-20 shrink-0"
                      placeholder={t('overRules.mappingValueLabel')}
                      min={0}
                      value={row.value}
                      disabled={!canEdit || locked}
                      onChange={(e) => setMappingRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                    />
                    {canEdit && !locked && mappingRows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2"
                        aria-label={t('common.delete')}
                        onClick={() => setMappingRows((rows) => rows.filter((_, idx) => idx !== i))}
                      >
                        <IconTrash size={18} />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {canEdit && !locked ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start text-xs"
                    onClick={() => setMappingRows((rows) => [...rows, { kind: 'RUN', count: '', value: '' }])}
                  >
                    {t('overRules.addMappingRow')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {results.length ? (
            <div className="rounded-lg bg-muted p-2 text-xs text-text-secondary">
              {results.map((r) => (
                <p key={r.inningsId}>
                  {t('overRules.actual')}: {r.actualRuns} · +{r.bonusRuns} / -{r.penaltyRuns}
                </p>
              ))}
            </div>
          ) : null}

          {canEdit && !locked ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
                {t('overRules.save')}
              </Button>
              <Button type="button" variant="outline" disabled={clear.isPending} onClick={() => (rule ? clear.mutate() : onDeleted())}>
                {rule ? t('overRules.clear') : t('common.delete')}
              </Button>
            </div>
          ) : null}
          {save.error ? <p className="text-sm text-danger">{errMsg(save.error, t('common.error'))}</p> : null}
          {clear.error ? <p className="text-sm text-danger">{errMsg(clear.error, t('common.error'))}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
