import { SectionCard } from '@components/ui/SectionCard';
import { useEditorStore } from '@features/editor/store/useEditorStore';
import { useSettingsStore } from '@features/settings/store/useSettingsStore';
import { useHandwritingRenderer } from '@hooks/useHandwritingRenderer';

export const PaperPreview = (): JSX.Element => {
  const text = useEditorStore((state) => state.debouncedText);

  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const inkColor = useSettingsStore((state) => state.inkColor);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const lineSpacing = useSettingsStore((state) => state.lineSpacing);
  const letterVariation = useSettingsStore((state) => state.letterVariation);
  const paperType = useSettingsStore((state) => state.paperType);

  const { canvasRef, isRendering } = useHandwritingRenderer({
    text,
    fontFamily,
    inkColor,
    fontSize,
    lineSpacing,
    letterVariation: letterVariation / 100,
    paperType,
  });

  return (
    <SectionCard
      title="Live Preview"
      description="The preview updates after a short debounce to keep typing smooth."
    >
      <div
        role="img"
        aria-label="Handwriting preview canvas"
        aria-busy={isRendering}
        className="overflow-hidden rounded-card border border-surface-200 bg-surface-100"
      >
        <canvas ref={canvasRef} className="h-[70vh] min-h-[560px] w-full" />
      </div>
    </SectionCard>
  );
};
