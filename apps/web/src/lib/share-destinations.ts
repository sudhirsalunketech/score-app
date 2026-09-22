import { matchShareText, tournamentShareText } from '@/lib/share-text';
import type { ShareDestination } from '@/components/share/ShareSheet';
import { publicLiveUrl, publicMatchUrl, publicTournamentUrl } from '@/lib/live';
import type { Match, PublicLiveScoreDto } from '@/types/api';

function marginLabel(match: Pick<Match, 'marginType' | 'marginValue'>): string | null {
  if (match.marginValue == null) return null;
  return `${match.marginValue} ${match.marginType === 'WICKETS' ? 'wickets' : 'runs'}`;
}

export function destinationsForMatch(match: Match): ShareDestination[] {
  const slug = match.publicSlug;
  if (!slug) return [];
  const inn = match.innings?.find((i) => i.status === 'IN_PROGRESS') ?? match.innings?.[match.innings.length - 1];
  const liveUrl = publicLiveUrl(slug);
  const centreUrl = publicMatchUrl(slug);
  const winner =
    match.resultWinnerTeamId === match.homeTeamId
      ? match.homeTeam.name
      : match.resultWinnerTeamId === match.awayTeamId
        ? match.awayTeam.name
        : null;
  const liveText = matchShareText({
    homeName: match.homeTeam.name,
    awayName: match.awayTeam.name,
    tournamentName: match.tournament?.name,
    status: match.status,
    runs: inn?.totalRuns,
    wickets: inn?.totalWickets,
    overs: inn ? `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}` : undefined,
    winnerName: winner,
    margin: marginLabel(match),
    scheduledAt: match.scheduledAt ?? null,
    venue: match.venueText,
    url: liveUrl,
  });
  const rows: ShareDestination[] = [];
  if (match.publicLiveEnabled !== false) {
    rows.push({ id: 'live', label: 'Live Score', url: liveUrl, text: liveText, title: match.title });
  }
  rows.push({
    id: 'scorecard',
    label: 'Scorecard',
    url: `${centreUrl}?tab=scorecard`,
    text: matchShareText({ ...{ homeName: match.homeTeam.name, awayName: match.awayTeam.name, status: match.status, url: `${centreUrl}?tab=scorecard`, winnerName: winner, margin: marginLabel(match) } }),
    title: match.title,
  });
  rows.push({
    id: 'centre',
    label: 'Match Centre',
    url: centreUrl,
    text: matchShareText({
      homeName: match.homeTeam.name,
      awayName: match.awayTeam.name,
      status: match.status,
      url: centreUrl,
      winnerName: winner,
      margin: marginLabel(match),
      scheduledAt: match.scheduledAt ?? null,
      venue: match.venueText,
    }),
    title: match.title,
  });
  if (match.tournament?.publicSlug) {
    const tUrl = publicTournamentUrl(match.tournament.publicSlug);
    rows.push({
      id: 'tournament',
      label: 'Tournament',
      url: tUrl,
      text: tournamentShareText({ name: match.tournament.name, season: match.tournament.season, url: tUrl }),
      title: match.tournament.name,
    });
  }
  rows.push({
    id: 'stats',
    label: 'Stats / MVP',
    url: `${centreUrl}?tab=stars`,
    text: liveText,
    title: match.title,
  });
  return rows;
}

export function destinationsForPublicLive(data: PublicLiveScoreDto): ShareDestination[] {
  const slug = data.publicSlug;
  if (!slug) return [];
  const liveUrl = publicLiveUrl(slug);
  const centreUrl = publicMatchUrl(slug);
  const winner = data.result?.winnerTeamId
    ? data.result.winnerTeamId === data.homeTeam.id
      ? data.homeTeam.name
      : data.awayTeam.name
    : null;
  const text = matchShareText({
    homeName: data.homeTeam.name,
    awayName: data.awayTeam.name,
    tournamentName: data.tournamentName,
    status: data.status,
    runs: data.score.runs,
    wickets: data.score.wickets,
    overs: data.score.overs,
    winnerName: winner,
    url: liveUrl,
    scheduledAt: data.scheduledAt,
    venue: data.venueText,
  });
  const rows: ShareDestination[] = [{ id: 'live', label: 'Live Score', url: liveUrl, text, title: data.title }];
  if (data.share?.scorecard !== false) {
    rows.push({ id: 'scorecard', label: 'Scorecard', url: `${centreUrl}?tab=scorecard`, text, title: data.title });
  }
  rows.push({ id: 'centre', label: 'Match Centre', url: centreUrl, text, title: data.title });
  if (data.tournamentSlug) {
    const tUrl = publicTournamentUrl(data.tournamentSlug);
    rows.push({
      id: 'tournament',
      label: 'Tournament',
      url: tUrl,
      text: tournamentShareText({ name: data.tournamentName ?? 'Tournament', url: tUrl }),
      title: data.tournamentName ?? 'Tournament',
    });
  }
  if (data.share?.mvp !== false || data.share?.stats !== false) {
    rows.push({ id: 'stats', label: 'Stats / MVP', url: `${centreUrl}?tab=stars`, text, title: data.title });
  }
  return rows;
}
