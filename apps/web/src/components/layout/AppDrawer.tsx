import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import {
  IconChart,
  IconCheckered,
  IconChevron,
  IconClose,
  IconClub,
  IconFlag,
  IconGear,
  IconInfo,
  IconGroup,
  IconHeart,
  IconHome,
  IconLogout,
  IconMatches,
  IconPerson,
  IconPlay,
  IconPlus,
  IconPower,
  IconSearch,
  IconStamp,
  IconTrophy,
} from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import { canScoreThisMatch, canSeeDrawerItem, isLiveMatch, isPlayerRole } from '@/lib/roles';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { playerRoleLabel } from '@/lib/match-result';
import type { HomeData } from '@/types/api';

type IconCmp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

type NavItem = {
  to: string;
  key: string;
  icon: IconCmp;
  auth?: boolean;
  guestOpen?: boolean;
  guestOnly?: boolean;
  create?: boolean;
  admin?: boolean;
  end?: boolean;
  emphasize?: boolean;
  live?: boolean;
  badge?: 'live' | 'mine';
  hideForPlayer?: boolean;
};

const main: NavItem[] = [
  { to: '/', key: 'drawer.home', icon: IconHome, end: true, guestOpen: true },
  { to: '/matches', key: 'drawer.myMatches', icon: IconMatches, end: true, badge: 'mine' },
  { to: '/live-matches', key: 'drawer.liveMatches', icon: IconPlay, live: true, badge: 'live', guestOpen: true },
  { to: '/teams', key: 'drawer.myTeams', icon: IconGroup, end: true },
  { to: '/tournaments', key: 'drawer.myTournaments', icon: IconTrophy, end: true, guestOpen: true },
  { to: '/players', key: 'drawer.players', icon: IconPerson, end: true, guestOpen: true },
  { to: '/statistics', key: 'drawer.stats', icon: IconChart, end: true, guestOpen: true },
  { to: '/clubs', key: 'drawer.myClubs', icon: IconClub, end: true },
  { to: '/following', key: 'drawer.following', icon: IconHeart, auth: true },
];

const actions: NavItem[] = [
  { to: '/clubs/register', key: 'drawer.registerAsClub', icon: IconStamp, auth: true, hideForPlayer: true },
  { to: '/tournaments/new', key: 'drawer.createTournament', icon: IconFlag, auth: true, create: true, emphasize: true },
  { to: '/teams?create=1', key: 'drawer.createTeam', icon: IconPlus, auth: true, create: true },
  { to: '/matches/new', key: 'drawer.startMatch', icon: IconPlay, guestOpen: true, create: true, emphasize: true },
];

const settings: NavItem[] = [
  { to: '/search', key: 'drawer.search', icon: IconSearch, guestOpen: true },
  { to: '/help', key: 'drawer.help', icon: IconInfo, guestOpen: true },
  { to: '/login', key: 'common.login', icon: IconPerson, guestOnly: true },
  { to: '/register', key: 'auth.createAccount', icon: IconPlus, guestOnly: true },
  { to: '/profile', key: 'drawer.profile', icon: IconPerson, auth: true },
  { to: '/settings', key: 'drawer.settings', icon: IconGear, auth: true, end: true },
  { to: '/settings/testers', key: 'beta.testers', icon: IconPerson, auth: true, admin: true },
  { to: '/settings/feedback', key: 'beta.feedback', icon: IconCheckered, auth: true, admin: true },
  { to: '/access', key: 'drawer.access', icon: IconPerson, auth: true, admin: true },
];

export function AppDrawer({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  tabletUp,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  tabletUp: boolean;
}) {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutBlocked, setLogoutBlocked] = useState(false);
  const overlay = !tabletUp;
  const home = useQuery({
    queryKey: keys.home,
    queryFn: () => api<HomeData>('/api/v1/home'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const scoringLiveMatch = (home.data?.myMatches ?? []).some((m) => isLiveMatch(m.status) && canScoreThisMatch(user, m));

  useEffect(() => {
    if (!open || !overlay) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])') ?? []);
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      lastFocus.current?.focus();
    };
  }, [open, onClose, overlay]);

  const player = isPlayerRole(user?.role);
  const visible = (item: NavItem) => canSeeDrawerItem(user, item, isAuthenticated);
  const remap = (item: NavItem): NavItem => {
    if (!player) return item;
    if (item.to === '/matches') return { ...item, to: '/my-matches' };
    if (item.to === '/teams') return { ...item, to: '/my-teams' };
    if (item.to === '/tournaments') return { ...item, to: '/my-tournaments' };
    return item;
  };

  const compact = tabletUp && collapsed;
  const liveCount = home.data?.liveMatches?.length ?? 0;
  const mineCount = home.data?.myMatches?.length ?? 0;
  const badgeFor = (item: NavItem) => {
    if (item.badge === 'live' && liveCount > 0) return liveCount;
    if (item.badge === 'mine' && mineCount > 0) return mineCount;
    return 0;
  };

  const groups = [
    { title: t('drawer.sectionMain'), items: main.filter(visible).map(remap) },
    { title: t('drawer.sectionActions'), items: actions.filter(visible) },
    { title: t('drawer.sectionSettings'), items: settings.filter(visible) },
  ].filter((g) => g.items.length);

  const role = player
    ? t('playerHome.role')
    : user?.player?.role
      ? t(`playingXI.${playerRoleLabel(user.player.role)}`)
      : t('drawer.viewProfile');

  return (
    <div
      className={cn(
        'z-overlay md:z-auto',
        overlay ? 'fixed inset-0' : 'sticky top-0 z-20 h-dvh shrink-0 self-start',
        overlay && !open && 'pointer-events-none',
      )}
      style={tabletUp ? { width: compact ? 'var(--sidebar-collapsed-w)' : 'var(--sidebar-w)' } : undefined}
    >
      {overlay ? (
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          className={cn('absolute inset-0 bg-black/40 transition-opacity duration-[var(--motion)]', open ? 'opacity-100' : 'opacity-0')}
          aria-label={t('drawer.close')}
          onClick={onClose}
        />
      ) : null}
      <div
        ref={panelRef}
        id="app-drawer"
        role={overlay ? 'dialog' : 'navigation'}
        aria-modal={overlay && open ? true : undefined}
        aria-label={t('drawer.navigation')}
        className={cn(
          'flex h-full flex-col bg-bg transition-[transform,width] duration-[var(--motion)]',
          overlay
            ? cn(
                'absolute inset-block-0 inset-inline-start-0 w-[min(320px,85vw)] shadow-lg',
                open ? 'translate-x-0' : '-translate-x-full',
              )
            : 'relative w-full border-e border-border',
        )}
      >
        <div className={cn('flex items-start gap-2 border-b border-border px-3 py-3', compact && 'justify-center px-2')}>
          {isAuthenticated ? (
            <NavLink
              to="/profile"
              onClick={onClose}
              className={cn(
                'group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                compact && 'flex-none justify-center p-1',
              )}
              aria-label={t('drawer.profile')}
              title={compact ? t('drawer.profile') : undefined}
            >
              <Avatar
                name={user?.name ?? t('common.guest')}
                src={user?.avatarUrl ?? user?.player?.photoUrl}
                kind="person"
                size={compact ? 40 : overlay ? 44 : 52}
              />
              {!compact ? (
                <span className="min-w-0 text-start">
                  <span className="block truncate text-sm font-bold">{user?.name}</span>
                  <span className="block truncate text-xs text-text-secondary">{role}</span>
                </span>
              ) : null}
            </NavLink>
          ) : (
            <div className={cn('flex min-w-0 flex-1 items-center gap-3 p-1.5', compact && 'justify-center')}>
              <Avatar name={t('common.guest')} kind="person" size={compact ? 40 : 44} />
              {!compact ? (
                <span className="min-w-0 text-start">
                  <span className="block text-sm font-bold">{t('common.guest')}</span>
                  <span className="block text-xs text-text-secondary">{t('drawer.loginSignup')}</span>
                </span>
              ) : null}
            </div>
          )}
          {overlay ? (
            <button
              type="button"
              className="touch-target inline-flex shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t('drawer.close')}
              onClick={onClose}
            >
              <IconClose size={20} />
            </button>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2" aria-label={t('drawer.navigation')}>
          {groups.map((group) =>
            group.items.length ? (
              <div key={group.title || 'guest'} className="mb-1">
                {group.title && !compact ? (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                    {group.title}
                  </p>
                ) : group.title && compact ? (
                  <div className="mx-2 my-2 border-t border-border" />
                ) : null}
                {group.items.map((item) => (
                  <DrawerLink key={item.key} item={item} onClose={onClose} compact={compact} badge={badgeFor(item)} />
                ))}
              </div>
            ) : null,
          )}
        </nav>

        <div className="border-t border-border px-2 py-2">
          {isAuthenticated ? (
            <button
              type="button"
              className={cn(
                'group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-danger transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                compact && 'justify-center px-2',
              )}
              onClick={() => (scoringLiveMatch ? setLogoutBlocked(true) : setConfirmLogout(true))}
              aria-label={t('drawer.logout')}
              title={compact ? t('drawer.logout') : undefined}
            >
              <span className="inline-flex w-6 shrink-0 justify-center">
                <IconLogout size={20} />
              </span>
              {!compact ? <span>{t('drawer.logout')}</span> : null}
            </button>
          ) : (
            <NavLink
              to="/login"
              onClick={onClose}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                compact && 'justify-center px-2',
              )}
              aria-label={t('drawer.loginSignup')}
              title={compact ? t('drawer.loginSignup') : undefined}
            >
              <span className="inline-flex w-6 shrink-0 justify-center">
                <IconPower size={20} />
              </span>
              {!compact ? <span>{t('drawer.loginSignup')}</span> : null}
            </NavLink>
          )}
          {tabletUp ? (
            <button
              type="button"
              className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl text-text-secondary transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={onToggleCollapse}
              aria-label={collapsed ? t('drawer.expand') : t('drawer.collapse')}
            >
              <IconChevron className={cn('transition-transform duration-[180ms]', collapsed ? '' : 'rotate-180')} />
            </button>
          ) : null}
        </div>
      </div>
      <Modal open={confirmLogout} title={t('auth.logoutConfirmTitle')} onClose={() => setConfirmLogout(false)}>
        <p className="mb-4 text-sm text-text-secondary">{t('auth.logoutConfirmBody')}</p>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => setConfirmLogout(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={() => {
              setConfirmLogout(false);
              if (scoringLiveMatch) {
                setLogoutBlocked(true);
                return;
              }
              onClose();
              void logout();
            }}
          >
            {t('drawer.logout')}
          </Button>
        </div>
      </Modal>
      <Modal open={logoutBlocked} title={t('auth.logoutBlockedTitle')} onClose={() => setLogoutBlocked(false)}>
        <p className="mb-4 text-sm text-text-secondary">{t('auth.logoutBlockedBody')}</p>
        <Button className="w-full" variant="primaryDark" onClick={() => setLogoutBlocked(false)}>
          {t('info.gotIt')}
        </Button>
      </Modal>
    </div>
  );
}

function DrawerLink({
  item,
  onClose,
  compact,
  badge,
}: {
  item: NavItem;
  onClose: () => void;
  compact: boolean;
  badge: number;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.key);
  return (
    <NavLink
      to={item.to}
      end={item.end ?? item.to === '/'}
      onClick={onClose}
      title={compact ? label : undefined}
      aria-label={label}
      className={({ isActive }) => {
        const active = item.to.includes('?') ? false : isActive;
        return cn(
          'group relative my-0.5 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color] duration-[180ms]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          compact ? 'justify-center px-2' : 'justify-start',
          active
            ? 'bg-primary/10 font-semibold text-primary before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-primary'
            : 'font-medium text-text hover:bg-muted',
          item.emphasize && !active && 'text-primary',
        );
      }}
    >
      <span className="relative inline-flex w-6 shrink-0 justify-center">
        <Icon size={20} />
        {item.live && badge > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-live" aria-hidden />
        ) : null}
      </span>
      {!compact ? (
        <>
          <span className="min-w-0 flex-1 truncate text-start">{label}</span>
          {badge > 0 ? (
            <span className="rounded-pill bg-muted px-1.5 text-[11px] font-bold tabular-nums text-text-secondary">
              {badge}
            </span>
          ) : null}
        </>
      ) : badge > 0 ? (
        <span className="sr-only">{badge}</span>
      ) : null}
    </NavLink>
  );
}
