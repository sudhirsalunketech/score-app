import { useTranslation } from 'react-i18next';
import { Input, NumericInput, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconTrash } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { OverRuleType } from '@/types/api';
import { mappingToRows, rowsToMapping, type MappingKind, type MappingRow } from '@/lib/over-rule-mapping';

export type OverRuleTemplateRow = {
  overNumber: string;
  name: string;
  ruleType: OverRuleType;
  target: string;
  achievedBonus: string;
  notAchievedPenalty: string;
  mappingRows: MappingRow[];
  customBonusRuns: string;
  customPenaltyRuns: string;
};

export function emptyOverRuleTemplateRow(): OverRuleTemplateRow {
  return {
    overNumber: '',
    name: '',
    ruleType: 'TARGET',
    target: '0',
    achievedBonus: '0',
    notAchievedPenalty: '0',
    mappingRows: mappingToRows(undefined),
    customBonusRuns: '0',
    customPenaltyRuns: '0',
  };
}

/** Reconstructs an editable row from a previously-saved tournament default (the inverse of overRuleTemplatePayload). */
export function overRuleTemplateRowFromPayload(item: { overNumber: number; name?: string | null; ruleType: OverRuleType; config: unknown }): OverRuleTemplateRow {
  const config = (item.config ?? {}) as Record<string, unknown>;
  return {
    overNumber: String(item.overNumber),
    name: item.name ?? '',
    ruleType: item.ruleType,
    target: String(config.target ?? 0),
    achievedBonus: String(config.achievedBonus ?? 0),
    notAchievedPenalty: String(config.notAchievedPenalty ?? 0),
    mappingRows: mappingToRows(config.mapping),
    customBonusRuns: String(config.bonusRuns ?? 0),
    customPenaltyRuns: String(config.penaltyRuns ?? 0),
  };
}

/** Builds the payload this row would save as, or null if the over number hasn't been filled in yet. */
export function overRuleTemplatePayload(row: OverRuleTemplateRow): { overNumber: number; name: string | null; ruleType: OverRuleType; enabled: true; config: unknown } | null {
  const overNumber = Number(row.overNumber);
  if (!Number.isInteger(overNumber) || overNumber < 0) return null;
  const config =
    row.ruleType === 'TARGET'
      ? { target: Number(row.target) || 0, achievedBonus: Number(row.achievedBonus) || 0, notAchievedPenalty: Number(row.notAchievedPenalty) || 0 }
      : row.ruleType === 'CUSTOM'
        ? { bonusRuns: Number(row.customBonusRuns) || 0, penaltyRuns: Number(row.customPenaltyRuns) || 0 }
        : { mapping: rowsToMapping(row.mappingRows) };
  return { overNumber, name: row.name.trim() || null, ruleType: row.ruleType, enabled: true, config };
}

export function OverRuleTemplateFields({
  dark,
  rows,
  onChange,
  disabled,
}: {
  dark?: boolean;
  rows: OverRuleTemplateRow[];
  onChange: (next: OverRuleTemplateRow[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const updateRow = (index: number, patch: Partial<OverRuleTemplateRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div key={index} className={cn('flex flex-col gap-3 rounded-lg border p-3', dark ? 'border-gold/20' : 'border-border')}>
          <div className="flex items-start gap-2">
            <NumericInput
              dark={dark}
              id={`over-rule-${index}-overNumber`}
              className="w-24"
              label={t('overRules.overNumberLabel')}
              min={1}
              value={row.overNumber}
              disabled={disabled}
              onChange={(e) => updateRow(index, { overNumber: e.target.value })}
            />
            <Input
              dark={dark}
              id={`over-rule-${index}-name`}
              className="flex-1"
              label={t('overRules.ruleNameLabel')}
              placeholder={t('overRules.ruleNamePlaceholder')}
              value={row.name}
              disabled={disabled}
              onChange={(e) => updateRow(index, { name: e.target.value })}
            />
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-6 px-2"
                aria-label={t('common.delete')}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                <IconTrash size={18} />
              </Button>
            ) : null}
          </div>

          <Select
            dark={dark}
            id={`over-rule-${index}-ruleType`}
            label={t('overRules.ruleTypeLabel')}
            value={row.ruleType}
            disabled={disabled}
            onChange={(e) => updateRow(index, { ruleType: e.target.value as OverRuleType })}
          >
            <option value="TARGET">{t('overRules.ruleType.TARGET')}</option>
            <option value="MAPPING">{t('overRules.ruleType.MAPPING')}</option>
            <option value="CUSTOM">{t('overRules.ruleType.CUSTOM')}</option>
          </Select>

          {row.ruleType === 'TARGET' ? (
            <div className="grid grid-cols-3 gap-2">
              <NumericInput
                dark={dark}
                id={`over-rule-${index}-target`}
                label={t('overRules.targetRuns')}
                min={0}
                value={row.target}
                disabled={disabled}
                onChange={(e) => updateRow(index, { target: e.target.value })}
              />
              <NumericInput
                dark={dark}
                id={`over-rule-${index}-achievedBonus`}
                label={t('overRules.achievedBonus')}
                min={0}
                value={row.achievedBonus}
                disabled={disabled}
                onChange={(e) => updateRow(index, { achievedBonus: e.target.value })}
              />
              <NumericInput
                dark={dark}
                id={`over-rule-${index}-notAchievedPenalty`}
                label={t('overRules.notAchievedPenalty')}
                min={0}
                value={row.notAchievedPenalty}
                disabled={disabled}
                onChange={(e) => updateRow(index, { notAchievedPenalty: e.target.value })}
              />
            </div>
          ) : row.ruleType === 'CUSTOM' ? (
            <div>
              <p className={cn('mb-1 text-xs font-semibold', dark ? 'text-on-dark/60' : 'text-text-secondary')}>{t('overRules.customHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                <NumericInput
                  dark={dark}
                  id={`over-rule-${index}-customBonusRuns`}
                  label={t('overRules.customBonusRuns')}
                  min={0}
                  value={row.customBonusRuns}
                  disabled={disabled}
                  onChange={(e) => updateRow(index, { customBonusRuns: e.target.value })}
                />
                <NumericInput
                  dark={dark}
                  id={`over-rule-${index}-customPenaltyRuns`}
                  label={t('overRules.customPenaltyRuns')}
                  min={0}
                  value={row.customPenaltyRuns}
                  disabled={disabled}
                  onChange={(e) => updateRow(index, { customPenaltyRuns: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div>
              <p className={cn('mb-1 text-xs font-semibold', dark ? 'text-on-dark/60' : 'text-text-secondary')}>{t('overRules.mappingHint')}</p>
              <div className="flex flex-col gap-2">
                {row.mappingRows.map((mr, mi) => (
                  <div key={mi} className="flex flex-wrap items-center gap-2">
                    <NumericInput
                      dark={dark}
                      className="!w-16 shrink-0"
                      placeholder={mr.kind === 'WICKET' ? t('overRules.mappingWicketsLabel') : t('overRules.mappingRunsLabel')}
                      min={0}
                      value={mr.kind === 'OTHER' ? '' : mr.count}
                      disabled={disabled || mr.kind === 'OTHER'}
                      onChange={(e) =>
                        updateRow(index, { mappingRows: row.mappingRows.map((r, i) => (i === mi ? { ...r, count: e.target.value } : r)) })
                      }
                    />
                    <Select
                      dark={dark}
                      className="!w-28 shrink-0"
                      aria-label={t('overRules.mappingKindLabel')}
                      value={mr.kind}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(index, {
                          mappingRows: row.mappingRows.map((r, i) => (i === mi ? { ...r, kind: e.target.value as MappingKind } : r)),
                        })
                      }
                    >
                      <option value="RUN">{t('overRules.mappingKind.RUN')}</option>
                      <option value="WICKET">{t('overRules.mappingKind.WICKET')}</option>
                      <option value="OTHER">{t('overRules.mappingKind.OTHER')}</option>
                    </Select>
                    <NumericInput
                      dark={dark}
                      className="!w-20 shrink-0"
                      placeholder={t('overRules.mappingValueLabel')}
                      min={0}
                      value={mr.value}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(index, { mappingRows: row.mappingRows.map((r, i) => (i === mi ? { ...r, value: e.target.value } : r)) })
                      }
                    />
                    {!disabled && row.mappingRows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2"
                        aria-label={t('common.delete')}
                        onClick={() => updateRow(index, { mappingRows: row.mappingRows.filter((_, i) => i !== mi) })}
                      >
                        <IconTrash size={18} />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {!disabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start text-xs"
                    onClick={() => updateRow(index, { mappingRows: [...row.mappingRows, { kind: 'RUN', count: '', value: '' }] })}
                  >
                    {t('overRules.addMappingRow')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ))}
      {!disabled ? (
        <Button type="button" variant="outline" onClick={() => onChange([...rows, emptyOverRuleTemplateRow()])}>
          {t('overRules.addRule')}
        </Button>
      ) : null}
    </div>
  );
}
