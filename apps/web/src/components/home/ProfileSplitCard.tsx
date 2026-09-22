import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initials } from '@/lib/format';
import { avatarSrc } from '@/lib/media';
import type { User } from '@/types/api';

export function ProfileSplitCard({
  user,
  matches,
  runs,
  wickets,
}: {
  user: User;
  matches: number;
  runs: number;
  wickets: number;
}) {
  const { t } = useTranslation();
  const photo = avatarSrc(user.avatarUrl ?? user.player?.photoUrl, 'person');

  return (
    <div className="px-[var(--gutter)]">
      <h2 className="mb-3 text-xl font-bold">{t('common.profile')}</h2>
      <Link to="/profile" className="flex overflow-hidden rounded-card-lg" aria-label={t('common.profile')}>
        <div className="flex w-[34%] items-center justify-center bg-club-card py-7">
          {photo ? (
            <img src={photo} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-on-dark">
              {initials(user.name || '?')}
            </span>
          )}
        </div>
        <div className="relative z-10 -ms-4 flex min-w-0 flex-1 flex-col justify-center rounded-tl-[2rem] bg-primary px-5 py-4 text-on-dark">
          <p className="truncate text-lg font-bold">{user.name.split(' ')[0]}</p>
          <div className="my-2 h-px bg-white/35" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={t('home.matches')} value={matches} />
            <Stat label={t('home.runs')} value={runs} />
            <Stat label={t('home.wickets')} value={wickets} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/80">{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}
