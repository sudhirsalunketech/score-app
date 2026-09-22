import { useParams } from 'react-router-dom';
import { FanZone } from '@/components/fans/FanZone';

export function MatchFanPage() {
  const { id = '' } = useParams();
  return (
    <div className="mx-auto max-w-lg">
      <FanZone matchId={id} />
    </div>
  );
}

export function TournamentFanPage() {
  const { id = '' } = useParams();
  return (
    <div className="mx-auto max-w-lg">
      <FanZone tournamentId={id} initialTab="predict" />
    </div>
  );
}
