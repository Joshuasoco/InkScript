import { useRef } from 'react';

import { AppShell } from '@components/layout/AppShell';
import { TextInputPanel } from '@features/editor';
import { ExportMenu } from '@features/export';
import { PaperPreview } from '@features/preview';
import { SettingsPanel } from '@features/settings';
import { useAppStore } from '@store/useAppStore';

const App = (): JSX.Element => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const toggleSettings = useAppStore((state) => state.toggleSettings);

  return (
    <AppShell
      topBar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Text-to-Handwriting</h1>
            <p className="text-sm text-neutral-500">
              Draft, style, and preview handwritten pages in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-start justify-end gap-3">
            <ExportMenu canvasRef={previewCanvasRef} />
            <button
              type="button"
              onClick={toggleSettings}
              className="h-11 rounded-full border border-primary-100 bg-white px-4 text-sm font-medium text-primary-700 transition hover:border-primary-500"
            >
              {isSettingsOpen ? 'Hide settings' : 'Show settings'}
            </button>
          </div>
        </div>
      }
      editor={<TextInputPanel />}
      settings={isSettingsOpen ? <SettingsPanel /> : null}
      preview={<PaperPreview canvasRef={previewCanvasRef} />}
    />
  );
};

export default App;
