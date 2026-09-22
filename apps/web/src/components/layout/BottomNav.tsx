import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { IconHome, IconMatches, IconPerson, IconPlay, IconTrophy } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';

export function BottomNav() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const items = [
    { to: '/', key: 'common.home', icon: IconHome, end: true },
    { to: '/matches', key: 'common.matches', icon: IconMatches, end: true },
    { to: '/live-matches', key: 'drawer.liveMatches', icon: IconPlay },
    { to: '/tournaments', key: 'common.tournaments', icon: IconTrophy, end: true },
    {
      to: isAuthenticated ? '/profile' : '/login',
      key: isAuthenticated ? 'common.profile' : 'common.login',
      icon: IconPerson,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t('drawer.navigation')}
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full min-h-touch flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold',
                    isActive ? 'text-primary' : 'text-text-secondary',
                  )
                }
              >
                <Icon size={22} />
                <span className="max-w-full truncate">{t(item.key)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
