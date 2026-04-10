import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { loadMyHandwritingFont } from '@utils/fontLoader';

import MyHandwritingWorker from '../workers/myHandwritingWorker?worker';

import {
  DEFAULT_PREVIEW_TEXT,
  HANDWRITING_TEMPLATE_CONFIG,
  MY_HANDWRITING_FONT_FAMILY,
  getTemplateCells,
} from '../constants';
import { downloadGeneratedFont } from '../services/fontBuilder';
import { deleteFont, saveFont } from '../services/fontStorage';
import { downloadHandwritingTemplate } from '../services/templatePdf';
import { prepareHandwritingUpload } from '../services/uploadPreparation';
import type {
  GeneratedHandwritingFont,
  HandwritingProcessingProgress,
  MyHandwritingWorkerMessage,
} from '../types';

type WizardStep = 1 | 2 | 3 | 4;

interface MyHandwritingWizardProps {
  isFontReady: boolean;
  onFontReady: () => void;
  onFontRemoved: () => void;
  onSelectFont: () => void;
}

const STEPS: ReadonlyArray<{ step: WizardStep; label: string }> = [
  { step: 1, label: 'Download Template' },
  { step: 2, label: 'Upload Photo' },
  { step: 3, label: 'Processing' },
  { step: 4, label: 'Done' },
] as const;

const PROCESS_STAGE_LABELS: Record<HandwritingProcessingProgress['stage'], string> = {
  slicing: 'Slicing',
  preprocessing: 'Preprocessing',
  vectorizing: 'Vectorizing',
  building: 'Building Font',
};

const getStepState = (activeStep: WizardStep, step: WizardStep): 'complete' | 'current' | 'upcoming' => {
  if (step < activeStep) {
    return 'complete';
  }

  if (step === activeStep) {
    return 'current';
  }

  return 'upcoming';
};

export const MyHandwritingWizard = ({
  isFontReady,
  onFontReady,
  onFontRemoved,
  onSelectFont,
}: MyHandwritingWizardProps): JSX.Element => {
  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [isBusy, setIsBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageImageData, setPageImageData] = useState<ImageData | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<HandwritingProcessingProgress | null>(null);
  const [generatedFont, setGeneratedFont] = useState<GeneratedHandwritingFont | null>(null);
  const [sampleText, setSampleText] = useState(DEFAULT_PREVIEW_TEXT);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const progressPercent = useMemo(() => {
    if (!progress) {
      return 0;
    }

    return Math.round((progress.completed / Math.max(progress.total, 1)) * 100);
  }, [progress]);

  const handleTemplateDownload = async (): Promise<void> => {
    setErrorMessage(null);

    try {
      await downloadHandwritingTemplate();
      setStep(2);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The handwriting template could not be generated.',
      );
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setErrorMessage(null);
    setIsBusy(true);

    try {
      const preparedUpload = await prepareHandwritingUpload(file);

      setPreviewUrl(preparedUpload.previewDataUrl);
      setPageImageData(preparedUpload.imageData);
      setUploadWarning(preparedUpload.warning);
      setGeneratedFont(null);
      setStep(2);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The uploaded photo could not be prepared.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateFont = async (): Promise<void> => {
    if (!pageImageData) {
      setErrorMessage('Upload a filled template photo before generating the font.');
      return;
    }

    setErrorMessage(null);
    setGeneratedFont(null);
    setProgress(null);
    setStep(3);
    setIsBusy(true);

    workerRef.current?.terminate();
    const worker = new MyHandwritingWorker();
    workerRef.current = worker;

    worker.onmessage = async (event: MessageEvent<MyHandwritingWorkerMessage>) => {
      if (event.data.type === 'progress') {
        setProgress(event.data.payload);
        return;
      }

      if (event.data.type === 'success') {
        const nextFont = event.data.payload;

        await saveFont(nextFont.buffer);
        await loadMyHandwritingFont();
        setGeneratedFont(nextFont);
        setIsBusy(false);
        setStep(4);
        onFontReady();
        onSelectFont();
        return;
      }

      setErrorMessage(event.data.payload.message);
      setIsBusy(false);
      setStep(2);
    };

    const pixels = pageImageData.data.slice().buffer;

    worker.postMessage(
      {
        type: 'generate-font',
        payload: {
          width: pageImageData.width,
          height: pageImageData.height,
          pixels,
        },
      },
      [pixels],
    );
  };

  const handleDeleteFont = async (): Promise<void> => {
    setErrorMessage(null);

    try {
      await deleteFont();
      setGeneratedFont(null);
      onFontRemoved();
      setStep(1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove the saved handwriting font.');
    }
  };

  return (
    <section className="rounded-panel border border-primary-100 bg-primary-50/50 p-4 shadow-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-700">
            My Handwriting
          </h4>
          <p className="mt-1 text-sm text-neutral-600">
            Print the template, write each character once, then upload a straight photo to build your own font.
          </p>
        </div>

        {isFontReady ? (
          <button
            type="button"
            onClick={() => {
              void handleDeleteFont();
            }}
            className="min-h-11 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-error-200 hover:text-error-600"
          >
            Remove Saved Font
          </button>
        ) : null}
      </div>

      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {STEPS.map(({ step: candidateStep, label }) => {
          const state = getStepState(step, candidateStep);

          return (
            <li
              key={label}
              className={`rounded-2xl border px-3 py-3 text-sm ${
                state === 'complete'
                  ? 'border-primary-200 bg-white text-primary-700'
                  : state === 'current'
                    ? 'border-primary-500 bg-primary-100 text-primary-800'
                    : 'border-neutral-200 bg-white/70 text-neutral-500'
              }`}
            >
              <span className="block text-xs uppercase tracking-[0.14em]">{`Step ${candidateStep}`}</span>
              <span className="mt-1 block font-medium">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 space-y-4">
        <div className="rounded-panel border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold text-neutral-800">Step 1. Download and print the template</h5>
              <p className="mt-1 text-sm text-neutral-500">
                The generated PDF matches the exact grid coordinates the app slices later.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleTemplateDownload();
              }}
              className="min-h-11 rounded-2xl bg-primary-600 px-4 text-sm font-medium text-white shadow-paper transition hover:bg-primary-700"
            >
              Download Template
            </button>
          </div>
        </div>

        <div className="rounded-panel border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold text-neutral-800">Step 2. Upload the filled page</h5>
              <p className="mt-1 text-sm text-neutral-500">
                Use a bright, straight photo with the full page in frame for the cleanest slicing.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  void handleFileChange(event);
                }}
                className="sr-only"
              />

              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                disabled={isBusy}
                className="min-h-11 rounded-2xl border border-primary-200 bg-white px-4 text-sm font-medium text-primary-700 transition hover:border-primary-400 disabled:cursor-wait disabled:opacity-60"
              >
                {previewUrl ? 'Replace Photo' : 'Choose Photo'}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleGenerateFont();
                }}
                disabled={!pageImageData || isBusy}
                className="min-h-11 rounded-2xl bg-primary-600 px-4 text-sm font-medium text-white shadow-paper transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                Generate Font
              </button>
            </div>
          </div>

          {previewUrl ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
              <div className="overflow-hidden rounded-2xl border border-[#e7dcc7] bg-[#faf8f4]">
                <div className="relative aspect-[960/1360] w-full">
                  <img
                    src={previewUrl}
                    alt="Uploaded handwriting template preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />

                  <svg
                    viewBox={`0 0 ${HANDWRITING_TEMPLATE_CONFIG.width} ${HANDWRITING_TEMPLATE_CONFIG.height}`}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                  >
                    {getTemplateCells().map((cell) => (
                      <g key={`${cell.character}-${cell.row}-${cell.col}`}>
                        <rect
                          x={cell.x}
                          y={cell.y}
                          width={cell.width}
                          height={cell.height}
                          rx={HANDWRITING_TEMPLATE_CONFIG.cornerRadius}
                          fill="none"
                          stroke="rgba(37,99,235,0.35)"
                          strokeWidth="2"
                        />
                        <text
                          x={cell.x + 6}
                          y={cell.y + HANDWRITING_TEMPLATE_CONFIG.labelOffsetY}
                          fill="rgba(27,83,124,0.9)"
                          fontSize="13"
                          fontFamily="system-ui"
                        >
                          {cell.character}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-neutral-200 bg-surface-50 p-4">
                  <p className="text-sm font-medium text-neutral-800">Alignment check</p>
                  <p className="mt-2 text-sm text-neutral-500">
                    The grid overlay should sit directly over the printed boxes. If it drifts badly, retake the photo before generating.
                  </p>
                </div>

                {uploadWarning ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {uploadWarning}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
                    The upload looks good enough to process.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-panel border border-neutral-200 bg-white p-4">
          <h5 className="text-sm font-semibold text-neutral-800">Step 3. Process the upload</h5>
          <p className="mt-1 text-sm text-neutral-500">
            Everything runs locally in a worker so the UI stays responsive while the font is built.
          </p>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-surface-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-neutral-700">
                {progress ? PROCESS_STAGE_LABELS[progress.stage] : 'Waiting to start'}
              </span>
              <span className="text-sm text-neutral-500">{progressPercent}%</span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="mt-3 text-sm text-neutral-500">
              {progress?.message ?? 'Upload a photo, then run the processing pipeline.'}
            </p>
          </div>
        </div>

        <div className="rounded-panel border border-neutral-200 bg-white p-4">
          <h5 className="text-sm font-semibold text-neutral-800">Step 4. Preview and use the font</h5>
          <p className="mt-1 text-sm text-neutral-500">
            Once the font is saved, you can select it like any other handwriting preset.
          </p>

          {generatedFont ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
              <div className="space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-neutral-700">Preview Text</span>
                  <textarea
                    value={sampleText}
                    onChange={(event) => {
                      setSampleText(event.target.value);
                    }}
                    rows={5}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 focus:border-primary-500 focus:outline-none"
                  />
                </label>

                <div className="rounded-2xl border border-[#e7dcc7] bg-[#faf8f4] p-4 shadow-paper">
                  <p
                    className="whitespace-pre-wrap text-[1.65rem] leading-[1.85] text-neutral-900"
                    style={{ fontFamily: MY_HANDWRITING_FONT_FAMILY }}
                  >
                    {sampleText}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-neutral-200 bg-surface-50 p-4 text-sm text-neutral-600">
                  <p>
                    Generated glyphs: <strong className="text-neutral-900">{generatedFont.glyphCount}</strong>
                  </p>
                  <p className="mt-2">
                    Skipped cells:{' '}
                    <strong className="text-neutral-900">
                      {generatedFont.skippedCharacters.length}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onSelectFont}
                  className="min-h-11 w-full rounded-2xl bg-primary-600 px-4 text-sm font-medium text-white shadow-paper transition hover:bg-primary-700"
                >
                  Use My Handwriting
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadGeneratedFont(generatedFont.buffer, generatedFont.filename);
                  }}
                  className="min-h-11 w-full rounded-2xl border border-primary-200 bg-white px-4 text-sm font-medium text-primary-700 transition hover:border-primary-400"
                >
                  Download Font File
                </button>

                {generatedFont.skippedCharacters.length > 0 ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    A few cells were skipped: {generatedFont.skippedCharacters.join(' ')}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-surface-50 px-4 py-5 text-sm text-neutral-500">
              Your generated font preview will appear here after processing finishes.
            </div>
          )}
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
};
