import { useId } from 'react';
import type { ReactNode } from 'react';

import type { PaperType } from '../../../types/handwriting';

export interface PaperCanvasProps {
  paperType: PaperType;
  pageSize: 'A4' | 'Letter' | 'Square';
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}

const PAGE_SIZE_CLASSES: Record<PaperCanvasProps['pageSize'], string> = {
  A4: 'aspect-[210/297] max-w-[min(100%,52rem)]',
  Letter: 'aspect-[8.5/11] max-w-[min(100%,54rem)]',
  Square: 'aspect-square max-w-[min(100%,48rem)]',
};

const PAPER_BACKGROUND_CLASSES: Record<PaperType, string> = {
  lined: 'bg-[#faf8f4]',
  blank: 'bg-[#faf8f4]',
  grid: 'bg-[#faf8f4]',
  dotted: 'bg-[#faf8f4]',
};

const getPaperLabel = (
  paperType: PaperType,
  pageSize: PaperCanvasProps['pageSize'],
  ariaLabel?: string,
): string => {
  if (ariaLabel) {
    return ariaLabel;
  }

  return `${pageSize} ${paperType} paper preview`;
};

const PaperPattern = ({ paperType }: { paperType: PaperType }): JSX.Element | null => {
  const patternId = useId().replace(/:/g, '');

  if (paperType === 'blank') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-30 mix-blend-multiply"
      >
        <defs>
          <filter id={`paper-noise-${patternId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.08" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect width="100" height="100" fill="#faf8f4" />
        <rect width="100" height="100" filter={`url(#paper-noise-${patternId})`} fill="#9f8f6b" />
      </svg>
    );
  }

  if (paperType === 'lined') {
    return (
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern id={`paper-lined-${patternId}`} width="24" height="32" patternUnits="userSpaceOnUse">
            <rect width="24" height="32" fill="#faf8f4" />
            <line x1="0" y1="31.5" x2="24" y2="31.5" stroke="#c8d8e8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#paper-lined-${patternId})`} />
      </svg>
    );
  }

  if (paperType === 'grid') {
    return (
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern id={`paper-grid-${patternId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#faf8f4" />
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d1d5db" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#paper-grid-${patternId})`} />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <pattern id={`paper-dotted-${patternId}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#faf8f4" />
          <circle cx="10" cy="10" r="1.1" fill="#cbd5e1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#paper-dotted-${patternId})`} />
    </svg>
  );
};

export const PaperCanvas = ({
  paperType,
  pageSize,
  children,
  ariaLabel,
  className,
}: PaperCanvasProps): JSX.Element => {
  return (
    <div className={`mx-auto w-full ${PAGE_SIZE_CLASSES[pageSize]} ${className ?? ''}`}>
      <div
        role="img"
        aria-roledescription="paper document preview"
        aria-label={getPaperLabel(paperType, pageSize, ariaLabel)}
        className={`relative h-full w-full overflow-hidden rounded-[clamp(1rem,2vw,1.75rem)] border border-[#e7dcc7] shadow-paper-lg ring-1 ring-white/70 ${PAPER_BACKGROUND_CLASSES[paperType]}`}
      >
        <PaperPattern paperType={paperType} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-[#efe5d4]/40" aria-hidden="true" />
        <div className="absolute inset-[2.5%] rounded-[clamp(0.85rem,1.5vw,1.35rem)] border border-white/35" aria-hidden="true" />
        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    </div>
  );
};
