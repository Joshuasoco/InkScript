import { AppShell } from '@components/layout/AppShell';
import { TextInputPanel } from '@features/editor';
import { PaperPreview } from '@features/preview';
import { SettingsPanel } from '@features/settings';
import { useAppStore } from '@store/useAppStore';

const App = (): JSX.Element => {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const toggleSettings = useAppStore((state) => state.toggleSettings);

  return (
    <AppShell
      topBar={
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Text-to-Handwriting</h1>
            <p className="text-sm text-neutral-500">
              Draft, style, and preview handwritten pages in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSettings}
            className="h-11 rounded-full border border-primary-100 bg-white px-4 text-sm font-medium text-primary-700 transition hover:border-primary-500"
          >
            {isSettingsOpen ? 'Hide settings' : 'Show settings'}
          </button>
        </div>
      }
      editor={<TextInputPanel />}
      settings={isSettingsOpen ? <SettingsPanel /> : null}
      preview={<PaperPreview />}
    />
  );
};

export default App;
