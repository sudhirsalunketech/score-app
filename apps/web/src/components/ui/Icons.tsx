import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M7 10.5V20h10v-9.5" />
    </Svg>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h16M4 16h10" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconQuiz(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1.9-1.1 1.8" />
      <circle cx="12" cy="16.2" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </Svg>
  );
}

export function IconNews(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5h12v14H6a2 2 0 0 1-2-2V5z" />
      <path d="M16 8h4v9a2 2 0 0 1-2 2h-2" />
      <path d="M8 9h5M8 13h5" />
    </Svg>
  );
}

export function IconBack(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconChevron(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function IconScore(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconMatches(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="11" height="16" rx="1.5" />
      <path d="M7 8h5M7 12h5M7 16h3" />
      <circle cx="18" cy="16" r="3.2" />
      <path d="M18 14.6V16l1 1" />
    </Svg>
  );
}

export function IconChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 19h16M7 16V11M12 16V8M17 16v-5" />
    </Svg>
  );
}

export function IconPower(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v8" />
      <path d="M7.2 6.2a7 7 0 1 0 9.6 0" />
    </Svg>
  );
}

export function IconCheckered(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4v16" />
      <path d="M5 5h12l-2.5 3.5L17 12H5" />
      <path d="M8 5v3.5M11.5 5v3.5M8 8.5h6.2M8 8.5V12M11.5 8.5V12" />
    </Svg>
  );
}

export function IconTrophy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 5h8v4a4 4 0 0 1-8 0V5z" />
      <path d="M8 7H5a2 2 0 0 0 2 4M16 7h3a2 2 0 0 1-2 4" />
      <path d="M12 13v3M9 20h6M10 20v-4h4v4" />
    </Svg>
  );
}

export function IconPerson(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" />
    </Svg>
  );
}

export function IconGroup(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 19c1-3 3.2-4.5 6-4.5s5 1.5 6 4.5M16 14.5c2 .2 3.7 1.3 4.5 4.5" />
    </Svg>
  );
}

export function IconClub(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l2.2 6.5H21l-5.4 4 2.1 6.5L12 16.5 6.3 20l2.1-6.5L3 9.5h6.8z" />
    </Svg>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6l12 6-12 6V6z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconFlag(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4v16M5 5h10l-2 4 2 4H5" />
    </Svg>
  );
}

export function IconStamp(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="14" width="16" height="6" rx="1" />
      <path d="M8 14V9a4 4 0 0 1 8 0v5" />
    </Svg>
  );
}

export function IconHeart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconGear(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 6.5l1.5 1.5M17.6 16l1.5 1.5M3 12h2M19 12h2M4.9 17.5l1.5-1.5M17.6 8l1.5-1.5" />
    </Svg>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h10M11 9l3 3-3 3" />
    </Svg>
  );
}

export function IconEye(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a15.5 15.5 0 0 1-3.2 4.1M6.5 6.6C4.3 8.1 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.2 3.3-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconMinus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 8H5V4" />
      <path d="M5 8a8 8 0 1 1-1.2 6" />
    </Svg>
  );
}

export function IconSwap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4v13" />
      <path d="M4 14l3 3 3-3" />
      <path d="M17 20V7" />
      <path d="M20 10l-3-3-3 3" />
    </Svg>
  );
}

export function IconMore(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" />
    </Svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="M8.2 13.2l7.6 4.4M15.8 6.4l-7.6 4.4" />
    </Svg>
  );
}

export function IconSpeaker(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 10v4h3l4 3V7L8 10H5z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
    </Svg>
  );
}

export function IconSpeakerOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 10v4h3l4 3V7L8 10H5z" />
      <path d="M16 9l4 6M20 9l-4 6" />
    </Svg>
  );
}

export function IconTennisBall({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
      <circle cx="12" cy="12" r="9" fill="#C6D800" stroke="#8A9A00" strokeWidth="1" />
      <path d="M5 8c4 2 6 4 7 9M19 8c-4 2-6 4-7 9" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

export function IconLeatherBall({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
      <circle cx="12" cy="12" r="9" fill="#B71C1C" stroke="#7F1010" strokeWidth="1" />
      <path d="M8 6.5c2 3 2 8 0 11M16 6.5c-2 3-2 8 0 11" fill="none" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}
