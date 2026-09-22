import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconPlus } from '@/components/ui/Icons';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { splitTeamName } from '@/lib/match-meta';
import type { Team } from '@/types/api';

export function TeamCard({
  team,
  onClick,
  emptyLabel,
  info,
}: {
  team: Team | null;
  onClick: () => void;
  emptyLabel?: string;
  info?: string;
}) {
  const { t } = useTranslation();
  const [line1, line2] = team ? splitTeamName(team.name) : ['', ''];
  const title = emptyLabel ?? t('match.selectTeam');
  return (
    <div className="flex w-[44%] max-w-[160px] min-w-0 flex-col items-center gap-2">
      <span className="inline-flex items-center justify-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {title}
        {info ? (
          <InfoTooltip topic={title} compact>
            {info}
          </InfoTooltip>
        ) : null}
      </span>
      <button
        type="button"
        className="flex w-full flex-col items-center gap-2"
        onClick={onClick}
        aria-label={t('match.selectTeam')}
      >
        <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border border-border bg-muted sm:h-[104px] sm:w-[104px]">
          {team ? (
            <Avatar name={team.name} src={team.logoUrl} kind="team" size={88} />
          ) : (
            <IconPlus className="text-text-secondary" size={28} />
          )}
        </span>
        <span className="w-full text-center text-[13px] font-bold uppercase leading-tight">
          {team ? (
            <>
              <span className="block truncate">{line1}</span>
              {line2 ? <span className="block truncate">{line2}</span> : null}
            </>
          ) : (
            <span className="text-text-secondary">{t('match.selectTeam')}</span>
          )}
        </span>
      </button>
    </div>
  );
}
