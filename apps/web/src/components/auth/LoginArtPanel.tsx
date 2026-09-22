import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconLeatherBall } from '@/components/ui/Icons';
import { BetaBadge } from '@/components/beta/BetaBadge';

/** One floating illustration tile, matching the reference design's scattered-photo layout. */
function Tile({ label, className, aspect = 'aspect-[4/3]', children }: { label: string; className: string; aspect?: string; children: ReactNode }) {
  return (
    <figure className={`absolute w-40 rounded-card-lg bg-bg p-2.5 shadow-[0_18px_30px_-14px_rgba(0,0,0,0.55)] xl:w-48 ${className}`}>
      <figcaption className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</figcaption>
      <div className={`overflow-hidden rounded-lg ${aspect}`}>{children}</div>
    </figure>
  );
}

export function LoginArtPanel() {
  const { t } = useTranslation();

  return (
    <aside className="relative hidden overflow-hidden bg-dark-chrome px-10 py-10 lg:flex lg:w-[44%] lg:flex-none lg:flex-col lg:justify-between xl:px-14 xl:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(55% 45% at 18% 10%, rgba(0,137,123,0.28), transparent 60%), radial-gradient(45% 40% at 88% 18%, rgba(253,192,47,0.16), transparent 60%)',
        }}
      />
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
        <ellipse cx="300" cy="360" rx="230" ry="300" fill="none" stroke="#a5d6d1" strokeWidth="1.5" />
        <rect x="278" y="210" width="44" height="300" fill="none" stroke="#a5d6d1" strokeWidth="1.5" />
        <line x1="278" y1="235" x2="322" y2="235" stroke="#a5d6d1" strokeWidth="1.5" />
        <line x1="278" y1="485" x2="322" y2="485" stroke="#a5d6d1" strokeWidth="1.5" />
      </svg>

      <div className="relative z-10 flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-on-dark/10">
          <IconLeatherBall size={20} />
        </span>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-semibold tracking-wide text-on-dark">{t('common.appName')}</span>
            <BetaBadge />
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-on-dark/55">Admin panel</span>
        </div>
      </div>

      <div className="relative z-10 h-[360px] xl:h-[420px]">
        <Tile label="Pitch map" className="left-0 top-0 rotate-[-4deg]">
          <svg viewBox="0 0 160 120" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
            <rect width="160" height="120" fill="#00897b" />
            <ellipse cx="80" cy="60" rx="70" ry="52" fill="none" stroke="#e0f2f0" strokeWidth="2" />
            <rect x="70" y="14" width="20" height="92" fill="#00695c" stroke="#e0f2f0" strokeWidth="1.5" />
            <line x1="70" y1="26" x2="90" y2="26" stroke="#e0f2f0" strokeWidth="1.5" />
            <line x1="70" y1="94" x2="90" y2="94" stroke="#e0f2f0" strokeWidth="1.5" />
            <circle cx="80" cy="60" r="4" fill="#fdc02f" />
          </svg>
        </Tile>

        <Tile label="Wagon wheel" className="left-[36%] top-[2%] rotate-[3deg]" aspect="aspect-square">
          <svg viewBox="0 0 120 120" className="h-full w-full">
            <rect width="120" height="120" fill="#0f1720" />
            <circle cx="60" cy="60" r="46" fill="none" stroke="#2a3540" strokeWidth="1.5" />
            <g stroke="#fdc02f" strokeWidth="2.5" strokeLinecap="round">
              <line x1="60" y1="60" x2="60" y2="18" />
              <line x1="60" y1="60" x2="96" y2="32" />
              <line x1="60" y1="60" x2="100" y2="66" />
            </g>
            <g stroke="#00897b" strokeWidth="2.5" strokeLinecap="round">
              <line x1="60" y1="60" x2="30" y2="24" />
              <line x1="60" y1="60" x2="20" y2="70" />
              <line x1="60" y1="60" x2="40" y2="98" />
            </g>
            <circle cx="60" cy="60" r="4" fill="#fff" />
          </svg>
        </Tile>

        <Tile label="Live score" className="right-0 top-[10%] w-44 rotate-[-3deg] xl:w-52" aspect="aspect-[5/3]">
          <svg viewBox="0 0 200 120" className="h-full w-full">
            <rect width="200" height="120" fill="#1c232b" />
            <text x="16" y="56" fontFamily="Teko, sans-serif" fontSize="46" fontWeight="600" fill="#fdc02f">182/4</text>
            <text x="16" y="78" fontFamily="Inter, sans-serif" fontSize="13" fill="#a5d6d1">OV 18.3 · RR 9.92</text>
            <circle cx="182" cy="20" r="4" fill="#e53935" className="cs-live-dot" />
            <text x="172" y="24" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" fill="#e53935" textAnchor="end">LIVE</text>
          </svg>
        </Tile>

        <Tile label="Boundary" className="bottom-[8%] left-[2%] w-32 rotate-[5deg] xl:w-36" aspect="aspect-square">
          <svg viewBox="0 0 120 120" className="h-full w-full">
            <rect width="120" height="120" fill="#00695c" />
            <path d="M20 90 Q46 40 96 26" fill="none" stroke="#fdc02f" strokeWidth="2" strokeDasharray="4 5" opacity="0.8" />
            <circle cx="96" cy="26" r="12" fill="#B71C1C" stroke="#7F1010" strokeWidth="1" />
            <path d="M92 19c1.5 3 1.5 6 0 9M100 19c-1.5 3-1.5 6 0 9" fill="none" stroke="#fff" strokeWidth="1.1" />
            <text x="60" y="110" textAnchor="middle" fontFamily="Teko, sans-serif" fontSize="22" fontWeight="600" fill="#fdc02f">FOUR!</text>
          </svg>
        </Tile>

        <Tile label="The worm" className="bottom-0 left-[32%] w-44 rotate-[-5deg] xl:w-52" aspect="aspect-[5/3]">
          <svg viewBox="0 0 200 120" className="h-full w-full">
            <rect width="200" height="120" fill="#f8fafc" />
            <g stroke="#e5e7eb" strokeWidth="1">
              <line x1="10" y1="30" x2="190" y2="30" />
              <line x1="10" y1="60" x2="190" y2="60" />
              <line x1="10" y1="90" x2="190" y2="90" />
            </g>
            <polyline points="10,95 45,80 80,70 115,45 150,38 190,18" fill="none" stroke="#00897b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="10,100 45,92 80,78 115,68 150,58 190,50" fill="none" stroke="#ff9800" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Tile>
      </div>

      <div className="relative z-10 max-w-xs">
        <p className="font-display text-5xl font-semibold leading-none text-on-dark xl:text-6xl">{t('auth.welcome')}</p>
        <p className="mt-3 text-sm text-gold">{t('common.appName')} turns every over into a live scorecard, wagon wheel and worm graph your team can follow in real time.</p>
      </div>
    </aside>
  );
}
