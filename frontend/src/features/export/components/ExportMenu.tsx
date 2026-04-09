import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { exportAsPDF, exportAsPNG, type ExportStatus } from '../exportService';

type ExportFormat = 'png' | 'pdf';
type ToastTone = 'success' | 'error';

interface ExportMenuProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  defaultFilename?: string;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  actionLabel?: string;
  onAction?: (() => void) | undefined;
}

const STATUS_COPY: Record<ExportStatus, string> = {
  preparing: 'Preparing export...',
  rendering: 'Rendering file...',
  done: 'Wrapping up...',
};

const Spinner = (): JSX.Element => (
  <span
    aria-hidden="true"
    className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600"
  />
);

const Toast = ({
  tone,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  tone: ToastTone;
  message: string;
  actionLabel?: string;
  onAction?: (() => void) | undefined;
  onDismiss: () => void;
}): JSX.Element => {
  const [isVisible, setIsVisible] = useState(false);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setIsVisible(true);
    }, 10);
    const hideTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, 3000);
    const removeTimer = window.setTimeout(() => {
      dismissRef.current();
    }, 3250);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto flex min-w-[18rem] max-w-sm items-start gap-3 rounded-panel border px-4 py-3 shadow-paper-lg transition duration-300 ${
        tone === 'success'
          ? 'border-accent-100 bg-white text-neutral-900'
          : 'border-error-100 bg-white text-neutral-900'
      } ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1 h-2.5 w-2.5 rounded-full ${
          tone === 'success' ? 'bg-accent-500' : 'bg-error-500'
        }`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={() => {
              onDismiss();
              onAction();
            }}
            className="mt-2 text-sm font-medium text-primary-700 underline decoration-primary-200 underline-offset-4"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="text-sm text-neutral-500 transition hover:text-neutral-900"
        aria-label="Dismiss notification"
      >
        Close
      </button>
    </div>
  );
};

export const ExportMenu = ({
  canvasRef,
  defaultFilename = 'handwriting-export',
}: ExportMenuProps): JSX.Element => {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const dismissToast = (id: number): void => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  };

  const pushToast = (
    tone: ToastTone,
    message: string,
    actionLabel?: string,
    onAction?: (() => void) | undefined,
  ): void => {
    const nextToast: ToastItem = {
      id: Date.now() + Math.round(Math.random() * 1000),
      tone,
      message,
      actionLabel,
      onAction,
    };

    setToasts((currentToasts) => [...currentToasts, nextToast]);
  };

  const runExport = async (format: ExportFormat): Promise<void> => {
    if (isExporting) {
      return;
    }

    setIsOpen(false);
    setIsExporting(true);
    setStatus('preparing');
    setSelectedFormat(format);

    const progressHandler = (nextStatus: ExportStatus): void => {
      if (nextStatus === 'done') {
        return;
      }

      setStatus(nextStatus);
    };

    const result =
      format === 'png'
        ? await exportAsPNG(canvasRef, defaultFilename, progressHandler)
        : await exportAsPDF(canvasRef, defaultFilename, progressHandler);

    setIsExporting(false);
    setStatus(null);

    if (result.success) {
      pushToast('success', 'Downloaded successfully!');
      return;
    }

    pushToast('error', result.error, 'Retry', () => {
      void runExport(format);
    });
  };

  return (
    <>
      <div ref={containerRef} className="relative flex flex-col items-end gap-2">
        <div className="flex items-center rounded-full border border-primary-100 bg-white shadow-paper">
          <button
            type="button"
            onClick={() => {
              void runExport(selectedFormat);
            }}
            disabled={isExporting}
            className="inline-flex h-11 items-center gap-2 rounded-l-full px-4 text-sm font-medium text-primary-700 transition hover:bg-primary-50 disabled:cursor-wait disabled:text-neutral-500"
          >
            {isExporting ? <Spinner /> : null}
            <span>Download</span>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs uppercase tracking-[0.12em] text-primary-700">
              {selectedFormat}
            </span>
          </button>

          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={menuId}
            onClick={() => {
              if (isExporting) {
                return;
              }

              setIsOpen((currentValue) => !currentValue);
            }}
            disabled={isExporting}
            className="inline-flex h-11 items-center justify-center rounded-r-full border-l border-primary-100 px-3 text-primary-700 transition hover:bg-primary-50 disabled:cursor-wait disabled:text-neutral-500"
          >
            <span className="sr-only">Choose download format</span>
            <span aria-hidden="true" className={`text-xs transition ${isOpen ? 'rotate-180' : ''}`}>
              v
            </span>
          </button>
        </div>

        <div className="min-h-[1.25rem] text-right">
          {isExporting && status ? (
            <p aria-live="polite" className="text-sm text-neutral-500">
              {STATUS_COPY[status]}
            </p>
          ) : null}
        </div>

        {isOpen ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Download format"
            className="absolute right-0 top-[calc(100%+0.25rem)] z-30 w-44 rounded-panel border border-neutral-200 bg-white p-2 shadow-paper-lg"
          >
            {(['png', 'pdf'] as const).map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                onClick={() => {
                  void runExport(format);
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm transition ${
                  selectedFormat === format
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span>{format.toUpperCase()}</span>
                {selectedFormat === format ? <span aria-hidden="true">Selected</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            tone={toast.tone}
            message={toast.message}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
            onDismiss={() => {
              dismissToast(toast.id);
            }}
          />
        ))}
      </div>
    </>
  );
};
