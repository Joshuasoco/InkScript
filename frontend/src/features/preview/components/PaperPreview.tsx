import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, UIEvent } from 'react';

import { SectionCard } from '@components/ui/SectionCard';
import { useEditorState } from '@features/editor/store/useEditorState';
import { useSettingsStore } from '@features/settings/store/useSettingsStore';
import { useHandwritingRenderer } from '@hooks/useHandwritingRenderer';
import type { PageSize, PaperType } from '../../../types/handwriting';

import { PaperCanvas } from './PaperCanvas';
import { createPreviewLayout, type PreviewPageData } from '../utils/pageLayout';

const PAGE_GAP_PX = 24;
const MAX_PAGE_WIDTH_PX = {
  A4: 832,
  Letter: 864,
  Square: 768,
} as const;

interface PaperPreviewProps {
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  compact?: boolean;
}

interface PreviewPageCardProps {
  page: PreviewPageData;
  fontFamily: string;
  inkColor: string;
  fontSize: number;
  lineSpacing: number;
  letterVariation: number;
  paperType: PaperType;
  pageSize: PageSize;
  refreshVersion: number;
  compact: boolean;
  externalCanvasRef?: MutableRefObject<HTMLCanvasElement | null>;
}

// WHY: Memoizing each preview page keeps scroll-window updates from repainting every mounted canvas.
const PreviewPageCard = memo(
  ({
    page,
    fontFamily,
    inkColor,
    fontSize,
    lineSpacing,
    letterVariation,
    paperType,
    pageSize,
    refreshVersion,
    compact,
    externalCanvasRef,
  }: PreviewPageCardProps): JSX.Element => {
    const { canvasRef, isRendering } = useHandwritingRenderer({
      lines: page.lines,
      fontFamily,
      inkColor,
      fontSize,
      lineSpacing,
      letterVariation: letterVariation / 100,
      paperType,
      pageSize,
      pageIndex: page.index,
      canvasRef: externalCanvasRef,
      seed: refreshVersion === 0 ? undefined : refreshVersion + page.index,
    });

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-neutral-500">
          <span>Page {page.index + 1}</span>
          <span>{page.lines.length} lines</span>
        </div>

        <div
          aria-busy={isRendering}
          className={`rounded-card border border-surface-200 bg-surface-50 p-3 shadow-paper ${
            compact ? 'origin-top scale-[0.92]' : ''
          }`}
        >
          <PaperCanvas paperType={paperType} pageSize={pageSize} ariaLabel={`Preview page ${page.index + 1}`}>
            <canvas ref={canvasRef} className="h-full w-full" />
          </PaperCanvas>
        </div>
      </div>
    );
  },
);

export const PaperPreview = ({
  canvasRef: externalCanvasRef,
  compact = false,
}: PaperPreviewProps): JSX.Element => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const text = useEditorState((state) => state.debouncedText);
  const refreshVersion = useEditorState((state) => state.refreshVersion);

  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const inkColor = useSettingsStore((state) => state.inkColor);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const lineSpacing = useSettingsStore((state) => state.lineSpacing);
  const letterVariation = useSettingsStore((state) => state.letterVariation);
  const paperType = useSettingsStore((state) => state.paperType);
  const pageSize = useSettingsStore((state) => state.pageSize);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // WHY: Layout generation measures and paginates the full document, so memoizing it avoids repeating the expensive work on unrelated UI updates.
  const previewLayout = useMemo(
    () =>
      createPreviewLayout({
        text,
        fontFamily,
        fontSize,
        lineSpacing,
        pageSize,
      }),
    [fontFamily, fontSize, lineSpacing, pageSize, text],
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateSize = (): void => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // WHY: We only window pages for very long documents so normal drafts keep their simple rendering path.
  const shouldVirtualize = previewLayout.lineCount > 500;
  const pageAspectRatio = previewLayout.logicalPageHeight / previewLayout.logicalPageWidth;
  const maxPageWidth = MAX_PAGE_WIDTH_PX[pageSize];
  const pageDisplayWidth = Math.max(280, Math.min(viewportSize.width - 12, maxPageWidth));
  const pageDisplayHeight = pageDisplayWidth * pageAspectRatio;
  const pageSlotHeight = pageDisplayHeight + PAGE_GAP_PX;
  const totalVirtualHeight =
    previewLayout.pages.length > 0 ? previewLayout.pages.length * pageSlotHeight - PAGE_GAP_PX : 0;

  const visiblePageRange = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        start: 0,
        end: previewLayout.pages.length - 1,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / pageSlotHeight) - 1);
    const end = Math.min(
      previewLayout.pages.length - 1,
      Math.ceil((scrollTop + viewportSize.height) / pageSlotHeight) + 1,
    );

    return { start, end };
  }, [pageSlotHeight, previewLayout.pages.length, scrollTop, shouldVirtualize, viewportSize.height]);

  const visiblePages = useMemo(() => {
    // WHY: Slicing the mounted page subset avoids reconciling hundreds of offscreen canvases during long-document scrolling.
    if (previewLayout.pages.length === 0) {
      return [];
    }

    return previewLayout.pages.slice(visiblePageRange.start, visiblePageRange.end + 1);
  }, [previewLayout.pages, visiblePageRange.end, visiblePageRange.start]);

  return (
    <SectionCard
      title="Live Preview"
      description="The preview streams page by page and windows very long drafts to stay responsive."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500">
          <span>{previewLayout.pages.length} pages</span>
          <span>{previewLayout.lineCount} wrapped lines</span>
        </div>

        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className={`rounded-panel border border-surface-200 bg-surface-50/80 p-2 ${
            compact ? 'max-h-[60vh]' : 'max-h-[min(74vh,72rem)]'
          } overflow-auto`}
        >
          {shouldVirtualize ? (
            <div className="relative" style={{ height: `${totalVirtualHeight}px` }}>
              {visiblePages.map((page) => {
                const pageTop = page.index * pageSlotHeight;

                return (
                  <div
                    key={page.index}
                    className="absolute left-0 right-0 flex justify-center px-1"
                    style={{ top: `${pageTop}px` }}
                  >
                    <div className="w-full max-w-[54rem]">
                      <PreviewPageCard
                        page={page}
                        fontFamily={fontFamily}
                        inkColor={inkColor}
                        fontSize={fontSize}
                        lineSpacing={lineSpacing}
                        letterVariation={letterVariation}
                        paperType={paperType}
                        pageSize={pageSize}
                        refreshVersion={refreshVersion}
                        compact={compact}
                        externalCanvasRef={
                          externalCanvasRef && page.index === visiblePageRange.start
                            ? externalCanvasRef
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {previewLayout.pages.map((page) => (
                <PreviewPageCard
                  key={page.index}
                  page={page}
                  fontFamily={fontFamily}
                  inkColor={inkColor}
                  fontSize={fontSize}
                  lineSpacing={lineSpacing}
                  letterVariation={letterVariation}
                  paperType={paperType}
                  pageSize={pageSize}
                  refreshVersion={refreshVersion}
                  compact={compact}
                  externalCanvasRef={externalCanvasRef && page.index === 0 ? externalCanvasRef : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};
