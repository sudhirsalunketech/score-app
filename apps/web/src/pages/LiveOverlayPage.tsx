import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePublicLive } from '@/hooks/usePublicLive';
import { parseOverlayConfig } from '@/lib/overlay-model';
import { BroadcastOverlay } from '@/components/overlay/BroadcastOverlay';
import { BallResultScene, IntroScene, LineupScene, LowerThirdScene, TargetScene } from '@/components/overlay/OverlayScenes';

export function LiveOverlayPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const { data, connection } = usePublicLive(slug);
  const config = parseOverlayConfig(params.toString(), data?.broadcast);

  useEffect(() => {
    document.documentElement.classList.add('cs-overlay');
    document.body.classList.add('cs-overlay');
    return () => {
      document.documentElement.classList.remove('cs-overlay');
      document.body.classList.remove('cs-overlay');
    };
  }, []);

  if (!data) return <div className="cs-broadcast min-h-dvh" data-overlay-empty />;
  if (data.share && data.share.live === false) {
    return <div className="cs-broadcast min-h-dvh" data-overlay-disabled />;
  }

  if (config.scene === 'intro') return <IntroScene data={data} config={config} t={t} />;
  if (config.scene === 'lineup') return <LineupScene data={data} t={t} />;
  if (config.scene === 'lower-third') return <LowerThirdScene data={data} config={config} t={t} />;
  if (config.scene === 'target') return <TargetScene data={data} config={config} t={t} />;
  if (config.scene === 'ball-result') return <BallResultScene data={data} config={config} t={t} />;

  return <BroadcastOverlay data={data} connection={connection} config={config} />;
}
