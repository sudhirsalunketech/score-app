import { useEffect, useState } from 'react';
import { initials } from '@/lib/format';
import { avatarSrc, type AvatarKind } from '@/lib/media';
import { cn } from '@/lib/cn';

export function Avatar({
  name,
  src,
  kind,
  size = 48,
  className,
}: {
  name: string;
  src?: string | null;
  kind?: AvatarKind;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const image = avatarSrc(broken ? null : src, kind);

  return (
    <div
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-primary', className)}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initials(name || '?')
      )}
    </div>
  );
}
