import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { overlayLiveUrl, youtubeEmbedSrc } from '@/lib/live';
import { destinationsForMatch } from '@/lib/share-destinations';
import type { Match, ShareVisibility } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { YoutubeEmbed } from '@/components/live/YoutubeEmbed';
import { BroadcastControlPanel } from '@/components/live/BroadcastControlPanel';
import { SharePreview, ShareSheet } from '@/components/share/ShareSheet';
import { cn } from '@/lib/cn';

const VIS: ShareVisibility[] = ['PUBLIC', 'UNLISTED', 'PRIVATE'];

export function LiveSharePanel({ match, onUpdated }: { match: Match; onUpdated: (m: Match) => void }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(Boolean(match.publicLiveEnabled));
  const [visibility, setVisibility] = useState<ShareVisibility>(match.visibility ?? 'PRIVATE');
  const [scorecard, setScorecard] = useState(match.publicScorecardEnabled !== false);
  const [stats, setStats] = useState(match.publicStatsEnabled !== false);
  const [mvp, setMvp] = useState(match.publicMvpEnabled !== false);
  const [youtubeUrl, setYoutubeUrl] = useState(
    match.youtubeVideoId ? `https://www.youtube.com/watch?v=${match.youtubeVideoId}` : '',
  );
  const [preview, setPreview] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(Boolean(match.publicLiveEnabled));
    setVisibility(match.visibility ?? 'PRIVATE');
    setScorecard(match.publicScorecardEnabled !== false);
    setStats(match.publicStatsEnabled !== false);
    setMvp(match.publicMvpEnabled !== false);
    setYoutubeUrl(match.youtubeVideoId ? `https://www.youtube.com/watch?v=${match.youtubeVideoId}` : '');
  }, [match]);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Match>(`/api/v1/matches/${match.id}`, { method: 'PATCH', body: patch });
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: string, value: boolean, set: (v: boolean) => void) => {
    set(value);
    void save({ [key]: value });
  };

  const inn = match.innings?.find((i) => i.status === 'IN_PROGRESS') ?? match.innings?.[match.innings.length - 1];
  const previewId = youtubeUrl.match(/[a-zA-Z0-9_-]{11}/)?.[0];
  const canShare = Boolean(match.publicSlug) && visibility !== 'PRIVATE';

  return (
    <section className="mt-8 rounded-card border border-border p-4">
      <h2 className="mb-3 text-sm font-bold uppercase text-text-secondary">{t('share.sharingVisibility')}</h2>
      <div className="mb-4 flex flex-col gap-2">
        {VIS.map((v) => (
          <label key={v} className="flex min-h-touch items-center gap-2 text-sm font-semibold">
            <input
              type="radio"
              name="visibility"
              checked={visibility === v}
              onChange={() => {
                setVisibility(v);
                void save({ visibility: v });
              }}
            />
            {t(`share.visibility.${v}`)}
          </label>
        ))}
      </div>

      <ToggleRow label={t('share.allowLive')} on={enabled} disabled={saving} onToggle={(next) => toggle('publicLiveEnabled', next, setEnabled)} />
      <ToggleRow label={t('share.allowScorecard')} on={scorecard} disabled={saving} onToggle={(next) => toggle('publicScorecardEnabled', next, setScorecard)} />
      <ToggleRow label={t('share.allowStats')} on={stats} disabled={saving} onToggle={(next) => toggle('publicStatsEnabled', next, setStats)} />
      <ToggleRow label={t('share.allowMvp')} on={mvp} disabled={saving} onToggle={(next) => toggle('publicMvpEnabled', next, setMvp)} />

      <Button type="button" variant="primaryDark" className="mt-4 w-full" disabled={!canShare} onClick={() => setShareOpen(true)}>
        {t('share.shareMatch')}
      </Button>
      {match.publicSlug && canShare ? (
        <p className="mt-2 break-all text-xs text-text-secondary">{overlayLiveUrl(match.publicSlug)}</p>
      ) : null}

      <BroadcastControlPanel match={match} saving={saving} onSave={save} />

      <h3 className="mb-2 mt-6 text-sm font-bold uppercase text-text-secondary">{t('live.youtubeLive')}</h3>
      <Input
        label={t('live.youtubeUrl')}
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        underline
        placeholder="https://www.youtube.com/watch?v="
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" onClick={() => setPreview(true)} disabled={!youtubeEmbedSrc(previewId ?? '')}>
          {t('live.preview')}
        </Button>
        <Button type="button" variant="primaryDark" disabled={saving} onClick={() => void save({ youtubeUrl, youtubeEnabled: true })}>
          {t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={() => void save({ youtubeUrl: '', youtubeEnabled: false })}>
          {t('live.remove')}
        </Button>
      </div>
      {preview && match.youtubeVideoId ? (
        <div className="mt-3">
          <YoutubeEmbed videoId={match.youtubeVideoId} title={match.title} />
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        heading={t('share.shareMatch')}
        destinations={destinationsForMatch(match)}
        preview={
          <SharePreview
            home={match.homeTeam.name}
            away={match.awayTeam.name}
            homeLogo={match.homeTeam.logoUrl}
            awayLogo={match.awayTeam.logoUrl}
            live={match.status === 'LIVE' || match.status === 'INNINGS_BREAK'}
            score={inn ? `${inn.totalRuns}/${inn.totalWickets}` : undefined}
            overs={inn ? `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}` : undefined}
            tournament={match.tournament?.name}
          />
        }
      />
    </section>
  );
}

function ToggleRow({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-sm">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={cn('relative h-8 w-14 rounded-pill transition-colors', on ? 'bg-primary' : 'bg-border')}
        onClick={() => onToggle(!on)}
      >
        <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white transition-[inset-inline-start]', on ? 'start-7' : 'start-1')} />
      </button>
    </div>
  );
}
