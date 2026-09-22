import { youtubeEmbedSrc } from '@/lib/live';

export function YoutubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const src = youtubeEmbedSrc(videoId);
  if (!src) return null;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        title={title}
        src={src}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
