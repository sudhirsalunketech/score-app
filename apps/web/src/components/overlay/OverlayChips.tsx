import { chipKind, chipLabel } from '@/lib/overlay-model';
import type { PublicBallDto } from '@/types/api';

export function OverlayChip({ ball }: { ball: PublicBallDto }) {
  return <span className={`cs-ov-chip cs-ov-chip-${chipKind(ball)}`}>{chipLabel(ball)}</span>;
}

export function OverlayChipRow({ balls }: { balls: PublicBallDto[] }) {
  if (!balls.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {balls.map((ball) => (
        <OverlayChip key={ball.sequence} ball={ball} />
      ))}
    </div>
  );
}
