import type { MutableRefObject } from 'react';

import { SectionCard } from '@components/ui/SectionCard';
import { useEditorState } from '@features/editor/store/useEditorState';
import { useSettingsStore } from '@features/settings/store/useSettingsStore';
import { useHandwritingRenderer } from '@hooks/useHandwritingRenderer';

import { PaperCanvas } from './PaperCanvas';

interface PaperPreviewProps {
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
}

export const PaperPreview = ({ canvasRef: externalCanvasRef }: PaperPreviewProps): JSX.Element => {
  const text = useEditorState((state) => state.debouncedText);
  const refreshVersion = useEditorState((state) => state.refreshVersion);

  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const inkColor = useSettingsStore((state) => state.inkColor);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const lineSpacing = useSettingsStore((state) => state.lineSpacing);
  const letterVariation = useSettingsStore((state) => state.letterVariation);
  const paperType = useSettingsStore((state) => state.paperType);
  const pageSize = useSettingsStore((state) => state.pageSize);

  const { canvasRef, isRendering } = useHandwritingRenderer({
    text,
    fontFamily,
    inkColor,
    fontSize,
    lineSpacing,
    letterVariation: letterVariation / 100,
    paperType,
    canvasRef: externalCanvasRef,
    seed: refreshVersion === 0 ? undefined : refreshVersion,
  });

  return (
    <SectionCard
      title="Live Preview"
      description="The preview updates after a short debounce to keep typing smooth."
    >
      <div
        aria-busy={isRendering}
        className="rounded-card border border-surface-200 bg-surface-50 p-3 sm:p-4"
      >
        <PaperCanvas paperType={paperType} pageSize={pageSize} ariaLabel="Handwriting paper preview">
          <canvas ref={canvasRef} className="h-full w-full" />
        </PaperCanvas>
      </div>
    </SectionCard>
  );
};
