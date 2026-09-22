import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { IconBack, IconBell, IconMenu, IconSearch } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';

type Props = {
  title?: string;
  onMenu?: () => void;
  menuOpen?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  onSearch?: () => void;
  end?: ReactNode;
  className?: string;
};

export function MobileHeader({ title, onMenu, menuOpen, onBack, showSearch, onSearch, end, className }: Props) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const inbox = useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<{ unread: number }>('/api/v1/notifications'),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    nav(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex min-h-14 items-center gap-2 bg-bg px-[var(--gutter)] pt-[env(safe-area-inset-top)]',
        className,
      )}
    >
      {onMenu ? (
        <button
          type="button"
          className="touch-target inline-flex items-center justify-center md:hidden"
          aria-label={t('drawer.open')}
          aria-expanded={menuOpen}
          aria-controls="app-drawer"
          onClick={onMenu}
        >
          <IconMenu />
        </button>
      ) : null}
      {onBack ? (
        <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={onBack}>
          <IconBack />
        </button>
      ) : null}
      {title ? <h1 className="ms-1 min-w-0 flex-1 truncate text-lg font-bold md:text-[length:var(--page-title)]">{title}</h1> : <div className="flex-1" />}
      {showSearch ? (
        <>
          <form className="hidden min-w-0 max-w-sm flex-1 md:block" onSubmit={submitSearch} role="search">
            <label className="sr-only" htmlFor="app-header-search">
              {t('common.search')}
            </label>
            <input
              id="app-header-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search.placeholder')}
              className="min-h-touch w-full rounded-pill border border-border bg-muted px-4 text-sm"
            />
          </form>
          <button type="button" className="touch-target inline-flex items-center justify-center md:hidden" aria-label={t('common.search')} onClick={onSearch}>
            <IconSearch />
          </button>
        </>
      ) : null}
      {isAuthenticated ? (
        <>
          <button
            type="button"
            className="touch-target relative inline-flex items-center justify-center"
            aria-label={t('notifications.title')}
            onClick={() => nav('/notifications')}
          >
            <IconBell />
            {(inbox.data?.unread ?? 0) > 0 ? (
              <span className="absolute end-1 top-1 min-w-4 rounded-pill bg-scoring px-1 text-[10px] font-bold text-scoring-on">
                {inbox.data?.unread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="touch-target inline-flex items-center justify-center"
            aria-label={t('common.profile')}
            onClick={() => nav('/profile')}
          >
            <Avatar name={user?.name ?? ''} src={user?.avatarUrl ?? user?.player?.photoUrl} kind="person" size={32} />
          </button>
        </>
      ) : null}
      {end}
    </header>
  );
}
