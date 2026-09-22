import { useTranslation } from 'react-i18next';

export function JerseyWatermark({ jerseyNo }: { jerseyNo: number | null | undefined }) {
  const { t } = useTranslation();
  if (jerseyNo == null) return null;
  return (
    <div className="mt-7 flex w-full flex-col items-center overflow-hidden pb-2">
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">{t('profile.jerseyNo')}</p>
      <p className="-mt-3 select-none text-[8rem] font-black leading-none tabular-nums text-text-secondary/10">{jerseyNo}</p>
    </div>
  );
}
