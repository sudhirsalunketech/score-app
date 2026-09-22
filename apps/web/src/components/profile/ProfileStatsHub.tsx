import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PillTabs } from '@/components/ui/Pills';
import type { PlayerProfileStats } from '@/lib/player-profile';
import { FormatStatsTable } from './FormatStatsTable';
import { MatchWiseList } from './MatchWiseList';

export function ProfileStatsHub({ data }: { data?: PlayerProfileStats | null }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('bat');
  const byFormat = data?.tables?.byFormat;
  return (
    <div className="mt-4">
      <PillTabs
        tone="ink"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'bat', label: t('profile.bat') },
          { id: 'bowl', label: t('profile.bowl') },
          { id: 'field', label: t('profile.field') },
          { id: 'matchwise', label: t('profile.matchWise') },
        ]}
      />
      {tab === 'bat' && byFormat ? <FormatStatsTable byFormat={byFormat} kind="bat" /> : null}
      {tab === 'bowl' && byFormat ? <FormatStatsTable byFormat={byFormat} kind="bowl" /> : null}
      {tab === 'field' && byFormat ? <FormatStatsTable byFormat={byFormat} kind="field" /> : null}
      {tab === 'matchwise' ? <MatchWiseList matches={data?.matches ?? []} /> : null}
    </div>
  );
}
