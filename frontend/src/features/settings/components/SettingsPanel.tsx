import { useEffect, useId, useState } from 'react';

import { SectionCard } from '@components/ui/SectionCard';
import {
  MyHandwritingWizard,
  hasSavedFont as hasSavedMyHandwritingFont,
} from '@features/my-handwriting';
import { MY_HANDWRITING_FONT_FAMILY } from '@features/my-handwriting/constants';
import {
  HANDWRITING_FONTS,
  PAGE_SIZES,
  PAPER_TYPES,
  type PageSize,
  type PaperType,
} from '../../../types/handwriting';

import { useSettingsStore } from '../store/useSettingsStore';

type SettingsGroup = 'style' | 'paper' | 'realism';

interface InkPreset {
  label: string;
  value: string;
}

const INK_PRESETS: readonly InkPreset[] = [
  { label: 'Black', value: '#1F2937' },
  { label: 'Blue', value: '#1D4ED8' },
  { label: 'Red', value: '#B91C1C' },
  { label: 'Green', value: '#166534' },
];

const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  lined: 'Lined',
  blank: 'Blank',
  grid: 'Grid',
  dotted: 'Dotted',
};

const PAGE_SIZE_DESCRIPTIONS: Record<PageSize, string> = {
  A4: '210 x 297 mm',
  Letter: '8.5 x 11 in',
  Square: '1:1 canvas',
};

const GROUP_COPY: Record<SettingsGroup, { title: string; description: string }> = {
  style: {
    title: 'Handwriting Style',
    description: 'Choose the writing voice, ink, and size for your draft.',
  },
  paper: {
    title: 'Paper',
    description: 'Match the page texture and sheet proportions to your final output.',
  },
  realism: {
    title: 'Realism',
    description: 'Control the natural variation and breathing room in each line.',
  },
};

const normalizeHexDraft = (value: string): string => {
  const cleaned = value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);

  return cleaned.length > 0 ? `#${cleaned}` : '#';
};

const isValidHexColor = (value: string): boolean => /^#[0-9A-F]{6}$/.test(value);

const getPaperPatternClassName = (paperType: PaperType): string => {
  if (paperType === 'blank') {
    return 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(250,248,244,0.96)_50%,rgba(239,229,212,0.9))]';
  }

  if (paperType === 'lined') {
    return 'bg-[#faf8f4] bg-[linear-gradient(to_bottom,transparent_0,transparent_17px,#c8d8e8_17px,#c8d8e8_18px)] bg-[length:100%_18px]';
  }

  if (paperType === 'grid') {
    return 'bg-[#faf8f4] bg-[linear-gradient(to_right,#d1d5db_1px,transparent_1px),linear-gradient(to_bottom,#d1d5db_1px,transparent_1px)] bg-[length:18px_18px]';
  }

  return 'bg-[#faf8f4] bg-[radial-gradient(circle,#cbd5e1_1.1px,transparent_1.2px)] bg-[length:18px_18px]';
};

const getPageSizePreviewClassName = (pageSize: PageSize): string => {
  if (pageSize === 'A4') {
    return 'h-12 w-9';
  }

  if (pageSize === 'Letter') {
    return 'h-11 w-9';
  }

  return 'h-10 w-10';
};

const PaperTypePreview = ({ paperType }: { paperType: PaperType }): JSX.Element => (
  <div className="rounded-2xl border border-neutral-200 bg-white/70 p-2">
    <div className={`h-14 w-full rounded-xl border border-[#e7dcc7] ${getPaperPatternClassName(paperType)}`} />
  </div>
);

const PageSizePreview = ({ pageSize }: { pageSize: PageSize }): JSX.Element => (
  <div className="flex h-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white/80">
    <div
      aria-hidden="true"
      className={`${getPageSizePreviewClassName(pageSize)} rounded-lg border border-primary-200 bg-surface-50 shadow-sm`}
    />
  </div>
);

export const SettingsPanel = (): JSX.Element => {
  const accordionId = useId();
  const [openGroup, setOpenGroup] = useState<SettingsGroup | null>('style');
  const [isMyHandwritingOpen, setIsMyHandwritingOpen] = useState(false);
  const [hasCustomFont, setHasCustomFont] = useState(false);
  const [isCheckingCustomFont, setIsCheckingCustomFont] = useState(true);

  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const inkColor = useSettingsStore((state) => state.inkColor);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const paperType = useSettingsStore((state) => state.paperType);
  const pageSize = useSettingsStore((state) => state.pageSize);
  const letterVariation = useSettingsStore((state) => state.letterVariation);
  const lineSpacing = useSettingsStore((state) => state.lineSpacing);

  const setFontFamily = useSettingsStore((state) => state.setFontFamily);
  const setInkColor = useSettingsStore((state) => state.setInkColor);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const setPaperType = useSettingsStore((state) => state.setPaperType);
  const setPageSize = useSettingsStore((state) => state.setPageSize);
  const setLetterVariation = useSettingsStore((state) => state.setLetterVariation);
  const setLineSpacing = useSettingsStore((state) => state.setLineSpacing);

  const [inkDraft, setInkDraft] = useState(inkColor.toUpperCase());

  useEffect(() => {
    setInkDraft(inkColor.toUpperCase());
  }, [inkColor]);

  useEffect(() => {
    let isActive = true;

    const syncCustomFontAvailability = async (): Promise<void> => {
      setIsCheckingCustomFont(true);

      try {
        const nextHasCustomFont = await hasSavedMyHandwritingFont();

        if (!isActive) {
          return;
        }

        setHasCustomFont(nextHasCustomFont);

        if (!nextHasCustomFont && fontFamily === MY_HANDWRITING_FONT_FAMILY) {
          setFontFamily('Caveat, cursive');
        }
      } finally {
        if (isActive) {
          setIsCheckingCustomFont(false);
        }
      }
    };

    void syncCustomFontAvailability();

    return () => {
      isActive = false;
    };
  }, [fontFamily, setFontFamily]);

  const toggleGroup = (group: SettingsGroup): void => {
    setOpenGroup((currentGroup) => (currentGroup === group ? null : group));
  };

  const handleInkDraftChange = (value: string): void => {
    const nextDraft = normalizeHexDraft(value);
    setInkDraft(nextDraft);

    if (isValidHexColor(nextDraft)) {
      setInkColor(nextDraft);
    }
  };

  const renderAccordionSection = (
    group: SettingsGroup,
    children: JSX.Element,
  ): JSX.Element => {
    const contentId = `${accordionId}-${group}`;
    const groupCopy = GROUP_COPY[group];
    const isOpen = openGroup === group;

    return (
      <section className="rounded-panel border border-neutral-200 bg-white/70 shadow-paper">
        <button
          type="button"
          onClick={() => {
            toggleGroup(group);
          }}
          aria-expanded={isOpen}
          aria-controls={contentId}
          className="flex w-full items-start justify-between gap-4 rounded-panel px-4 py-4 text-left sm:pointer-events-none"
        >
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-700">
              {groupCopy.title}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">{groupCopy.description}</p>
          </div>

          <span
            aria-hidden="true"
            className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition sm:hidden"
          >
            {isOpen ? '-' : '+'}
          </span>
        </button>

        <div id={contentId} className={`${isOpen ? 'block' : 'hidden'} border-t border-neutral-100 px-4 pb-4 pt-4 sm:block`}>
          {children}
        </div>
      </section>
    );
  };

  return (
    <SectionCard
      title="Handwriting Settings"
      description="Shape the visual style, paper, and realism of the handwritten preview."
    >
      <div className="space-y-4">
        {renderAccordionSection(
          'style',
          <fieldset className="space-y-5">
            <legend className="sr-only">Handwriting style settings</legend>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-700" id={`${accordionId}-font-label`}>
                  Font Preview
                </p>
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Tap a card to select</p>
              </div>

              <div
                role="radiogroup"
                aria-labelledby={`${accordionId}-font-label`}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {HANDWRITING_FONTS.map((font) => {
                  const isSelected = font.family === fontFamily;
                  const isCustomFont = font.family === MY_HANDWRITING_FONT_FAMILY;
                  const isReady = !isCustomFont || hasCustomFont;

                  return (
                    <button
                      key={font.family}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        if (isCustomFont && !isReady) {
                          setIsMyHandwritingOpen(true);
                          return;
                        }

                        setFontFamily(font.family);
                      }}
                      className={`rounded-panel border p-4 text-left transition ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 shadow-paper'
                          : 'border-neutral-200 bg-white hover:border-primary-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-700">{font.label}</p>
                          {font.description ? (
                            <p className="mt-1 text-xs text-neutral-500">{font.description}</p>
                          ) : null}
                        </div>

                        {isCustomFont ? (
                          <span
                            className={`rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${
                              isReady
                                ? 'bg-accent-50 text-accent-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {isCheckingCustomFont ? 'Checking' : isReady ? 'Ready' : 'Setup'}
                          </span>
                        ) : null}
                      </div>

                      <p
                        className="mt-3 block min-h-[3rem] overflow-hidden pt-1 text-[1.65rem] leading-[1.25] text-neutral-900"
                        style={{ fontFamily: isReady ? font.family : '"Times New Roman", serif' }}
                      >
                        {isCustomFont ? 'My style' : 'Hello'}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-dashed border-primary-200 bg-white/80 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Upload your own handwriting</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Build a personal client-side font from a printable template and a single photo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMyHandwritingOpen((currentValue) => !currentValue);
                    }}
                    className="min-h-11 rounded-2xl border border-primary-200 bg-white px-4 text-sm font-medium text-primary-700 transition hover:border-primary-400"
                  >
                    {isMyHandwritingOpen ? 'Hide Wizard' : hasCustomFont ? 'Manage Font' : 'Set Up'}
                  </button>
                </div>
              </div>

              {isMyHandwritingOpen ? (
                <MyHandwritingWizard
                  isFontReady={hasCustomFont}
                  onFontReady={() => {
                    setHasCustomFont(true);
                    setFontFamily(MY_HANDWRITING_FONT_FAMILY);
                  }}
                  onFontRemoved={() => {
                    setHasCustomFont(false);
                    if (fontFamily === MY_HANDWRITING_FONT_FAMILY) {
                      setFontFamily('Caveat, cursive');
                    }
                  }}
                  onSelectFont={() => {
                    setFontFamily(MY_HANDWRITING_FONT_FAMILY);
                  }}
                />
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-neutral-700" id={`${accordionId}-ink-label`}>
                Ink Color
              </p>

              <div
                role="radiogroup"
                aria-labelledby={`${accordionId}-ink-label`}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {INK_PRESETS.map((preset) => {
                  const isSelected = preset.value === inkColor.toUpperCase();

                  return (
                    <button
                      key={preset.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setInkColor(preset.value);
                      }}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-200'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.value }}
                      />
                      <span className="text-sm font-medium">{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <label className="block">
                  <span className="sr-only">Pick custom ink color</span>
                  <input
                    type="color"
                    aria-label="Custom ink color picker"
                    value={inkColor}
                    onChange={(event) => {
                      setInkColor(event.target.value);
                    }}
                    className="h-12 w-14 rounded-2xl border border-neutral-200 bg-white p-1"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-neutral-700">Custom Hex</span>
                  <input
                    type="text"
                    inputMode="text"
                    value={inkDraft}
                    onChange={(event) => {
                      handleInkDraftChange(event.target.value);
                    }}
                    onBlur={() => {
                      setInkDraft(inkColor.toUpperCase());
                    }}
                    aria-describedby={`${accordionId}-ink-help`}
                    className="h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm tracking-[0.16em] text-neutral-900 uppercase focus:border-primary-500 focus:outline-none"
                    placeholder="#1F2937"
                  />
                </label>
              </div>

              <p id={`${accordionId}-ink-help`} className="text-xs text-neutral-500">
                Enter a 6-digit hex color to update the preview ink.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="flex items-center justify-between text-sm font-medium text-neutral-700">
                <span>Font Size</span>
                <span>{fontSize}px</span>
              </span>
              <input
                type="range"
                min={12}
                max={28}
                step={1}
                value={fontSize}
                onChange={(event) => {
                  setFontSize(Number(event.target.value));
                }}
                className="w-full accent-primary-500"
              />
            </label>
          </fieldset>,
        )}

        {renderAccordionSection(
          'paper',
          <fieldset className="space-y-5">
            <legend className="sr-only">Paper settings</legend>

            <div className="space-y-3">
              <p className="text-sm font-medium text-neutral-700" id={`${accordionId}-paper-type-label`}>
                Paper Type
              </p>

              <div
                role="radiogroup"
                aria-labelledby={`${accordionId}-paper-type-label`}
                className="grid grid-cols-2 gap-3"
              >
                {PAPER_TYPES.map((type) => {
                  const isSelected = type === paperType;

                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setPaperType(type);
                      }}
                      className={`space-y-3 rounded-panel border p-3 text-left transition ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 bg-white hover:border-primary-200'
                      }`}
                    >
                      <PaperTypePreview paperType={type} />
                      <p className="text-sm font-medium text-neutral-700">{PAPER_TYPE_LABELS[type]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-neutral-700" id={`${accordionId}-page-size-label`}>
                Page Size
              </p>

              <div
                role="radiogroup"
                aria-labelledby={`${accordionId}-page-size-label`}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {PAGE_SIZES.map((size) => {
                  const isSelected = size === pageSize;

                  return (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setPageSize(size);
                      }}
                      className={`space-y-3 rounded-panel border p-3 text-left transition ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 bg-white hover:border-primary-200'
                      }`}
                    >
                      <PageSizePreview pageSize={size} />
                      <div>
                        <p className="text-sm font-medium text-neutral-700">{size}</p>
                        <p className="text-xs text-neutral-500">{PAGE_SIZE_DESCRIPTIONS[size]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>,
        )}

        {renderAccordionSection(
          'realism',
          <fieldset className="space-y-5">
            <legend className="sr-only">Realism settings</legend>

            <label className="block space-y-2">
              <span className="flex items-center justify-between text-sm font-medium text-neutral-700">
                <span>Letter Variation</span>
                <span>{letterVariation}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={letterVariation}
                onChange={(event) => {
                  setLetterVariation(Number(event.target.value));
                }}
                className="w-full accent-primary-500"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Uniform</span>
                <span>Very natural</span>
              </div>
            </label>

            <label className="block space-y-2">
              <span className="flex items-center justify-between text-sm font-medium text-neutral-700">
                <span>Line Spacing</span>
                <span>{lineSpacing.toFixed(1)}x</span>
              </span>
              <input
                type="range"
                min={1}
                max={2.5}
                step={0.1}
                value={lineSpacing}
                onChange={(event) => {
                  setLineSpacing(Number(event.target.value));
                }}
                className="w-full accent-primary-500"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>1.0x</span>
                <span>2.5x</span>
              </div>
            </label>
          </fieldset>,
        )}
      </div>
    </SectionCard>
  );
};
