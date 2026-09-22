import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconInfo } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { PopupHeader } from '@/components/ui/PopupHeader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

export type InfoSection = { heading: string; body: string };

type Props = {
  topic: string;
  title?: string;
  children?: ReactNode;
  sections?: InfoSection[];
  dark?: boolean;
  compact?: boolean;
  className?: string;
};

type Pos = { top: number; left: number; place: 'above' | 'below' };

export function InfoTooltip({ topic, title, children, sections, dark, compact, className }: Props) {
  const { t } = useTranslation();
  const hoverDesktop = useMediaQuery('(hover: hover) and (min-width: 768px)');
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const isPanel = Boolean(sections?.length);
  const showTip = !isPanel && hoverDesktop && (hover || open);
  const showSheet = isPanel ? open : !hoverDesktop && open;
  const heading = title ?? (isPanel ? t('info.heading') : topic);
  const label = t('info.about', { topic });

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const above = r.top > 140;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setPos({
      place: above ? 'above' : 'below',
      left,
      top: above ? r.top - 8 : r.bottom + 8,
    });
  };

  useEffect(() => {
    if (!showTip && !showSheet) return;
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [showTip, showSheet]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <span className={cn('relative inline-flex align-middle', className)}>
      <button
        ref={btnRef}
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-full text-current',
          compact ? 'min-h-8 min-w-8 md:min-h-[22px] md:min-w-[22px]' : 'min-h-touch min-w-touch md:min-h-7 md:min-w-7',
          dark ? 'text-gold/80 hover:text-gold' : 'text-text-secondary hover:text-text',
        )}
        aria-label={label}
        aria-expanded={open || hover}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => hoverDesktop && setHover(true)}
        onMouseLeave={() => hoverDesktop && setHover(false)}
        onFocus={() => hoverDesktop && setHover(true)}
        onBlur={(e) => {
          if (tipRef.current?.contains(e.relatedTarget as Node)) return;
          setHover(false);
        }}
      >
        <IconInfo className="h-[18px] w-[18px] md:h-4 md:w-4" />
      </button>
      {showTip && pos
        ? createPortal(
            <div
              ref={tipRef}
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-[1200] max-w-[300px] rounded-lg bg-dark-chrome px-3 py-2 text-start text-sm leading-snug text-on-dark shadow-lg"
              style={{
                top: pos.place === 'above' ? undefined : pos.top,
                bottom: pos.place === 'above' ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: Math.min(300, window.innerWidth - 24),
              }}
            >
              {title ? <p className="mb-1 font-semibold">{title}</p> : null}
              <div>{children}</div>
            </div>,
            document.body,
          )
        : null}
      {showSheet
        ? createPortal(
            <div
              className={cn(
                'fixed inset-0 z-[1200] flex justify-center',
                isPanel ? 'items-center p-5' : 'items-end sm:items-center sm:p-4',
              )}
            >
              <button type="button" className="absolute inset-0 bg-black/50" aria-label={t('common.close')} onClick={() => setOpen(false)} />
              <div
                ref={tipRef}
                id={id}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                className={cn(
                  'relative z-10 w-full max-w-md shadow-xl',
                  isPanel
                    ? 'rounded-xl bg-dark-chrome p-5 text-on-dark'
                    : 'rounded-t-card-lg bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-text sm:rounded-card-lg',
                )}
              >
                <PopupHeader title={heading} titleId={`${id}-title`} onClose={() => setOpen(false)} dark={isPanel} />
                {isPanel ? <div className="mt-2 border-t border-white/15" /> : null}
                <div className={cn(isPanel ? 'mt-4' : 'mt-2 text-sm leading-relaxed text-text-secondary')}>
                  {isPanel && sections?.length ? <InfoPanelSections sections={sections} /> : children}
                </div>
                <Button
                  type="button"
                  variant={isPanel ? 'gold' : 'primaryDark'}
                  className="mt-4 w-full"
                  onClick={() => setOpen(false)}
                >
                  {t('info.gotIt')}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function InfoPanelSections({ sections }: { sections: InfoSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="font-bold text-gold">{section.heading}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/80">{section.body}</p>
        </div>
      ))}
    </div>
  );
}

const HOME_INFO_KIND = ['club', 'tournament', 'team', 'match'] as const;
export type HomeInfoKind = (typeof HOME_INFO_KIND)[number];

const HOME_INFO_TOPIC: Record<HomeInfoKind, string> = {
  club: 'common.clubs',
  tournament: 'common.tournaments',
  team: 'common.teams',
  match: 'common.matches',
};

export function HomeSectionInfo({ kind }: { kind: HomeInfoKind }) {
  const { t } = useTranslation();
  return (
    <InfoTooltip
      topic={t(HOME_INFO_TOPIC[kind])}
      title={t('info.heading')}
      compact
      sections={[
        { heading: t(`info.home.${kind}Feature`), body: t(`info.home.${kind}FeatureBody`) },
        { heading: t(`info.home.${kind}Create`), body: t(`info.home.${kind}CreateBody`) },
      ]}
    />
  );
}

export function LabelWithInfo({
  label,
  info,
  requiredMark,
  dark,
  htmlFor,
}: {
  label: string;
  info?: string;
  requiredMark?: boolean;
  dark?: boolean;
  htmlFor?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <label htmlFor={htmlFor} className={cn('text-sm font-semibold', dark ? 'text-gold' : 'text-text-secondary')}>
        {label}
        {requiredMark ? <span className="text-danger"> *</span> : null}
      </label>
      {info ? (
        <InfoTooltip topic={label} dark={dark}>
          {info}
        </InfoTooltip>
      ) : null}
    </span>
  );
}
