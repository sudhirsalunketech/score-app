export function playerRoleLabel(role: string | null | undefined): 'batter' | 'bowler' | 'allRounder' | 'wk' {
  const raw = (role ?? '').toUpperCase().replace(/[\s-]/g, '_');
  if (raw === 'BOWLER') return 'bowler';
  if (raw === 'ALL_ROUNDER' || raw === 'ALLROUNDER') return 'allRounder';
  if (raw === 'WICKET_KEEPER' || raw === 'WK' || raw === 'KEEPER') return 'wk';
  return 'batter';
}

export function resultHeadline(input: {
  resultType?: string | null;
  winnerName?: string | null;
  marginType?: string | null;
  marginValue?: number | null;
  labels: {
    completed: string;
    wonBy: string;
    runs: string;
    wickets: string;
    tie: string;
    noResult: string;
    abandoned: string;
    draw?: string;
    innings?: string;
    wonByInnings?: string;
  };
}): string {
  if (input.resultType === 'DRAW') return input.labels.draw ?? input.labels.completed;
  if (input.resultType === 'TIE') return input.labels.tie;
  if (input.resultType === 'NO_RESULT') return input.labels.noResult;
  if (input.resultType === 'ABANDONED') return input.labels.abandoned;
  if (input.resultType === 'WIN' && input.winnerName) {
    const margin = input.marginValue ?? 0;
    if (input.marginType === 'INNINGS') {
      const template = input.labels.wonByInnings ?? `${input.labels.wonBy} an ${input.labels.innings ?? 'innings'} and {{runs}} ${input.labels.runs}`;
      return `${input.winnerName} ${template.replace('{{runs}}', String(margin))}`.trim();
    }
    const unit = input.marginType === 'WICKETS' ? input.labels.wickets : input.labels.runs;
    return `${input.winnerName} ${input.labels.wonBy} ${margin} ${unit}`.trim();
  }
  return input.labels.completed;
}

export function shareResultText(input: {
  title: string;
  homeName: string;
  awayName: string;
  homeScore: string;
  awayScore: string;
  headline: string;
  url: string;
}): string {
  return [input.title, `${input.homeName} ${input.homeScore}`, `${input.awayName} ${input.awayScore}`, input.headline, input.url]
    .filter(Boolean)
    .join('\n');
}
