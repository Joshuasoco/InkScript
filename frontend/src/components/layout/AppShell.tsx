import type { ReactNode } from 'react';

interface AppShellProps {
  topBar: ReactNode;
  editor: ReactNode;
  desktopSettings?: ReactNode;
  tabletSettings?: ReactNode;
  preview: ReactNode;
  mobilePreview: ReactNode;
  mobileActiveTab: 'edit' | 'preview';
  tabletFab?: ReactNode;
  mobileTabBar?: ReactNode;
  modalLayer?: ReactNode;
}

export const AppShell = ({
  topBar,
  editor,
  desktopSettings,
  tabletSettings,
  preview,
  mobilePreview,
  mobileActiveTab,
  tabletFab,
  mobileTabBar,
  modalLayer,
}: AppShellProps): JSX.Element => {
  return (
    <div className="min-h-screen min-w-[320px]">
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-7xl">{topBar}</div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-4 md:pb-6">
        <section className="md:hidden">
          {mobileActiveTab === 'edit' ? editor : mobilePreview}
        </section>

        <section className="hidden md:grid md:gap-4 lg:hidden">
          {editor}
          {tabletSettings}
          {preview}
        </section>

        <section className="hidden lg:grid lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-4">
          <div className="space-y-4">
            {editor}
            {desktopSettings}
          </div>

          <div>{preview}</div>
        </section>
      </main>

      {tabletFab}
      {mobileTabBar}
      {modalLayer}
    </div>
  );
};
