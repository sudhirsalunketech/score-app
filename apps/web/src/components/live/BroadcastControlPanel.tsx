import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { overlayLiveUrl } from '@/lib/live';
import { defaultPublicBroadcast, OVERLAY_SCENES, type OverlayMode, type OverlayScene, type OverlayTheme } from '@/lib/overlay-model';
import type { Match, OverlaySponsorPosition, PublicBroadcastDto } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const MODES: OverlayMode[] = ['full', 'standard', 'compact', 'minimal'];
const THEMES: OverlayTheme[] = ['classic', 'dark', 'transparent'];
const POSITIONS: OverlaySponsorPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const SCENES_LIST: OverlayScene[] = OVERLAY_SCENES.filter((s) => s !== 'score');

function broadcastFromMatch(match: Match): PublicBroadcastDto {
  const raw = match.settings && typeof match.settings === 'object' ? (match.settings.broadcast as PublicBroadcastDto | undefined) : undefined;
  const base = defaultPublicBroadcast(raw?.mode ?? 'standard');
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    animations: { ...base.animations, ...raw.animations },
    panels: { ...base.panels, ...raw.panels },
    sponsor: raw.sponsor ?? null,
  };
}

export function BroadcastControlPanel({
  match,
  onSave,
  saving,
}: {
  match: Match;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  saving?: boolean;
}) {
  const { t } = useTranslation();
  const initial = useMemo(() => broadcastFromMatch(match), [match]);
  const [mode, setMode] = useState<OverlayMode>(initial.mode);
  const [theme, setTheme] = useState<OverlayTheme>(initial.theme);
  const [four, setFour] = useState(initial.animations.four);
  const [six, setSix] = useState(initial.animations.six);
  const [wicket, setWicket] = useState(initial.animations.wicket);
  const [currentOver, setCurrentOver] = useState(initial.panels.currentOver);
  const [batters, setBatters] = useState(initial.panels.batters);
  const [bowler, setBowler] = useState(initial.panels.bowler);
  const [partnership, setPartnership] = useState(initial.panels.partnership);
  const [recentOvers, setRecent] = useState(initial.panels.recentOvers);
  const [projected, setProjected] = useState(initial.panels.projected);
  const [header, setHeader] = useState(initial.header);
  const [tournamentLogo, setTournamentLogo] = useState(initial.tournamentLogo);
  const [sponsorOn, setSponsorOn] = useState(Boolean(initial.sponsor));
  const [sponsorName, setSponsorName] = useState(initial.sponsor?.name ?? '');
  const [sponsorLogo, setSponsorLogo] = useState(initial.sponsor?.logoUrl ?? '');
  const [sponsorUrl, setSponsorUrl] = useState(initial.sponsor?.url ?? '');
  const [sponsorPos, setSponsorPos] = useState<OverlaySponsorPosition>(initial.sponsor?.position ?? 'top-right');
  const [copied, setCopied] = useState(false);
  const [copiedScene, setCopiedScene] = useState<OverlayScene | null>(null);

  const broadcast: PublicBroadcastDto = {
    theme,
    mode,
    header,
    tournamentLogo,
    sponsor: sponsorOn && (sponsorName.trim() || sponsorLogo.trim())
      ? {
          name: sponsorName.trim() || null,
          logoUrl: sponsorLogo.trim() || null,
          url: sponsorUrl.trim() || null,
          position: sponsorPos,
        }
      : null,
    animations: { four, six, wicket },
    panels: {
      currentOver,
      batters,
      bowler,
      partnership,
      recentOvers,
      moments: mode === 'full',
      projected,
    },
  };
  const overlayHref = match.publicSlug ? overlayLiveUrl(match.publicSlug) : '';

  const copy = async () => {
    if (!overlayHref) return;
    await navigator.clipboard.writeText(overlayHref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const copyScene = async (scene: OverlayScene) => {
    if (!match.publicSlug) return;
    await navigator.clipboard.writeText(overlayLiveUrl(match.publicSlug, `?scene=${scene}`));
    setCopiedScene(scene);
    window.setTimeout(() => setCopiedScene(null), 1600);
  };

  return (
    <section className="mt-8 rounded-card border border-border p-4">
      <h2 className="mb-1 text-sm font-bold uppercase text-text-secondary">{t('overlay.broadcast')}</h2>
      <p className="mb-4 text-xs text-text-secondary">{t('overlay.obsIntro')}</p>

      {overlayHref ? (
        <>
          <p className="mb-1 text-xs font-bold uppercase text-text-secondary">{t('overlay.youtubeOverlay')}</p>
          <p className="mb-2 break-all rounded-md bg-muted px-3 py-2 text-xs">{overlayHref}</p>
          <Button type="button" variant="primaryDark" className="w-full" onClick={() => void copy()}>
            {copied ? t('live.copied') : t('overlay.copyUrl')}
          </Button>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-text-secondary">
            <li>{t('overlay.obs1')}</li>
            <li>{t('overlay.obs2')}</li>
            <li>{t('overlay.obs3')}</li>
            <li>{t('overlay.obs4')}</li>
            <li>{t('overlay.obs5')}</li>
            <li>{t('overlay.obs6')}</li>
            <li>{t('overlay.obs7')}</li>
            <li>{t('overlay.obs8')}</li>
            <li>{t('overlay.obs720')}</li>
          </ol>

          <p className="mb-2 mt-6 text-xs font-bold uppercase text-text-secondary">{t('overlay.scenes')}</p>
          <p className="mb-3 text-xs text-text-secondary">{t('overlay.scenesHint')}</p>
          <div className="flex flex-col gap-2">
            {SCENES_LIST.map((scene) => (
              <div key={scene} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="text-sm font-semibold">{t(`overlay.sceneNames.${scene}`)}</span>
                <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => void copyScene(scene)}>
                  {copiedScene === scene ? t('live.copied') : t('overlay.copyUrl')}
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-secondary">{t('overlay.enableLiveFirst')}</p>
      )}

      <p className="mb-2 mt-6 text-xs font-bold uppercase text-text-secondary">{t('overlay.mode')}</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`min-h-10 rounded-md border px-3 text-sm font-semibold capitalize ${mode === m ? 'border-primary bg-hero text-primary' : 'border-border'}`}
            onClick={() => setMode(m)}
          >
            {t(`overlay.modes.${m}`)}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-bold uppercase text-text-secondary">{t('overlay.theme')}</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {THEMES.map((th) => (
          <button
            key={th}
            type="button"
            className={`min-h-10 rounded-md border px-3 text-sm font-semibold capitalize ${theme === th ? 'border-primary bg-hero text-primary' : 'border-border'}`}
            onClick={() => setTheme(th)}
          >
            {t(`overlay.themes.${th}`)}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-bold uppercase text-text-secondary">{t('overlay.animations')}</p>
      <CheckRow label={t('overlay.four')} on={four} onToggle={setFour} />
      <CheckRow label={t('overlay.six')} on={six} onToggle={setSix} />
      <CheckRow label={t('overlay.wicket')} on={wicket} onToggle={setWicket} />

      <p className="mb-2 mt-4 text-xs font-bold uppercase text-text-secondary">{t('overlay.show')}</p>
      <CheckRow label={t('overlay.currentOver')} on={currentOver} onToggle={setCurrentOver} />
      <CheckRow label={t('overlay.batters')} on={batters} onToggle={setBatters} />
      <CheckRow label={t('overlay.bowler')} on={bowler} onToggle={setBowler} />
      <CheckRow label={t('overlay.partnership')} on={partnership} onToggle={setPartnership} />
      <CheckRow label={t('overlay.recentOvers')} on={recentOvers} onToggle={setRecent} />
      <CheckRow label={t('overlay.projected')} on={projected} onToggle={setProjected} />
      <CheckRow label={t('overlay.vsHeader')} on={header} onToggle={setHeader} />
      <CheckRow label={t('overlay.tournamentBrand')} on={tournamentLogo} onToggle={setTournamentLogo} />
      <CheckRow label={t('overlay.sponsor')} on={sponsorOn} onToggle={setSponsorOn} />

      {sponsorOn ? (
        <div className="mt-3 space-y-3">
          <Input label={t('overlay.sponsorName')} value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} underline />
          <Input label={t('overlay.sponsorLogo')} value={sponsorLogo} onChange={(e) => setSponsorLogo(e.target.value)} underline placeholder="https://" />
          <Input label={t('overlay.sponsorUrl')} value={sponsorUrl} onChange={(e) => setSponsorUrl(e.target.value)} underline placeholder="https://" />
          <label className="block text-sm">
            <span className="text-text-secondary">{t('overlay.sponsorPosition')}</span>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2"
              value={sponsorPos}
              onChange={(e) => setSponsorPos(e.target.value as OverlaySponsorPosition)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`overlay.positions.${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <Button
        type="button"
        variant="primaryDark"
        className="mt-4 w-full"
        disabled={saving}
        onClick={() => void onSave({ settings: { broadcast } })}
      >
        {t('overlay.saveSettings')}
      </Button>
    </section>
  );
}

function CheckRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <label className="mb-1 flex min-h-10 items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
    </label>
  );
}
