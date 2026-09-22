import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AuthGuard, GuestOnly } from '@/components/layout/AuthGuard';
import { MatchPermissionGate, TournamentPermissionGate } from '@/components/layout/PermissionGate';
import { RouteSuspense } from '@/components/layout/RouteSuspense';

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPage = lazy(() => import('@/pages/ForgotPage').then((m) => ({ default: m.ForgotPage })));
const ResetPasswordPage = lazy(() =>
  import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const InviteAcceptPage = lazy(() =>
  import('@/pages/InviteAcceptPage').then((m) => ({ default: m.InviteAcceptPage })),
);
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const MatchesPage = lazy(() => import('@/pages/MatchesPage').then((m) => ({ default: m.MatchesPage })));
const OpenMatchPage = lazy(() => import('@/pages/OpenMatchPage').then((m) => ({ default: m.OpenMatchPage })));
const MyMatchesPage = lazy(() => import('@/pages/MyMatchesPage').then((m) => ({ default: m.MyMatchesPage })));
const MyTeamsPage = lazy(() => import('@/pages/MyTeamsPage').then((m) => ({ default: m.MyTeamsPage })));
const MyTournamentsPage = lazy(() => import('@/pages/MyTournamentsPage').then((m) => ({ default: m.MyTournamentsPage })));
const MatchPlayerPerformancePage = lazy(() =>
  import('@/pages/MatchPlayerPerformancePage').then((m) => ({ default: m.MatchPlayerPerformancePage })),
);
const PlayingXIPage = lazy(() => import('@/pages/PlayingXIPage').then((m) => ({ default: m.PlayingXIPage })));
const BroadcastControlPage = lazy(() =>
  import('@/pages/BroadcastControlPage').then((m) => ({ default: m.BroadcastControlPage })),
);
const MatchCentrePage = lazy(() =>
  import('@/pages/MatchCentrePage').then((m) => ({ default: m.MatchCentrePage })),
);
const MatchCentreSummaryPage = lazy(() =>
  import('@/pages/MatchCentreSummaryPage').then((m) => ({ default: m.MatchCentreSummaryPage })),
);
const TeamsPage = lazy(() => import('@/pages/TeamsPage').then((m) => ({ default: m.TeamsPage })));
const TeamDetailPage = lazy(() => import('@/pages/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage })));
const PlayersPage = lazy(() => import('@/pages/PlayersPage').then((m) => ({ default: m.PlayersPage })));
const PlayerDetailPage = lazy(() =>
  import('@/pages/PlayerDetailPage').then((m) => ({ default: m.PlayerDetailPage })),
);
const ClubsPage = lazy(() => import('@/pages/ClubsPage').then((m) => ({ default: m.ClubsPage })));
const ClubDetailPage = lazy(() => import('@/pages/ClubDetailPage').then((m) => ({ default: m.ClubDetailPage })));
const RegisterClubPage = lazy(() =>
  import('@/pages/RegisterClubPage').then((m) => ({ default: m.RegisterClubPage })),
);
const TournamentsPage = lazy(() =>
  import('@/pages/TournamentsPage').then((m) => ({ default: m.TournamentsPage })),
);
const CreateTournamentPage = lazy(() =>
  import('@/pages/CreateTournamentPage').then((m) => ({ default: m.CreateTournamentPage })),
);
const EditTournamentPage = lazy(() =>
  import('@/pages/EditTournamentPage').then((m) => ({ default: m.EditTournamentPage })),
);
const TournamentDetailPage = lazy(() =>
  import('@/pages/TournamentDetailPage').then((m) => ({ default: m.TournamentDetailPage })),
);
const TournamentPlayerPage = lazy(() =>
  import('@/pages/TournamentPlayerPage').then((m) => ({ default: m.TournamentPlayerPage })),
);
const TournamentTeamPage = lazy(() =>
  import('@/pages/TournamentTeamPage').then((m) => ({ default: m.TournamentTeamPage })),
);
const FanQuizPage = lazy(() => import('@/pages/FanQuizPage').then((m) => ({ default: m.FanQuizPage })));
const TournamentRulesPage = lazy(() =>
  import('@/pages/TournamentRulesPage').then((m) => ({ default: m.TournamentRulesPage })),
);
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage').then((m) => ({ default: m.StatisticsPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const SearchPage = lazy(() => import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const FollowingPage = lazy(() => import('@/pages/FollowingPage').then((m) => ({ default: m.FollowingPage })));
const PublicLivePage = lazy(() => import('@/pages/PublicLivePage').then((m) => ({ default: m.PublicLivePage })));
const PublicTournamentPage = lazy(() =>
  import('@/pages/PublicTournamentPage').then((m) => ({ default: m.PublicTournamentPage })),
);
const LiveOverlayPage = lazy(() =>
  import('@/pages/LiveOverlayPage').then((m) => ({ default: m.LiveOverlayPage })),
);
const MatchAccessPage = lazy(() =>
  import('@/pages/MatchAccessPage').then((m) => ({ default: m.MatchAccessPage })),
);
const TournamentAccessPage = lazy(() =>
  import('@/pages/MatchAccessPage').then((m) => ({ default: m.TournamentAccessPage })),
);
const EditScorecardPage = lazy(() =>
  import('@/pages/EditScorecardPage').then((m) => ({ default: m.EditScorecardPage })),
);
const OverRulesPage = lazy(() => import('@/pages/OverRulesPage').then((m) => ({ default: m.OverRulesPage })));
const AccessManagementPage = lazy(() =>
  import('@/pages/AccessManagementPage').then((m) => ({ default: m.AccessManagementPage })),
);
const BetaTestersPage = lazy(() =>
  import('@/pages/BetaTestersPage').then((m) => ({ default: m.BetaTestersPage })),
);
const BetaFeedbackAdminPage = lazy(() =>
  import('@/pages/BetaFeedbackAdminPage').then((m) => ({ default: m.BetaFeedbackAdminPage })),
);
const HelpPage = lazy(() => import('@/pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const FanQuestionPage = lazy(() =>
  import('@/pages/FanQuestionPage').then((m) => ({ default: m.FanQuestionPage })),
);
const FanAdminPage = lazy(() => import('@/pages/FanAdminPage').then((m) => ({ default: m.FanAdminPage })));
const MatchFanPage = lazy(() => import('@/pages/MatchFanPage').then((m) => ({ default: m.MatchFanPage })));
const TournamentFanPage = lazy(() =>
  import('@/pages/MatchFanPage').then((m) => ({ default: m.TournamentFanPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<RouteSuspense fallback={null} />}>
        <Route path="/live/match/:slug/overlay" element={<LiveOverlayPage />} />
      </Route>
      <Route element={<RouteSuspense />}>
        <Route path="/live/match/:slug" element={<PublicLivePage />} />
        <Route path="/live/:slug" element={<PublicLivePage />} />
        <Route path="/match/:slug" element={<PublicLivePage />} />
        <Route path="/tournament/:slug" element={<PublicTournamentPage />} />
        <Route path="/matches/:id/centre" element={<MatchCentreSummaryPage />} />
        <Route path="/matches/:id/quiz" element={<FanQuizPage scope="match" />} />
        <Route path="/tournaments/:id/quiz" element={<FanQuizPage scope="tournament" />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/fan/questions/:id" element={<FanQuestionPage />} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/reset" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:id/player/:playerId" element={<MatchPlayerPerformancePage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route path="/players/:id" element={<PlayerDetailPage />} />
        <Route path="/clubs" element={<ClubsPage />} />
        <Route path="/clubs/:id" element={<ClubDetailPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/matches/new" element={<OpenMatchPage />} />
        <Route element={<AuthGuard />}>
          <Route path="/live-matches" element={<MatchesPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route
            path="/matches/:id"
            element={
              <MatchPermissionGate permission="MATCH_EDIT">
                <OpenMatchPage />
              </MatchPermissionGate>
            }
          />
          <Route path="/matches/:id/playing-xi" element={<PlayingXIPage />} />
          <Route
            path="/matches/:id/broadcast"
            element={
              <MatchPermissionGate permission="MATCH_SHARE">
                <BroadcastControlPage />
              </MatchPermissionGate>
            }
          />
          <Route
            path="/matches/:id/access"
            element={
              <MatchPermissionGate permission="USER_MANAGE_ACCESS">
                <MatchAccessPage />
              </MatchPermissionGate>
            }
          />
          <Route
            path="/matches/:id/edit-scorecard"
            element={
              <MatchPermissionGate permission="MATCH_CORRECT_BALL">
                <EditScorecardPage />
              </MatchPermissionGate>
            }
          />
          <Route
            path="/matches/:id/over-rules"
            element={
              <MatchPermissionGate permission="MATCH_EDIT">
                <OverRulesPage />
              </MatchPermissionGate>
            }
          />
          <Route
            path="/tournaments/:id/access"
            element={
              <TournamentPermissionGate permission="USER_MANAGE_ACCESS">
                <TournamentAccessPage />
              </TournamentPermissionGate>
            }
          />
          <Route path="/tournaments/new" element={<CreateTournamentPage />} />
          <Route
            path="/tournaments/:id/edit"
            element={
              <TournamentPermissionGate permission="TOURNAMENT_EDIT">
                <EditTournamentPage />
              </TournamentPermissionGate>
            }
          />
          <Route path="/clubs/register" element={<RegisterClubPage />} />
          <Route
            path="/tournaments/:id/rules"
            element={
              <TournamentPermissionGate permission="TOURNAMENT_VIEW">
                <TournamentRulesPage />
              </TournamentPermissionGate>
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-matches" element={<MyMatchesPage />} />
          <Route path="/my-teams" element={<MyTeamsPage />} />
          <Route path="/my-tournaments" element={<MyTournamentsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/access" element={<AccessManagementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/testers" element={<BetaTestersPage />} />
          <Route path="/settings/feedback" element={<BetaFeedbackAdminPage />} />
          <Route
            path="/matches/:id/fan/admin"
            element={
              <MatchPermissionGate permission="FAN_MANAGE">
                <FanAdminPage scope="match" />
              </MatchPermissionGate>
            }
          />
          <Route
            path="/tournaments/:id/fan/admin"
            element={
              <TournamentPermissionGate permission="FAN_MANAGE">
                <FanAdminPage scope="tournament" />
              </TournamentPermissionGate>
            }
          />
          <Route path="/following" element={<FollowingPage />} />
        </Route>
        <Route path="/matches/:id/fan" element={<MatchFanPage />} />
        <Route path="/tournaments/:id/fan" element={<TournamentFanPage />} />
        <Route path="/tournaments/:id/players/:playerId" element={<TournamentPlayerPage />} />
        <Route path="/tournaments/:id/teams/:teamId" element={<TournamentTeamPage />} />
        <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route
          path="/matches/:id/score"
          element={
            <MatchPermissionGate permission="MATCH_SCORE">
              <MatchCentrePage />
            </MatchPermissionGate>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
