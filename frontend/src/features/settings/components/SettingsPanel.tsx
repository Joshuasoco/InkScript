import { SectionCard } from '@components/ui/SectionCard';
import { HANDWRITING_FONTS, PAPER_TYPES, type PaperType } from '../../../types/handwriting';

import { useSettingsStore } from '../store/useSettingsStore';

const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  lined: 'Lined',
  blank: 'Blank',
  grid: 'Grid',
  dotted: 'Dotted',
};

export const SettingsPanel = (): JSX.Element => {
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const inkColor = useSettingsStore((state) => state.inkColor);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const lineSpacing = useSettingsStore((state) => state.lineSpacing);
  const letterVariation = useSettingsStore((state) => state.letterVariation);
  const paperType = useSettingsStore((state) => state.paperType);

  const setFontFamily = useSettingsStore((state) => state.setFontFamily);
  const setInkColor = useSettingsStore((state) => state.setInkColor);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const setLineSpacing = useSettingsStore((state) => state.setLineSpacing);
  const setLetterVariation = useSettingsStore((state) => state.setLetterVariation);
  const setPaperType = useSettingsStore((state) => state.setPaperType);

  return (
    <SectionCard
      title="Handwriting Settings"
      description="Tune style realism, readability, and page type before export."
    >
      <div className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">Font</span>
          <select
            value={fontFamily}
            onChange={(event) => {
              setFontFamily(event.target.value);
            }}
            className="h-11 w-full rounded-card border border-neutral-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
          >
            {HANDWRITING_FONTS.map((font) => (
              <option key={font.family} value={font.family}>
                {font.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">Ink Color</span>
            <input
              value={inkColor}
              onChange={(event) => {
                setInkColor(event.target.value);
              }}
              type="text"
              aria-label="Ink color hex value"
              className="h-11 w-full rounded-card border border-neutral-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">Picker</span>
            <input
              value={inkColor}
              onChange={(event) => {
                setInkColor(event.target.value);
              }}
              type="color"
              aria-label="Pick ink color"
              className="h-11 w-14 rounded-card border border-neutral-200 p-1"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">Font Size ({fontSize}px)</span>
          <input
            value={fontSize}
            onChange={(event) => {
              setFontSize(Number(event.target.value));
            }}
            min={12}
            max={32}
            step={1}
            type="range"
            className="w-full"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">
            Line Spacing ({lineSpacing.toFixed(1)}x)
          </span>
          <input
            value={lineSpacing}
            onChange={(event) => {
              setLineSpacing(Number(event.target.value));
            }}
            min={1}
            max={2.5}
            step={0.1}
            type="range"
            className="w-full"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">
            Letter Variation ({letterVariation}%)
          </span>
          <input
            value={letterVariation}
            onChange={(event) => {
              setLetterVariation(Number(event.target.value));
            }}
            min={0}
            max={100}
            step={1}
            type="range"
            className="w-full"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Paper Type</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAPER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setPaperType(type);
                }}
                className={`h-11 rounded-card border text-sm transition ${
                  type === paperType
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-200'
                }`}
                aria-pressed={type === paperType}
              >
                {PAPER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
