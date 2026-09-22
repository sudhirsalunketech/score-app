import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import type { Team, TossDecision } from '@/types/api';

const CONFETTI_EMOJI = ['🎉', '🎊', '✨', '⭐', '🎈'];

function makeConfetti() {
  const count = 20 + Math.floor(Math.random() * 17); // 20–36
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)],
    left: Math.random() * 100,
    dx: Math.random() * 100 - 50,
    dy: -(40 + Math.random() * 50),
    rot: Math.random() * 360 - 180,
    delay: Math.random() * 0.35,
    duration: 0.7 + Math.random() * 0.5,
  }));
}

export function TossModal({
  open,
  onClose,
  home,
  away,
  winnerId,
  decision,
  onWinner,
  onDecision,
  onStart,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  home: Team;
  away: Team;
  winnerId: string | null;
  decision: TossDecision | null;
  onWinner: (id: string) => void;
  onDecision: (d: TossDecision) => void;
  onStart: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [flipping, setFlipping] = useState(false);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<ReturnType<typeof makeConfetti>>([]);

  const pickWinner = (team: Team) => {
    onWinner(team.id);
    setCelebrateId(team.id);
    setConfetti(makeConfetti());
    window.setTimeout(() => setCelebrateId((cur) => (cur === team.id ? null : cur)), 1400);
  };

  const flipCoin = () => {
    if (flipping || busy) return;
    setFlipping(true);
    window.setTimeout(() => {
      pickWinner(Math.random() < 0.5 ? home : away);
      setFlipping(false);
    }, 900);
  };

  return (
    <Modal open={open} title={t('match.toss')} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-semibold">{t('match.whoWonToss')}</p>
        <button
          type="button"
          className="inline-flex min-h-touch shrink-0 items-center gap-2 rounded-pill border border-primary px-3 text-xs font-bold text-primary disabled:opacity-50"
          onClick={flipCoin}
          disabled={flipping || busy}
        >
          <span className="[perspective:400px]">
            <span
              aria-hidden
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-black text-dark-chrome',
                flipping && 'cs-coin-flip',
              )}
            >
              ?
            </span>
          </span>
          {flipping ? t('match.flipping') : t('match.flipCoin')}
        </button>
      </div>
      <p className="mb-3 text-xs text-text-secondary">{t('match.flipCoinHint')}</p>
      <div className="mb-2 grid grid-cols-2 gap-3">
        {[home, away].map((team) => (
          <button
            key={team.id}
            type="button"
            disabled={flipping}
            className={cn(
              'relative flex min-h-touch flex-col items-center gap-2 rounded-card border p-3 disabled:opacity-50',
              winnerId === team.id ? 'border-primary bg-primary-light' : 'border-border',
              celebrateId === team.id && 'cs-winner-pop',
            )}
            onClick={() => pickWinner(team)}
          >
            {winnerId === team.id ? (
              <span
                aria-hidden
                className="absolute -top-2 end-2 rounded-pill bg-gold px-2 py-0.5 text-[10px] font-black uppercase text-dark-chrome shadow-sm"
              >
                🏆
              </span>
            ) : null}
            {celebrateId === team.id ? (
              <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
                {confetti.map((p) => (
                  <span
                    key={p.id}
                    className="cs-confetti-particle text-sm"
                    style={
                      {
                        '--cs-confetti-left': `${p.left}%`,
                        '--cs-confetti-dx': `${p.dx}px`,
                        '--cs-confetti-dy': `${p.dy}px`,
                        '--cs-confetti-rot': `${p.rot}deg`,
                        '--cs-confetti-delay': `${p.delay}s`,
                        '--cs-confetti-duration': `${p.duration}s`,
                      } as CSSProperties
                    }
                  >
                    {p.emoji}
                  </span>
                ))}
              </span>
            ) : null}
            <Avatar name={team.name} src={team.logoUrl} kind="team" />
            <span className="text-center text-xs font-bold uppercase">{team.name}</span>
          </button>
        ))}
      </div>
      <p
        className={cn(
          'mb-5 min-h-[1.25rem] text-center text-sm font-bold text-primary transition-opacity duration-300',
          celebrateId ? 'opacity-100' : 'opacity-0',
        )}
      >
        {celebrateId ? t('match.tossWinnerAnnounce', { team: (celebrateId === home.id ? home : away).name }) : ''}
      </p>
      <p className="mb-3 font-semibold">{t('match.decidedTo')}</p>
      <div className="mb-5 grid grid-cols-2 gap-3">
        {(['BAT', 'BOWL'] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={cn(
              'min-h-touch rounded-card border font-bold',
              decision === d ? 'border-primary bg-primary text-on-dark' : 'border-border',
            )}
            onClick={() => onDecision(d)}
          >
            {d === 'BAT' ? t('match.bat') : t('match.bowl')}
          </button>
        ))}
      </div>
      <Button className="w-full" variant="primaryDark" disabled={!winnerId || !decision || busy} onClick={onStart}>
        {t('match.startScoring')}
      </Button>
    </Modal>
  );
}
