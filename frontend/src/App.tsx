import { Suspense, lazy, useRef } from 'react';

import { AppShell } from '@components/layout/AppShell';
import { BottomSheet } from '@components/ui/BottomSheet';
import { TextInputPanel } from '@features/editor';
import { PaperPreview } from '@features/preview';
import { useAppStore } from '@store/useAppStore';

// WHY: Export pulls in PDF tooling, so lazy loading keeps that heavy bundle off the first paint path.
const LazyExportMenu = lazy(async () => {
  const module = await import('@features/export');

  return {
    default: module.ExportMenu,
  };
});

// WHY: Settings are secondary to typing, so lazy loading trims the initial JS work before the user asks for them.
const LazySettingsPanel = lazy(async () => {
  const module = await import('@features/settings');

  return {
    default: module.SettingsPanel,
  };
});

const PanelFallback = ({ label }: { label: string }): JSX.Element => (
  <div className="rounded-panel border border-neutral-200 bg-white/80 p-4 shadow-paper">
    <p className="text-sm text-neutral-500">{label}</p>
  </div>
);

const TabletSettingsSummary = (): JSX.Element => (
  <details className="rounded-panel border border-neutral-200 bg-white/80 shadow-paper">
    <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-primary-700">
      <span>Handwriting settings</span>
      <span className="text-xs uppercase tracking-[0.12em] text-neutral-500">Expand</span>
    </summary>

    <div className="border-t border-neutral-100 p-2">
      <Suspense fallback={<PanelFallback label="Loading settings..." />}>
        <LazySettingsPanel />
      </Suspense>
    </div>
  </details>
);

const DesktopExportFallback = (): JSX.Element => (
  <div className="hidden h-11 items-center rounded-full border border-primary-100 bg-white px-4 text-sm text-neutral-500 shadow-paper lg:inline-flex">
    Loading export...
  </div>
);

const DesktopSettingsPanel = (): JSX.Element => (
  <Suspense fallback={<PanelFallback label="Loading settings..." />}>
    <LazySettingsPanel />
  </Suspense>
);

const App = (): JSX.Element => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeMobileTab = useAppStore((state) => state.activeMobileTab);
  const setActiveMobileTab = useAppStore((state) => state.setActiveMobileTab);
  const isSettingsSheetOpen = useAppStore((state) => state.isSettingsSheetOpen);
  const openSettingsSheet = useAppStore((state) => state.openSettingsSheet);
  const closeSettingsSheet = useAppStore((state) => state.closeSettingsSheet);
  const isExportSheetOpen = useAppStore((state) => state.isExportSheetOpen);
  const openExportSheet = useAppStore((state) => state.openExportSheet);
  const closeExportSheet = useAppStore((state) => state.closeExportSheet);

  return (
    <AppShell
      topBar={
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Text-to-Handwriting</h1>
            <p className="text-sm text-neutral-500">
              Draft, style, and preview handwritten pages with page-aware rendering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Suspense fallback={<DesktopExportFallback />}>
              <div className="hidden lg:block">
                <LazyExportMenu canvasRef={previewCanvasRef} />
              </div>
            </Suspense>

            <button
              type="button"
              onClick={openSettingsSheet}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-primary-100 bg-white px-4 text-sm font-medium text-primary-700 shadow-paper transition hover:border-primary-500 md:hidden"
            >
              Settings
            </button>
          </div>
        </div>
      }
      editor={<TextInputPanel />}
      desktopSettings={<DesktopSettingsPanel />}
      tabletSettings={<TabletSettingsSummary />}
      preview={<PaperPreview canvasRef={previewCanvasRef} />}
      mobilePreview={<PaperPreview canvasRef={previewCanvasRef} compact />}
      mobileActiveTab={activeMobileTab}
      tabletFab={
        <button
          type="button"
          onClick={() => {
            if (isExportSheetOpen) {
              closeExportSheet();
              return;
            }

            openExportSheet();
          }}
          className="fixed bottom-6 right-6 z-30 hidden min-h-14 min-w-14 items-center justify-center rounded-full bg-primary-600 px-5 text-sm font-medium text-white shadow-paper-lg transition hover:bg-primary-700 md:inline-flex lg:hidden"
        >
          Download
        </button>
      }
      mobileTabBar={
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveMobileTab('edit');
              }}
              className={`min-h-11 rounded-2xl px-3 text-sm font-medium transition ${
                activeMobileTab === 'edit'
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-white text-neutral-600'
              }`}
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMobileTab('preview');
              }}
              className={`min-h-11 rounded-2xl px-3 text-sm font-medium transition ${
                activeMobileTab === 'preview'
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-white text-neutral-600'
              }`}
            >
              Preview
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMobileTab('preview');
                openExportSheet();
              }}
              className="min-h-11 rounded-2xl bg-primary-600 px-3 text-sm font-medium text-white shadow-paper"
            >
              Export
            </button>
          </div>
        </nav>
      }
      modalLayer={
        <>
          <div className="fixed bottom-24 right-6 z-40 hidden md:block lg:hidden">
            {isExportSheetOpen ? (
              <div className="rounded-panel border border-neutral-200 bg-white p-3 shadow-paper-lg">
                <Suspense fallback={<PanelFallback label="Loading export tools..." />}>
                  <LazyExportMenu canvasRef={previewCanvasRef} />
                </Suspense>
              </div>
            ) : null}
          </div>

          <BottomSheet isOpen={isSettingsSheetOpen} title="Handwriting settings" onClose={closeSettingsSheet}>
            <Suspense fallback={<PanelFallback label="Loading settings..." />}>
              <LazySettingsPanel />
            </Suspense>
          </BottomSheet>

          <BottomSheet isOpen={isExportSheetOpen} title="Export options" onClose={closeExportSheet}>
            <Suspense fallback={<PanelFallback label="Loading export tools..." />}>
              <LazyExportMenu canvasRef={previewCanvasRef} />
            </Suspense>
          </BottomSheet>
        </>
      }
    />
  );
};

export default App;
