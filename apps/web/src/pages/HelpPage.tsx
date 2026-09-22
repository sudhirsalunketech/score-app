import { useTranslation } from 'react-i18next';

export function HelpPage() {
  const { t } = useTranslation();
  const sections = [
    { title: t('help.scoringTitle'), body: t('help.scoringBody') },
    { title: t('help.offlineTitle'), body: t('help.offlineBody') },
    { title: t('help.liveTitle'), body: t('help.liveBody') },
    { title: t('help.rolesTitle'), body: t('help.rolesBody') },
  ];
  return (
    <div className="mx-auto max-w-2xl px-[var(--gutter)] py-6">
      <h1 className="mb-4 text-xl font-bold">{t('help.title')}</h1>
      <div className="flex flex-col gap-5">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">{section.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-text">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
