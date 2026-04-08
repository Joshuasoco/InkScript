import type { ReactNode } from 'react';

interface AppShellProps {
  topBar: ReactNode;
  editor: ReactNode;
  settings?: ReactNode;
  preview: ReactNode;
}

export const AppShell = ({ topBar, editor, settings, preview }: AppShellProps): JSX.Element => {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-7xl">{topBar}</div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        <section className="space-y-4">
          {editor}
          {settings}
        </section>

        <section>{preview}</section>
      </main>
    </div>
  );
};
