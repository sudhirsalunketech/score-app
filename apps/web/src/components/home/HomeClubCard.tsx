import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Club } from '@/types/api';
import { IconLeatherBall, IconTennisBall } from '@/components/ui/Icons';
import { initials } from '@/lib/format';
import { mediaSrc } from '@/lib/media';

export function HomeClubCard({ club }: { club: Club }) {
  const { t } = useTranslation();
  const teams = club._count?.teams;
  const types = club.ballTypes ?? [];

  return (
    <Link
      to={`/clubs/${club.id}`}
      className="flex w-[78vw] max-w-sm shrink-0 items-center gap-3 rounded-xl bg-club-card p-4 text-on-dark"
    >
      {club.logoUrl ? (
        <img src={mediaSrc(club.logoUrl)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
          {initials(club.name || '?')}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{club.name}</p>
        {club.city ? <p className="truncate text-sm text-white/70">{club.city}</p> : null}
        {teams != null ? (
          <p className="truncate text-xs text-white/55">{t('tournaments.teamCount', { count: teams })}</p>
        ) : null}
        {types.length ? (
          <div className="mt-2 flex items-center gap-2">
            {types.includes('TENNIS') || types.includes('RUBBER') ? <IconTennisBall size={16} /> : null}
            {types.includes('LEATHER') ? <IconLeatherBall size={16} /> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
