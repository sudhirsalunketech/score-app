import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppDrawer } from './AppDrawer';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Feedback';
import { BetaBadge } from '@/components/beta/BetaBadge';
import { BetaFeedbackSheet } from '@/components/beta/BetaFeedbackSheet';
import { useSidebarCollapsed } from '@/hooks/useMediaQuery';
import { RouteSuspense } from './RouteSuspense';

const titles: Record<string, string> = {
  '/': 'common.home',
  '/search': 'common.search',
  '/matches': 'common.matches',
  '/live-matches': 'drawer.liveMatches',
  '/teams': 'common.teams',
  '/players': 'common.players',
  '/clubs': 'common.clubs',
  '/tournaments': 'common.tournaments',
  '/statistics': 'common.statistics',
  '/profile': 'common.profile',
  '/settings': 'common.settings',
  '/settings/testers': 'beta.testers',
  '/settings/feedback': 'beta.feedback',
  '/help': 'help.title',
  '/following': 'drawer.following',
  '/notifications': 'notifications.title',
};

export function AppShell() {
  const { t } = useTranslation();
  const { ready } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const { tabletUp, collapsed, toggle } = useSidebarCollapsed();
  const isHome = loc.pathname === '/';
  // Full-immersion scoring screens stay chromeless on every screen size.
  const isScoringUi = loc.pathname.includes('/score') || loc.pathname.includes('/centre') || loc.pathname.includes('/playing-xi');
  const isTournamentDetail = /^\/tournaments\/(?!new$)[^/]+$/.test(loc.pathname);
  // Full-screen forms: chromeless on mobile (unchanged), but shown inside the sidebar shell on tablet/desktop.
  const isFormPage =
    loc.pathname === '/matches/new' ||
    loc.pathname === '/clubs/register' ||
    loc.pathname === '/tournaments/new' ||
    /^\/tournaments\/[^/]+\/edit$/.test(loc.pathname) ||
    /^\/matches\/[^/]+$/.test(loc.pathname);
  const hideChrome = isScoringUi || isTournamentDetail || (isFormPage && !tabletUp);
  const titleKey = titles[loc.pathname];
  const canBack = !isHome;

  if (!ready) return <Spinner />;
  if (hideChrome) return <RouteSuspense />;

  return (
    <div className="flex min-h-dvh w-full overflow-x-clip bg-bg">
      <AppDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        collapsed={collapsed}
        onToggleCollapse={toggle}
        tabletUp={tabletUp}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader
          title={isHome ? t('common.appName') : titleKey ? t(titleKey) : undefined}
          onMenu={!tabletUp ? () => setDrawer(true) : undefined}
          menuOpen={drawer}
          onBack={canBack ? () => nav(-1) : undefined}
          showSearch={loc.pathname !== '/search'}
          onSearch={() => nav('/search')}
          end={
            <div className="flex items-center gap-1">
              <BetaBadge />
              <BetaFeedbackSheet />
            </div>
          }
        />
        <main className="mx-auto w-full min-w-0 max-w-[var(--page-max)] flex-1 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10">
          <RouteSuspense />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
