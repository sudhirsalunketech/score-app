import { useTranslation } from 'react-i18next';

export function PlayerAwardsCard({ playerOfMatchCount }: { playerOfMatchCount: number }) {
  const { t } = useTranslation();
  if (!playerOfMatchCount) return null;
  return (
    <section className="mt-6 w-full">
      <h2 className="text-sm font-bold">{t('profile.awards')}</h2>
      <div className="mt-2 flex gap-3 overflow-x-auto">
        <div className="flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-card-lg bg-dark-chrome px-3 py-4 text-center text-on-dark">
          <p className="text-3xl font-bold tabular-nums">{playerOfMatchCount}</p>
          <span className="h-px w-6 bg-on-dark/25" />
          <p className="text-[11px] font-semibold leading-tight text-on-dark/80">{t('profile.playerOfTheMatch')}</p>
        </div>
      </div>
    </section>
  );
}
